//! Checked frame/event owner shared by Component and trusted TS presentation.
use crate::document_runtime::SurfacePort;
use serde_json::Value;
use std::{
    collections::{BTreeMap, VecDeque},
    sync::{
        Arc, Mutex,
        atomic::{AtomicUsize, Ordering},
    },
};
use tokio::sync::Notify;
use wasmtime::error::ensure;
/// Strict bounded JSON rejects duplicate decoded keys instead of last-writer-wins.
pub(crate) fn decode(bytes: &[u8]) -> wasmtime::Result<Value> {
    use serde::de::{DeserializeSeed, Error, MapAccess, SeqAccess, Visitor};
    struct Seed(usize);
    impl<'de> DeserializeSeed<'de> for Seed {
        type Value = Value;
        fn deserialize<D: serde::Deserializer<'de>>(self, d: D) -> Result<Value, D::Error> {
            if self.0 > 64 {
                return Err(D::Error::custom("JSON depth"));
            }
            d.deserialize_any(self)
        }
    }
    impl<'de> Visitor<'de> for Seed {
        type Value = Value;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("bounded finite JSON")
        }
        fn visit_bool<E: Error>(self, v: bool) -> Result<Value, E> {
            Ok(Value::Bool(v))
        }
        fn visit_i64<E: Error>(self, v: i64) -> Result<Value, E> {
            Ok(Value::from(v))
        }
        fn visit_u64<E: Error>(self, v: u64) -> Result<Value, E> {
            Ok(Value::from(v))
        }
        fn visit_f64<E: Error>(self, v: f64) -> Result<Value, E> {
            serde_json::Number::from_f64(v)
                .map(Value::Number)
                .ok_or_else(|| E::custom("finite JSON"))
        }
        fn visit_str<E: Error>(self, v: &str) -> Result<Value, E> {
            Ok(Value::String(v.into()))
        }
        fn visit_string<E: Error>(self, v: String) -> Result<Value, E> {
            Ok(Value::String(v))
        }
        fn visit_unit<E: Error>(self) -> Result<Value, E> {
            Ok(Value::Null)
        }
        fn visit_none<E: Error>(self) -> Result<Value, E> {
            Ok(Value::Null)
        }
        fn visit_seq<A: SeqAccess<'de>>(self, mut a: A) -> Result<Value, A::Error> {
            let mut out = Vec::new();
            while let Some(v) = a.next_element_seed(Seed(self.0 + 1))? {
                out.push(v);
            }
            Ok(Value::Array(out))
        }
        fn visit_map<A: MapAccess<'de>>(self, mut a: A) -> Result<Value, A::Error> {
            let mut out = serde_json::Map::new();
            while let Some(key) = a.next_key::<String>()? {
                if out.contains_key(&key) {
                    return Err(A::Error::custom("duplicate JSON key"));
                }
                out.insert(key, a.next_value_seed(Seed(self.0 + 1))?);
            }
            Ok(Value::Object(out))
        }
    }
    let mut d = serde_json::Deserializer::from_slice(bytes);
    let v = Seed(0).deserialize(&mut d)?;
    d.end()?;
    Ok(v)
}
struct State {
    revision: Option<u64>,
    sequence: u64,
    controls: BTreeMap<String, Value>,
    events: VecDeque<String>,
    closed: bool,
}
/// Narrow surface owner. Render callback only sees validated bounded JSON; events
/// are checked against the current rendered controls, revision and monotonic sequence.
pub struct NativeSurface {
    state: Mutex<State>,
    wake: Notify,
    pending: AtomicUsize,
    render: Box<dyn Fn(String) -> wasmtime::Result<()> + Send + Sync>,
}
impl NativeSurface {
    pub fn new(
        render: impl Fn(String) -> wasmtime::Result<()> + Send + Sync + 'static,
    ) -> Arc<Self> {
        Arc::new(Self {
            state: Mutex::new(State {
                revision: None,
                sequence: 0,
                controls: BTreeMap::new(),
                events: VecDeque::new(),
                closed: false,
            }),
            wake: Notify::new(),
            pending: AtomicUsize::new(0),
            render: Box::new(render),
        })
    }
    pub fn pending(&self) -> usize {
        self.pending.load(Ordering::SeqCst)
    }
    pub(crate) fn take_queued_event(&self) -> Option<String> {
        self.state.lock().unwrap().events.pop_front()
    }
    pub fn submit_event(&self, text: &str) -> wasmtime::Result<()> {
        ensure!(text.len() <= 8192, "event byte budget");
        let v: Value = decode(text.as_bytes())?;
        let obj = v
            .as_object()
            .ok_or_else(|| wasmtime::Error::msg("event object"))?;
        ensure!(
            obj.keys()
                .all(|k| ["revision", "sequence", "key", "type", "value"].contains(&k.as_str())),
            "unknown event field"
        );
        let mut p = self.state.lock().unwrap();
        ensure!(
            !p.closed && p.events.len() < 16,
            "closed or full event queue"
        );
        ensure!(v["revision"].as_u64() == p.revision, "stale event revision");
        let seq = v["sequence"]
            .as_u64()
            .filter(|s| *s > p.sequence && *s <= 9_007_199_254_740_991)
            .ok_or_else(|| wasmtime::Error::msg("stale event sequence"))?;
        let key = v["key"]
            .as_str()
            .ok_or_else(|| wasmtime::Error::msg("event key"))?;
        let kind = p
            .controls
            .get(key)
            .ok_or_else(|| wasmtime::Error::msg("disabled or unknown event key"))?;
        match (kind["type"].as_str(), v["type"].as_str()) {
            (Some("button"), Some("activate")) => {
                ensure!(v.get("value").is_none(), "activate value")
            }
            (Some("input" | "select"), Some("change")) => ensure!(
                v["value"].as_str().is_some_and(|s| s.len() <= 4096),
                "event value"
            ),
            (Some("toggle"), Some("change")) => ensure!(v["value"].is_boolean(), "toggle value"),
            _ => wasmtime::error::bail!("event type mismatch"),
        }
        if kind["type"] == "select" {
            ensure!(
                kind["options"].as_array().is_some_and(|options| options
                    .iter()
                    .any(|option| option["value"] == v["value"])),
                "unknown selection"
            );
        }
        p.sequence = seq;
        p.events.push_back(text.into());
        drop(p);
        self.wake.notify_one();
        Ok(())
    }
}
fn visit(
    v: &Value,
    depth: usize,
    count: &mut usize,
    keys: &mut BTreeMap<String, String>,
    controls: &mut BTreeMap<String, Value>,
) -> wasmtime::Result<()> {
    *count += 1;
    ensure!(*count <= 512 && depth <= 16, "node budget");
    let obj = v
        .as_object()
        .ok_or_else(|| wasmtime::Error::msg("node object"))?;
    ensure!(
        obj.keys().all(|k| [
            "key", "type", "label", "text", "value", "disabled", "loading", "tone", "children",
            "options"
        ]
        .contains(&k.as_str())),
        "unsupported node field"
    );
    let key = v["key"]
        .as_str()
        .filter(|s| {
            !s.is_empty()
                && s.len() <= 120
                && s.bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"_:./-".contains(&b))
        })
        .ok_or_else(|| wasmtime::Error::msg("node key"))?;
    let kind = v["type"]
        .as_str()
        .ok_or_else(|| wasmtime::Error::msg("node type"))?;
    ensure!(
        [
            "column", "row", "text", "button", "input", "toggle", "select"
        ]
        .contains(&kind),
        "unsupported native semantic element"
    );
    ensure!(
        keys.insert(key.into(), kind.into()).is_none(),
        "duplicate node key"
    );
    for name in ["text", "label"] {
        if let Some(t) = v.get(name) {
            ensure!(
                t.as_str().is_some_and(|s| s.len() <= 4096),
                "node text budget"
            );
        }
    }
    for name in ["disabled", "loading"] {
        if let Some(b) = v.get(name) {
            ensure!(b.is_boolean(), "node boolean");
        }
    }
    if let Some(t) = v.get("tone") {
        ensure!(
            t.as_str()
                .is_some_and(|s| ["default", "muted", "danger", "accent"].contains(&s)),
            "node tone"
        );
    }
    if ["button", "input", "toggle", "select"].contains(&kind) {
        ensure!(
            v["label"].as_str().is_some_and(|s| !s.trim().is_empty()),
            "accessible label required"
        );
        if v["disabled"] != true && v["loading"] != true {
            controls.insert(key.into(), v.clone());
        }
    }
    if let Some(value) = v.get("value") {
        ensure!(
            (kind == "toggle" && value.is_boolean())
                || (["input", "select"].contains(&kind)
                    && value.as_str().is_some_and(|s| s.len() <= 4096)),
            "node value"
        );
    }
    if let Some(options) = v.get("options") {
        ensure!(kind == "select", "options only on select");
        let options = options
            .as_array()
            .ok_or_else(|| wasmtime::Error::msg("options array"))?;
        ensure!(options.len() <= 128, "options budget");
        for option in options {
            let o = option
                .as_object()
                .ok_or_else(|| wasmtime::Error::msg("option object"))?;
            ensure!(
                o.len() == 2
                    && o.get("value")
                        .and_then(Value::as_str)
                        .is_some_and(|s| s.len() <= 256)
                    && o.get("label")
                        .and_then(Value::as_str)
                        .is_some_and(|s| s.len() <= 256),
                "option fields"
            );
        }
    }
    if let Some(children) = v.get("children") {
        ensure!(["row", "column"].contains(&kind), "leaf children");
        for child in children
            .as_array()
            .ok_or_else(|| wasmtime::Error::msg("children array"))?
        {
            visit(child, depth + 1, count, keys, controls)?;
        }
    }
    Ok(())
}
struct Pending<'a>(&'a AtomicUsize);
impl Drop for Pending<'_> {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}
impl SurfacePort for NativeSurface {
    fn render(&self, text: String) -> wasmtime::Result<()> {
        ensure!(text.len() <= 65536, "frame byte budget");
        let v: Value = decode(text.as_bytes())?;
        let obj = v
            .as_object()
            .ok_or_else(|| wasmtime::Error::msg("frame object"))?;
        ensure!(obj.len() == 2 && obj.contains_key("root"), "frame fields");
        let revision = v["revision"]
            .as_u64()
            .filter(|r| *r <= 9_007_199_254_740_991)
            .ok_or_else(|| wasmtime::Error::msg("frame revision"))?;
        let mut controls = BTreeMap::new();
        visit(&v["root"], 0, &mut 0, &mut BTreeMap::new(), &mut controls)?;
        let mut p = self.state.lock().unwrap();
        ensure!(
            !p.closed && revision == p.revision.map_or(0, |r| r + 1),
            "closed or stale frame"
        );
        p.revision = Some(revision);
        p.controls = controls;
        p.events.clear();
        drop(p);
        // Presentation is trusted but may reenter lifecycle APIs. Never call it
        // under the policy lock; a failed publication closes rather than retries.
        if let Err(error) = (self.render)(text) {
            self.close();
            return Err(error);
        }
        Ok(())
    }
    fn next_event(
        &self,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Option<String>> + Send + '_>> {
        Box::pin(async move {
            if self
                .pending
                .compare_exchange(0, 1, Ordering::SeqCst, Ordering::SeqCst)
                .is_err()
            {
                return None;
            }
            let _pending = Pending(&self.pending);
            loop {
                let wake = self.wake.notified();
                tokio::pin!(wake);
                wake.as_mut().enable();
                {
                    let mut p = self.state.lock().unwrap();
                    if p.closed {
                        return None;
                    }
                    if let Some(v) = p.events.pop_front() {
                        return Some(v);
                    }
                }
                wake.await;
            }
        })
    }
    fn close(&self) {
        let mut p = self.state.lock().unwrap();
        p.closed = true;
        p.events.clear();
        drop(p);
        self.wake.notify_waiters();
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn strict_json_and_selection_limits() {
        assert!(decode(br#"{"x":1,"\u0078":2}"#).is_err());
        assert!(decode(br#"{"x":1} trailing"#).is_err());
        let s = NativeSurface::new(|_| Ok(()));
        assert!(
            s.render(r#"{"revision":1,"root":{"key":"x","type":"text"}}"#.into())
                .is_err()
        );
        s.render(r#"{"revision":0,"root":{"key":"choice","type":"select","label":"Choice","options":[{"value":"allowed","label":"Allowed"}]}}"#.into()).unwrap();
        assert!(
            s.submit_event(
                r#"{"revision":0,"sequence":1,"key":"choice","type":"change","value":"unknown"}"#
            )
            .is_err()
        );
        s.submit_event(
            r#"{"revision":0,"sequence":1,"key":"choice","type":"change","value":"allowed"}"#,
        )
        .unwrap();
        assert!(
            s.render(r#"{"revision":2,"root":{"key":"x","type":"text"}}"#.into())
                .is_err()
        );
    }
    #[tokio::test]
    async fn publication_failure_closes_pending_reads() {
        let s = NativeSurface::new(|_| Err(wasmtime::Error::msg("presentation failed")));
        assert!(
            s.render(r#"{"revision":0,"root":{"key":"x","type":"text"}}"#.into())
                .is_err()
        );
        assert_eq!(s.next_event().await, None);
    }
    #[tokio::test]
    async fn close_cancels_before_join() {
        let s = NativeSurface::new(|_| Ok(()));
        let read = s.next_event();
        let close = async {
            s.close();
        };
        let (out, _) = tokio::join!(read, close);
        assert_eq!(out, None);
        assert_eq!(s.pending(), 0);
    }
    #[test]
    fn stale_disabled_and_unknown_events() {
        let s = NativeSurface::new(|_| Ok(()));
        s.render(r#"{"revision":0,"root":{"key":"replace","type":"button","label":"Replace","text":"Run"}}"#.into()).unwrap();
        let event = r#"{"revision":0,"sequence":1,"key":"replace","type":"activate"}"#;
        s.submit_event(event).unwrap();
        assert!(s.submit_event(event).is_err());
        assert!(
            s.submit_event(r#"{"revision":9,"sequence":2,"key":"replace","type":"activate"}"#)
                .is_err()
        );
        assert!(
            s.render(r#"{"revision":0,"root":{"key":"x","type":"text"}}"#.into())
                .is_err()
        );
    }
}
