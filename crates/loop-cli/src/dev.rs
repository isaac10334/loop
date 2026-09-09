//! Trusted-local development tasks. Cargo and JS tools own their dependencies.
use anyhow::{Context, Result, bail, ensure};
use clap::{Args, ValueEnum};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::IsTerminal,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};

static CANCELLED: AtomicBool = AtomicBool::new(false);
pub fn install_cancellation() -> Result<()> {
    ctrlc::set_handler(|| CANCELLED.store(true, Ordering::SeqCst))?;
    Ok(())
}

#[derive(Clone, Copy, Debug, ValueEnum, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    Rust,
    Typescript,
}
#[derive(Clone, Copy, Debug, ValueEnum)]
pub enum Template {
    Component,
    Desktop,
}
#[derive(Clone, Copy, Debug, ValueEnum)]
pub enum Host {
    Generated,
    User,
}
#[derive(Args)]
pub struct Create {
    pub path: PathBuf,
    #[arg(long, value_enum)]
    pub template: Option<Template>,
    #[arg(long, value_enum)]
    pub language: Option<Language>,
    #[arg(long, value_enum, default_value = "generated")]
    pub host: Host,
    #[arg(long)]
    pub yes: bool,
    /// Use a local host checkout instead of the published crate.
    #[arg(long)]
    pub host_source: Option<PathBuf>,
    /// Declarative overlay files, rendered with MiniJinja; no scripts executed.
    #[arg(long)]
    pub template_dir: Option<PathBuf>,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Manifest {
    pub version: u32,
    pub name: String,
    #[serde(rename = "type")]
    pub item_type: String,
    pub source: String,
    pub language: Language,
    pub host: String,
    pub bindings: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub host_source: Option<PathBuf>,
    pub grants: Grants,
    #[serde(default = "default_host_version")]
    pub host_version: String,
}
fn default_host_version() -> String {
    "0.1.0".into()
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Grants {
    pub notes: String,
}
impl Manifest {
    pub fn read(dir: &Path) -> Result<Self> {
        let m: Self =
            toml::from_str(&fs::read_to_string(dir.join("loop.toml")).context("read loop.toml")?)
                .context("parse loop.toml")?;
        m.validate()?;
        Ok(m)
    }
    fn validate(&self) -> Result<()> {
        ensure!(
            self.version == 1,
            "unsupported loop.toml version {}",
            self.version
        );
        validate_name(&self.name)?;
        let parts: Vec<_> = self.host_version.split('.').collect();
        ensure!(
            parts.len() == 3
                && parts
                    .iter()
                    .all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit())),
            "invalid host_version"
        );
        ensure!(
            matches!(self.item_type.as_str(), "component" | "application"),
            "type must be component or application"
        );
        ensure!(
            matches!(self.host.as_str(), "generated" | "user"),
            "host must be generated or user"
        );
        ensure!(
            self.source == "component",
            "this schema supports source = component"
        );
        let expected = match self.language {
            Language::Rust => "loopkit:app/application@0.1.0",
            Language::Typescript => "loopkit:app/application-sync@0.1.0",
        };
        ensure!(
            self.bindings == expected,
            "language requires bindings = {expected}"
        );
        ensure!(
            matches!(self.grants.notes.as_str(), "read-only" | "read-write"),
            "notes grant must be read-only or read-write"
        );
        Ok(())
    }
}
fn validate_name(name: &str) -> Result<()> {
    ensure!(
        !name.is_empty()
            && name.len() <= 48
            && name.as_bytes()[0].is_ascii_lowercase()
            && name
                .bytes()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-'),
        "name must start with a-z and contain only a-z, 0-9, hyphen (max 48)"
    );
    ensure!(
        ![
            "con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7",
            "com8", "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9"
        ]
        .contains(&name),
        "reserved Windows name"
    );
    Ok(())
}
fn write(path: impl AsRef<Path>, content: impl AsRef<[u8]>) -> Result<()> {
    let path = path.as_ref();
    fs::create_dir_all(path.parent().unwrap())?;
    fs::write(path, content)?;
    Ok(())
}
pub fn create(mut options: Create) -> Result<PathBuf> {
    if !options.yes && std::io::stdin().is_terminal() {
        if options.template.is_none() {
            options.template = Some(
                if dialoguer::Select::new()
                    .with_prompt("Create")
                    .items(["Desktop application", "Component"])
                    .default(0)
                    .interact()?
                    == 0
                {
                    Template::Desktop
                } else {
                    Template::Component
                },
            );
        }
        if options.language.is_none() {
            options.language = Some(
                if dialoguer::Select::new()
                    .with_prompt("Language")
                    .items(["Rust (P3 async)", "TypeScript (sync component ABI)"])
                    .default(0)
                    .interact()?
                    == 0
                {
                    Language::Rust
                } else {
                    Language::Typescript
                },
            );
        }
    }
    let template = options.template.unwrap_or(Template::Desktop);
    let language = options.language.unwrap_or(Language::Rust);
    let name = options
        .path
        .file_name()
        .and_then(|s| s.to_str())
        .context("destination needs a name")?
        .to_string();
    validate_name(&name)?;
    ensure!(
        !options.path.exists(),
        "destination exists; refusing overwrite: {}",
        options.path.display()
    );
    let parent = options
        .path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    fs::create_dir_all(parent)?;
    let host_source = options
        .host_source
        .or_else(|| std::env::var_os("LOOP_HOST_SOURCE").map(PathBuf::from))
        .map(|path| path.canonicalize())
        .transpose()
        .context("host source checkout missing")?;
    if let Some(source) = &host_source {
        ensure!(
            source.join("crates/loop-host/Cargo.toml").is_file(),
            "host source lacks crates/loop-host"
        );
    }
    let m = Manifest {
        version: 1,
        name: name.clone(),
        item_type: if matches!(template, Template::Desktop) {
            "application"
        } else {
            "component"
        }
        .into(),
        source: "component".into(),
        language,
        host: if matches!(options.host, Host::User) {
            "user"
        } else {
            "generated"
        }
        .into(),
        bindings: match language {
            Language::Rust => "loopkit:app/application@0.1.0",
            Language::Typescript => "loopkit:app/application-sync@0.1.0",
        }
        .into(),
        host_source,
        grants: Grants {
            notes: "read-only".into(),
        },
        host_version: env!("CARGO_PKG_VERSION").into(),
    };
    m.validate()?;
    // Stage beside destination: failed generation never exposes a partial workspace.
    let stage = tempfile::Builder::new()
        .prefix(".loop-create-")
        .tempdir_in(parent)?;
    scaffold(stage.path(), &m)?;
    if let Some(overlay) = options.template_dir {
        overlay_files(&overlay, stage.path(), &name, language)?;
    }
    Manifest::read(stage.path())?;
    fs::rename(stage.path(), &options.path)
        .context("publish workspace (destination must be absent)")?;
    Ok(options.path)
}
fn scaffold(dir: &Path, m: &Manifest) -> Result<()> {
    write(dir.join("loop.toml"), toml::to_string_pretty(m)?)?;
    write(
        dir.join("rust-toolchain.toml"),
        include_str!("../../../rust-toolchain.toml"),
    )?;
    write(
        dir.join(".gitignore"),
        "**/target/\n**/node_modules/\n**/dist/\n.loop/\n",
    )?;
    write(
        dir.join("component/wit/application.wit"),
        include_str!("../../loop-host/wit/application.wit"),
    )?;
    match m.language {
        Language::Rust => {
            write(
                dir.join("component/Cargo.toml"),
                format!(
                    "[package]\nname = {:?}\nversion = \"0.1.0\"\nedition = \"2024\"\n[workspace]\n[lib]\ncrate-type = [\"cdylib\"]\n[dependencies]\nwit-bindgen = \"=0.61.1\"\nwasip3 = \"=0.8.0\"\n",
                    m.name
                ),
            )?;
            write(
                dir.join("component/src/lib.rs"),
                include_str!("../../../templates/rust/lib.rs"),
            )?;
        }
        Language::Typescript => {
            write(
                dir.join("component/package.json"),
                r#"{"private":true,"type":"module","dependencies":{"@bytecodealliance/componentize-js":"0.22.0","@bytecodealliance/jco":"1.32.1","typescript":"6.0.2"}}"#,
            )?;
            write(
                dir.join("component/app.ts"),
                include_str!("../../../templates/typescript/app.ts"),
            )?;
            write(
                dir.join("component/build.mjs"),
                include_str!("../../../templates/typescript/build.mjs"),
            )?;
            write(
                dir.join("component/tsconfig.json"),
                r#"{"compilerOptions":{"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","strict":true,"outDir":"out","skipLibCheck":true,"paths":{"loopkit:app/notes@0.1.0":["./bindings/interfaces/loopkit-app-notes.d.ts"]}},"include":["app.ts","bindings/**/*.d.ts"]}"#,
            )?;
        }
    }
    if m.host == "user" && m.item_type == "application" {
        generate_host(&dir.join("host"), m)?;
    }
    write(
        dir.join("README.md"),
        format!(
            "# {}\n\nRun `loop run .`; build `loop build .`. Rust uses P3 async; TypeScript uses synchronous component ABI. Edit component sources and rerun.\n\nBuilds are trusted-local: Cargo build scripts and JS tools execute native code. Generated hosts use the versioned loop-host crate unless you set --host-source. The built directory bundle needs neither Cargo nor the Loop CLI.\n",
            m.name
        ),
    )?;
    Ok(())
}
fn overlay_files(source: &Path, target: &Path, name: &str, language: Language) -> Result<()> {
    let env = minijinja::Environment::new();
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        ensure!(!ty.is_symlink(), "template symlinks are unsupported");
        let dest = target.join(entry.file_name());
        if ty.is_dir() {
            fs::create_dir_all(&dest)?;
            overlay_files(&entry.path(), &dest, name, language)?;
        } else {
            let text = fs::read_to_string(entry.path()).context("template files must be UTF-8")?;
            write(dest, env.render_str(&text, minijinja::context! { name => name, language => match language { Language::Rust => "rust", Language::Typescript => "typescript" } })?)?;
        }
    }
    Ok(())
}
pub fn add(workspace: &Path, name: String, language: Language) -> Result<()> {
    Manifest::read(workspace)?;
    validate_name(&name)?;
    let destination = workspace.join("components").join(&name);
    let m = Manifest::read(workspace)?;
    create(Create {
        path: destination.clone(),
        template: Some(Template::Component),
        language: Some(language),
        host: Host::Generated,
        yes: true,
        host_source: m.host_source,
        template_dir: None,
    })?;
    // Directory discovery avoids rewriting user-owned manifest text transactionally.
    println!("Added {}. Run: loop run {}", name, destination.display());
    Ok(())
}

