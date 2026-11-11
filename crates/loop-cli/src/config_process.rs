//! Bounded HK1 Bun child protocol. No shell, project worker, auto-install or ambient preload.
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::mpsc::{self, Receiver},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
const MAX: usize = 1_048_576;

fn request_timeout(operation: &str) -> Duration {
    Duration::from_secs(match operation {
        "stop" | "shutdown" => 5,
        // Live inspection should be immediate; a blocked worker cannot report stopping.
        "inspectLive" => 10,
        _ => 30,
    })
}
pub struct ConfigProcess {
    child: Child,
    input: ChildStdin,
    output: Receiver<Result<Value, String>>,
    epoch: String,
    next: u64,
    _tree: ProcessTree,
    _asset: tempfile::TempDir,
}
impl ConfigProcess {
    pub fn spawn(root: &Path) -> Result<Self, String> {
        let asset = tempfile::tempdir().map_err(|e| e.to_string())?;
        let path = asset.path().join("host-worker.js");
        std::fs::write(&path, include_bytes!("../host-tools/dist/worker.js"))
            .map_err(|e| e.to_string())?;
        let requested = std::env::var_os("LOOP_BUN").map(PathBuf::from);
        let bun = if let Some(path) = requested {
            path.canonicalize().map_err(|e| {
                format!("E_TOOL: explicit LOOP_BUN must name an existing executable: {e}")
            })?
        } else {
            let mut found = None;
            for dir in std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default()) {
                let path = dir.join(if cfg!(windows) { "bun.exe" } else { "bun" });
                if path.is_file() {
                    found = Some(path.canonicalize().map_err(|e| e.to_string())?);
                    break;
                }
            }
            found.ok_or("E_TOOL: Bun executable not found on PATH")?
        };
        let mut version_command = Command::new(&bun);
        version_command.arg("--version").env_clear();
        for key in ["SystemRoot", "WINDIR"] {
            if let Some(v) = std::env::var_os(key) {
                version_command.env(key, v);
            }
        }
        let version = version_command
            .output()
            .map_err(|e| format!("E_TOOL_VERSION: {e}"))?;
        let version = String::from_utf8_lossy(&version.stdout).trim().to_string();
        let patch = version
            .strip_prefix("1.3.")
            .and_then(|s| s.parse::<u32>().ok());
        if !patch.is_some_and(|p| p >= 14) {
            return Err(format!(
                "E_TOOL_VERSION: supported Bun 1.3.14..1.3.x; actual {version}"
            ));
        }
        let bun_digest = format!(
            "{:x}",
            Sha256::digest(std::fs::read(&bun).map_err(|e| e.to_string())?)
        );
        let evaluator_digest = format!(
            "{:x}",
            Sha256::digest(include_bytes!("../host-tools/dist/worker.js"))
        );
        let mut command = Command::new(&bun);
        command
            .args(["--no-install", "--no-env-file"])
            .arg(path)
            .current_dir(root)
            .env_clear();
        command
            .env("BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0")
            .env("LOOP_BUN_SHA256", bun_digest)
            .env("LOOP_EVALUATOR_SHA256", &evaluator_digest);
        for key in [
            "PATH",
            "SystemRoot",
            "WINDIR",
            "TEMP",
            "TMP",
            "HOME",
            "USERPROFILE",
            "LOCALAPPDATA",
        ] {
            if let Some(v) = std::env::var_os(key) {
                command.env(key, v);
            }
        }
        if let Ok(exe) = std::env::current_exe() {
            command.env("LOOP_CLI_EXECUTABLE", exe);
        }
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }
        let mut child = command
            .spawn()
            .map_err(|e| format!("E_TOOL: Bun is required; prepare it explicitly: {e}"))?;
        let tree = match ProcessTree::attach(&child) {
            Ok(tree) => tree,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(error);
            }
        };
        let input = child.stdin.take().unwrap();
        let mut stdout = child.stdout.take().unwrap();
        let mut stderr = child.stderr.take().unwrap();
        let (tx, output) = mpsc::sync_channel(16);
        thread::spawn(move || {
            loop {
                let result = read_frame(&mut stdout);
                let failed = result.is_err();
                if tx.send(result).is_err() || failed {
                    break;
                }
            }
        });
        thread::spawn(move || {
            let mut buffer = [0; 4096];
            let mut total = 0;
            loop {
                match stderr.read(&mut buffer) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        if total < MAX {
                            let keep = n.min(MAX - total);
                            let _ = std::io::stderr().write_all(&buffer[..keep]);
                        }
                        total += n;
                    }
                }
            }
        });
        let epoch = format!(
            "{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let mut result = Self {
            child,
            input,
            output,
            epoch: epoch.clone(),
            next: 0,
            _tree: tree,
            _asset: asset,
        };
        result.write(&json!({"type":"hello","protocol":1,"cliVersion":env!("CARGO_PKG_VERSION"),"evaluatorDigest":evaluator_digest,"nonce":epoch,"supportedPlanSchemas":[1],"features":[]}))?;
        let ack = result.receive(Duration::from_secs(5), true)?;
        if ack["type"] != "helloAck"
            || ack["protocol"] != 1
            || ack["nonce"] != result.epoch
            || ack["schemas"] != json!([1])
            || ack["evaluatorDigest"] != evaluator_digest
            || ack["bunVersion"] != version
            || ack["features"] != json!([])
        {
            return Err("E_PROTOCOL_HANDSHAKE: nonce/schema mismatch".into());
        }
        Ok(result)
    }
    fn write(&mut self, value: &Value) -> Result<(), String> {
        let bytes = serde_json::to_vec(value).map_err(|e| e.to_string())?;
        if bytes.len() > MAX {
            return Err("E_PROTOCOL_FRAME: oversized request".into());
        }
        self.input
            .write_all(&(bytes.len() as u32).to_le_bytes())
            .and_then(|_| self.input.write_all(&bytes))
            .and_then(|_| self.input.flush())
            .map_err(|e| e.to_string())
    }
    fn receive(&self, timeout: Duration, cancellable: bool) -> Result<Value, String> {
        let deadline = std::time::Instant::now() + timeout;
        loop {
            if cancellable && crate::dev::cancellation_requested() {
                return Err("E_CANCELLED: cancelled; owned process tree will be stopped, incomplete trusted effects require reconciliation".into());
            }
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            if remaining.is_zero() {
                return Err("E_PROTOCOL_TIMEOUT: operation deadline exceeded".into());
            }
            match self
                .output
                .recv_timeout(remaining.min(Duration::from_millis(50)))
            {
                Ok(value) => return value,
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(error) => return Err(format!("E_PROTOCOL_EOF: {error}")),
            }
        }
    }
    pub fn request(&mut self, operation: &str, payload: Value) -> Result<Value, String> {
        self.next += 1;
        let id = self.next.to_string();
        self.write(&json!({"type":"request","epoch":self.epoch,"id":id,"generation":1,"operation":operation,"payload":payload}))?;
        let mut accepted = false;
        loop {
            let reply = self.receive(
                request_timeout(operation),
                !matches!(operation, "stop" | "shutdown"),
            )?;
            if reply["epoch"] != self.epoch
                || reply["id"] != id
                || reply["operation"] != operation
                || reply["generation"] != 1
            {
                return Err("E_PROTOCOL_MESSAGE: unsolicited/stale response".into());
            }
            match reply["type"].as_str() {
                Some("accepted") if !accepted => accepted = true,
                Some("progress") if accepted => {}
                Some("completed") if accepted => return Ok(reply["result"].clone()),
                Some("failed") if accepted => {
                    return Err(format!(
                        "{}: {}",
                        reply["error"]["code"].as_str().unwrap_or("E_RUNTIME"),
                        reply["error"]["message"]
                            .as_str()
                            .unwrap_or("operation failed")
                    ));
                }
                _ => return Err("E_PROTOCOL_STATE: unexpected or duplicate terminal".into()),
            }
        }
    }
    pub fn shutdown(&mut self) -> Result<(), String> {
        self.request("shutdown", json!({})).map(|_| ())
    }
}
impl Drop for ConfigProcess {
    fn drop(&mut self) {
        self._tree.terminate();
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
#[cfg(windows)]
struct ProcessTree {
    handle: *mut std::ffi::c_void,
}
#[cfg(windows)]
#[link(name = "kernel32")]
unsafe extern "system" {
    fn CreateJobObjectW(
        attributes: *mut std::ffi::c_void,
        name: *const u16,
    ) -> *mut std::ffi::c_void;
    fn SetInformationJobObject(
        job: *mut std::ffi::c_void,
        class: u32,
        information: *const std::ffi::c_void,
        length: u32,
    ) -> i32;
    fn AssignProcessToJobObject(job: *mut std::ffi::c_void, process: *mut std::ffi::c_void) -> i32;
    fn TerminateJobObject(job: *mut std::ffi::c_void, code: u32) -> i32;
    fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
}
#[cfg(windows)]
impl ProcessTree {
    fn attach(child: &Child) -> Result<Self, String> {
        use std::os::windows::io::AsRawHandle;
        // JOBOBJECT_EXTENDED_LIMIT_INFORMATION, aligned and sized for Win64. The
        // release CLI is Win64; fail rather than silently run an unsupervised child.
        #[cfg(not(target_pointer_width = "64"))]
        {
            let _ = child;
            return Err("E_TOOL_PLATFORM: HK1 requires Win64 process supervision".into());
        }
        #[cfg(target_pointer_width = "64")]
        unsafe {
            let handle = CreateJobObjectW(std::ptr::null_mut(), std::ptr::null());
            if handle.is_null() {
                return Err(format!(
                    "E_PROCESS_JOB: {}",
                    std::io::Error::last_os_error()
                ));
            }
            let mut limits = [0u64; 18];
            limits[2] = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            if SetInformationJobObject(handle, 9, limits.as_ptr().cast(), 144) == 0
                || AssignProcessToJobObject(handle, child.as_raw_handle()) == 0
            {
                let error = std::io::Error::last_os_error();
                CloseHandle(handle);
                return Err(format!("E_PROCESS_JOB: {error}"));
            }
            Ok(Self { handle })
        }
    }
    fn terminate(&self) {
        unsafe {
            TerminateJobObject(self.handle, 1);
        }
    }
}
#[cfg(windows)]
impl Drop for ProcessTree {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.handle);
        }
    }
}
#[cfg(unix)]
struct ProcessTree {
    id: i32,
}
#[cfg(unix)]
impl ProcessTree {
    fn attach(child: &Child) -> Result<Self, String> {
        Ok(Self {
            id: child.id() as i32,
        })
    }
    fn terminate(&self) {
        unsafe extern "C" {
            fn kill(pid: i32, sig: i32) -> i32;
        }
        unsafe {
            kill(-self.id, 9);
        }
    }
}
#[cfg(not(any(windows, unix)))]
struct ProcessTree;
#[cfg(not(any(windows, unix)))]
impl ProcessTree {
    fn attach(_child: &Child) -> Result<Self, String> {
        Err("E_TOOL_PLATFORM: process-tree supervision unavailable".into())
    }
    fn terminate(&self) {}
}

