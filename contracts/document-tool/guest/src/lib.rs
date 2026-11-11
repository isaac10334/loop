//! Explicit Rust bootstrap for the nominal asynchronous document world.
wit_bindgen::generate!({ path: "../wit", world: "tool" });
struct Tool;
impl Guest for Tool {
    async fn replace_text(document: &Document, from: String, to: String) -> Result<String, Failure> {
        if from.len() > 1_048_576 || to.len() > 1_048_576 {
            return Err(Failure::InvalidSource("replacement input exceeds byte budget".into()));
        }
        let snapshot = document.read().await?;
        let source = snapshot.source.replace(&from, &to);
        if source.len() > 1_048_576 {
            return Err(Failure::InvalidSource("replacement output exceeds byte budget".into()));
        }
        let committed = document.write(snapshot.revision, source).await?;
        Ok(format!("revision={};source={}", committed.revision, committed.source))
    }
}
export!(Tool);
