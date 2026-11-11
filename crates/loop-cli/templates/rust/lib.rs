wit_bindgen::generate!({ path: "wit", world: "application" });
use loopkit::app::{notes, ui::{Alignment, Kind, Node}};
use std::cell::RefCell;

// One state per component instance. Never hold a RefCell borrow across await.
thread_local! {
    static STATE: RefCell<(u32, Option<notes::Store>)> = const { RefCell::new((0, None)) };
}
struct App;
impl Guest for App {
    async fn dispatch(input: Action) -> View {
        if input == Action::DelayedIncrement {
            wasip3::clocks::monotonic_clock::wait_for(800_000_000).await;
        }
        STATE.with(|state| {
            let mut state = state.borrow_mut();
            if state.1.is_none() { state.1 = Some(notes::acquire()); }
            let status = match input {
                Action::Increment | Action::DelayedIncrement => {
                    state.0 = state.0.saturating_add(1);
                    if input == Action::DelayedIncrement { "Resumed after a WASI 0.3 timer.".into() }
                    else { "One small step. State lives in your component.".into() }
                }
                Action::ReadNote => match state.1.as_ref().unwrap().read() {
                    Ok(value) => value, Err(e) => format!("Read: {e:?}"),
                },
                Action::WriteNote => match state.1.as_ref().unwrap().write(&format!("Saved count: {}", state.0)) {
                    Ok(()) => "Note saved.".into(), Err(e) => format!("Write: {e:?}"),
                },
                Action::Refresh => "Ready when you are.".into(),
            };
            let mut nodes = vec![node(None, Kind::Column, "", None, 20),
                node(Some(0), Kind::Text, "Make a little progress.", None, 0),
                node(Some(0), Kind::Text, &state.0.to_string(), None, 0),
                node(Some(0), Kind::Row, "", None, 12)];
            for (text, action) in [("Add one", Action::Increment), ("Add after a moment", Action::DelayedIncrement)] {
                nodes.push(node(Some(3), Kind::Button, text, Some(action), 0));
            }
            nodes.push(node(Some(0), Kind::Row, "", None, 12));
            nodes.push(node(Some(6), Kind::Button, "Read note", Some(Action::ReadNote), 0));
            nodes.push(node(Some(6), Kind::Button, "Save count", Some(Action::WriteNote), 0));
            View { count: state.0, status, nodes }
        })
    }
}
fn node(parent: Option<u32>, kind: Kind, text: &str, action: Option<Action>, gap: u16) -> Node {
    Node { parent, kind, text: text.into(), action, gap, align: Alignment::Start }
}
export!(App);