// serde_json::Value normally accepts duplicate object keys. HK1 must reject
// duplicates at every nesting level, including escaped-equivalent spellings.
struct Unique(Value);
impl<'de> serde::Deserialize<'de> for Unique {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct Visitor;
        impl<'de> serde::de::Visitor<'de> for Visitor {
            type Value = Unique;
            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("strict JSON")
            }
            fn visit_bool<E: serde::de::Error>(self, v: bool) -> Result<Unique, E> {
                Ok(Unique(Value::Bool(v)))
            }
            fn visit_i64<E: serde::de::Error>(self, v: i64) -> Result<Unique, E> {
                Ok(Unique(v.into()))
            }
            fn visit_u64<E: serde::de::Error>(self, v: u64) -> Result<Unique, E> {
                Ok(Unique(v.into()))
            }
            fn visit_f64<E: serde::de::Error>(self, v: f64) -> Result<Unique, E> {
                serde_json::Number::from_f64(v)
                    .map(|n| Unique(Value::Number(n)))
                    .ok_or_else(|| E::custom("nonfinite number"))
            }
            fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Unique, E> {
                Ok(Unique(v.into()))
            }
            fn visit_string<E: serde::de::Error>(self, v: String) -> Result<Unique, E> {
                Ok(Unique(v.into()))
            }
            fn visit_none<E: serde::de::Error>(self) -> Result<Unique, E> {
                Ok(Unique(Value::Null))
            }
            fn visit_unit<E: serde::de::Error>(self) -> Result<Unique, E> {
                Ok(Unique(Value::Null))
            }
            fn visit_seq<A: serde::de::SeqAccess<'de>>(self, mut a: A) -> Result<Unique, A::Error> {
                let mut values = Vec::new();
                while let Some(Unique(v)) = a.next_element()? {
                    values.push(v);
                }
                Ok(Unique(Value::Array(values)))
            }
            fn visit_map<A: serde::de::MapAccess<'de>>(self, mut a: A) -> Result<Unique, A::Error> {
                let mut values = serde_json::Map::new();
                while let Some(k) = a.next_key::<String>()? {
                    if values.contains_key(&k) {
                        return Err(serde::de::Error::custom("E_PROTOCOL_DUPLICATE_KEY"));
                    }
                    let Unique(v) = a.next_value()?;
                    values.insert(k, v);
                }
                Ok(Unique(Value::Object(values)))
            }
        }
        d.deserialize_any(Visitor)
    }
}
pub fn strict_value(bytes: &[u8]) -> Result<Value, String> {
    serde_json::from_slice::<Unique>(bytes)
        .map(|v| v.0)
        .map_err(|e| format!("E_PROTOCOL_JSON: {e}"))
}
pub fn read_frame(reader: &mut impl Read) -> Result<Value, String> {
    let mut prefix = [0; 4];
    reader
        .read_exact(&mut prefix)
        .map_err(|e| format!("E_PROTOCOL_EOF: {e}"))?;
    let length = u32::from_le_bytes(prefix) as usize;
    if length == 0 || length > MAX {
        return Err("E_PROTOCOL_FRAME: invalid frame length".into());
    }
    let mut bytes = vec![0; length];
    reader
        .read_exact(&mut bytes)
        .map_err(|e| format!("E_PROTOCOL_TRUNCATED: {e}"))?;
    let value = strict_value(&bytes)?;
    if !value.is_object() {
        return Err("E_PROTOCOL_OBJECT".into());
    }
    Ok(value)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn live_inspection_has_its_own_shorter_deadline() {
        assert_eq!(request_timeout("inspectLive"), Duration::from_secs(10));
        assert_eq!(request_timeout("stop"), Duration::from_secs(5));
        assert_eq!(request_timeout("evaluate"), Duration::from_secs(30));
    }
    #[test]
    fn rejects_bounds_and_truncation() {
        assert!(read_frame(&mut &1_048_577u32.to_le_bytes()[..]).is_err());
        assert!(read_frame(&mut &[4, 0, 0, 0, b'{'][..]).is_err());
    }
    #[test]
    fn shared_protocol_corpus() {
        let corpus: Value =
            serde_json::from_str(include_str!("../assets/protocol-golden.json")).unwrap();
        for case in corpus["cases"].as_array().unwrap() {
            let bytes = case["payload"].as_str().unwrap().as_bytes();
            let mut framed = (bytes.len() as u32).to_le_bytes().to_vec();
            framed.extend_from_slice(bytes);
            assert_eq!(
                read_frame(&mut &framed[..]).is_ok(),
                case["accept"].as_bool().unwrap(),
                "{}",
                case["id"]
            );
        }
        for case in corpus["lengthCases"].as_array().unwrap() {
            let framed = (case["length"].as_u64().unwrap() as u32).to_le_bytes();
            assert_eq!(
                read_frame(&mut &framed[..]).is_ok(),
                case["accept"].as_bool().unwrap(),
                "{}",
                case["id"]
            );
        }
    }
    #[test]
    fn accepts_real_frame() {
        assert_eq!(
            read_frame(&mut &[2, 0, 0, 0, b'{', b'}'][..]).unwrap(),
            json!({})
        );
    }
}
