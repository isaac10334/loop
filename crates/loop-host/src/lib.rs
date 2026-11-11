//! Concrete Wasmtime embedding. Toolchains and templates live outside this crate.
//!
//! ```
//! use loop_host::{Runtime, Notes, Rights};
//! let runtime = Runtime::new()?;
//! let notes = Notes::new("Welcome", Rights::ReadOnly);
//! let grant = notes.grant();
//! grant.revoke();
//! assert!(grant.is_revoked());
//! # Ok::<(), anyhow::Error>(())
//! ```
use anyhow::{Result, bail, ensure};
use std::{
    path::Path,
    sync::{Arc, Mutex},
    time::Duration,
};
use wasmtime::component::{Component, HasSelf, Linker, Resource, ResourceTable, TypedFunc};
use wasmtime::error::Context as WasmtimeContext;
use wasmtime::{Config, Engine, Store, StoreLimits, StoreLimitsBuilder};
use wasmtime_wasi::{WasiCtx, WasiCtxView, WasiView};

#[allow(missing_docs)]
pub mod bindings {
    wasmtime::component::bindgen!({
        path: "wit", world: "application",
        imports: { default: trappable },
        exports: { default: async | store },
        with: { "loopkit:app/notes.store": super::NoteHandle },
        additional_derives: [serde::Serialize, serde::Deserialize],
    });
}
use bindings::loopkit::app::notes::{self, AccessError};
pub use bindings::loopkit::app::ui::{Action, Alignment, Kind, Node, View};

