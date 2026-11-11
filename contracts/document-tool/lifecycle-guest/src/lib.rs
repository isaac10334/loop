//! Deliberately retained borrowed handle + genuine owned resource conformance.
//! This is a separate test-only world, never an official application starter.
wit_bindgen::generate!({ path: "wit", world: "lifecycle", generate_all });
use std::sync::{Mutex, atomic::{AtomicU32, Ordering}};
static SAVED_BORROW: AtomicU32 = AtomicU32::new(u32::MAX);
static OWNED: Mutex<Option<Document>> = Mutex::new(None);
struct Lifecycle;
impl Guest for Lifecycle {
    fn save_borrow(document: &Document) {
        SAVED_BORROW.store(document.handle(), Ordering::SeqCst);
    }
    async fn read_saved() -> Result<Snapshot, Failure> {
        let handle = SAVED_BORROW.load(Ordering::SeqCst);
        if handle == u32::MAX { return Err(Failure::Unavailable); }
        // Intentional hostile reconstruction after the borrow call returned.
        // ManuallyDrop prevents claiming ownership of the borrowed table entry.
        let stolen = core::mem::ManuallyDrop::new(unsafe { Document::from_handle(handle) });
        stolen.read().await
    }
    fn accept_own(document: Document) {
        *OWNED.lock().unwrap() = Some(document);
    }
    async fn read_owned() -> Result<Snapshot, Failure> {
        let document = OWNED.lock().unwrap().take().ok_or(Failure::Unavailable)?;
        let result = document.read().await;
        *OWNED.lock().unwrap() = Some(document);
        result
    }
    fn drop_owned() {
        drop(OWNED.lock().unwrap().take());
    }
}
export!(Lifecycle);
