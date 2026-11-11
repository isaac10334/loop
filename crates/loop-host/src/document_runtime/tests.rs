use super::*;
fn artifact(name: &str) -> Option<Vec<u8>> {
    let root = std::env::var_os("LOOP_DOCUMENT_ARTIFACT_DIR")?;
    Some(
        std::fs::read(
            std::path::PathBuf::from(root).join(format!("loop_document_{name}_guest.wasm")),
        )
        .expect("fresh artifact missing"),
    )
}
#[tokio::test]
async fn current_component_async_and_runaway_isolation() {
    let Some(bytes) = std::env::var_os("LOOP_DOCUMENT_ARTIFACT_DIR").map(|root| {
        std::fs::read(std::path::PathBuf::from(root).join("loop_document_guest.wasm")).unwrap()
    }) else {
        eprintln!("SKIP real Component: set LOOP_DOCUMENT_ARTIFACT_DIR after fresh build");
        return;
    };
    let hash = format!("{:x}", Sha256::digest(&bytes));
    let runtime = DocumentRuntime::new().unwrap();
    let (s, g, d) = fixture(DocumentRights::EDITOR);
    let mut program = runtime
        .instantiate(&bytes, &hash, d, Profile::Document, None)
        .await
        .unwrap();
    let started = std::time::Instant::now();
    let result = program
        .replace_text("hello".into(), "native".into())
        .await
        .unwrap()
        .unwrap();
    assert!(result.contains("native world"));
    assert!(started.elapsed() >= Duration::from_millis(10));
    assert_eq!(s.snapshot().revision, "1");
    drop(program);
    assert_eq!(g.handles(), 0);
    assert_eq!(g.pending(), 0);
    let runaway = artifact("runaway").unwrap();
    let hash = format!("{:x}", Sha256::digest(&runaway));
    let (_, g, d) = fixture(DocumentRights::EDITOR);
    let mut program = runtime
        .instantiate(&runaway, &hash, d, Profile::Document, None)
        .await
        .unwrap();
    let started = std::time::Instant::now();
    assert!(
        program
            .replace_text("hello".into(), "runaway".into())
            .await
            .is_err()
    );
    let elapsed = started.elapsed();
    eprintln!(
        "MEASURED native runaway fuel stop ms={}",
        elapsed.as_millis()
    );
    assert!(elapsed < Duration::from_secs(6));
    assert!(
        program
            .replace_text("hello".into(), "again".into())
            .await
            .is_err()
    );
    drop(program);
    assert_eq!(g.handles(), 0);
    let (_, _, d) = fixture(DocumentRights::EDITOR);
    let mut fresh = runtime
        .instantiate(
            &bytes,
            &format!("{:x}", Sha256::digest(&bytes)),
            d,
            Profile::Document,
            None,
        )
        .await
        .unwrap();
    assert!(
        fresh
            .replace_text("hello".into(), "fresh".into())
            .await
            .unwrap()
            .is_ok()
    );
}
#[tokio::test]
async fn semantic_current_component_close_pending_and_event() {
    let Some(bytes) = artifact("semantic") else {
        return;
    };
    let hash = format!("{:x}", Sha256::digest(&bytes));
    for close in [false, true] {
        let (storage, g, d) = fixture(DocumentRights::EDITOR);
        let surface = crate::native_kit::NativeSurface::new(|_| Ok(()));
        let runtime = DocumentRuntime::new().unwrap();
        let mut program = runtime
            .instantiate(&bytes, &hash, d, Profile::Semantic, Some(surface.clone()))
            .await
            .unwrap();
        let action = async {
            while surface.pending() == 0 {
                tokio::task::yield_now().await;
            }
            if close {
                surface.close();
            } else {
                surface
                    .submit_event(
                        r#"{"revision":0,"sequence":1,"key":"replace","type":"activate"}"#,
                    )
                    .unwrap();
            }
        };
        let (result, _) = tokio::join!(program.run(), action);
        let result = result.unwrap();
        if close {
            assert_eq!(result, Err(Failure::Cancelled));
            assert_eq!(storage.snapshot().revision, "0");
        } else {
            assert!(result.unwrap().contains("semantic world"));
            assert_eq!(storage.snapshot().revision, "1");
        }
        drop(program);
        assert_eq!(g.handles(), 0);
        assert_eq!(g.pending(), 0);
        assert_eq!(surface.pending(), 0);
    }
}
fn fixture(rights: DocumentRights) -> (Arc<MemoryDocument>, DocumentGrant, DocumentLease) {
    let storage = Arc::new(MemoryDocument::new("hello world".into()).unwrap());
    let grant = DocumentGrant::new(
        storage.clone(),
        "alice".into(),
        rights,
        Duration::from_millis(5),
    );
    let lease = grant
        .issue("alice", "epoch-a".into(), Cancellation::default())
        .unwrap();
    (storage, grant, lease)
}
#[tokio::test]
async fn nominal_grants_generation_and_drop() {
    let (s, g, d) = fixture(DocumentRights::VIEWER);
    assert!(matches!(
        d.write("0".into(), "no".into()).await,
        Err(Failure::Denied)
    ));
    assert!(g.issue("bob", "x".into(), Cancellation::default()).is_err());
    g.set_rights(DocumentRights::EDITOR);
    assert!(matches!(d.read().await, Err(Failure::Revoked)));
    let new = g
        .issue("alice", "new".into(), Cancellation::default())
        .unwrap();
    assert!(new.write("0".into(), "yes".into()).await.is_ok());
    assert_eq!(s.snapshot().source, "yes");
    drop(d);
    assert_eq!(g.handles(), 1);
    g.revoke();
    assert!(matches!(new.read().await, Err(Failure::Revoked)));
    drop(new);
    assert_eq!(g.handles(), 0);
    assert_eq!(g.pending(), 0);
}
#[tokio::test]
async fn cas_one_winner_no_retry() {
    let (s, _, d) = fixture(DocumentRights::EDITOR);
    let (a, b) = tokio::join!(
        d.write("0".into(), "A".into()),
        d.write("0".into(), "B".into())
    );
    assert!(matches!(
        (a, b),
        (Ok(_), Err(Failure::Conflict(_))) | (Err(Failure::Conflict(_)), Ok(_))
    ));
    assert_eq!(s.snapshot().revision, "1");
}
#[tokio::test]
async fn cancel_before_commit_and_committed_result() {
    let (s, g, d) = fixture(DocumentRights::EDITOR);
    d.cancel();
    assert_eq!(
        d.write("0".into(), "no".into()).await,
        Err(Failure::Cancelled)
    );
    assert_eq!(s.snapshot().revision, "0");
    assert_eq!(g.pending(), 0);
    let fresh = g
        .issue("alice", "fresh".into(), Cancellation::default())
        .unwrap();
    assert!(fresh.write("0".into(), "yes".into()).await.is_ok());
    fresh.cancel();
    assert_eq!(s.snapshot().source, "yes");
}
#[tokio::test]
async fn dropped_pending_future_releases_accounting() {
    let (_, g, d) = fixture(DocumentRights::EDITOR);
    {
        let future = d.read();
        tokio::pin!(future);
        tokio::select! {_=&mut future=>panic!("delay did not suspend"),_=tokio::task::yield_now()=>{}}
        assert_eq!(g.pending(), 1);
    }
    assert_eq!(g.pending(), 0);
}
#[tokio::test]
async fn two_instances_stop_a_leaves_b() {
    let (a, _, da) = fixture(DocumentRights::EDITOR);
    let (b, _, db) = fixture(DocumentRights::EDITOR);
    da.cancel();
    assert!(matches!(da.read().await, Err(Failure::Cancelled)));
    db.write("0".into(), "B".into()).await.unwrap();
    assert_eq!(a.snapshot().revision, "0");
    assert_eq!(b.snapshot().source, "B");
}
#[tokio::test]
async fn malformed_hash_and_unknown_import_denied() {
    let (_, _, d) = fixture(DocumentRights::EDITOR);
    let runtime = DocumentRuntime::new().unwrap();
    assert!(
        runtime
            .instantiate(b"bad", "0000", d.clone(), Profile::Document, None)
            .await
            .is_err()
    );
    let bytes = br#"(component (import "wasi:filesystem/types@0.2.9" (instance)))"#;
    let component = Component::new(&runtime.engine, bytes).unwrap();
    let error = linker(&runtime.engine, &component, Profile::Document)
        .err()
        .unwrap();
    assert!(format!("{error:#}").contains("unreviewed import wasi:filesystem"));
    let hash = format!("{:x}", Sha256::digest(bytes));
    assert!(
        runtime
            .instantiate(bytes, &hash, d, Profile::Document, None)
            .await
            .is_err()
    );
}
