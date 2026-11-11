//! Deliberately non-cooperative conformance fixture; never an application starter.
wit_bindgen::generate!({ path: "../wit", world: "tool" });
struct Runaway;
impl Guest for Runaway {
    async fn replace_text(_document: &Document, _from: String, _to: String) -> Result<String, Failure> {
        let mut counter = 0_u64;
        loop { counter = counter.wrapping_add(1); core::hint::black_box(counter); }
    }
}
export!(Runaway);
