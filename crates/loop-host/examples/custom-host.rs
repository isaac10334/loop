//! Native provider policy with an actual component retaining one scoped handle.
use anyhow::{Result, ensure};
use loop_host::{Action, Notes, Rights, Runtime};
#[tokio::main]
async fn main() -> Result<()> {
    let path = std::env::args_os().nth(1).expect("pass component.wasm");
    let notes = Notes::new("hello from the native provider", Rights::ReadOnly);
    let grant = notes.grant();
    let runtime = Runtime::new()?;
    let mut program = runtime.load(path, notes).await?;
    ensure!(program.dispatch(Action::ReadNote).await?.status == "hello from the native provider");
    ensure!(grant.handles() == 1);
    ensure!(
        program
            .dispatch(Action::WriteNote)
            .await?
            .status
            .to_lowercase()
            .contains("denied")
    );
    grant.set_rights(Rights::ReadWrite);
    ensure!(program.dispatch(Action::WriteNote).await?.status == "Note saved.");
    grant.revoke();
    ensure!(
        program
            .dispatch(Action::ReadNote)
            .await?
            .status
            .to_lowercase()
            .contains("revoked")
    );
    ensure!(
        program
            .dispatch(Action::WriteNote)
            .await?
            .status
            .to_lowercase()
            .contains("revoked")
    );
    ensure!(grant.handles() == 1, "guest must reuse its original handle");
    drop(program);
    ensure!(grant.handles() == 0);
    println!(
        "PASS: guest read; denied write; allowed write; revoked existing handle; store drop released handle"
    );
    Ok(())
}
