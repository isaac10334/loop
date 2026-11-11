use super::*;
#[derive(Default)]
struct SurfacePolicy { frames: Vec<serde_json::Value>, event: Option<String>, closed: bool, pending: usize }
#[derive(Clone, Default)]
struct Surface { policy: Arc<Mutex<SurfacePolicy>>, entered: Arc<tokio::sync::Notify>, release: Arc<tokio::sync::Notify> }
fn render(surface: &Surface,text: String) -> Result<()> {
    ensure!(text.len()<=65536,"frame bound");let frame:serde_json::Value=serde_json::from_str(&text)?;
    let mut p=surface.policy.lock().unwrap();ensure!(!p.closed,"surface closed");ensure!(frame["revision"].as_u64()==Some(p.frames.len() as u64),"stale frame");p.frames.push(frame);Ok(())
}
pub(super) async fn run(engine:&Engine,component:&Component)->Result<()> {
 let mut linker=base_linker(engine,component)?;
 let mut ui=linker.instance("loopkit:ui/surfaces@0.1.0")?;
 ui.resource("surface",wasmtime::component::ResourceType::host::<Surface>(),|mut s,rep|{s.data_mut().table.delete(Resource::<Surface>::new_own(rep))?;Ok(())})?;
 ui.func_wrap("[method]surface.render",|s,(h,text):(Resource<Surface>,String)|render(s.data().table.get(&h)?,text).map(|_|()))?;
 ui.func_wrap_concurrent("[method]surface.next-event",|access,(h,):(Resource<Surface>,)|Box::pin(async move {
   let surface=access.with(|mut a|a.get().table.get(&h).cloned())?;
   {let mut p=surface.policy.lock().unwrap();p.pending+=1;}
   surface.entered.notify_one();surface.release.notified().await;
   let mut p=surface.policy.lock().unwrap();p.pending-=1;Ok((if p.closed {None}else{p.event.take()},))
 }))?;
 for mode in ["event","close-pending","viewer","revoked","stale-guest-event"] {
  let d=doc(mode!="viewer");let surface=Surface::default();
  let mut store=Store::new(engine,State {table:ResourceTable::new()});store.set_fuel(100_000_000)?;store.fuel_async_yield_interval(Some(100_000))?;
  let instance=linker.instantiate_async(&mut store,component).await?;
  let f=instance.get_typed_func::<(Resource<Document>,Resource<Surface>),(std::result::Result<String,Failure>,)>(&mut store,"run")?;
  let dr=store.data_mut().table.push(d.clone())?.rep();let sr=store.data_mut().table.push(surface.clone())?.rep();
  let call=store.run_concurrent(async |a|f.call_concurrent(a,(Resource::new_borrow(dr),Resource::new_borrow(sr))).await);
  let event=async {surface.entered.notified().await;tokio::time::sleep(Duration::from_millis(40)).await;ensure!(d.0.lock().unwrap().revision==0,"mutation before semantic event");let mut p=surface.policy.lock().unwrap();ensure!(p.pending==1,"not suspended on event");if mode=="close-pending" {p.closed=true;}else{p.event=Some(format!("{{\"revision\":{},\"sequence\":1,\"key\":\"replace\",\"type\":\"activate\"}}",if mode=="stale-guest-event"{9}else{0}));}if mode=="revoked"{d.0.lock().unwrap().revoked=true;}drop(p);surface.release.notify_one();Ok::<(),wasmtime::Error>(())};
  let (out,notified)=tokio::join!(call,event);notified?;let out=out??.0;
  match mode {"event"=>{ensure!(matches!(&out,Ok(s) if s=="revision=1;source=semantic world"));ensure!(surface.policy.lock().unwrap().frames.len()==2);},"close-pending"=>ensure!(matches!(out,Err(Failure::Cancelled))),"viewer"=>ensure!(matches!(out,Err(Failure::Denied))),"revoked"=>ensure!(matches!(out,Err(Failure::Revoked))),_=>ensure!(matches!(out,Err(Failure::InvalidSource(_))))}
  println!("PASS semantic mode={mode} result={out:?} frames={:?}",surface.policy.lock().unwrap().frames);
  if mode!="event"{ensure!(d.0.lock().unwrap().revision==0);}
  store.data_mut().table.delete(Resource::<Surface>::new_own(sr))?;close(store,dr,&d)?;ensure!(surface.policy.lock().unwrap().pending==0);
 }
 println!("DONE semantic native: identical extension bytes; synthetic HOST event, frames captured NOT native-rendered; pending event/document calls=0; stores/resources closed");Ok(())
}