/// Native policy selects rights for one note scope.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Rights {
    ReadOnly,
    ReadWrite,
}
/// Distinguishable authorization failures.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum NoteError {
    #[error("write denied by read-only grant")]
    Denied,
    #[error("grant revoked")]
    Revoked,
}
struct Policy {
    rights: Rights,
    revoked: bool,
    value: String,
    handles: usize,
}
/// Native policy control. Never exposed as a guest import.
#[derive(Clone)]
pub struct Grant(Arc<Mutex<Policy>>);
impl Grant {
    /// Checks and commits hold the same lock. Operations committed before
    /// revocation completes remain complete; subsequent calls fail.
    pub fn revoke(&self) {
        self.0.lock().unwrap().revoked = true;
    }
    /// Change rights on existing handles. Cannot un-revoke a grant.
    pub fn set_rights(&self, rights: Rights) {
        self.0.lock().unwrap().rights = rights;
    }
    /// Whether revocation occurred.
    pub fn is_revoked(&self) -> bool {
        self.0.lock().unwrap().revoked
    }
    /// Live guest resource count.
    pub fn handles(&self) -> usize {
        self.0.lock().unwrap().handles
    }
}
/// Memory-backed provider: each instance receives exactly this scope.
#[derive(Clone)]
pub struct Notes {
    grant: Grant,
}
impl Notes {
    /// Create an isolated scope with no filesystem authority.
    pub fn new(value: impl Into<String>, rights: Rights) -> Self {
        Self {
            grant: Grant(Arc::new(Mutex::new(Policy {
                value: value.into(),
                rights,
                revoked: false,
                handles: 0,
            }))),
        }
    }
    /// Obtain native policy control.
    pub fn grant(&self) -> Grant {
        self.grant.clone()
    }
    fn acquire(&self) -> NoteHandle {
        self.grant.0.lock().unwrap().handles += 1;
        NoteHandle(self.grant.clone())
    }
}
/// Backing for a scoped WIT resource; guest numeric IDs confer no authority alone.
pub struct NoteHandle(Grant);
impl NoteHandle {
    fn read(&self) -> std::result::Result<String, NoteError> {
        let p = self.0.0.lock().unwrap();
        if p.revoked {
            return Err(NoteError::Revoked);
        }
        Ok(p.value.clone())
    }
    fn write(&self, value: String) -> std::result::Result<(), NoteError> {
        let mut p = self.0.0.lock().unwrap();
        if p.revoked {
            return Err(NoteError::Revoked);
        }
        if p.rights != Rights::ReadWrite {
            return Err(NoteError::Denied);
        }
        p.value = value;
        Ok(())
    }
}
impl Drop for NoteHandle {
    fn drop(&mut self) {
        self.0.0.lock().unwrap().handles -= 1;
    }
}
impl From<NoteError> for AccessError {
    fn from(e: NoteError) -> Self {
        match e {
            NoteError::Denied => Self::Denied,
            NoteError::Revoked => Self::Revoked,
        }
    }
}
struct State {
    ctx: WasiCtx,
    table: ResourceTable,
    notes: Notes,
    limits: StoreLimits,
}
impl WasiView for State {
    fn ctx(&mut self) -> WasiCtxView<'_> {
        WasiCtxView {
            ctx: &mut self.ctx,
            table: &mut self.table,
        }
    }
}
impl notes::Host for State {
    fn acquire(&mut self) -> wasmtime::Result<Resource<NoteHandle>> {
        Ok(self.table.push(self.notes.acquire())?)
    }
}
impl notes::HostStore for State {
    fn read(
        &mut self,
        handle: Resource<NoteHandle>,
    ) -> wasmtime::Result<std::result::Result<String, AccessError>> {
        Ok(self.table.get(&handle)?.read().map_err(Into::into))
    }
    fn write(
        &mut self,
        handle: Resource<NoteHandle>,
        value: String,
    ) -> wasmtime::Result<std::result::Result<(), AccessError>> {
        wasmtime::error::ensure!(value.len() <= 64 * 1024, "note exceeds 64 KiB");
        Ok(self.table.get(&handle)?.write(value).map_err(Into::into))
    }
    fn drop(&mut self, handle: Resource<NoteHandle>) -> wasmtime::Result<()> {
        self.table.delete(handle)?;
        Ok(())
    }
}
/// Concrete runtime and providers, reusable across component instances.
pub struct Runtime {
    engine: Engine,
}
impl Runtime {
    /// Enable Component Model async, fuel limits and cooperative yields.
    pub fn new() -> Result<Self> {
        let mut config = Config::new();
        config.wasm_component_model_async(true).consume_fuel(true);
        // Development loads favor fast compilation over peak throughput.
        config.cranelift_opt_level(wasmtime::OptLevel::None);
        Ok(Self {
            engine: Engine::new(&config)?,
        })
    }
    /// Load a loop application or synchronous compatibility component.
    /// Linker failures report the actual required imports and exports.
    pub async fn load(&self, path: impl AsRef<Path>, notes: Notes) -> Result<Program> {
        let path = path.as_ref();
        eprintln!("[host] compiling {}", path.display());
        let component = Component::from_file(&self.engine, path)
            .with_context(|| format!("compile {}", path.display()))?;
        let ty = component.component_type();
        let imports = ty
            .imports(&self.engine)
            .map(|(n, _)| n.to_owned())
            .collect::<Vec<_>>();
        let exports = ty
            .exports(&self.engine)
            .map(|(n, _)| n.to_owned())
            .collect::<Vec<_>>();
        ensure!(
            exports.iter().any(|x| x == "dispatch"),
            "unsupported world: expected loopkit:app/application dispatch(action)->view; exports={exports:?}; imports={imports:?}"
        );
        let mut linker = Linker::new(&self.engine);
        wasmtime_wasi::p2::add_to_linker_async(&mut linker)?;
        wasmtime_wasi::p3::add_to_linker(&mut linker)?;
        notes::add_to_linker::<_, HasSelf<_>>(&mut linker, |s| s)?;
        let mut store = Store::new(
            &self.engine,
            State {
                ctx: WasiCtx::builder().build(),
                table: ResourceTable::new(),
                notes,
                limits: StoreLimitsBuilder::new()
                    .memory_size(256 * 1024 * 1024)
                    .build(),
            },
        );
        store.limiter(|s| &mut s.limits);
        store.set_fuel(100_000_000)?;
        store.fuel_async_yield_interval(Some(100_000))?;
        let instance = linker
            .instantiate_async(&mut store, &component)
            .await
            .with_context(|| {
                format!("link loop world; imports={imports:?}; exports={exports:?}")
            })?;
        let dispatch = instance
            .get_typed_func::<(Action,), (View,)>(&mut store, "dispatch")
            .context("unsupported dispatch signature: expected loopkit:app/ui action and view")?;
        Ok(Program {
            store,
            dispatch,
            poisoned: false,
        })
    }
}
/// Live guest state. Cancelled or trapped calls poison the instance; drop it to
/// cancel remaining work and release all resources, then load a fresh instance.
pub struct Program {
    store: Store<State>,
    dispatch: TypedFunc<(Action,), (View,)>,
    poisoned: bool,
}
impl Program {
    /// Route a typed action to the guest and validate the resulting semantic tree.
    pub async fn dispatch(&mut self, action: Action) -> Result<View> {
        if self.poisoned {
            bail!("instance was cancelled or trapped; reload it");
        }
        self.poisoned = true;
        self.store.set_fuel(100_000_000)?;
        let func = self.dispatch;
        let (view,) = tokio::time::timeout(
            Duration::from_secs(10),
            self.store
                .run_concurrent(async |accessor| func.call_concurrent(accessor, (action,)).await),
        )
        .await
        .context("action exceeded 10 seconds; instance cancelled")???;
        validate_view(&view)?;
        self.poisoned = false;
        Ok(view)
    }
}
/// Validate the bounded preorder tree used by desktop and headless providers.
pub fn validate_view(view: &View) -> Result<()> {
    ensure!(
        !view.nodes.is_empty() && view.nodes.len() <= 128,
        "view needs 1..128 nodes"
    );
    ensure!(view.status.len() <= 4096, "status too long");
    for (i, node) in view.nodes.iter().enumerate() {
        ensure!(
            node.text.len() <= 4096 && node.gap <= 64,
            "node limits exceeded"
        );
        if i == 0 {
            ensure!(node.parent.is_none(), "root must have no parent");
        } else {
            let parent = node.parent.context("only root may omit parent")? as usize;
            ensure!(parent < i, "parent must precede child");
            ensure!(
                matches!(view.nodes[parent].kind, Kind::Row | Kind::Column),
                "parent must be a container"
            );
        }
        ensure!(
            node.action.is_none() || matches!(node.kind, Kind::Button),
            "only buttons carry actions"
        );
    }
    Ok(())
}
/// Execute the same guest contract without a window.
pub async fn headless(
    path: impl AsRef<Path>,
    notes: Notes,
    actions: &[Action],
) -> Result<Vec<View>> {
    let mut program = Runtime::new()?.load(path, notes).await?;
    let mut views = Vec::new();
    for action in actions {
        views.push(program.dispatch(*action).await?);
    }
    Ok(views)
}
#[cfg(feature = "desktop")]
pub mod desktop;
/// Async nominal document execution, separate from legacy application dispatch.
pub mod document_runtime;
/// Native lifecycle/presentation through bounded semantic surface ports.
pub mod native_kit;

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn policy_and_drop() {
        let notes = Notes::new("hello", Rights::ReadOnly);
        let grant = notes.grant();
        let a = notes.acquire();
        let b = notes.acquire();
        assert_eq!(a.read().unwrap(), "hello");
        assert_eq!(a.write("no".into()), Err(NoteError::Denied));
        grant.set_rights(Rights::ReadWrite);
        a.write("yes".into()).unwrap();
        drop(a);
        assert_eq!(grant.handles(), 1);
        assert_eq!(b.read().unwrap(), "yes");
        grant.revoke();
        assert_eq!(b.read(), Err(NoteError::Revoked));
        assert_eq!(b.write("no".into()), Err(NoteError::Revoked));
        drop(b);
        assert_eq!(grant.handles(), 0);
    }
}