enum Task {
    RustComponent,
    JavaScript,
    Host,
    Package,
}
fn process(
    task: Task,
    program: &str,
    args: &[&str],
    dir: &Path,
    target: Option<&Path>,
) -> Result<()> {
    let label = match task {
        Task::RustComponent => "Rust -> wasm32-wasip2 + P3",
        Task::JavaScript => "TypeScript -> component",
        Task::Host => "native host",
        Task::Package => "package",
    };
    eprintln!("[trusted-local / {label}] {program} {}", args.join(" "));
    let mut command = Command::new(program);
    command.args(args).current_dir(dir).stdin(Stdio::null());
    command.env("RUSTUP_TOOLCHAIN", "1.98.0");
    if let Some(target) = target {
        command.env("CARGO_TARGET_DIR", target);
    }
    let mut child = command
        .spawn()
        .with_context(|| format!("start {program}; run loop doctor"))?;
    loop {
        if let Some(status) = child.try_wait()? {
            ensure!(status.success(), "{program} failed with {status}");
            return Ok(());
        }
        if CANCELLED.load(Ordering::SeqCst) {
            #[cfg(windows)]
            {
                let _ = Command::new("taskkill")
                    .args(["/PID", &child.id().to_string(), "/T", "/F"])
                    .output();
            }
            let _ = child.kill();
            let _ = child.wait();
            bail!("cancelled {program}");
        }
        std::thread::sleep(Duration::from_millis(80));
    }
}
pub fn build(path: &Path, release: bool, package: bool) -> Result<PathBuf> {
    let dir = path.canonicalize()?;
    let m = Manifest::read(&dir)?;
    let source = dir.join(&m.source);
    let profile = if release { "release" } else { "debug" };
    let wasm = match m.language {
        Language::Rust => {
            let mut args = vec!["build", "--target", "wasm32-wasip2"];
            if release {
                args.push("--release");
            }
            process(
                Task::RustComponent,
                "cargo",
                &args,
                &source,
                Some(&source.join("target")),
            )?;
            source.join(format!(
                "target/wasm32-wasip2/{profile}/{}.wasm",
                m.name.replace('-', "_")
            ))
        }
        Language::Typescript => {
            let args = if source.join("bun.lock").exists() {
                vec!["install", "--frozen-lockfile"]
            } else {
                vec!["install"]
            };
            process(Task::JavaScript, "bun", &args, &source, None)?;
            process(
                Task::JavaScript,
                "bun",
                &[
                    "x",
                    "--no-install",
                    "jco",
                    "types",
                    "wit",
                    "--world-name",
                    "application-sync",
                    "-o",
                    "bindings",
                ],
                &source,
                None,
            )?;
            process(
                Task::JavaScript,
                "bun",
                &["x", "--no-install", "tsc", "-p", "tsconfig.json"],
                &source,
                None,
            )?;
            process(Task::JavaScript, "node", &["build.mjs"], &source, None)?;
            source.join("dist/component.wasm")
        }
    };
    ensure!(
        wasm.is_file(),
        "build succeeded without expected component {}",
        wasm.display()
    );
    if !package || m.item_type == "component" {
        return Ok(wasm);
    }
    let host_dir = dir.join(if m.host == "user" {
        "host"
    } else {
        ".loop/host"
    });
    if m.host == "generated" {
        generate_host(&host_dir, &m)?;
    }
    ensure!(host_dir.join("Cargo.toml").is_file(), "user host missing");
    let host_target = host_target(&dir, &m);
    let mut args = vec!["build"];
    if release {
        args.push("--release");
    }
    process(Task::Host, "cargo", &args, &host_dir, Some(&host_target))?;
    let executable =
        host_target
            .join(profile)
            .join(format!("{}-host{}", m.name, std::env::consts::EXE_SUFFIX));
    let bundle = dir.join("dist").join(&m.name);
    fs::create_dir_all(bundle.parent().unwrap())?;
    ensure!(
        !bundle.exists(),
        "bundle exists: move/remove {} before packaging again",
        bundle.display()
    );
    let stage = tempfile::Builder::new()
        .prefix(".bundle-")
        .tempdir_in(bundle.parent().unwrap())?;
    fs::copy(
        executable,
        stage
            .path()
            .join(format!("{}{}", m.name, std::env::consts::EXE_SUFFIX)),
    )?;
    fs::copy(wasm, stage.path().join("component.wasm"))?;
    write(
        stage.path().join("README.txt"),
        "Run the executable. --headless runs an interaction check. Windows 11 with WebView2 required for the window. No loop CLI required.\n",
    )?;
    let _task = Task::Package;
    fs::rename(stage.path(), &bundle)?;
    Ok(bundle)
}
fn generate_host(dir: &Path, m: &Manifest) -> Result<()> {
    let dependency = if let Some(source) = &m.host_source {
        if !dir.join("Cargo.lock").exists() && source.join("Cargo.lock").is_file() {
            fs::create_dir_all(dir)?;
            fs::copy(source.join("Cargo.lock"), dir.join("Cargo.lock"))?;
        }
        let path = toml::Value::String(
            source
                .join("crates/loop-host")
                .to_string_lossy()
                .into_owned(),
        )
        .to_string();
        format!("path = {path}")
    } else {
        format!("version = \"={}\"", m.host_version)
    };
    write(
        dir.join("Cargo.toml"),
        format!(
            "[package]\nname = \"{}-host\"\nversion = \"0.1.0\"\nedition = \"2024\"\n[workspace]\n[dependencies]\nloop-host = {{ {dependency}, features = [\"desktop\"] }}\nanyhow = \"1\"\ntokio = {{ version = \"1\", features = [\"rt-multi-thread\"] }}\n[profile.dev]\ndebug = 0\n",
            m.name
        ),
    )?;
    let rights = if m.grants.notes == "read-write" {
        "ReadWrite"
    } else {
        "ReadOnly"
    };
    write(
        dir.join("src/main.rs"),
        format!(
            r#"use loop_host::{{Action, Notes, Rights}};
fn main() -> anyhow::Result<()> {{
    let args = std::env::args_os().collect::<Vec<_>>();
    let path = if let Some(index) = args.iter().position(|a| a == "--component") {{
        std::path::PathBuf::from(args.get(index + 1).ok_or_else(|| anyhow::anyhow!("--component requires a path"))?)
    }} else {{ std::env::current_exe()?.parent().unwrap().join("component.wasm") }};
    let notes = Notes::new("A small note, scoped to this application.", Rights::{rights});
    if std::env::args().any(|a| a == "--headless") {{
        let views = tokio::runtime::Runtime::new()?.block_on(loop_host::headless(path, notes, &[Action::Refresh, Action::Increment, Action::DelayedIncrement]))?;
        anyhow::ensure!(views.last().unwrap().count == 2);
        println!("PASS: relocated bundle guest count=2");
        Ok(())
    }} else {{ loop_host::desktop::run(path, notes) }}
}}
"#
        ),
    )?;
    Ok(())
}
pub fn doctor() -> Result<()> {
    println!(
        "loop 0.1.0 | execution: {}-{} | host: Wasmtime 48.0.0",
        std::env::consts::OS,
        std::env::consts::ARCH
    );
    for (program, args) in [
        ("rustc", vec!["+1.98.0", "--version"]),
        ("cargo", vec!["+1.98.0", "--version"]),
        ("bun", vec!["--version"]),
        ("node", vec!["--version"]),
    ] {
        match Command::new(program).args(args).output() {
            Ok(o) if o.status.success() => {
                println!("{program}: {}", String::from_utf8_lossy(&o.stdout).trim())
            }
            _ => println!("MISSING: {program}; see docs/windows.md"),
        }
    }
    let out = Command::new("rustup")
        .args(["target", "list", "--installed", "--toolchain", "1.98.0"])
        .output()?;
    if !String::from_utf8_lossy(&out.stdout).contains("wasm32-wasip2") {
        println!("MISSING: rustup target add wasm32-wasip2 --toolchain 1.98.0");
    }
    #[cfg(windows)]
    {
        match wry_version() {
            Ok(v) => println!("WebView2: {v}"),
            Err(e) => println!("MISSING WebView2: {e}"),
        }
    }
    println!(
        "Rust: wasm32-wasip2 target + wit-bindgen 0.61.1 + wasip3 0.8.0; verified mixed P2/P3 async.\nTypeScript: ComponentizeJS 0.22.0 sync ABI only; P3 async-world generation panics.\nSupported: loopkit:app/application and application-sync dispatch contracts.\nNative compilation requires MSVC Build Tools on Windows. Builds are trusted-local.\nGenerated hosts use loop-host from crates.io; --host-source / LOOP_HOST_SOURCE overrides this for local development."
    );
    Ok(())
}
pub fn run_user_host(path: &Path, component: &Path) -> Result<()> {
    let m = Manifest::read(path)?;
    process(
        Task::Host,
        "cargo",
        &[
            "run",
            "--",
            "--component",
            component.to_str().context("non-UTF-8 component path")?,
        ],
        &path.join("host"),
        Some(&host_target(&path.canonicalize()?, &m)),
    )
}
fn host_target(dir: &Path, m: &Manifest) -> PathBuf {
    m.host_source
        .as_ref()
        .map(|p| p.join("target"))
        .unwrap_or_else(|| dir.join(".loop/target"))
}
#[cfg(windows)]
fn wry_version() -> Result<String> {
    loop_host::desktop::webview_version()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn registry_host_is_portable_and_pinned() -> Result<()> {
        let stage = tempfile::tempdir()?;
        let m = Manifest {
            version: 1,
            name: "test-app".into(),
            item_type: "application".into(),
            source: "component".into(),
            language: Language::Rust,
            host: "user".into(),
            bindings: "loopkit:app/application@0.1.0".into(),
            host_source: None,
            grants: Grants {
                notes: "read-only".into(),
            },
            host_version: "0.1.0".into(),
        };
        scaffold(stage.path(), &m)?;
        let loaded = Manifest::read(stage.path())?;
        assert!(loaded.host_source.is_none());
        assert_eq!(loaded.host_version, "0.1.0");
        let cargo = fs::read_to_string(stage.path().join("host/Cargo.toml"))?;
        assert!(cargo.contains("version = \"=0.1.0\""));
        assert!(!cargo.contains("path ="));
        assert!(stage.path().join("component/wit/application.wit").is_file());
        Ok(())
    }
    #[test]
    fn reject_unsafe_names() {
        for name in ["../x", "CON", "con", "a/b", "a b", "", "1app", "a.exe"] {
            assert!(validate_name(name).is_err(), "{name}");
        }
    }
}
