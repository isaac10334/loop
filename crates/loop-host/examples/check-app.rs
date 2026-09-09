//! Real guest-state and cancellation integration; pass a built Rust starter.
use anyhow::{Result, ensure};
use loop_host::{Action, Notes, Rights, Runtime};
use std::time::Duration;
#[tokio::main]
async fn main() -> Result<()> {
    let path = std::env::args_os().nth(1).expect("pass component.wasm");
    let runtime = Runtime::new()?;
    let notes = Notes::new("hello", Rights::ReadOnly);
    let grant = notes.grant();
    let mut p = runtime.load(&path, notes).await?;
    ensure!(p.dispatch(Action::Refresh).await?.count == 0);
    ensure!(p.dispatch(Action::Increment).await?.count == 1);
    let start = std::time::Instant::now();
    ensure!(p.dispatch(Action::DelayedIncrement).await?.count == 2);
    ensure!(start.elapsed() >= Duration::from_millis(750));
    ensure!(
        tokio::time::timeout(
            Duration::from_millis(40),
            p.dispatch(Action::DelayedIncrement)
        )
        .await
        .is_err()
    );
    ensure!(
        p.dispatch(Action::Refresh).await.is_err(),
        "cancelled instance cannot be reused"
    );
    drop(p);
    ensure!(grant.handles() == 0);
    println!(
        "PASS: guest state 0->1->2, delayed boundary, cancellation poisons instance, resources released"
    );
    Ok(())
}
