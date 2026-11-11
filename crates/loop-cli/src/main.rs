#[cfg(test)]
mod cli_tests;
mod config_process;
mod dev;
mod kit_commands;
mod manage;
use anyhow::{Context, Result, bail};
use clap::{Args, Parser, Subcommand};
use loop_host::{Action, Notes, Rights};
use std::path::{Path, PathBuf};

#[derive(Parser)]
#[command(
    name = "loop",
    version,
    about = "Create, build and run local component applications and trusted host kits"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}
#[derive(Args, Default)]
struct KitSelectors {
    #[arg(long)]
    config: Option<PathBuf>,
    #[arg(long)]
    target: Option<String>,
    #[arg(long)]
    instance: Option<String>,
    #[arg(long)]
    trust_local_config: bool,
    #[arg(long)]
    port: Option<u16>,
    #[arg(long)]
    profile: Option<String>,
    #[arg(long)]
    json: bool,
}
#[derive(Args)]
struct CreateOptions {
    #[command(flatten)]
    legacy: dev::Create,
    /// Select an official typed-config starter; absent preserves legacy create.
    #[arg(long, value_parser = ["browser", "native"])]
    kit: Option<String>,
    #[arg(long)]
    json: bool,
}
#[derive(Subcommand)]
enum Command {
    /// Download and install the latest Windows release.
    Upgrade,
    /// Remove this managed installation; keep projects and Rust.
    Uninstall,
    /// Report prerequisites without executing project configuration.
    Doctor {
        #[arg(default_value = ".")]
        root: PathBuf,
        #[arg(long)]
        json: bool,
    },
    /// Create a legacy application, or opt into a typed-config host kit.
    Create(CreateOptions),
    /// Add a source component to an existing workspace.
    Add {
        #[command(subcommand)]
        command: Add,
    },
    /// Build sources and run, or explicitly select trusted host configuration.
    Run {
        #[arg(default_value = ".")]
        path: PathBuf,
        #[arg(long)]
        headless: bool,
        #[arg(long, value_delimiter = ',', default_value = "refresh")]
        actions: Vec<String>,
        #[arg(long)]
        writable: bool,
        #[command(flatten)]
        kit: KitSelectors,
    },
    /// Produce a component or a relocatable host-kit application bundle.
    Build {
        #[arg(default_value = ".")]
        path: PathBuf,
        #[arg(long)]
        release: bool,
        #[command(flatten)]
        kit: KitSelectors,
    },
    /// Run an explicitly trusted foreground host-kit instance.
    Dev {
        #[arg(default_value = ".")]
        root: PathBuf,
        #[command(flatten)]
        kit: KitSelectors,
    },
    /// Inspect literal files without executing configuration unless explicitly requested.
    Inspect {
        #[arg(default_value = ".")]
        root: PathBuf,
        #[arg(long, conflicts_with_all = ["evaluate_config", "config", "trust_local_config", "target", "instance", "port", "profile"])]
        plan: Option<PathBuf>,
        #[arg(long)]
        evaluate_config: bool,
        #[command(flatten)]
        kit: KitSelectors,
    },
    /// Stop exactly one owned instance, leaving siblings running.
    Stop {
        instance: String,
        #[arg(long)]
        root: PathBuf,
        #[arg(long)]
        target: Option<String>,
        #[arg(long)]
        json: bool,
    },
    /// Restart an owned instance in a fresh epoch; config trust is required again.
    Restart {
        instance: String,
        #[arg(long)]
        root: PathBuf,
        #[arg(long)]
        target: Option<String>,
        #[arg(long)]
        trust_local_config: bool,
        #[arg(long)]
        json: bool,
    },
    #[command(hide = true)]
    NativeSurface {
        #[arg(long)]
        profile_dir: PathBuf,
        #[arg(long)]
        instance_id: String,
        #[arg(long)]
        epoch: String,
    },
    #[command(hide = true)]
    NativeComponent {
        #[arg(long)]
        component: PathBuf,
        #[arg(long)]
        expected_sha256: String,
        #[arg(long)]
        profile_dir: PathBuf,
        #[arg(long)]
        instance_id: String,
        #[arg(long)]
        epoch: String,
        #[arg(long)]
        source: String,
        #[arg(long)]
        writable: bool,
    },
    /// Offline bundled skills. Mutations plan unless --write is explicit.
    Skills {
        #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
        args: Vec<String>,
    },
}
#[derive(Subcommand)]
enum Add {
    Component {
        name: String,
        #[arg(long, value_enum, default_value = "rust")]
        language: dev::Language,
        #[arg(long, default_value = ".")]
        workspace: PathBuf,
    },
}
fn main() {
    if let Err(error) = execute() {
        let args: Vec<String> = std::env::args().skip(1).collect();
        let new_mode = args.iter().any(|arg| {
            arg == "--config"
                || arg.starts_with("--config=")
                || arg == "--kit"
                || arg.starts_with("--kit=")
        }) || args.first().is_some_and(|arg| {
            ["dev", "inspect", "stop", "restart", "skills"].contains(&arg.as_str())
        });
        if new_mode {
            let message = format!("{error:#}");
            let prefix = message.split(':').next().unwrap_or("");
            let code = if prefix.starts_with("E_") {
                prefix.to_owned()
            } else {
                "E_RUNTIME".to_owned()
            };
            let failure = kit_commands::KitError { code, message };
            if args.iter().any(|arg| arg == "--json") {
                println!(
                    "{}",
                    serde_json::json!({"schemaVersion":1,"operation":args.first(),"status":"failed","diagnostics":[{"code":failure.code,"phase":"invocation","message":failure.message}]})
                );
            } else {
                eprintln!("{}: {}", failure.code, failure.message);
            }
            std::process::exit(failure.exit_code());
        }
        eprintln!("error: {error:#}");
        std::process::exit(1);
    }
}
fn request(operation: &str, root: PathBuf, kit: KitSelectors) -> kit_commands::KitRequest {
    kit_commands::KitRequest {
        operation: operation.into(),
        root,
        config: kit.config,
        target: kit.target,
        instance: kit.instance,
        trust_local_config: kit.trust_local_config,
        plan: None,
        json: kit.json,
        kit: None,
        port: kit.port,
        profile: kit.profile,
        release: false,
        evaluate_config: false,
    }
}
fn execute_kit(request: kit_commands::KitRequest) -> Result<()> {
    let json = request.json;
    match kit_commands::execute(request) {
        Ok(value) => {
            if json {
                println!("{}", serde_json::to_string(&value)?);
            } else {
                println!("{}", serde_json::to_string_pretty(&value)?);
            }
            Ok(())
        }
        Err(error) => {
            if json {
                println!(
                    "{}",
                    serde_json::json!({"schemaVersion":1,"status":"failed","diagnostics":[{"code":error.code,"message":error.message}]})
                );
            } else {
                eprintln!("{}: {}", error.code, error.message);
            }
            std::process::exit(error.exit_code());
        }
    }
}
fn reject_unselected_kit_flags(kit: &KitSelectors) -> Result<()> {
    if kit.config.is_none()
        && (kit.target.is_some()
            || kit.instance.is_some()
            || kit.trust_local_config
            || kit.port.is_some()
            || kit.profile.is_some()
            || kit.json)
    {
        bail!("E_CONFIG_FLAGS: host-kit selectors require explicit --config loop.config.ts");
    }
    Ok(())
}
fn legacy_selection(path: &Path, operation: &str) -> Result<()> {
    if path.is_dir() && path.join("loop.config.ts").exists() {
        if !path.join("loop.toml").exists() {
            bail!(
                "E_CONFIG_OPT_IN: loop.config.ts is present; use loop {operation} {} --config loop.config.ts --trust-local-config",
                path.display()
            );
        }
        eprintln!("loop.config.ts ignored: legacy loop.toml selected; use --config to opt in");
    }
    Ok(())
}
fn execute() -> Result<()> {
    dev::install_cancellation()?;
    match Cli::parse().command {
        Command::Upgrade => manage::start("Upgrade"),
        Command::Uninstall => manage::start("Uninstall"),
        Command::Doctor { root, json } => {
            if json {
                let tools: Vec<serde_json::Value> = ["bun", "cargo", "rustc"].into_iter().map(|tool| {
                    let mut command = std::process::Command::new(tool);
                    command.current_dir(&root).env("RUSTUP_AUTO_INSTALL", "0").env("BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0").env_remove("BUN_OPTIONS").env_remove("NODE_OPTIONS");
                    if tool == "bun" { command.args(["--no-install", "--no-env-file"]); }
                    let result = command.arg("--version").output();
                    match result {
                        Ok(output) if output.status.success() => serde_json::json!({"id":tool,"available":true,"version":String::from_utf8_lossy(&output.stdout).trim()}),
                        Ok(output) => serde_json::json!({"id":tool,"available":false,"diagnostic":String::from_utf8_lossy(&output.stderr).trim()}),
                        Err(error) => serde_json::json!({"id":tool,"available":false,"diagnostic":error.to_string()}),
                    }
                }).collect();
                let value = serde_json::json!({"schemaVersion":1,"operation":"doctor","executedConfig":false,"root":root,"configPresent":root.join("loop.config.ts").is_file(),"platform":{"os":std::env::consts::OS,"arch":std::env::consts::ARCH,"officialNativeSupported":cfg!(windows)},"tools":tools,"status":"ok","diagnostics":[]});
                println!("{value}");
                Ok(())
            } else {
                dev::doctor()
            }
        }
        Command::Create(options) => {
            if let Some(kit) = options.kit {
                let args: Vec<String> = std::env::args().collect();
                if args.iter().any(|arg| {
                    [
                        "--host",
                        "--host-source",
                        "--template-dir",
                        "--template",
                        "--language",
                    ]
                    .iter()
                    .any(|flag| arg == flag || arg.starts_with(&format!("{flag}=")))
                }) {
                    bail!("E_CONFIG_FLAGS: --kit cannot be combined with legacy create flags");
                }
                let mut req = request(
                    "create",
                    options.legacy.path,
                    KitSelectors {
                        json: options.json,
                        ..Default::default()
                    },
                );
                req.kit = Some(kit);
                execute_kit(req)
            } else {
                let path = dev::create(options.legacy)?;
                println!(
                    "Created {}\nNext: loop run {}",
                    path.display(),
                    path.display()
                );
                Ok(())
            }
        }
        Command::Add {
            command:
                Add::Component {
                    name,
                    language,
                    workspace,
                },
        } => dev::add(&workspace, name, language),
        Command::Build { path, release, kit } => {
            if kit.config.is_some() {
                let mut req = request("build", path, kit);
                req.release = release;
                execute_kit(req)
            } else {
                reject_unselected_kit_flags(&kit)?;
                legacy_selection(&path, "build")?;
                println!("Built {}", dev::build(&path, release, true)?.display());
                Ok(())
            }
        }
        Command::Run {
            path,
            headless,
            actions,
            writable,
            kit,
        } => {
            if kit.config.is_some() {
                if headless
                    || writable
                    || std::env::args()
                        .any(|arg| arg == "--actions" || arg.starts_with("--actions="))
                {
                    bail!(
                        "E_CONFIG_FLAGS: legacy --headless/--writable/--actions are not kit grants or profiles"
                    );
                }
                execute_kit(request("run", path, kit))
            } else {
                reject_unselected_kit_flags(&kit)?;
                legacy_selection(&path, "run")?;
                legacy_run(path, headless, actions, writable)
            }
        }
        Command::Dev { root, kit } => execute_kit(request("dev", root, kit)),
        Command::Inspect {
            root,
            plan,
            evaluate_config,
            kit,
        } => {
            let mut req = request("inspect", root, kit);
            req.plan = plan;
            req.evaluate_config = evaluate_config;
            execute_kit(req)
        }
        Command::Stop {
            instance,
            root,
            target,
            json,
        } => execute_kit(request(
            "stop",
            root,
            KitSelectors {
                instance: Some(instance),
                target,
                json,
                ..Default::default()
            },
        )),
        Command::Restart {
            instance,
            root,
            target,
            trust_local_config,
            json,
        } => execute_kit(request(
            "restart",
            root,
            KitSelectors {
                instance: Some(instance),
                target,
                trust_local_config,
                json,
                ..Default::default()
            },
        )),
        Command::NativeSurface {
            profile_dir,
            instance_id,
            epoch,
        } => loop_host::native_kit::run_surface(loop_host::native_kit::SurfaceOptions {
            profile_dir,
            instance_id,
            epoch,
        }),
        Command::NativeComponent {
            component,
            expected_sha256,
            profile_dir,
            instance_id,
            epoch,
            source,
            writable,
        } => loop_host::native_kit::run_component(loop_host::native_kit::NativeOptions {
            component,
            expected_sha256,
            profile_dir,
            instance_id,
            epoch,
            source,
            writable,
        }),
        Command::Skills { args } => run_skills(args),
    }
}
fn run_skills(args: Vec<String>) -> Result<()> {
    use std::io::Write;
    use std::process::Stdio;
    // Read-only verbs must not materialize even an evaluator tempfile.
    let mut command = std::process::Command::new("bun");
    command
        .args(["--no-install", "--no-env-file", "run", "-"])
        .args(args)
        .env_clear()
        .env("BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0");
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
        if let Some(value) = std::env::var_os(key) {
            command.env(key, value);
        }
    }
    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .context("Bun is required for offline skill management")?;
    let write = child
        .stdin
        .take()
        .context("skill manager stdin missing")?
        .write_all(include_bytes!("../assets/skills.mjs"));
    if let Err(error) = write {
        let _ = child.kill();
        let _ = child.wait();
        return Err(error.into());
    }
    let status = child.wait()?;
    std::process::exit(status.code().unwrap_or(4));
}
fn legacy_run(path: PathBuf, headless: bool, actions: Vec<String>, writable: bool) -> Result<()> {
    let manifest = if path.is_dir() {
        Some(dev::Manifest::read(&path)?)
    } else {
        None
    };
    let component = if path.is_dir() {
        dev::build(&path, false, false)?
    } else {
        path.canonicalize().context("component file missing")?
    };
    let rights = if writable
        || manifest
            .as_ref()
            .is_some_and(|m| m.grants.notes == "read-write")
    {
        Rights::ReadWrite
    } else {
        Rights::ReadOnly
    };
    let notes = Notes::new("A small note, scoped to this application.", rights);
    if !headless
        && manifest
            .as_ref()
            .is_some_and(|m| m.item_type == "application")
    {
        if manifest.as_ref().is_some_and(|m| m.host == "user") {
            if writable {
                bail!("user-owned hosts set their own grants in host/src/main.rs");
            }
            return dev::run_user_host(&path, &component);
        }
        loop_host::desktop::run(component, notes)
    } else {
        let actions = actions
            .iter()
            .map(|s| parse_action(s))
            .collect::<Result<Vec<_>>>()?;
        tokio::runtime::Runtime::new()?.block_on(async { tokio::select! {
            result=loop_host::headless(component,notes,&actions)=>{for view in result? {println!("{}",serde_json::to_string(&view)?);}Ok(())}
            _=tokio::signal::ctrl_c()=>bail!("cancelled"),
        }})
    }
}
fn parse_action(s: &str) -> Result<Action> {
    Ok(match s {
        "refresh" => Action::Refresh,
        "increment" => Action::Increment,
        "delayed-increment" => Action::DelayedIncrement,
        "read-note" => Action::ReadNote,
        "write-note" => Action::WriteNote,
        _ => bail!("unknown action {s}"),
    })
}
