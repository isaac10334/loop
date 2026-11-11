//! Replayable adversarial cases for nominal resource and owner lifetimes.
use super::*;
fn named_artifact(name: &str) -> Option<Vec<u8>> {
    std::env::var_os("LOOP_DOCUMENT_ARTIFACT_DIR").map(|root| {
        std::fs::read(
            std::path::PathBuf::from(root).join(format!("loop_document_{name}_guest.wasm")),
        )
        .unwrap()
    })
}
#[tokio::test]
async fn canonical_encoded_budget_traps_before_utf8_and_result_allocation() {
    let Some(bytes) = named_artifact("budget") else {
        return;
    };
    let runtime = DocumentRuntime::new().unwrap();
    let hash = format!("{:x}", Sha256::digest(&bytes));
    assert_eq!(
        hash,
        "10d932472b61474aeb79f5284b216114c044ab09360dfbd986d2a98e306cf9f4"
    );
    for mode in [
        "oversized-invalid",
        "invalid-at-budget",
        "oversized-result",
        "valid",
        "overlong-revision",
        "overlong-utf8-revision",
    ] {
        let (storage, grant, lease, _) = fixture(Duration::ZERO);
        let mut program = runtime
            .instantiate(&bytes, &hash, lease, Profile::Document, None)
            .await
            .unwrap();
        assert_eq!(program.store.hostcall_fuel(), HOSTCALL_BYTE_BUDGET);
        let result = program.replace_text(mode.into(), "unused".into()).await;
        if mode == "valid" {
            assert!(result.unwrap().unwrap().contains("hello world"));
        } else if mode.starts_with("overlong-") {
            assert_eq!(result.unwrap().unwrap(), "revision-rejected");
            assert!(!program.poisoned);
            eprintln!("REVISION_BUDGET mode={mode} guest_result=revision-rejected");
        } else {
            let error = format!("{:#}", result.unwrap_err());
            eprintln!("CANONICAL_BUDGET mode={mode} bytes={HOSTCALL_BYTE_BUDGET} error={error}");
            if mode == "invalid-at-budget" {
                assert!(error.to_lowercase().contains("utf"), "{error}");
            } else {
                assert!(error.to_lowercase().contains("fuel"), "{error}");
                assert!(
                    !error.to_lowercase().contains("invalid utf"),
                    "decoded oversized bytes first: {error}"
                );
            }
            assert!(program.poisoned);
        }
        assert_eq!(storage.snapshot().revision, "0");
        drop(program);
        assert_eq!(grant.handles(), 0);
        assert_eq!(grant.pending(), 0);
    }
}
async fn lifecycle_store(
    runtime: &DocumentRuntime,
    bytes: &[u8],
) -> (Store<State>, wasmtime::component::Instance) {
    let component = Component::new(&runtime.engine, bytes).unwrap();
    let linker = linker(&runtime.engine, &component, Profile::Document).unwrap();
    // This explicit test-only world uses the real reviewed document linker but
    // never passes the production callable-profile allowlist.
    assert!(validate_profile(&runtime.engine, &component, Profile::Document).is_err());
    let mut store = Store::new(
        &runtime.engine,
        State {
            table: ResourceTable::new(),
            limits: StoreLimitsBuilder::new()
                .memory_size(256 * 1024 * 1024)
                .build(),
        },
    );
    store.limiter(|s| &mut s.limits);
    store.set_hostcall_fuel(HOSTCALL_BYTE_BUDGET);
    store.set_fuel(100_000_000).unwrap();
    store.fuel_async_yield_interval(Some(100_000)).unwrap();
    let instance = linker
        .instantiate_async(&mut store, &component)
        .await
        .unwrap();
    (store, instance)
}
#[tokio::test]
async fn actual_guest_retained_borrow_expires_without_new_authority() {
    let Some(bytes) = named_artifact("lifecycle") else {
        return;
    };
    assert_eq!(
        format!("{:x}", Sha256::digest(&bytes)),
        "77d265f824e6fe9eb71226d3db9f1af52c8f758aad9269d94d41c4d49a4314d3"
    );
    let runtime = DocumentRuntime::new().unwrap();
    let (storage, grant, lease, _) = fixture(Duration::ZERO);
    let (mut store, instance) = lifecycle_store(&runtime, &bytes).await;
    let rep = store.data_mut().table.push(lease).unwrap().rep();
    let save = instance
        .get_typed_func::<(Resource<DocumentLease>,), ()>(&mut store, "save-borrow")
        .unwrap();
    store
        .run_concurrent(async |a| save.call_concurrent(a, (Resource::new_borrow(rep),)).await)
        .await
        .unwrap()
        .unwrap();
    let read = instance
        .get_typed_func::<(), (Result<Snapshot, Failure>,)>(&mut store, "read-saved")
        .unwrap();
    let result = store
        .run_concurrent(async |a| read.call_concurrent(a, ()).await)
        .await;
    assert!(
        result.is_err() || result.as_ref().is_ok_and(|v| v.is_err()),
        "retained borrow unexpectedly remained callable"
    );
    eprintln!("LIFETIME retained borrowed handle after call traps={result:?}");
    assert_eq!(storage.snapshot().revision, "0");
    drop(store);
    assert_eq!(grant.handles(), 0);
    assert_eq!(grant.pending(), 0);
}
#[tokio::test]
async fn actual_guest_owned_drop_releases_one_resource_not_sibling() {
    let Some(bytes) = named_artifact("lifecycle") else {
        return;
    };
    let runtime = DocumentRuntime::new().unwrap();
    let (storage, grant, lease, _) = fixture(Duration::ZERO);
    let (mut store, instance) = lifecycle_store(&runtime, &bytes).await;
    let resource = store.data_mut().table.push(lease).unwrap();
    let sibling = grant
        .issue("principal", "sibling".into(), Cancellation::default())
        .unwrap();
    assert_eq!(grant.handles(), 2);
    let accept = instance
        .get_typed_func::<(Resource<DocumentLease>,), ()>(&mut store, "accept-own")
        .unwrap();
    store
        .run_concurrent(async |a| accept.call_concurrent(a, (resource,)).await)
        .await
        .unwrap()
        .unwrap();
    let read = instance
        .get_typed_func::<(), (Result<Snapshot, Failure>,)>(&mut store, "read-owned")
        .unwrap();
    let result = store
        .run_concurrent(async |a| read.call_concurrent(a, ()).await)
        .await
        .unwrap()
        .unwrap()
        .0
        .unwrap();
    assert_eq!(result.source, "hello world");
    let drop_owned = instance
        .get_typed_func::<(), ()>(&mut store, "drop-owned")
        .unwrap();
    store
        .run_concurrent(async |a| drop_owned.call_concurrent(a, ()).await)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(grant.handles(), 1);
    assert!(sibling.read().await.is_ok());
    assert_eq!(storage.snapshot().revision, "0");
    drop(store);
    assert_eq!(grant.handles(), 1);
    drop(sibling);
    assert_eq!(grant.handles(), 0);
    assert_eq!(grant.pending(), 0);
}
#[tokio::test]
async fn same_world_changed_source_v2_changes_native_output() {
    let Some(root) = std::env::var_os("LOOP_DOCUMENT_ARTIFACT_DIR") else {
        return;
    };
    let root = std::path::PathBuf::from(root);
    let original = std::fs::read(root.join("loop_document_guest.wasm")).unwrap();
    let changed = std::fs::read(root.join("loop_document_guest_v2.wasm")).unwrap();
    assert_ne!(Sha256::digest(&original), Sha256::digest(&changed));
    assert_eq!(
        format!("{:x}", Sha256::digest(&changed)),
        "eeae14d35159a8f355d92c137d25f18a77356e8b1c6ba096b812582b3bf38b55"
    );
    let runtime = DocumentRuntime::new().unwrap();
    let (_, grant, lease, _) = fixture(Duration::from_millis(5));
    let mut program = runtime
        .instantiate(
            &changed,
            &format!("{:x}", Sha256::digest(&changed)),
            lease,
            Profile::Document,
            None,
        )
        .await
        .unwrap();
    let output = program
        .replace_text("hello".into(), "native-v2".into())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(output, "fresh-v2;revision=1;source=native-v2 world");
    eprintln!(
        "NATIVE_V2 artifact=eeae14d35159a8f355d92c137d25f18a77356e8b1c6ba096b812582b3bf38b55 output={output}"
    );
    drop(program);
    assert_eq!(grant.handles(), 0);
    assert_eq!(grant.pending(), 0);
}
fn fixture(
    delay: Duration,
) -> (
    Arc<MemoryDocument>,
    DocumentGrant,
    DocumentLease,
    Cancellation,
) {
    let storage = Arc::new(MemoryDocument::new("hello world".into()).unwrap());
    let grant = DocumentGrant::new(
        storage.clone(),
        "principal".into(),
        DocumentRights::EDITOR,
        delay,
    );
    let cancellation = Cancellation::default();
    let lease = grant
        .issue("principal", "epoch".into(), cancellation.clone())
        .unwrap();
    (storage, grant, lease, cancellation)
}
fn document_bytes() -> Option<Vec<u8>> {
    std::env::var_os("LOOP_DOCUMENT_ARTIFACT_DIR").map(|root| {
        std::fs::read(std::path::PathBuf::from(root).join("loop_document_guest.wasm")).unwrap()
    })
}
#[tokio::test]
async fn full_source_returns_bounded_metadata_output() {
    let Some(bytes) = document_bytes() else {
        return;
    };
    let storage = Arc::new(MemoryDocument::new("x".repeat(SOURCE_BYTE_BUDGET)).unwrap());
    let grant = DocumentGrant::new(
        storage.clone(),
        "principal".into(),
        DocumentRights::EDITOR,
        Duration::ZERO,
    );
    let lease = grant
        .issue("principal", "epoch".into(), Cancellation::default())
        .unwrap();
    let runtime = DocumentRuntime::new().unwrap();
    let hash = format!("{:x}", Sha256::digest(&bytes));
    let mut program = runtime
        .instantiate(&bytes, &hash, lease, Profile::Document, None)
        .await
        .unwrap();
    let output = program
        .replace_text("x".into(), "x".into())
        .await
        .unwrap()
        .unwrap();
    assert!(output.starts_with("revision=1;source="));
    assert_eq!(
        output.len(),
        SOURCE_BYTE_BUDGET + "revision=1;source=".len()
    );
    assert_eq!(storage.snapshot().revision, "1");
    eprintln!("FULL_SOURCE_RESULT bytes={} revision=1", output.len());
}
#[tokio::test]
async fn post_commit_presentation_trap_reports_uncertain_not_rollback() {
    let Some(bytes) = named_artifact("semantic") else {
        return;
    };
    let runtime = DocumentRuntime::new().unwrap();
    let (storage, grant, lease, _) = fixture(Duration::ZERO);
    let surface = crate::native_kit::NativeSurface::new(|text| {
        let frame: serde_json::Value = serde_json::from_str(&text)?;
        if frame["revision"] == 1 {
            wasmtime::error::bail!("failed presentation after document commit");
        }
        Ok(())
    });
    let mut program = runtime
        .instantiate(
            &bytes,
            &format!("{:x}", Sha256::digest(&bytes)),
            lease,
            Profile::Semantic,
            Some(surface.clone()),
        )
        .await
        .unwrap();
    let action = async {
        while surface.pending() == 0 {
            tokio::task::yield_now().await;
        }
        surface
            .submit_event(r#"{"revision":0,"sequence":1,"key":"replace","type":"activate"}"#)
            .unwrap();
    };
    let (result, _) = tokio::join!(program.run(), action);
    assert!(format!("{:#}", result.unwrap_err()).contains("reconcile before retry"));
    assert_eq!(storage.snapshot().revision, "1");
    assert_eq!(storage.snapshot().source, "semantic world");
    assert!(program.run().await.is_err());
    drop(program);
    assert_eq!(grant.pending(), 0);
    assert_eq!(grant.handles(), 0);
}
#[tokio::test]
async fn synchronous_substitute_is_not_the_async_profile() {
    let bytes=br#"(component (core module $m (func (export "run"))) (core instance $i (instantiate $m)) (func (export "replace-text") (canon lift (core func $i "run"))))"#;
    let runtime = DocumentRuntime::new().unwrap();
    let (_, _, lease, _) = fixture(Duration::ZERO);
    let error = runtime
        .instantiate(
            bytes,
            &format!("{:x}", Sha256::digest(bytes)),
            lease,
            Profile::Document,
            None,
        )
        .await
        .err()
        .unwrap();
    assert!(format!("{error:#}").contains("async signature mismatch"));
}
#[tokio::test]
async fn cancelled_partial_start_rejects_before_artifact_compilation() {
    let (_, grant, lease, cancellation) = fixture(Duration::ZERO);
    cancellation.cancel();
    let surface = crate::native_kit::NativeSurface::new(|_| Ok(()));
    let runtime = DocumentRuntime::new().unwrap();
    let error = runtime
        .instantiate(
            b"must not compile or hash",
            "not a valid digest",
            lease,
            Profile::Semantic,
            Some(surface.clone()),
        )
        .await
        .err()
        .unwrap();
    assert!(format!("{error:#}").contains("initialization cancelled"));
    assert_eq!(surface.next_event().await, None);
    assert_eq!(grant.pending(), 0);
    assert_eq!(grant.handles(), 0);
}
#[tokio::test]
async fn failed_initialization_aborts_surface_and_releases_owned_resources() {
    let (storage, grant, lease, _) = fixture(Duration::from_millis(5));
    let surface = crate::native_kit::NativeSurface::new(|_| Ok(()));
    let runtime = DocumentRuntime::new().unwrap();
    let result = runtime
        .instantiate(
            b"not a component",
            &format!("{:x}", Sha256::digest(b"not a component")),
            lease,
            Profile::Semantic,
            Some(surface.clone()),
        )
        .await;
    assert!(result.is_err());
    assert_eq!(surface.next_event().await, None);
    assert_eq!(surface.pending(), 0);
    assert_eq!(grant.handles(), 0);
    assert_eq!(grant.pending(), 0);
    assert_eq!(storage.snapshot().revision, "0");
}
#[tokio::test]
async fn authority_is_rechecked_after_suspension_before_commit() {
    for mode in ["revoke", "generation", "cancel"] {
        let (storage, grant, lease, cancellation) = fixture(Duration::from_millis(20));
        let change = async {
            while grant.pending() == 0 {
                tokio::task::yield_now().await;
            }
            match mode {
                "revoke" => grant.revoke(),
                "generation" => grant.set_rights(DocumentRights::VIEWER),
                _ => cancellation.cancel(),
            }
        };
        let (result, _) = tokio::join!(lease.write("0".into(), "forbidden".into()), change);
        assert!(
            matches!(result, Err(Failure::Revoked) | Err(Failure::Cancelled)),
            "mode={mode} result={result:?}"
        );
        assert_eq!(storage.snapshot().revision, "0");
        assert_eq!(grant.pending(), 0);
        drop(lease);
        assert_eq!(grant.handles(), 0);
    }
}
#[tokio::test]
async fn pending_call_budget_and_no_read_rights() {
    let (_, grant, lease, _) = fixture(Duration::from_secs(30));
    let mut calls: Vec<_> = (0..16).map(|_| lease.read()).collect();
    std::future::poll_fn(|cx| {
        for call in &mut calls {
            assert!(call.as_mut().poll(cx).is_pending());
        }
        std::task::Poll::Ready(())
    })
    .await;
    assert_eq!(grant.pending(), 16);
    assert_eq!(lease.read().await, Err(Failure::Unavailable));
    drop(calls);
    assert_eq!(grant.pending(), 0);
    grant.set_rights(DocumentRights {
        read: false,
        write: false,
    });
    // A zero-delay grant gives a direct denial rather than waiting for old calls.
    let storage = Arc::new(MemoryDocument::new("private".into()).unwrap());
    let denied = DocumentGrant::new(
        storage,
        "p".into(),
        DocumentRights {
            read: false,
            write: false,
        },
        Duration::ZERO,
    );
    assert_eq!(
        denied
            .issue("p", "e".into(), Cancellation::default())
            .unwrap()
            .read()
            .await,
        Err(Failure::Denied)
    );
}
#[tokio::test]
async fn budgets_reject_before_storage_and_conflict_preserves_draft() {
    let (storage, grant, lease, _) = fixture(Duration::ZERO);
    assert!(matches!(
        lease
            .write("0".into(), "x".repeat(SOURCE_BYTE_BUDGET + 1))
            .await,
        Err(Failure::InvalidSource(_))
    ));
    assert!(matches!(
        lease.write("x".repeat(129), "x".into()).await,
        Err(Failure::InvalidSource(_))
    ));
    assert_eq!(grant.pending(), 0);
    assert_eq!(storage.snapshot().revision, "0");
    lease.write("0".into(), "winner".into()).await.unwrap();
    let draft = "unchanged losing draft".to_string();
    assert!(
        matches!(lease.write("0".into(),draft.clone()).await,Err(Failure::Conflict(Snapshot{source,..})) if source=="winner")
    );
    assert_eq!(draft, "unchanged losing draft");
    assert!(validate_result(&Ok("x".repeat(SOURCE_BYTE_BUDGET + 256))).is_ok());
    assert!(validate_result(&Ok("x".repeat(SOURCE_BYTE_BUDGET + 257))).is_err());
    assert!(validate_result(&Ok("é".repeat((SOURCE_BYTE_BUDGET + 256) / 2))).is_ok());
    assert!(validate_result(&Ok("é".repeat((SOURCE_BYTE_BUDGET + 256) / 2 + 1))).is_err());
    assert!(validate_result(&Err(Failure::InvalidSource("x".repeat(65536)))).is_ok());
    assert!(validate_result(&Err(Failure::InvalidSource("x".repeat(65537)))).is_err());
    assert!(validate_result(&Err(Failure::InvalidSource("é".repeat(32768)))).is_ok());
    assert!(validate_result(&Err(Failure::InvalidSource("é".repeat(32769)))).is_err());
    assert!(
        validate_result(&Err(Failure::Conflict(Snapshot {
            revision: "0".into(),
            source: "\n".repeat(530000),
        })))
        .is_ok()
    );
}
#[tokio::test]
async fn actual_borrow_forgery_own_drop_and_trap_do_not_cross_instances() {
    let Some(bytes) = document_bytes() else {
        return;
    };
    let hash = format!("{:x}", Sha256::digest(&bytes));
    let runtime = DocumentRuntime::new().unwrap();
    let (sa, ga, da, _) = fixture(Duration::from_millis(2));
    let (sb, gb, db, _) = fixture(Duration::from_millis(2));
    let mut a = runtime
        .instantiate(&bytes, &hash, da, Profile::Document, None)
        .await
        .unwrap();
    let mut b = runtime
        .instantiate(&bytes, &hash, db, Profile::Document, None)
        .await
        .unwrap();
    // Host ingress fault injection: guest still goes through its nominal imported
    // document type and fails when the forged representation reaches the provider.
    a.document_rep = a.document_rep.checked_add(1000).unwrap();
    assert!(
        a.replace_text("hello".into(), "forged".into())
            .await
            .is_err()
    );
    assert!(a.poisoned);
    assert_eq!(sa.snapshot().revision, "0");
    drop(a);
    assert_eq!(ga.handles(), 0);
    assert_eq!(ga.pending(), 0);
    // Actual own-table deletion releases one handle, not a separately issued sibling.
    let sibling = gb
        .issue("principal", "epoch".into(), Cancellation::default())
        .unwrap();
    let sibling_rep = b.store.data_mut().table.push(sibling).unwrap().rep();
    let rep = b.document_rep;
    b.store
        .data_mut()
        .table
        .delete(Resource::<DocumentLease>::new_own(rep))
        .unwrap();
    // Program retains its host cancellation lease until owner close. This is not
    // a guest-owned document destructor test (the reviewed world only borrows).
    assert!(
        b.store
            .data_mut()
            .table
            .get(&Resource::<DocumentLease>::new_borrow(sibling_rep))
            .unwrap()
            .read()
            .await
            .is_ok()
    );
    b.document_rep = sibling_rep;
    assert!(
        b.replace_text("hello".into(), "survivor".into())
            .await
            .unwrap()
            .is_ok()
    );
    assert_eq!(sb.snapshot().source, "survivor world");
    drop(b);
    assert_eq!(gb.handles(), 0);
    assert_eq!(gb.pending(), 0);
}
#[tokio::test]
async fn cancelled_call_future_poisoned_no_late_reply_promotes() {
    let Some(bytes) = document_bytes() else {
        return;
    };
    let runtime = DocumentRuntime::new().unwrap();
    let hash = format!("{:x}", Sha256::digest(&bytes));
    let (storage, grant, lease, cancellation) = fixture(Duration::from_millis(25));
    let mut program = runtime
        .instantiate(&bytes, &hash, lease, Profile::Document, None)
        .await
        .unwrap();
    {
        let call = program.replace_text("hello".into(), "late".into());
        tokio::pin!(call);
        tokio::select! {_=&mut call=>panic!("did not suspend"),_=tokio::time::sleep(Duration::from_millis(2))=>{}}
    }
    cancellation.cancel();
    assert!(
        program
            .replace_text("hello".into(), "retry".into())
            .await
            .is_err()
    );
    drop(program);
    assert_eq!(grant.pending(), 0);
    assert_eq!(grant.handles(), 0);
    tokio::time::sleep(Duration::from_millis(30)).await;
    assert_eq!(storage.snapshot().revision, "0");
}
#[tokio::test]
async fn generated_replayable_grant_sequences() {
    // Fixed seeds are the replay keys. On failure report seed and shortest failing
    // operation prefix; each prefix can be rerun without timing-dependent randomness.
    for seed in 0..8_u64 {
        let (storage, grant, mut lease, _) = fixture(Duration::ZERO);
        let mut random = seed + 1;
        let mut revision = 0_u64;
        let mut generation_valid = true;
        let mut rights = DocumentRights::EDITOR;
        let mut revoked = false;
        for step in 0..24 {
            random = random.wrapping_mul(6364136223846793005).wrapping_add(1);
            let op = (random >> 32) % 5;
            match op {
                0 => {
                    let result = lease.read().await;
                    if !generation_valid || revoked {
                        assert!(
                            matches!(result, Err(Failure::Revoked)),
                            "seed={seed} prefix={step}"
                        );
                    } else {
                        assert!(result.is_ok(), "seed={seed} prefix={step}");
                    }
                }
                1 => {
                    let result = lease
                        .write(revision.to_string(), format!("seed={seed};step={step}"))
                        .await;
                    if revoked || !generation_valid {
                        assert!(
                            matches!(result, Err(Failure::Revoked)),
                            "seed={seed} prefix={step}"
                        );
                    } else if !rights.write {
                        assert_eq!(result, Err(Failure::Denied), "seed={seed} prefix={step}");
                    } else {
                        assert!(result.is_ok(), "seed={seed} prefix={step}");
                        revision += 1;
                    }
                }
                2 => {
                    rights = if rights.write {
                        DocumentRights::VIEWER
                    } else {
                        DocumentRights::EDITOR
                    };
                    grant.set_rights(rights);
                    generation_valid = false;
                }
                3 => {
                    if let Ok(next) =
                        grant.issue("principal", "epoch".into(), Cancellation::default())
                    {
                        lease = next;
                        generation_valid = true;
                    }
                }
                _ => {
                    if step > 16 {
                        grant.revoke();
                        revoked = true;
                    }
                }
            }
            assert_eq!(
                storage.snapshot().revision,
                revision.to_string(),
                "seed={seed} prefix={step}"
            );
            assert_eq!(grant.pending(), 0);
        }
        drop(lease);
        assert_eq!(grant.handles(), 0);
    }
}
