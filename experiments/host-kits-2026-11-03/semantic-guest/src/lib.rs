wit_bindgen::generate!({ path: "wit", world: "semantic-tool", generate_all });
use serde::Deserialize;
struct Tool;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Event { revision: u32, sequence: u32, key: String, r#type: String }
impl Guest for Tool {
    async fn run(document: &Document, surface: &Surface) -> Result<String, Failure> {
        surface.render(r#"{"revision":0,"root":{"type":"button","key":"replace","label":"Replace document","text":"Replace document"}}"#);
        let Some(event)=surface.next_event().await else { return Err(Failure::Cancelled); };
        let event: Event=serde_json::from_str(&event).map_err(|_|Failure::InvalidSource("invalid semantic event".into()))?;
        if event.revision!=0 || event.sequence!=1 || event.key!="replace" || event.r#type!="activate" { return Err(Failure::InvalidSource("stale/unknown event".into())); }
        let before=document.read().await?;
        let after=document.write(before.revision,before.source.replace("hello","semantic")).await?;
        let frame=serde_json::json!({"revision":1,"root":{"type":"text","key":"result","text":after.source}});
        surface.render(&frame.to_string());
        Ok(format!("revision={};source={}",after.revision,after.source))
    }
}
export!(Tool);
