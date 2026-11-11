use wasmtime::{Result, error::ensure};
use std::{sync::{Arc, Mutex}, time::{Duration, Instant}};
use wasmtime::{Config, Engine, Store};
use wasmtime::component::{Component, ComponentType, Lift, Lower, Linker, Resource, ResourceTable};
mod semantic;
#[cfg(all(windows,feature="desktop"))]
mod desktop;

#[derive(Clone, Debug, ComponentType, Lift, Lower)]
#[component(record)]
struct Snapshot { revision: String, source: String }
#[derive(Clone, Debug, ComponentType, Lift, Lower)]
#[component(variant)]
enum Failure { #[component(name = "denied")] Denied, #[component(name = "revoked")] Revoked, #[component(name = "conflict")] Conflict(Snapshot), #[component(name = "invalid-source")] InvalidSource(String), #[component(name = "cancelled")] Cancelled, #[component(name = "unavailable")] Unavailable }
#[derive(Debug)]
struct Policy { revision: u32, source: String, write: bool, revoked: bool, cancelled: bool, events: Vec<String>, pending: usize }
#[derive(Clone)]
struct Document(Arc<Mutex<Policy>>);
struct State { table: ResourceTable }
fn snapshot(p: &Policy) -> Snapshot { Snapshot { revision: p.revision.to_string(), source: p.source.clone() } }
fn check(p: &Policy, write: bool) -> std::result::Result<(), Failure> {
    if p.revoked { return Err(Failure::Revoked); }
    if p.cancelled { return Err(Failure::Cancelled); }
    if write && !p.write { return Err(Failure::Denied); }
    Ok(())
}
async fn read(doc: Document) -> Result<(std::result::Result<Snapshot, Failure>,)> {
    { let mut p=doc.0.lock().unwrap(); p.events.push("read-enter".into()); p.pending+=1; }
    tokio::time::sleep(Duration::from_millis(35)).await;
    let mut p=doc.0.lock().unwrap(); p.pending-=1; p.events.push("read-resume".into());
    Ok((check(&p,false).map(|_|snapshot(&p)),))
}
async fn write(doc: Document, expected: String, source: String) -> Result<(std::result::Result<Snapshot, Failure>,)> {
    { let mut p=doc.0.lock().unwrap(); p.events.push("write-enter".into()); p.pending+=1; }
    tokio::time::sleep(Duration::from_millis(35)).await;
    let mut p=doc.0.lock().unwrap(); p.pending-=1; p.events.push("write-resume".into());
    let result = (|| {
        check(&p,true)?;
        if source.len()>65536 { return Err(Failure::InvalidSource("64KiB limit".into())); }
        if p.revision.to_string()!=expected { return Err(Failure::Conflict(snapshot(&p))); }
        p.revision+=1; p.source=source; p.events.push("commit".into()); Ok(snapshot(&p))
    })();
    Ok((result,))
}
type Run = wasmtime::component::TypedFunc<(Resource<Document>, String, String), (std::result::Result<String, Failure>,)>;
fn base_linker(engine: &Engine, component: &Component) -> Result<Linker<State>> {
    let mut linker=Linker::<State>::new(engine);
    // Nominal, inert WASI resource types. Every emitted WASI function is explicitly denied.
    struct Pollable; struct WasiError; struct InputStream; struct OutputStream; struct TerminalInput; struct TerminalOutput;
    for (id,item) in component.component_type().imports(engine) {
        if !id.starts_with("wasi:") { continue; }
        if let wasmtime::component::types::ComponentItem::ComponentInstance(ty)=item.ty {
            let mut iface=linker.instance(id)?;
            for (name,entry) in ty.exports(engine) {
                if matches!(entry.ty,wasmtime::component::types::ComponentItem::Resource(_)) {
                    let rt=match name {
                        "pollable"=>wasmtime::component::ResourceType::host::<Pollable>(),
                        "error"=>wasmtime::component::ResourceType::host::<WasiError>(),
                        "input-stream"=>wasmtime::component::ResourceType::host::<InputStream>(),
                        "output-stream"=>wasmtime::component::ResourceType::host::<OutputStream>(),
                        "terminal-input"=>wasmtime::component::ResourceType::host::<TerminalInput>(),
                        "terminal-output"=>wasmtime::component::ResourceType::host::<TerminalOutput>(),
                        _=>wasmtime::error::bail!("unreviewed runtime resource {id}.{name}"),
                    };
                    iface.resource(name,rt,|_,_|wasmtime::error::bail!("unused runtime resource drop denied"))?;
                }
                if matches!(entry.ty,wasmtime::component::types::ComponentItem::ComponentFunc(_)) {
                    let denied=format!("denied unused runtime import {id}.{name}");
                    iface.func_new(name,move |_s,_ty,_p,_r| wasmtime::error::bail!("{denied}"))?;
                }
            }
        }
    }
    let mut iface=linker.instance("loop:document-tool/documents@0.1.0")?;
    iface.resource("document",wasmtime::component::ResourceType::host::<Document>(),|mut s,rep| { s.data_mut().table.delete(Resource::<Document>::new_own(rep))?; Ok(()) })?;
    iface.func_wrap_concurrent("[method]document.read",|access,(handle,):(Resource<Document>,)| {
        Box::pin(async move { let doc=access.with(|mut a|a.get().table.get(&handle).cloned())?; read(doc).await })
    })?;
    iface.func_wrap_concurrent("[method]document.write",|access,(handle,expected,source):(Resource<Document>,String,String)| {
        Box::pin(async move { let doc=access.with(|mut a|a.get().table.get(&handle).cloned())?; write(doc,expected,source).await })
    })?;
    Ok(linker)
}
async fn setup(engine: &Engine, component: &Component, doc: &Document) -> Result<(Store<State>, Run, u32)> {
    let linker=base_linker(engine,component)?;
    let mut store=Store::new(engine,State { table:ResourceTable::new() });
    store.set_fuel(100_000_000)?;
    store.fuel_async_yield_interval(Some(100_000))?;
    let instance=linker.instantiate_async(&mut store,component).await?;
    let run=instance.get_typed_func::<(Resource<Document>,String,String),(std::result::Result<String,Failure>,)>(&mut store,"replace-text")?;
    let resource=store.data_mut().table.push(doc.clone())?;
    Ok((store,run,resource.rep()))
}
async fn invoke(store: &mut Store<State>,run: Run,rep: u32,to: &str) -> Result<std::result::Result<String,Failure>> {
    let to=to.to_string();
    Ok(store.run_concurrent(async |access|run.call_concurrent(access,(Resource::new_borrow(rep),"hello".into(),to)).await).await??.0)
}
fn doc(write: bool) -> Document { Document(Arc::new(Mutex::new(Policy { revision:0,source:"hello world".into(),write,revoked:false,cancelled:false,events:vec![],pending:0 }))) }
fn close(mut store: Store<State>,rep: u32,doc: &Document) -> Result<()> { store.data_mut().table.delete(Resource::<Document>::new_own(rep))?; drop(store); ensure!(doc.0.lock().unwrap().pending==0); Ok(()) }
#[tokio::main]
async fn main() -> Result<()> {
    let path=std::env::args().nth(1).unwrap_or("guest/target/wasm32-wasip2/release/async_document_guest.wasm".into());
    let mut config=Config::new(); config.wasm_component_model_async(true).consume_fuel(true).cranelift_opt_level(wasmtime::OptLevel::None);
    let engine=Engine::new(&config)?; let started=Instant::now(); let component=Component::from_file(&engine,path)?;
    println!("wasmtime_crate=48.0.0 compile_ms={}",started.elapsed().as_millis());
    println!("imports={:?}",component.component_type().imports(&engine).map(|(n,_)|n.to_string()).collect::<Vec<_>>());
    println!("exports={:?}",component.component_type().exports(&engine).map(|(n,_)|n.to_string()).collect::<Vec<_>>());
    #[cfg(all(windows,feature="desktop"))]
    if std::env::args().any(|v|v=="--desktop") { return desktop::run(engine,component); }
    if std::env::args().any(|v|v=="--semantic") { return semantic::run(&engine,&component).await; }
    let d=doc(true); let (mut s,f,r)=setup(&engine,&component,&d).await?; let t=Instant::now();
    let out=invoke(&mut s,f,r,"native").await?; let expected=format!("{}revision=1;source=native world",std::env::var("PROBE_EXPECTED_PREFIX").unwrap_or_default()); ensure!(matches!(&out,Ok(v) if v==&expected)); ensure!(t.elapsed()>=Duration::from_millis(70));
    println!("PASS grant+async result={out:?} elapsed_ms={} events={:?}",t.elapsed().as_millis(),d.0.lock().unwrap().events);
    d.0.lock().unwrap().revoked=true; ensure!(matches!(invoke(&mut s,f,r,"forbidden").await?,Err(Failure::Revoked))); ensure!(d.0.lock().unwrap().revision==1); println!("PASS revoke retained host resource no mutation");
    let forged=invoke(&mut s,f,r+1000,"forged").await; ensure!(forged.is_err()); println!("PASS forged resource trapped: {:?}",forged.err()); close(s,r,&d)?; println!("PASS owner-close pending=0");
    let d=doc(false);let (mut s,f,r)=setup(&engine,&component,&d).await?; ensure!(matches!(invoke(&mut s,f,r,"viewer").await?,Err(Failure::Denied))); ensure!(d.0.lock().unwrap().revision==0);close(s,r,&d)?;println!("PASS viewer write denied no mutation cleanup pending=0");
    let d=doc(true);let (mut a,fa,ra)=setup(&engine,&component,&d).await?;let (mut b,fb,rb)=setup(&engine,&component,&d).await?;
    let (x,y)=tokio::join!(invoke(&mut a,fa,ra,"A"),invoke(&mut b,fb,rb,"B"));let (x,y)=(x?,y?);ensure!(matches!((&x,&y),(Ok(_),Err(Failure::Conflict(_)))|(Err(Failure::Conflict(_)),Ok(_)))); ensure!(d.0.lock().unwrap().revision==1);println!("PASS CAS race exactly one winner x={x:?} y={y:?}; loser draft caller-owned A/B unchanged");close(a,ra,&d)?;close(b,rb,&d)?;
    for (phase,delay,cancel) in [("before-read",10,false),("during-write",50,false),("cancel-before-commit",50,true),("after-commit",100,false)] {
        let d=doc(true);let (mut s,f,r)=setup(&engine,&component,&d).await?;let other=d.clone();
        let change=async move {tokio::time::sleep(Duration::from_millis(delay)).await;let mut p=other.0.lock().unwrap(); if cancel {p.cancelled=true}else{p.revoked=true};};
        let (out,_)=tokio::join!(invoke(&mut s,f,r,"race"),change);let out=out?;
        if delay<70 {ensure!(matches!(out,Err(Failure::Revoked)|Err(Failure::Cancelled)));ensure!(d.0.lock().unwrap().revision==0);}else{ensure!(out.is_ok());ensure!(d.0.lock().unwrap().revision==1);}
        println!("PASS {phase} out={out:?} events={:?}",d.0.lock().unwrap().events);close(s,r,&d)?;
    }
    println!("DONE independent instances disposed; pending host tasks=0. No installed desktop shell claim; no runaway/forced-stop claim.");Ok(())
}
