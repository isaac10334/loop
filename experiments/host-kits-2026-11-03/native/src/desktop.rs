use super::*;
use tao::{event::{Event,WindowEvent},event_loop::{ControlFlow,EventLoopBuilder},window::WindowBuilder};
use wry::{WebViewBuilder,WebViewBuilderExtWindows,WebContext};
#[derive(Clone)]
enum UiEvent { Frame(String), Done(String), Failed(String), Close }
#[derive(Default)]
struct SurfaceState { event:Option<String>, closed:bool, pending:usize }
#[derive(Clone)]
struct Surface { state:Arc<Mutex<SurfaceState>>, release:Arc<tokio::sync::Notify>, proxy:tao::event_loop::EventLoopProxy<UiEvent> }
pub(super) fn run(engine:Engine,component:Component)->Result<()> {
 let root=std::env::current_dir()?;let profile=root.join(std::env::var("PROBE_DESKTOP_PROFILE").unwrap_or("desktop-webview-profile".into()));ensure!(profile.starts_with(&root),"profile must be owned");std::fs::create_dir_all(&profile)?;
 println!("DESKTOP WebView2={} profile={}",wry::webview_version()?,profile.display());
 let events=EventLoopBuilder::<UiEvent>::with_user_event().build();let proxy=events.create_proxy();
 let window=WindowBuilder::new().with_title("Loop isolated document Component probe").with_inner_size(tao::dpi::LogicalSize::new(720.,420.)).build(&events)?;
 let state=Arc::new(Mutex::new(SurfaceState::default()));let release=Arc::new(tokio::sync::Notify::new());let surface=Surface {state:state.clone(),release:release.clone(),proxy:proxy.clone()};
 let ipc_state=state.clone();let ipc_release=release.clone();let ipc_proxy=proxy.clone();
 let mut context=WebContext::new(Some(profile));
 let html=include_str!("desktop.html");
 let webview=WebViewBuilder::new_with_web_context(&mut context)
 .with_additional_browser_args("--remote-debugging-port=0 --remote-debugging-address=127.0.0.1 --no-first-run")
 .with_custom_protocol("loop-probe".into(),move|_,req|{let ok=req.uri().path()=="/";wry::http::Response::builder().status(if ok{200}else{404}).header("Content-Type","text/html; charset=utf-8").body(std::borrow::Cow::Borrowed(if ok{html.as_bytes()}else{&[]})).unwrap()})
 .with_url("loop-probe://localhost/")
 .with_navigation_handler(|url|url=="http://loop-probe.localhost/"||url=="loop-probe://localhost/")
 .with_new_window_req_handler(|_,_|wry::NewWindowResponse::Deny)
 .with_ipc_handler(move|request|{
  if request.uri()!="http://loop-probe.localhost/"||request.body().len()>2048{return;}
  if request.body()=="close"{let _=ipc_proxy.send_event(UiEvent::Close);return;}
  if let Ok(v)=serde_json::from_str::<serde_json::Value>(request.body()) {
   if v["revision"]==0&&v["sequence"]==1&&v["key"]=="replace"&&v["type"]=="activate" {let mut p=ipc_state.lock().unwrap();if !p.closed&&p.event.is_none(){p.event=Some(request.body().clone());drop(p);ipc_release.notify_one();}}
  }
 }).build(&window)?;
 let worker_proxy=proxy.clone();let worker_state=state.clone();
 let worker=std::thread::spawn(move||{
  let rt=tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
  let result=rt.block_on(async {
   let mut linker=base_linker(&engine,&component)?;let mut ui=linker.instance("loopkit:ui/surfaces@0.1.0")?;
   ui.resource("surface",wasmtime::component::ResourceType::host::<Surface>(),|mut s,r|{s.data_mut().table.delete(Resource::<Surface>::new_own(r))?;Ok(())})?;
   ui.func_wrap("[method]surface.render",|s,(h,text):(Resource<Surface>,String)|{ensure!(text.len()<=65536,"frame bound");let surface=s.data().table.get(&h)?;ensure!(!surface.state.lock().unwrap().closed,"closed surface");surface.proxy.send_event(UiEvent::Frame(text)).map_err(|e|wasmtime::Error::msg(e.to_string()))?;Ok(())})?;
   ui.func_wrap_concurrent("[method]surface.next-event",|access,(h,):(Resource<Surface>,)|Box::pin(async move{let surface=access.with(|mut a|a.get().table.get(&h).cloned())?;{let mut p=surface.state.lock().unwrap();p.pending+=1;}surface.release.notified().await;let mut p=surface.state.lock().unwrap();p.pending-=1;Ok((if p.closed{None}else{p.event.take()},))}))?;
   let d=doc(true);let mut store=Store::new(&engine,State {table:ResourceTable::new()});store.set_fuel(100_000_000)?;store.fuel_async_yield_interval(Some(100_000))?;let instance=linker.instantiate_async(&mut store,&component).await?;let f=instance.get_typed_func::<(Resource<Document>,Resource<Surface>),(std::result::Result<String,Failure>,)>(&mut store,"run")?;let dr=store.data_mut().table.push(d.clone())?.rep();let sr=store.data_mut().table.push(surface)?.rep();
   let out=store.run_concurrent(async|a|f.call_concurrent(a,(Resource::new_borrow(dr),Resource::new_borrow(sr))).await).await??.0;
   ensure!(matches!(&out,Ok(v) if v=="revision=1;source=semantic world"),"desktop outcome {out:?}");ensure!(d.0.lock().unwrap().source=="semantic world");
   store.data_mut().table.delete(Resource::<Surface>::new_own(sr))?;close(store,dr,&d)?;ensure!(worker_state.lock().unwrap().pending==0);Ok::<_,wasmtime::Error>(format!("{out:?}; document_events={:?}; pending=0; store/resources dropped",d.0.lock().unwrap().events))
  });
  match result {Ok(v)=>{let _=worker_proxy.send_event(UiEvent::Done(v));},Err(e)=>{let _=worker_proxy.send_event(UiEvent::Failed(format!("{e:#}")));}}
 });
 let deadline=proxy.clone();std::thread::spawn(move||{std::thread::sleep(Duration::from_secs(40));let _=deadline.send_event(UiEvent::Close);});
 let mut worker=Some(worker);let mut ready=false;let mut frames=vec![];let mut done=None;let receipt=root.join("desktop-receipt.json");
 events.run(move|event,_,flow|{
  let _keep_alive=&window;*flow=ControlFlow::Wait;
  match event {
   Event::UserEvent(UiEvent::Frame(frame))=>{frames.push(frame.clone());let script=format!("window.renderFrame({frame})");let _=webview.evaluate_script(&script);ready=true;},
   Event::UserEvent(UiEvent::Done(result))=>{println!("PASS desktop component {result}");done=Some(result);},
   Event::UserEvent(UiEvent::Failed(error))=>{eprintln!("FAIL desktop {error}");done=Some(format!("FAILED {error}"));},
   Event::WindowEvent{event:WindowEvent::CloseRequested,..}|Event::UserEvent(UiEvent::Close)=>{
    state.lock().unwrap().closed=true;release.notify_one();if let Some(w)=worker.take(){let _=w.join();}let record=serde_json::json!({"adapter":"Tao0.37/Wry0.56/WebView2+Wasmtime48; NOT Electrobun/Polyengine desktop","frames":frames,"componentResult":done,"workerJoined":true,"closed":true,"ready":ready,"pendingEventReads":state.lock().unwrap().pending});let _=std::fs::write(&receipt,serde_json::to_string_pretty(&record).unwrap());println!("CLEANUP desktop worker joined/window close");*flow=ControlFlow::Exit;
   },_=>{}
  }
 });
}
