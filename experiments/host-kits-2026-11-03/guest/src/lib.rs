wit_bindgen::generate!({ path: "wit", world: "tool" });

struct Tool;

impl Guest for Tool {
    async fn replace_text(document: &Document, from: String, to: String) -> Result<String, Failure> {
        let snapshot = document.read().await?;
        let source = snapshot.source.replace(&from, &to);
        let committed = document.write(snapshot.revision, source).await?;
        Ok(format!("revision={};source={}", committed.revision, committed.source))
    }
}
export!(Tool);
