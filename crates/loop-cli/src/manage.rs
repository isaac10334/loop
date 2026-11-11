use anyhow::{Context, Result, ensure};
use std::{fs, process::Command};

pub fn start(action: &str) -> Result<()> {
    let exe = std::env::current_exe()?;
    let root = exe
        .parent()
        .and_then(|p| p.parent())
        .context("installation directory missing")?;
    ensure!(
        root.join("installation.json").is_file() && root.join("manage.ps1").is_file(),
        "This CLI is not a managed installation. Install from https://isaac10334.github.io/loop/"
    );
    // Run a temporary copy so an uninstall can remove the installation directory.
    let script = tempfile::Builder::new()
        .prefix("loop-manage-")
        .suffix(".ps1")
        .tempfile()?;
    fs::write(script.path(), include_str!("../assets/manage.ps1"))?;
    let (_, path) = script.keep()?;
    // Encode the wrapper to preserve spaces and apostrophes in Windows paths.
    let quote = |s: &str| s.replace('\'', "''");
    let wrapper = format!(
        "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; try {{ & '{}' -Action {} -InstallDir '{}' -ParentPid {} }} catch {{ Write-Error $_; exit 1 }} finally {{ Remove-Item -LiteralPath '{}' -Force }}",
        quote(&path.to_string_lossy()),
        action,
        quote(&root.to_string_lossy()),
        std::process::id(),
        quote(&path.to_string_lossy())
    );
    use base64::Engine;
    let bytes: Vec<u8> = wrapper.encode_utf16().flat_map(u16::to_le_bytes).collect();
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-OutputFormat",
            "Text",
            "-ExecutionPolicy",
            "Bypass",
            "-EncodedCommand",
            &encoded,
        ])
        .spawn()
        .context("start installation manager")?;
    println!(
        "Started Loop {}. Wait for the manager's completion message before using Loop.",
        action.to_lowercase()
    );
    Ok(())
}
