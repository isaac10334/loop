mod dev;
mod manage;
use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand};
use loop_host::{Action, Notes, Rights};
use std::path::PathBuf;

#[derive(Parser)]
#[command(
    name = "loop",
    version,
    about = "Create, build and run local component applications"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}
#[derive(Subcommand)]
enum Command {
    /// Download and install the latest Windows release.
    Upgrade,
    /// Remove this managed installation; keep projects and Rust.
    Uninstall,
    /// Report prerequisites and the supported execution paths.
    Doctor,
    /// Create a workspace with a component or desktop application.
    Create(dev::Create),
    /// Add a source component to an existing workspace.
    Add {
        #[command(subcommand)]
        command: Add,
    },
    /// Build sources and run, or load an existing supported component.
    Run {
        #[arg(default_value = ".")]
        path: PathBuf,
        #[arg(long)]
        headless: bool,
        #[arg(long, value_delimiter = ',', default_value = "refresh")]
        actions: Vec<String>,
        #[arg(long)]
        writable: bool,
    },
    /// Produce a component or a standalone directory application bundle.
    Build {
        #[arg(default_value = ".")]
        path: PathBuf,
        #[arg(long)]
        release: bool,
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
        eprintln!("error: {error:#}");
        std::process::exit(1);
    }
}
fn execute() -> Result<()> {
    dev::install_cancellation()?;
    match Cli::parse().command {
        Command::Upgrade => manage::start("Upgrade"),
        Command::Uninstall => manage::start("Uninstall"),
        Command::Doctor => dev::doctor(),
        Command::Create(options) => {
            let path = dev::create(options)?;
            println!(
                "Created {}\nNext: loop run {}",
                path.display(),
                path.display()
            );
            Ok(())
        }
        Command::Add {
            command:
                Add::Component {
                    name,
                    language,
                    workspace,
                },
        } => dev::add(&workspace, name, language),
        Command::Build { path, release } => {
            println!("Built {}", dev::build(&path, release, true)?.display());
            Ok(())
        }
        Command::Run {
            path,
            headless,
            actions,
            writable,
        } => {
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
                tokio::runtime::Runtime::new()?.block_on(async {
                    tokio::select! {
                        result = loop_host::headless(component, notes, &actions) => {
                            for view in result? { println!("{}", serde_json::to_string(&view)?); } Ok(())
                        }
                        _ = tokio::signal::ctrl_c() => bail!("cancelled"),
                    }
                })
            }
        }
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
