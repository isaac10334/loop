//! Real asynchronous Component entry: semantic event -> granted CAS -> next frame.
wit_bindgen::generate!({ path: "wit", world: "semantic-tool", generate_all });
use serde::Deserialize;
struct Tool;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Event {
    revision: u32,
    sequence: u32,
    key: String,
    r#type: String,
}
impl Guest for Tool {
    async fn run(document: &Document, surface: &Surface) -> Result<String, Failure> {
        surface.render(r#"{"revision":0,"root":{"type":"button","key":"replace","label":"Replace document","text":"Replace document"}}"#);
        let Some(event) = surface.next_event().await else { return Err(Failure::Cancelled); };
        if event.len() > 65_536 { return Err(Failure::InvalidSource("event byte budget exceeded".into())); }
        let event: Event = serde_json::from_str(&event).map_err(|_| Failure::InvalidSource("invalid semantic event".into()))?;
        if event.revision != 0 || event.sequence != 1 || event.key != "replace" || event.r#type != "activate" {
            return Err(Failure::InvalidSource("stale or unknown semantic event".into()));
        }
        let before = document.read().await?;
        let source = before.source.replace("hello", "semantic");
        if source.len() > 1_048_576 { return Err(Failure::InvalidSource("source byte budget exceeded".into())); }
        let after = document.write(before.revision, source).await?;
        let frame = serde_json::json!({"revision":1,"root":{"type":"text","key":"result","text":after.source}});
        surface.render(&frame.to_string());
        Ok(format!("revision={};source={}", after.revision, after.source))
    }
}
export!(Tool);
