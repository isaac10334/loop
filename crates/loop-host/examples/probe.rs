use anyhow::{Context, Result, ensure};
use std::{sync::Arc, time::Duration};
use tokio::sync::{Notify, oneshot};
use wasmtime::component::{Component, FutureReader, Linker, ResourceTable, StreamReader};
use wasmtime::{Config, Engine, Store};
use wasmtime_wasi::{WasiCtx, WasiCtxView, WasiView};

#[derive(Default)]
struct State {
    ctx: WasiCtx,
    table: ResourceTable,
}
impl WasiView for State {
    fn ctx(&mut self) -> WasiCtxView<'_> {
        WasiCtxView {
            ctx: &mut self.ctx,
            table: &mut self.table,
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let path = std::env::args_os().nth(1).context("pass probe.wasm")?;
    let mut config = Config::new();
    config.wasm_component_model_async(true);
    let engine = Engine::new(&config)?;
    let component = Component::from_file(&engine, path)?;
    let mut linker = Linker::<State>::new(&engine);
    wasmtime_wasi::p2::add_to_linker_async(&mut linker)?;
    wasmtime_wasi::p3::add_to_linker(&mut linker)?;
    linker.root().func_wrap("feed", |mut store, (): ()| {
        let future = FutureReader::new(&mut store, async {
            tokio::time::sleep(Duration::from_millis(20)).await;
            Ok::<_, wasmtime::Error>(10u32)
        })?;
        let stream = StreamReader::new(&mut store, vec![1u32, 2, 3])?;
        Ok(((future, stream),))
    })?;
    let entered = Arc::new(Notify::new());
    let release = Arc::new(Notify::new());
    let (e, r) = (entered.clone(), release.clone());
    linker
        .root()
        .func_wrap_concurrent("wait-event", move |_access, (): ()| {
            let (e, r) = (e.clone(), r.clone());
            Box::pin(async move {
                e.notify_one();
                r.notified().await;
                Ok((41u32,))
            })
        })?;
    let mut store = Store::new(&engine, State::default());
    let instance = linker.instantiate_async(&mut store, &component).await?;
    let run = instance.get_typed_func::<(), (u32,)>(&mut store, "run")?;
    let clock = instance.get_typed_func::<(), (u64,)>(&mut store, "wasi-clock")?;
    let consume = instance.get_typed_func::<(), (u32,)>(&mut store, "consume")?;
    let (done_tx, mut done_rx) = oneshot::channel();
    let task = tokio::spawn(async move {
        let value = store
            .run_concurrent(async |accessor| run.call_concurrent(accessor, ()).await)
            .await??;
        let _ = done_tx.send(value.0);
        let elapsed = store
            .run_concurrent(async |accessor| clock.call_concurrent(accessor, ()).await)
            .await??;
        let (sum,) = store
            .run_concurrent(async |accessor| consume.call_concurrent(accessor, ()).await)
            .await??;
        ensure!(sum == 16);
        println!("PASS: WIT future<u32> + stream<u32> crossed boundary; sum={sum}");
        Ok::<_, anyhow::Error>(elapsed.0)
    });
    tokio::time::timeout(Duration::from_secs(10), entered.notified()).await?;
    ensure!(
        tokio::time::timeout(Duration::from_millis(75), &mut done_rx)
            .await
            .is_err(),
        "guest completed before event"
    );
    println!("PASS: async guest entered import and remained suspended for 75ms");
    release.notify_one();
    ensure!(tokio::time::timeout(Duration::from_secs(5), done_rx).await?? == 42);
    println!("PASS: host event resumed component async export, result=42");
    let elapsed = task.await??;
    ensure!(elapsed >= 25_000_000);
    println!("PASS: wasi:clocks/monotonic-clock@0.3.0 wait-for elapsed={elapsed}ns");
    Ok(())
}
