//! Windows system-webview provider. The UI thread only renders and routes events.
use crate::{Action, Notes, Runtime, View};
use anyhow::Result;
use std::path::PathBuf;

/// Installed system webview version, for prerequisite diagnostics.
#[cfg(windows)]
pub fn webview_version() -> Result<String> {
    Ok(wry::webview_version()?)
}

/// Open the bundled semantic renderer on the main thread. Close cancels the
/// worker, discards queued input, drops the guest store, and joins the worker.
#[cfg(windows)]
pub fn run(path: PathBuf, notes: Notes) -> Result<()> {
    use tao::{
        event::{Event, WindowEvent},
        event_loop::{ControlFlow, EventLoopBuilder},
        window::WindowBuilder,
    };
    use wry::WebViewBuilder;
    enum UiEvent {
        View(View),
        Error(String),
        Ready,
        Close,
    }
    let event_loop = EventLoopBuilder::<UiEvent>::with_user_event().build();
    let window = WindowBuilder::new()
        .with_title("loop • a little progress")
        .with_inner_size(tao::dpi::LogicalSize::new(820., 640.))
        .build(&event_loop)?;
    let (tx, mut rx) = tokio::sync::mpsc::channel::<Action>(8);
    let (close_tx, mut close_rx) = tokio::sync::oneshot::channel::<()>();
    let ready_proxy = event_loop.create_proxy();
    let smoke = std::env::var_os("LOOP_UI_SMOKE").map(PathBuf::from);
    let smoke_enabled = smoke.is_some();
    let webview = WebViewBuilder::new()
        .with_custom_protocol("loop".into(), |_, request| {
            let (status, body) = if request.uri().path() == "/" {
                (200, include_str!("desktop.html"))
            } else {
                (404, "Not found")
            };
            wry::http::Response::builder()
                .status(status)
                .header("Content-Type", "text/html; charset=utf-8")
                .body(std::borrow::Cow::Borrowed(body.as_bytes()))
                .unwrap()
        })
        .with_url("loop://localhost/")
        // Only this fixed document may use the bridge. No navigation or popups.
        .with_navigation_handler(|url| {
            url == "http://loop.localhost/" || url == "loop://localhost/"
        })
        .with_new_window_req_handler(|_, _| wry::NewWindowResponse::Deny)
        .with_ipc_handler(move |request| {
            if request.uri() != "http://loop.localhost/" {
                eprintln!("[webview] rejected unexpected origin: {}", request.uri());
                return;
            }
            if request.body() == "ready" {
                let _ = ready_proxy.send_event(UiEvent::Ready);
                return;
            }
            if smoke_enabled && request.body() == "smoke-close" {
                let _ = ready_proxy.send_event(UiEvent::Close);
                return;
            }
            if request.body().len() > 64 {
                return;
            }
            if let Ok(action) = serde_json::from_str::<Action>(request.body()) {
                let _ = tx.try_send(action);
            }
        })
        .build(&window)?;
    let proxy = event_loop.create_proxy();
    let worker = std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(async {
            let work = async {
                let runtime = Runtime::new()?;
                let mut program = runtime.load(path, notes).await?;
                let view = program.dispatch(Action::Refresh).await?;
                let _ = proxy.send_event(UiEvent::View(view));
                while let Some(action) = rx.recv().await {
                    let view = program.dispatch(action).await?;
                    let _ = proxy.send_event(UiEvent::View(view));
                }
                Ok::<_, anyhow::Error>(())
            };
            tokio::select! {
                _ = &mut close_rx => {},
                result = work => if let Err(e) = result { let _ = proxy.send_event(UiEvent::Error(format!("{e:#}"))); },
            }
        });
    });
    let mut close_tx = Some(close_tx);
    let mut worker = Some(worker);
    let mut ready = false;
    let mut pending = None;
    let mut observed = Vec::new();
    event_loop.run(move |event, _, flow| {
        let _keep_window_alive = &window;
        *flow = ControlFlow::Wait;
        match event {
            Event::WindowEvent { event: WindowEvent::CloseRequested, .. } | Event::UserEvent(UiEvent::Close) => {
                if let Some(tx) = close_tx.take() { let _ = tx.send(()); }
                if let Some(worker) = worker.take() { let _ = worker.join(); }
                if let Some(path) = &smoke {
                    let _ = std::fs::write(path, format!("DOM input -> guest views: {observed:?}; worker joined on close\n"));
                }
                *flow = ControlFlow::Exit;
            }
            Event::UserEvent(UiEvent::Ready) => { ready = true; }
            Event::UserEvent(UiEvent::View(view)) => {
                observed.push(view.count);
                pending = Some(format!("window.render({})", serde_json::to_string(&view).unwrap()));
            }
            Event::UserEvent(UiEvent::Error(error)) => {
                pending = Some(format!("window.showError({})", serde_json::to_string(&error).unwrap()));
            }
            _ => {}
        }
        if ready && let Some(mut script) = pending.take() {
            if smoke_enabled {
                script.push_str(";setTimeout(()=>{const b=document.querySelectorAll('button');if(b.length&&document.querySelector('#view').textContent.includes('Make a little')){const n=document.querySelectorAll('.column>.text')[1].textContent;if(n==='0')b[0].click();else if(n==='1')b[1].click();else window.ipc.postMessage('smoke-close');}},100)");
            }
            let _ = webview.evaluate_script(&script);
        }
    });
}

/// Desktop integration currently targets Windows 11 and WebView2.
#[cfg(not(windows))]
pub fn run(_path: PathBuf, _notes: Notes) -> Result<()> {
    anyhow::bail!("desktop provider currently requires Windows/WebView2; use headless")
}
