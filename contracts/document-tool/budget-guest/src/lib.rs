//! Hostile canonical-ABI conformance only. Never an application/default starter.
//! Raw pointer/length arguments deliberately contain invalid UTF-8 without creating
//! an invalid Rust String; the host must reject encoded budget before UTF-8 decode.
wit_bindgen::generate!({ path: "../wit", world: "tool" });
const ENCODED_BUDGET: usize = 2 * (1_048_576 + 256);
struct Budget;
#[cfg(target_arch = "wasm32")]
#[link(wasm_import_module = "loop:document-tool/documents@0.1.0")]
unsafe extern "C" {
    #[link_name = "[async-lower][method]document.write"]
    fn raw_write(params: *mut u8, results: *mut u8) -> i32;
}
impl Guest for Budget {
    async fn replace_text(
        document: &Document,
        from: String,
        _to: String,
    ) -> Result<String, Failure> {
        if from == "valid" {
            let snapshot = document.read().await?;
            return Ok(format!(
                "valid;revision={};source={}",
                snapshot.revision, snapshot.source
            ));
        }
        if from == "overlong-revision" || from == "overlong-utf8-revision" {
            let revision = if from == "overlong-revision" {
                "r".repeat(129)
            } else {
                "é".repeat(65)
            };
            return match document.write(revision, "must not commit".into()).await {
                Err(Failure::InvalidSource(_)) => Ok("revision-rejected".into()),
                _ => Err(Failure::Unavailable),
            };
        }
        if from == "oversized-result" {
            return Ok("x".repeat(ENCODED_BUDGET + 1));
        }
        let size = if from == "invalid-at-budget" {
            ENCODED_BUDGET - 1
        } else {
            ENCODED_BUDGET + 1
        };
        let revision = b"0";
        let payload = vec![0xff_u8; size];
        // wit-bindgen 0.61.1's async-lower ABI: five pointer-sized input
        // fields followed by six pointer-sized result fields in the same area.
        let mut area = [0_usize; 11];
        area[0] = document.handle() as usize;
        area[1] = revision.as_ptr() as usize;
        area[2] = revision.len();
        area[3] = payload.as_ptr() as usize;
        area[4] = payload.len();
        #[cfg(target_arch = "wasm32")]
        unsafe {
            raw_write(area.as_mut_ptr().cast(), area.as_mut_ptr().add(5).cast());
        }
        Err(Failure::Unavailable)
    }
}
export!(Budget);
