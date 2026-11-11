//! Inward document ports and policy. Identity and ownership are not authorization.
use super::{Failure, SOURCE_BYTE_BUDGET, Snapshot};
use std::{
    future::Future,
    pin::Pin,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
    time::Duration,
};
use tokio::sync::Notify;

/// Storage transaction port. Implementations must serialize the closure with all
/// other readers/writers and commit only its successful result. No implicit retry.
pub trait DocumentStorage: Send + Sync {
    fn transact(
        &self,
        operation: &mut dyn FnMut(&mut Snapshot) -> Result<Snapshot, Failure>,
    ) -> Result<Snapshot, Failure>;
}
/// Reference storage; concrete products may inject transactional persistence.
pub struct MemoryDocument(Mutex<Snapshot>);
impl MemoryDocument {
    pub fn new(source: String) -> Result<Self, Failure> {
        if source.len() > SOURCE_BYTE_BUDGET {
            return Err(Failure::InvalidSource("source budget".into()));
        }
        Ok(Self(Mutex::new(Snapshot {
            revision: "0".into(),
            source,
        })))
    }
    pub fn snapshot(&self) -> Snapshot {
        self.0.lock().unwrap().clone()
    }
}
impl DocumentStorage for MemoryDocument {
    fn transact(
        &self,
        op: &mut dyn FnMut(&mut Snapshot) -> Result<Snapshot, Failure>,
    ) -> Result<Snapshot, Failure> {
        let mut value = self.0.lock().unwrap();
        // Stage so a failed provider operation cannot mutate committed state.
        let mut staged = value.clone();
        let result = op(&mut staged)?;
        *value = staged;
        Ok(result)
    }
}
/// An instance-local stop source. Cancels pending reads before any task join.
#[derive(Clone, Default)]
pub struct Cancellation(Arc<CancelState>);
#[derive(Default)]
struct CancelState {
    stopped: AtomicBool,
    changed: Notify,
    commit: Mutex<()>,
}
impl Cancellation {
    pub fn cancel(&self) {
        let _commit = self.0.commit.lock().unwrap();
        self.0.stopped.store(true, Ordering::SeqCst);
        self.0.changed.notify_waiters();
    }
    pub fn is_cancelled(&self) -> bool {
        self.0.stopped.load(Ordering::SeqCst)
    }
    pub async fn cancelled(&self) {
        loop {
            let changed = self.0.changed.notified();
            tokio::pin!(changed);
            changed.as_mut().enable();
            if self.is_cancelled() {
                return;
            }
            changed.await;
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct DocumentRights {
    pub read: bool,
    pub write: bool,
}
impl DocumentRights {
    pub const VIEWER: Self = Self {
        read: true,
        write: false,
    };
    pub const EDITOR: Self = Self {
        read: true,
        write: true,
    };
}
struct GrantState {
    generation: u64,
    rights: DocumentRights,
    revoked: bool,
}
struct Owner {
    storage: Arc<dyn DocumentStorage>,
    policy: Mutex<GrantState>,
    principal: String,
    pending: AtomicUsize,
    handles: AtomicUsize,
    revoked: Cancellation,
    delay: Duration,
}
/// Host-issued authorization owner; never exposed to Component imports.
#[derive(Clone)]
pub struct DocumentGrant(Arc<Owner>);
impl DocumentGrant {
    pub fn new(
        storage: Arc<dyn DocumentStorage>,
        principal: String,
        rights: DocumentRights,
        delay: Duration,
    ) -> Self {
        Self(Arc::new(Owner {
            storage,
            policy: Mutex::new(GrantState {
                generation: 1,
                rights,
                revoked: false,
            }),
            principal,
            pending: AtomicUsize::new(0),
            handles: AtomicUsize::new(0),
            revoked: Cancellation::default(),
            delay,
        }))
    }
    /// Permanent revocation. All retained handles fail and pending work wakes.
    pub fn revoke(&self) {
        self.0.policy.lock().unwrap().revoked = true;
        self.0.revoked.cancel();
    }
    /// Rights changes invalidate all prior generations, including pending writes.
    pub fn set_rights(&self, rights: DocumentRights) {
        let mut p = self.0.policy.lock().unwrap();
        p.generation = p
            .generation
            .checked_add(1)
            .expect("grant generation exhausted");
        p.rights = rights;
    }
    pub fn pending(&self) -> usize {
        self.0.pending.load(Ordering::SeqCst)
    }
    pub fn handles(&self) -> usize {
        self.0.handles.load(Ordering::SeqCst)
    }
    /// Bind an unforgeable host resource to a principal, epoch and generation.
    pub fn issue(
        &self,
        principal: &str,
        epoch: String,
        cancellation: Cancellation,
    ) -> Result<DocumentLease, Failure> {
        if principal != self.0.principal || epoch.is_empty() {
            return Err(Failure::Denied);
        }
        let p = self.0.policy.lock().unwrap();
        if p.revoked {
            return Err(Failure::Revoked);
        }
        self.0.handles.fetch_add(1, Ordering::SeqCst);
        Ok(DocumentLease(Arc::new(Lease {
            owner: self.0.clone(),
            generation: p.generation,
            epoch,
            cancellation,
        })))
    }
}
struct Lease {
    owner: Arc<Owner>,
    generation: u64,
    epoch: String,
    cancellation: Cancellation,
}
impl Drop for Lease {
    fn drop(&mut self) {
        self.owner.handles.fetch_sub(1, Ordering::SeqCst);
    }
}
/// Nominal resource backing, issued by policy only. Cloning retains this lease,
/// not another grant. ABI borrows are owned by Wasmtime's call lifetime.
#[derive(Clone)]
pub struct DocumentLease(Arc<Lease>);
struct Pending(Arc<Owner>);
impl Drop for Pending {
    fn drop(&mut self) {
        self.0.pending.fetch_sub(1, Ordering::SeqCst);
    }
}
/// Async narrow provider port. No path lookup, principal lookup or owner dispatcher.
pub trait DocumentPort: Send + Sync {
    fn read(&self) -> Pin<Box<dyn Future<Output = Result<Snapshot, Failure>> + Send + '_>>;
    fn write(
        &self,
        expected: String,
        source: String,
    ) -> Pin<Box<dyn Future<Output = Result<Snapshot, Failure>> + Send + '_>>;
}
impl DocumentLease {
    pub fn epoch(&self) -> &str {
        &self.0.epoch
    }
    pub fn cancel(&self) {
        self.0.cancellation.cancel();
    }
    pub(crate) fn is_cancelled(&self) -> bool {
        self.0.cancellation.is_cancelled()
    }
    pub(crate) async fn cancelled(&self) {
        self.0.cancellation.cancelled().await;
    }
    async fn operation(&self, write: Option<(String, String)>) -> Result<Snapshot, Failure> {
        if write
            .as_ref()
            .is_some_and(|(r, s)| s.len() > SOURCE_BYTE_BUDGET || r.len() > 128)
        {
            return Err(Failure::InvalidSource("source/revision budget".into()));
        }
        let owner = &self.0.owner;
        let mut pending = owner.pending.load(Ordering::SeqCst);
        loop {
            if pending >= 16 {
                return Err(Failure::Unavailable);
            }
            match owner.pending.compare_exchange_weak(
                pending,
                pending + 1,
                Ordering::SeqCst,
                Ordering::SeqCst,
            ) {
                Ok(_) => break,
                Err(current) => pending = current,
            }
        }
        let _pending = Pending(owner.clone());
        tokio::select! {
            biased;
            _ = self.0.cancellation.cancelled() => return Err(Failure::Cancelled),
            _ = owner.revoked.cancelled() => return Err(Failure::Revoked),
            _ = tokio::time::sleep(owner.delay) => {}
        }
        // Authorization, generation, cancellation, CAS and commit share one
        // linearization section. Cancellation never purports to roll back a commit.
        let p = owner.policy.lock().unwrap();
        let _commit = self.0.cancellation.0.commit.lock().unwrap();
        if p.revoked || p.generation != self.0.generation {
            return Err(Failure::Revoked);
        }
        if self.0.cancellation.is_cancelled() {
            return Err(Failure::Cancelled);
        }
        if !p.rights.read || (write.is_some() && !p.rights.write) {
            return Err(Failure::Denied);
        }
        owner.storage.transact(&mut |current| {
            if current.source.len() > SOURCE_BYTE_BUDGET || current.revision.len() > 128 {
                return Err(Failure::Unavailable);
            }
            if let Some((expected, source)) = &write {
                if &current.revision != expected {
                    return Err(Failure::Conflict(current.clone()));
                }
                let next = current
                    .revision
                    .parse::<u64>()
                    .ok()
                    .and_then(|n| n.checked_add(1))
                    .ok_or(Failure::Unavailable)?;
                current.revision = next.to_string();
                current.source = source.clone();
            }
            Ok(current.clone())
        })
    }
}
impl DocumentPort for DocumentLease {
    fn read(&self) -> Pin<Box<dyn Future<Output = Result<Snapshot, Failure>> + Send + '_>> {
        Box::pin(self.operation(None))
    }
    fn write(
        &self,
        expected: String,
        source: String,
    ) -> Pin<Box<dyn Future<Output = Result<Snapshot, Failure>> + Send + '_>> {
        Box::pin(self.operation(Some((expected, source))))
    }
}
