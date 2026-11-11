//! Explicit config-mode commands; legacy parsing and execution remain in main/dev.
use crate::config_process::{ConfigProcess, strict_value};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    path::PathBuf,
    time::{Duration, Instant},
};

// The browser may spend five seconds waiting for disposal acknowledgements;
// leave additional time for server, plugin, and owner cleanup before escalation.
const FOREGROUND_STOP_GRACE: Duration = Duration::from_secs(10);
// A separate stop client must wait longer than the foreground cleanup grace.
const STOP_ACK_GRACE: Duration = Duration::from_secs(12);

fn stopping_expired(state: Option<&str>, since: &mut Option<Instant>, now: Instant) -> bool {
    if state != Some("stopping") {
        *since = None;
        return false;
    }
    let started = *since.get_or_insert(now);
    now.saturating_duration_since(started) >= FOREGROUND_STOP_GRACE
}
#[derive(Debug, Default)]
pub struct KitRequest {
    pub operation: String,
    pub root: PathBuf,
    pub config: Option<PathBuf>,
    pub target: Option<String>,
    pub instance: Option<String>,
    pub trust_local_config: bool,
    pub plan: Option<PathBuf>,
    pub json: bool,
    pub kit: Option<String>,
    pub port: Option<u16>,
    pub profile: Option<String>,
    pub release: bool,
    pub evaluate_config: bool,
}
#[derive(Debug)]
pub struct KitError {
    pub code: String,
    pub message: String,
}
impl std::fmt::Display for KitError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}
impl std::error::Error for KitError {}
impl KitError {
    pub fn exit_code(&self) -> i32 {
        if self.code.contains("CANCELLED") {
            130
        } else if self.code.contains("TRUST") {
            3
        } else if self.code.contains("PROTOCOL") {
            6
        } else if self.code.contains("BUSY")
            || self.code.contains("CONFLICT")
            || self.code.contains("STALE")
        {
            5
        } else if self.code.contains("RUNTIME")
            || self.code.contains("TOOL")
            || self.code.contains("BUILD")
        {
            4
        } else {
            2
        }
    }
}
impl From<String> for KitError {
    fn from(message: String) -> Self {
        let code = message.split(':').next().unwrap_or("E_RUNTIME").to_owned();
        Self { code, message }
    }
}
impl From<std::io::Error> for KitError {
    fn from(e: std::io::Error) -> Self {
        Self {
            code: "E_IO".into(),
            message: e.to_string(),
        }
    }
}
fn envelope(r: &KitRequest, executed: bool, result: Value) -> Value {
    json!({"schemaVersion":1,"operation":r.operation,"executedConfig":executed,"selected":{"target":r.target,"instance":r.instance},"result":result,"diagnostics":[],"status":"ok"})
}
fn validate_id(s: &str) -> Result<(), KitError> {
    if s.is_empty()
        || s.len() > 64
        || !s
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'.' || b == b'-')
        || s == "."
        || s == ".."
    {
        return Err("E_INSTANCE: invalid instance id".to_string().into());
    }
    Ok(())
}
fn find_launch(r: &KitRequest) -> Result<(PathBuf, Value), KitError> {
    let id = r
        .instance
        .as_deref()
        .ok_or_else(|| KitError::from("E_INSTANCE_REQUIRED: --instance is required".to_string()))?;
    validate_id(id)?;
    let base = r.root.canonicalize()?.join(".loop/instances");
    let mut candidates = Vec::new();
    if base.exists() {
        for target in std::fs::read_dir(base)? {
            let target = target?;
            if r.target
                .as_ref()
                .is_some_and(|t| target.file_name().to_string_lossy() != *t)
            {
                continue;
            }
            let instances = target.path().join(id);
            if !instances.is_dir() {
                continue;
            }
            for epoch in std::fs::read_dir(&instances)? {
                let p = epoch?.path().join("launch.json");
                if p.is_file() {
                    let value: Value = serde_json::from_slice(&std::fs::read(&p)?)
                        .map_err(|e| KitError::from(e.to_string()))?;
                    if matches!(
                        value["state"].as_str(),
                        Some(
                            "starting"
                                | "active"
                                | "awaiting-browser"
                                | "replacing"
                                | "stopping"
                                | "stopped"
                                | "failed"
                        )
                    ) {
                        candidates.push((p, value));
                    }
                }
            }
            // A reservation can exist before its starting record is published, or
            // publication can fail. Never report an older stopped epoch as success
            // while an observed lock belongs to a missing or terminal record.
            match std::fs::read_to_string(instances.join("active.lock")) {
                Ok(owner) => {
                    let matching = candidates.iter().find(|(path, value)| {
                        path.parent().and_then(|p| p.parent()) == Some(instances.as_path())
                            && value["epoch"].as_str() == Some(owner.as_str())
                    });
                    if matching.is_none_or(|(_, value)| {
                        !matches!(
                            value["state"].as_str(),
                            Some(
                                "starting"
                                    | "active"
                                    | "awaiting-browser"
                                    | "replacing"
                                    | "stopping"
                            )
                        )
                    }) {
                        return Err("E_RUNTIME_STOP: instance reservation has no matching live record; retry or recover explicitly".to_string().into());
                    }
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return Err(error.into()),
            }
        }
    }
    // A failed epoch that still owns the instance lock must never be hidden by
    // an older stopped record or by an inconsistent active record.
    for (path, value) in &candidates {
        if value["state"] != "failed" {
            continue;
        }
        let epoch = value["epoch"].as_str().ok_or_else(|| {
            KitError::from("E_INSTANCE: failed record has no epoch; recovery required".to_string())
        })?;
        let lock = path.parent().unwrap().parent().unwrap().join("active.lock");
        match std::fs::read_to_string(lock) {
            Ok(owner) if owner == epoch => {
                return Err(
                    "E_RUNTIME_STOP: failed epoch retains its reservation; recovery required"
                        .to_string()
                        .into(),
                );
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
    }
    // A live/stopping match on another target makes an omitted target unsafe.
    let live_targets: std::collections::HashSet<_> = candidates
        .iter()
        .filter(|(_, v)| {
            matches!(
                v["state"].as_str(),
                Some("starting" | "active" | "awaiting-browser" | "replacing" | "stopping")
            )
        })
        .map(|(_, v)| v["targetId"].as_str().unwrap_or(""))
        .collect();
    if live_targets.len() > 1 {
        return Err("E_INSTANCE: --target required for ambiguous live instance"
            .to_string()
            .into());
    }
    let active = candidates
        .iter()
        .filter(|(_, v)| {
            matches!(
                v["state"].as_str(),
                Some("starting" | "active" | "awaiting-browser" | "replacing")
            )
        })
        .count();
    if active == 1 {
        return Ok(candidates
            .into_iter()
            .find(|(_, v)| {
                matches!(
                    v["state"].as_str(),
                    Some("starting" | "active" | "awaiting-browser" | "replacing")
                )
            })
            .unwrap());
    }
    if active > 1 || candidates.is_empty() {
        return Err("E_INSTANCE: expected one unambiguous matching instance"
            .to_string()
            .into());
    }
    let stopping = candidates
        .iter()
        .filter(|(_, v)| v["state"] == "stopping")
        .count();
    if stopping == 1 {
        return Ok(candidates
            .into_iter()
            .find(|(_, v)| v["state"] == "stopping")
            .unwrap());
    }
    if stopping > 1 {
        return Err(
            "E_INSTANCE: multiple stopping epochs require explicit recovery"
                .to_string()
                .into(),
        );
    }
    let targets: std::collections::HashSet<_> = candidates
        .iter()
        .map(|(_, v)| v["targetId"].as_str().unwrap_or(""))
        .collect();
    if targets.len() != 1 {
        return Err(
            "E_INSTANCE: --target required for ambiguous stopped instance"
                .to_string()
                .into(),
        );
    }
    candidates.sort_by_key(|(path, _)| std::fs::metadata(path).and_then(|m| m.modified()).ok());
    Ok(candidates.pop().unwrap())
}
fn canonical_plan_json(value: &Value) -> String {
    match value {
        Value::Object(map) => {
            let mut entries: Vec<_> = map.iter().collect();
            entries.sort_by(|(a, _), (b, _)| a.encode_utf16().cmp(b.encode_utf16()));
            format!(
                "{{{}}}",
                entries
                    .into_iter()
                    .map(|(k, v)| format!(
                        "{}:{}",
                        serde_json::to_string(k).unwrap(),
                        canonical_plan_json(v)
                    ))
                    .collect::<Vec<_>>()
                    .join(",")
            )
        }
        Value::Array(values) => format!(
            "[{}]",
            values
                .iter()
                .map(canonical_plan_json)
                .collect::<Vec<_>>()
                .join(",")
        ),
        Value::Number(number) => {
            let raw = number.to_string();
            let f = number.as_f64().unwrap_or(0.0);
            if f == 0.0 {
                return "0".into();
            }
            let (mantissa, exponent) = raw
                .split_once(['e', 'E'])
                .map(|(m, e)| (m, e.parse::<i32>().unwrap_or(0)))
                .unwrap_or((&raw, 0));
            let negative = mantissa.starts_with('-');
            let unsigned = mantissa.trim_start_matches('-');
            let before = unsigned.find('.').unwrap_or(unsigned.len()) as i32;
            let mut digits = unsigned.replace('.', "");
            while digits.ends_with('0') && digits.len() > 1 {
                digits.pop();
            }
            let point = before + exponent;
            let sign = if negative { "-" } else { "" };
            if f.abs() >= 1e-6 && f.abs() < 1e21 {
                if point <= 0 {
                    format!("{sign}0.{}{digits}", "0".repeat((-point) as usize))
                } else if point as usize >= digits.len() {
                    format!(
                        "{sign}{digits}{}",
                        "0".repeat(point as usize - digits.len())
                    )
                } else {
                    format!(
                        "{sign}{}.{}",
                        &digits[..point as usize],
                        &digits[point as usize..]
                    )
                }
            } else {
                let exp = point - 1;
                let rest = if digits.len() > 1 {
                    format!(".{}", &digits[1..])
                } else {
                    String::new()
                };
                format!(
                    "{sign}{}{rest}e{}{exp}",
                    &digits[..1],
                    if exp >= 0 { "+" } else { "" }
                )
            }
        }
        _ => serde_json::to_string(value).unwrap(),
    }
}
fn verify_plan(plan: &Value) -> Result<(), KitError> {
    let invalid = || KitError::from("E_PLAN_SCHEMA: invalid inert HK1 plan".to_string());
    let fields = [
        "schemaVersion",
        "protocolVersion",
        "planId",
        "features",
        "targetId",
        "kind",
        "kit",
        "profile",
        "coordinator",
        "kitOptions",
        "hosts",
        "toolchain",
        "inputs",
        "plugins",
        "application",
        "dependencyEdges",
        "buildRecipes",
        "descriptors",
        "cache",
        "provenance",
    ];
    let object = plan.as_object().ok_or_else(invalid)?;
    if object.len() != fields.len()
        || fields.iter().any(|k| !object.contains_key(*k))
        || plan["schemaVersion"] != 1
        || plan["protocolVersion"] != 1
        || plan["cache"] != "disabled"
        || !matches!(plan["kind"].as_str(), Some("browser" | "desktop"))
    {
        return Err(invalid());
    }
    fn hex(v: &Value) -> bool {
        v.as_str().is_some_and(|s| {
            s.len() == 64
                && s.bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        })
    }
    fn identity(v: &Value) -> bool {
        v.as_object().is_some_and(|o| o.len() == 2)
            && v["id"].as_str().is_some_and(|s| s.contains(':'))
            && v["version"]
                .as_str()
                .is_some_and(|s| s.split('.').count() >= 3)
    }
    fn module(v: &Value) -> bool {
        v.as_object().is_some_and(|o| o.len() == 3)
            && v["specifier"].as_str().is_some_and(|s| !s.is_empty())
            && v["export"].as_str().is_some_and(|s| !s.is_empty())
            && hex(&v["sha256"])
    }
    if !hex(&plan["planId"])
        || !identity(&plan["kit"])
        || !identity(&plan["profile"])
        || !module(&plan["coordinator"])
        || !module(&plan["application"])
        || plan["targetId"].as_str().is_none()
    {
        return Err(invalid());
    }
    for name in [
        "features",
        "hosts",
        "toolchain",
        "plugins",
        "dependencyEdges",
        "buildRecipes",
    ] {
        if !plan[name].is_array() {
            return Err(invalid());
        }
    }
    for host in plan["hosts"].as_array().unwrap() {
        if host.as_object().is_none_or(|o| o.len() != 3)
            || host["key"].as_str().is_none()
            || !identity(&host["profile"])
            || !matches!(
                host["realm"].as_str(),
                Some("application" | "coordinator" | "guest-worker")
            )
        {
            return Err(invalid());
        }
    }
    let inputs = &plan["inputs"];
    if inputs.as_object().is_none_or(|o| o.len() != 4)
        || !hex(&inputs["configDigest"])
        || inputs["sourceSnapshotDigest"]
            .as_str()
            .is_none_or(|s| !s.starts_with("sha256:"))
        || !inputs["lockDigests"].is_array()
        || !inputs["modules"].is_array()
    {
        return Err(invalid());
    }
    for m in inputs["modules"].as_array().unwrap() {
        if !module(m) {
            return Err(invalid());
        }
    }
    for p in plan["plugins"].as_array().unwrap() {
        if p.as_object().is_none_or(|o| o.len() != 4)
            || !identity(&p["identity"])
            || p["key"].as_str().is_none()
            || !p["hooks"].is_array()
            || !p["contributions"].is_array()
        {
            return Err(invalid());
        }
        for h in p["hooks"].as_array().unwrap() {
            if !matches!(h.as_str(), Some("prepare" | "ready" | "quiesce")) {
                return Err(invalid());
            }
        }
        for c in p["contributions"].as_array().unwrap() {
            if c.as_object().is_none_or(|o| o.len() != 6)
                || !module(&c["entry"])
                || !c["requires"].is_array()
                || !c["provides"].is_array()
                || c["host"].as_str().is_none()
                || c["key"].as_str().is_none()
            {
                return Err(invalid());
            }
        }
    }
    let mut projection = object.clone();
    projection.remove("planId");
    projection.remove("provenance");
    let canonical = canonical_plan_json(&Value::Object(projection));
    let actual = format!("{:x}", Sha256::digest(canonical));
    if plan["planId"] != actual {
        return Err("E_PLAN_DIGEST: stored plan content differs from planId"
            .to_string()
            .into());
    }
    Ok(())
}
pub fn execute(r: KitRequest) -> Result<Value, KitError> {
    if r.operation == "create" {
        return scaffold(&r);
    }
    let root = r.root.canonicalize()?;
    if r.operation == "inspect" && !r.evaluate_config {
        if let Some(plan) = &r.plan {
            let bytes = std::fs::read(plan)?;
            if bytes.len() > 1_048_576 {
                return Err("E_PLAN_BUDGET: plan exceeds 1 MiB".to_string().into());
            }
            let value = strict_value(&bytes).map_err(KitError::from)?;
            verify_plan(&value)?;
            return Ok(envelope(
                &r,
                false,
                json!({"plan":value,"verified":"schema-and-content-digest"}),
            ));
        }
        let path = root.join(
            r.config
                .as_deref()
                .unwrap_or(std::path::Path::new("loop.config.ts")),
        );
        let config = std::fs::symlink_metadata(&path).ok();
        if config.as_ref().is_some_and(|m| m.file_type().is_symlink()) {
            return Err("E_CONFIG_ROOT: symlink config rejected".to_string().into());
        }
        return Ok(envelope(
            &r,
            false,
            json!({"projectRoot":root,"config":{"present":config.is_some(),"evaluated":false},"legacyManifest":root.join("loop.toml").is_file(),"sourceManifest":root.join("loop.package.json").is_file()}),
        ));
    }
    if r.operation == "restart" && !r.trust_local_config {
        return Err(
            "E_CONFIG_TRUST: restart requires --trust-local-config before stopping old instance"
                .to_string()
                .into(),
        );
    }
    let restart = if r.operation == "stop" || r.operation == "restart" {
        let (path, record) = find_launch(&r)?;
        if record["state"] == "failed" {
            return Err("E_RUNTIME_STOP: selected epoch failed; recovery required"
                .to_string()
                .into());
        }
        if matches!(
            record["state"].as_str(),
            Some("starting" | "active" | "awaiting-browser" | "replacing")
        ) {
            std::fs::write(path.parent().unwrap().join("stop.request"), b"stop\n")?;
        }
        let mut stopped = false;
        let deadline = Instant::now() + STOP_ACK_GRACE;
        while Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(100));
            let updated: Value =
                serde_json::from_slice(&std::fs::read(&path)?).unwrap_or(Value::Null);
            if updated["state"] == "stopped" {
                stopped = true;
                break;
            }
            if updated["state"] == "failed" {
                return Err("E_RUNTIME_STOP: launch cleanup failed; recovery required"
                    .to_string()
                    .into());
            }
        }
        if !stopped {
            return Err(
                "E_RUNTIME_STOP: graceful stop not acknowledged; recovery required"
                    .to_string()
                    .into(),
            );
        }
        if r.operation == "stop" {
            return Ok(envelope(
                &r,
                false,
                json!({"instance":record["instanceId"],"state":"stopped"}),
            ));
        }
        Some(record)
    } else {
        None
    };
    if !r.trust_local_config {
        return Err(
            "E_CONFIG_TRUST: --trust-local-config required; config has same-user authority"
                .to_string()
                .into(),
        );
    }
    let mut worker = ConfigProcess::spawn(&root).map_err(KitError::from)?;
    let target = r.target.clone().or_else(|| {
        restart
            .as_ref()
            .and_then(|v| v["targetId"].as_str().map(str::to_owned))
    });
    let payload = json!({"root":root,"config":r.config.as_ref().map(|p|p.to_string_lossy().to_string()).unwrap_or_else(||"loop.config.ts".into()),"target":target,"trustLocalConfig":true});
    let plan = worker
        .request("evaluate", payload)
        .map_err(KitError::from)?;
    if r.operation == "inspect" {
        worker.shutdown().map_err(KitError::from)?;
        return Ok(envelope(&r, true, plan));
    }
    if r.operation == "build" {
        let result = worker
            .request("prepare", json!({"release":r.release}))
            .map_err(KitError::from)?;
        worker.shutdown().map_err(KitError::from)?;
        return Ok(envelope(&r, true, result));
    }
    let launch = worker
        .request(
            "start",
            json!({"instance":r.instance,"port":r.port,"profile":r.profile,"dev":r.operation=="dev"}),
        )
        .map_err(KitError::from)?;
    // Foreground lifecycle: another invocation can stop this exact instance. No implicit daemon.
    eprintln!(
        "Loop instance {} target {}{}",
        launch["instanceId"].as_str().unwrap_or("?"),
        plan["targetId"].as_str().unwrap_or("?"),
        launch["endpoint"]
            .as_str()
            .map(|s| format!(" at {s}"))
            .unwrap_or_default()
    );
    let mut stopping_since = None;
    loop {
        std::thread::sleep(Duration::from_millis(200));
        if crate::dev::cancellation_requested() {
            let stopped = worker.request("stop", json!({})).map_err(KitError::from);
            let _ = worker.shutdown();
            stopped?;
            return Err("E_CANCELLED: foreground invocation stopped"
                .to_string()
                .into());
        }
        let live = worker.request("inspectLive", json!({})).map_err(|error| {
            if error.starts_with("E_PROTOCOL_TIMEOUT:") {
                KitError::from(format!("{error}; termination of the owned process tree will be attempted; inspect reservations and reconcile potentially incomplete trusted effects"))
            } else {
                KitError::from(error)
            }
        })?;
        if live["state"] == "failed" {
            return Err(format!("E_RUNTIME: {}", live["failure"]).into());
        }
        if stopping_expired(live["state"].as_str(), &mut stopping_since, Instant::now()) {
            return Err("E_RUNTIME_STOP_TIMEOUT: termination of the owned process tree will be attempted; inspect reservations and reconcile potentially incomplete trusted effects".to_string().into());
        }
        if live["state"] == "stopped" {
            break;
        }
    }
    worker.shutdown().map_err(KitError::from)?;
    Ok(envelope(
        &r,
        true,
        json!({"launch":launch,"state":"stopped"}),
    ))
}
fn scaffold(r: &KitRequest) -> Result<Value, KitError> {
    let kit = r
        .kit
        .as_deref()
        .ok_or_else(|| KitError::from("E_KIT: choose browser or native".to_string()))?;
    if kit != "browser" && kit != "native" {
        return Err("E_KIT: official kits are browser and native"
            .to_string()
            .into());
    }
    if r.root.exists() && std::fs::read_dir(&r.root)?.next().is_some() {
        return Err("E_CONFIG_CONFLICT: destination must be empty"
            .to_string()
            .into());
    }
    std::fs::create_dir_all(r.root.join("src"))?;
    let package = if kit == "browser" {
        "@loop-kit/host-browser"
    } else {
        "@loop-kit/host-native"
    };
    let target = if kit == "browser" { "web" } else { "desktop" };
    let factory = if kit == "browser" {
        "browser"
    } else {
        "native"
    };
    let dom_import = if kit == "browser" {
        "import {semanticDom} from '@loop-kit/renderer-dom';\n"
    } else {
        ""
    };
    let dom_plugin = if kit == "browser" {
        ",semanticDom({key:'dom',root:'#app'})"
    } else {
        ""
    };
    let config = format!(
        "import {{defineConfig}} from '@loop-kit/host';\nimport {{{factory}}} from '{package}';\nimport {{statusPlugin}} from './src/status';\n{dom_import}export default defineConfig({{schemaVersion:1,source:{{manifest:'./loop.package.json'}},targets:[{{id:'{target}',kit:{factory}({{}}),application:{{specifier:'./src/app.ts',export:'start'}},plugins:[statusPlugin(){dom_plugin}]}}]}});\n"
    );
    std::fs::write(r.root.join("loop.config.ts"), config)?;
    std::fs::write(
        r.root.join("src/app.ts"),
        include_str!("../templates/kits/app.ts"),
    )?;
    std::fs::write(
        r.root.join("src/status.ts"),
        include_str!("../templates/kits/status.ts"),
    )?;
    std::fs::write(
        r.root.join("src/status-provider.ts"),
        include_str!("../templates/kits/status-provider.ts"),
    )?;
    let mut dependencies = serde_json::Map::new();
    for name in [
        "@loop-kit/host",
        "@loop-kit/capabilities",
        "@loop-kit/ui",
        package,
    ] {
        dependencies.insert(name.into(), json!("0.1.0"));
    }
    if kit == "browser" {
        dependencies.insert("@loop-kit/renderer-dom".into(), json!("0.1.0"));
    }
    std::fs::write(
        r.root.join("package.json"),
        serde_json::to_vec_pretty(
            &json!({"name":"loop-app","private":true,"type":"module","dependencies":dependencies}),
        )
        .unwrap(),
    )?;
    std::fs::write(r.root.join("loop.package.json"),serde_json::to_vec_pretty(&json!({"version":1,"id":"example:loop-app","sourcePaths":["loop.config.ts","package.json","src/app.ts","src/status.ts","src/status-provider.ts"]})).unwrap())?;
    std::fs::write(r.root.join(".gitignore"), "node_modules/\ndist/\n.loop/\n")?;
    Ok(envelope(
        r,
        false,
        json!({"path":r.root,"kit":kit,"next":format!("Review dependencies, explicitly prepare a frozen lock, then: loop dev {} --config loop.config.ts --target {target} --trust-local-config",r.root.display())}),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record(root: &std::path::Path, target: &str, epoch: &str, state: &str) {
        let dir = root
            .join(".loop/instances")
            .join(target)
            .join("same")
            .join(epoch);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join("launch.json"),
            serde_json::to_vec(
                &json!({"targetId":target,"instanceId":"same","epoch":epoch,"state":state}),
            )
            .unwrap(),
        )
        .unwrap();
    }

    #[test]
    fn stopping_epoch_is_selected_without_hiding_a_new_active_epoch() {
        let root = tempfile::tempdir().unwrap();
        record(root.path(), "web", "old", "stopped");
        record(root.path(), "web", "in-progress", "stopping");
        let request = KitRequest {
            root: root.path().to_path_buf(),
            instance: Some("same".into()),
            ..Default::default()
        };
        assert_eq!(find_launch(&request).unwrap().1["epoch"], "in-progress");
        record(root.path(), "web", "new", "active");
        assert_eq!(find_launch(&request).unwrap().1["epoch"], "new");
    }

    #[test]
    fn starting_epoch_is_not_hidden_by_an_old_stopped_record() {
        let root = tempfile::tempdir().unwrap();
        record(root.path(), "web", "old", "stopped");
        record(root.path(), "web", "new", "starting");
        let request = KitRequest {
            root: root.path().to_path_buf(),
            instance: Some("same".into()),
            ..Default::default()
        };
        assert_eq!(find_launch(&request).unwrap().1["epoch"], "new");
        record(root.path(), "desktop", "replacing", "replacing");
        assert_eq!(find_launch(&request).unwrap_err().code, "E_INSTANCE");
    }

    #[test]
    fn unrecorded_reservation_is_not_hidden_by_stopped_history() {
        let root = tempfile::tempdir().unwrap();
        record(root.path(), "web", "old", "stopped");
        std::fs::write(
            root.path().join(".loop/instances/web/same/active.lock"),
            "new",
        )
        .unwrap();
        let request = KitRequest {
            root: root.path().to_path_buf(),
            instance: Some("same".into()),
            ..Default::default()
        };
        assert_eq!(find_launch(&request).unwrap_err().code, "E_RUNTIME_STOP");
        record(root.path(), "web", "new", "starting");
        assert_eq!(find_launch(&request).unwrap().1["epoch"], "new");
        let terminal = tempfile::tempdir().unwrap();
        record(terminal.path(), "web", "old", "stopped");
        std::fs::write(
            terminal.path().join(".loop/instances/web/same/active.lock"),
            "old",
        )
        .unwrap();
        let terminal_request = KitRequest {
            root: terminal.path().to_path_buf(),
            instance: Some("same".into()),
            ..Default::default()
        };
        assert_eq!(
            find_launch(&terminal_request).unwrap_err().code,
            "E_RUNTIME_STOP"
        );
    }

    #[test]
    fn failed_owner_reservation_cannot_be_hidden_by_other_epochs() {
        let root = tempfile::tempdir().unwrap();
        record(root.path(), "web", "old", "stopped");
        record(root.path(), "web", "failed-owner", "failed");
        std::fs::write(
            root.path().join(".loop/instances/web/same/active.lock"),
            "failed-owner",
        )
        .unwrap();
        let request = KitRequest {
            root: root.path().to_path_buf(),
            instance: Some("same".into()),
            ..Default::default()
        };
        assert_eq!(find_launch(&request).unwrap_err().code, "E_RUNTIME_STOP");
        record(root.path(), "web", "inconsistent", "active");
        assert_eq!(find_launch(&request).unwrap_err().code, "E_RUNTIME_STOP");
    }

    #[test]
    fn stopping_ambiguities_fail_closed_unless_target_resolves_them() {
        let root = tempfile::tempdir().unwrap();
        record(root.path(), "web", "first", "stopping");
        record(root.path(), "web", "second", "stopping");
        let request = KitRequest {
            root: root.path().to_path_buf(),
            instance: Some("same".into()),
            ..Default::default()
        };
        assert_eq!(find_launch(&request).unwrap_err().code, "E_INSTANCE");
        let other = tempfile::tempdir().unwrap();
        record(other.path(), "web", "first", "active");
        record(other.path(), "desktop", "second", "stopping");
        let mut request = KitRequest {
            root: other.path().to_path_buf(),
            instance: Some("same".into()),
            ..Default::default()
        };
        assert_eq!(find_launch(&request).unwrap_err().code, "E_INSTANCE");
        request.target = Some("web".into());
        assert_eq!(find_launch(&request).unwrap().1["epoch"], "first");
    }

    #[test]
    fn stopping_deadline_starts_on_observation_and_resets_after_transition() {
        let start = Instant::now();
        let mut since = None;
        assert!(!stopping_expired(Some("active"), &mut since, start));
        assert!(!stopping_expired(Some("stopping"), &mut since, start));
        assert!(!stopping_expired(
            Some("stopping"),
            &mut since,
            start + Duration::from_secs(4)
        ));
        assert!(stopping_expired(
            Some("stopping"),
            &mut since,
            start + FOREGROUND_STOP_GRACE
        ));
        assert!(!stopping_expired(
            Some("active"),
            &mut since,
            start + Duration::from_secs(6)
        ));
        assert!(!stopping_expired(
            Some("stopping"),
            &mut since,
            start + Duration::from_secs(7)
        ));
    }
}
