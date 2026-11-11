use super::{NativeOptions, NativeSurface, SurfaceOptions};
use crate::document_runtime::{
    Cancellation, DocumentGrant, DocumentRights, DocumentRuntime, MemoryDocument, Profile,
    SurfacePort,
};
use anyhow::{Result, ensure};
use std::{
    io::{Read, Write},
    sync::{Arc, mpsc},
    time::{Duration, Instant},
};
use tao::{
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoopBuilder},
    platform::run_return::EventLoopExtRunReturn,
    window::WindowBuilder,
};
use wry::{WebContext, WebViewBuilder};
#[derive(Clone)]
enum UiMessage {
    Frame(String),
    Loaded,
    ProtocolFailed(String),
    Finished(Result<String, String>),
    Close,
}
type Output = mpsc::SyncSender<Vec<u8>>;
fn write_frame(out: &Output, value: serde_json::Value) -> Result<()> {
    let bytes = serde_json::to_vec(&value)?;
    ensure!(bytes.len() <= 65536, "bridge output budget");
    let mut frame = Vec::with_capacity(bytes.len() + 4);
    frame.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
    frame.extend_from_slice(&bytes);
    out.try_send(frame)
        .map_err(|e| anyhow::anyhow!("native output queue full/closed: {e}"))?;
    Ok(())
}
fn output_writer(
    proxy: tao::event_loop::EventLoopProxy<UiMessage>,
) -> (Output, mpsc::Receiver<Result<(), String>>) {
    // At most 16x64KiB queued. A stalled parent cannot block event cancellation.
    let (tx, rx) = mpsc::sync_channel::<Vec<u8>>(16);
    let (done, completion) = mpsc::channel();
    std::thread::spawn(move || {
        let result = (|| -> std::io::Result<()> {
            let mut out = std::io::stdout().lock();
            while let Ok(frame) = rx.recv() {
                out.write_all(&frame)?;
                out.flush()?;
            }
            Ok(())
        })();
        let result = result.map_err(|e| e.to_string());
        if let Err(e) = &result {
            let _ = proxy.send_event(UiMessage::ProtocolFailed(e.clone()));
        }
        let _ = done.send(result);
    });
    (tx, completion)
}
/// Must execute on the process main thread. A fresh profile directory is required;
/// the native process does not borrow or discover another application's profile.
pub fn run_component(options: NativeOptions) -> Result<()> {
    let surface = SurfaceOptions {
        profile_dir: options.profile_dir.clone(),
        instance_id: options.instance_id.clone(),
        epoch: options.epoch.clone(),
    };
    run(surface, Some(options))
}
pub fn run_surface(options: SurfaceOptions) -> Result<()> {
    run(options, None)
}
fn run(options: SurfaceOptions, component: Option<NativeOptions>) -> Result<()> {
    ensure!(
        !options.instance_id.is_empty()
            && options.instance_id.len() <= 64
            && !options.epoch.is_empty()
            && options.epoch.len() <= 256,
        "instance/epoch required and bounded"
    );
    if let Some(component) = &component {
        ensure!(
            component.source.len() <= crate::document_runtime::SOURCE_BYTE_BUDGET,
            "source byte budget"
        );
        ensure!(
            component.expected_sha256.len() == 64,
            "artifact SHA256 required"
        );
    }
    ensure!(
        options.profile_dir.is_absolute(),
        "absolute owned profile required"
    );
    // create_dir (not create_dir_all) fails closed on reuse, including stale profiles.
    let parent = options
        .profile_dir
        .parent()
        .ok_or_else(|| anyhow::anyhow!("profile parent"))?;
    std::fs::create_dir_all(parent)?;
    std::fs::create_dir(&options.profile_dir)?;
    let mut events = EventLoopBuilder::<UiMessage>::with_user_event().build();
    let proxy = events.create_proxy();
    let window = WindowBuilder::new()
        .with_title(format!("Loop native · {}", options.instance_id))
        .with_inner_size(tao::dpi::LogicalSize::new(720., 480.))
        .build(&events)?;
    let frames = proxy.clone();
    let surface = NativeSurface::new(move |frame| {
        frames
            .send_event(UiMessage::Frame(frame))
            .map_err(|e| wasmtime::Error::msg(e.to_string()))
    });
    let cancellation = Cancellation::default();
    let (output, output_done) = output_writer(proxy.clone());
    let bridge = component.is_none();
    let ipc_surface = surface.clone();
    let ipc_output = output.clone();
    let ipc_epoch = options.epoch.clone();
    let loaded_proxy = proxy.clone();
    let ipc_errors = proxy.clone();
    let mut context = WebContext::new(Some(options.profile_dir));
    let html = include_str!("desktop.html");
    let webview = WebViewBuilder::new_with_web_context(&mut context)
        .with_custom_protocol("loop-native".into(), move |_, req| {
            let ok = req.uri().path() == "/";
            wry::http::Response::builder()
                .status(if ok { 200 } else { 404 })
                .header("Content-Type", "text/html; charset=utf-8")
                .body(std::borrow::Cow::Borrowed(if ok {
                    html.as_bytes()
                } else {
                    &[]
                }))
                .unwrap()
        })
        .with_url("loop-native://localhost/")
        .with_navigation_handler(|url| {
            url == "http://loop-native.localhost/" || url == "loop-native://localhost/"
        })
        .with_new_window_req_handler(|_, _| wry::NewWindowResponse::Deny)
        .with_on_page_load_handler(move |event, url| {
            if matches!(event, wry::PageLoadEvent::Finished)
                && (url == "http://loop-native.localhost/" || url == "loop-native://localhost/")
            {
                let _ = loaded_proxy.send_event(UiMessage::Loaded);
            }
        })
        .with_ipc_handler(move |request| {
            if request.uri() != "http://loop-native.localhost/" {
                return;
            }
            if ipc_surface.submit_event(request.body()).is_ok()
                && bridge
                && let Some(text) = ipc_surface.take_queued_event()
                && let Ok(event) = serde_json::from_str::<serde_json::Value>(&text)
                && let Err(error) = write_frame(
                    &ipc_output,
                    serde_json::json!({"type":"event","epoch":ipc_epoch,"event":event}),
                )
            {
                let _ = ipc_errors.send_event(UiMessage::ProtocolFailed(error.to_string()));
            }
        })
        .build(&window)?;
    let worker_surface = surface.clone();
    let worker_cancel = cancellation.clone();
    let worker_proxy = proxy.clone();
    let mut worker = component.map(|options| {
        std::thread::spawn(move || {
            let result = (|| -> Result<String> {
                let rt = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()?;
                rt.block_on(async {
                    ensure!(!worker_cancel.is_cancelled(), "native startup cancelled");
                    let mut bytes = Vec::new();
                    std::fs::File::open(&options.component)?
                        .take(32 * 1024 * 1024 + 1)
                        .read_to_end(&mut bytes)?;
                    ensure!(bytes.len() <= 32 * 1024 * 1024, "artifact byte budget");
                    let storage = Arc::new(
                        MemoryDocument::new(options.source)
                            .map_err(|e| anyhow::anyhow!("invalid source {e:?}"))?,
                    );
                    let grant = DocumentGrant::new(
                        storage.clone(),
                        options.instance_id.clone(),
                        if options.writable {
                            DocumentRights::EDITOR
                        } else {
                            DocumentRights::VIEWER
                        },
                        Duration::from_millis(35),
                    );
                    let lease = grant
                        .issue(&options.instance_id, options.epoch, worker_cancel.clone())
                        .map_err(|e| anyhow::anyhow!("grant {e:?}"))?;
                    ensure!(!worker_cancel.is_cancelled(), "native startup cancelled");
                    let runtime = DocumentRuntime::new().map_err(|e| anyhow::anyhow!("{e:#}"))?;
                    ensure!(!worker_cancel.is_cancelled(), "native startup cancelled");
                    let mut program = runtime
                        .instantiate(
                            &bytes,
                            &options.expected_sha256,
                            lease,
                            Profile::Semantic,
                            Some(worker_surface.clone()),
                        )
                        .await
                        .map_err(|e| anyhow::anyhow!("{e:#}"))?;
                    let result = program.run().await.map_err(|e| anyhow::anyhow!("{e:#}"))?;
                    drop(program);
                    grant.revoke();
                    ensure!(
                        grant.pending() == 0 && grant.handles() == 0,
                        "resources remain after store drop"
                    );
                    Ok(format!(
                        "result={result:?}; revision={}; pending=0; handles=0",
                        storage.snapshot().revision
                    ))
                })
            })();
            let _ =
                worker_proxy.send_event(UiMessage::Finished(result.map_err(|e| format!("{e:#}"))));
        })
    });
    {
        let read_surface = surface.clone();
        let read_cancel = cancellation.clone();
        let read_proxy = proxy.clone();
        let epoch = options.epoch.clone();
        // EOF or corruption closes admission and wakes event reads before the UI
        // loop joins anything. Parent supervisor owns this process and stdin thread.
        std::thread::spawn(move || {
            let result = (|| -> Result<()> {
                let mut input = std::io::stdin().lock();
                loop {
                    let mut length = [0; 4];
                    input.read_exact(&mut length)?;
                    let length = u32::from_le_bytes(length) as usize;
                    ensure!(length > 0 && length <= 1024 * 1024, "bridge frame length");
                    let mut bytes = vec![0; length];
                    input.read_exact(&mut bytes)?;
                    let value: serde_json::Value =
                        super::surface::decode(&bytes).map_err(|e| anyhow::anyhow!("{e:#}"))?;
                    ensure!(
                        value["epoch"].as_str() == Some(&epoch),
                        "stale bridge epoch"
                    );
                    match value["type"].as_str() {
                        Some("render") => {
                            ensure!(bridge, "Component owns rendering");
                            ensure!(
                                value.as_object().is_some_and(|o| o.len() == 3),
                                "render fields"
                            );
                            read_surface
                                .render(serde_json::to_string(&value["frame"])?)
                                .map_err(|e| anyhow::anyhow!("{e:#}"))?;
                        }
                        Some("close") => {
                            ensure!(
                                value.as_object().is_some_and(|o| o.len() == 2),
                                "close fields"
                            );
                            return Ok(());
                        }
                        _ => anyhow::bail!("unknown bridge operation"),
                    }
                }
            })();
            read_surface.close();
            read_cancel.cancel();
            let _ = read_proxy.send_event(match result {
                Ok(()) => UiMessage::Close,
                Err(e) => UiMessage::ProtocolFailed(format!("native bridge: {e:#}")),
            });
        });
    }
    let mut close_started: Option<Instant> = None;
    let mut worker_done = bridge;
    let mut failure = None;
    let mut pending_frames = Vec::new();
    let mut page_loaded = false;
    let mut ready = false;
    let mut has_frame = false;
    events.run_return(|event,_,flow|{
        *flow=ControlFlow::WaitUntil(Instant::now()+Duration::from_millis(25));
        match event {
            Event::UserEvent(UiMessage::Frame(frame))=>{has_frame=true;if close_started.is_none(){if page_loaded{if let Err(e)=webview.evaluate_script(&format!("window.renderFrame({frame})")){failure=Some(e.to_string());}}else{pending_frames.push(frame);}}},
            Event::UserEvent(UiMessage::Loaded)=>{page_loaded=true;for frame in pending_frames.drain(..){if let Err(e)=webview.evaluate_script(&format!("window.renderFrame({frame})")){failure=Some(e.to_string());}}},
            Event::UserEvent(UiMessage::Finished(result))=>{worker_done=true;match result{Ok(r)=>eprintln!("[native] {r}"),Err(e)=>{failure=Some(e);surface.close();cancellation.cancel();close_started.get_or_insert(Instant::now());}}},
            Event::UserEvent(UiMessage::ProtocolFailed(error))=>{failure=Some(error);surface.close();cancellation.cancel();close_started.get_or_insert(Instant::now());},
            Event::WindowEvent{event:WindowEvent::CloseRequested,..}|Event::UserEvent(UiMessage::Close)=>{surface.close();cancellation.cancel();close_started.get_or_insert(Instant::now());},_=>{}
        }
        if !ready && page_loaded && (bridge || has_frame) && close_started.is_none() {
            if let Err(e)=write_frame(&output,serde_json::json!({"type":"ready","epoch":options.epoch,"instanceId":options.instance_id})){failure=Some(e.to_string());surface.close();cancellation.cancel();close_started.get_or_insert(Instant::now());}
            ready=true;
        }
        if let Some(started)=close_started {
            if worker_done {*flow=ControlFlow::Exit;}else if started.elapsed()>=Duration::from_secs(5){failure=Some("shutdown deadline exceeded; process supervisor must terminate owned backend".into());*flow=ControlFlow::Exit;}
        }
    });
    surface.close();
    cancellation.cancel();
    if worker_done && let Some(worker) = worker.take() {
        worker
            .join()
            .map_err(|_| anyhow::anyhow!("Component worker panicked"))?;
    }
    write_frame(
        &output,
        serde_json::json!({"type":"closed","epoch":options.epoch,"pendingEventReads":surface.pending()}),
    )?;
    drop(webview);
    drop(output);
    output_done
        .recv_timeout(Duration::from_secs(5))
        .map_err(|_| anyhow::anyhow!("native stdout drain deadline; incomplete shutdown"))?
        .map_err(|e| anyhow::anyhow!(e))?;
    if let Some(error) = failure {
        anyhow::bail!(error);
    }
    ensure!(surface.pending() == 0, "pending event reads after close");
    Ok(())
}
