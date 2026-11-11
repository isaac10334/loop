//! Async document Component profile, independent of legacy app/scripting worlds.
//! Verified immutable code may be reused; stores, grants and surfaces never are.
mod policy;
pub use policy::*;
use sha2::{Digest, Sha256};
use std::{sync::Arc, time::Duration};
use wasmtime::component::{
    Component, ComponentType, Lift, Linker, Lower, Resource, ResourceTable, TypedFunc,
};
use wasmtime::error::ensure;
use wasmtime::{Config, Engine, Store, StoreLimits, StoreLimitsBuilder};

pub const SOURCE_BYTE_BUDGET: usize = 1024 * 1024;
/// Aggregate pre-lift guest-to-host transfer cap, allowing revision/result metadata
/// beside a maximum-size document. Per-field budgets remain separately enforced.
pub const HOSTCALL_BYTE_BUDGET: usize = 2 * (SOURCE_BYTE_BUDGET + 256);
pub const DOCUMENT_INTERFACE: &str = "loop:document-tool/documents@0.1.0";
pub const SURFACE_INTERFACE: &str = "loopkit:ui/surfaces@0.1.0";
#[derive(Clone, Debug, PartialEq, Eq, ComponentType, Lift, Lower)]
#[component(record)]
pub struct Snapshot {
    pub revision: String,
    pub source: String,
}
#[derive(Clone, Debug, PartialEq, Eq, ComponentType, Lift, Lower)]
#[component(variant)]
pub enum Failure {
    #[component(name = "denied")]
    Denied,
    #[component(name = "revoked")]
    Revoked,
    #[component(name = "conflict")]
    Conflict(Snapshot),
    #[component(name = "invalid-source")]
    InvalidSource(String),
    #[component(name = "cancelled")]
    Cancelled,
    #[component(name = "unavailable")]
    Unavailable,
}
/// Separate profiles: semantic UI is never silently added to the document world.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Profile {
    Document,
    Semantic,
}
/// Bounded, trusted semantic surface port. Implementations validate frames/events,
/// close event reads synchronously before joins, and expose no raw owner RPC.
pub trait SurfacePort: Send + Sync {
    fn render(&self, frame: String) -> wasmtime::Result<()>;
    fn next_event(
        &self,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Option<String>> + Send + '_>>;
    fn close(&self);
}
#[derive(Clone)]
struct SurfaceResource(Arc<dyn SurfacePort>);
struct State {
    table: ResourceTable,
    limits: StoreLimits,
}
type Replace = TypedFunc<(Resource<DocumentLease>, String, String), (Result<String, Failure>,)>;
type Run =
    TypedFunc<(Resource<DocumentLease>, Resource<SurfaceResource>), (Result<String, Failure>,)>;
/// Wasmtime48 provider. Artifact hashes establish byte identity, not provenance or
/// a canonical ABI digest; nominal typed lookup validates the selected call ABI.
pub struct DocumentRuntime {
    engine: Engine,
}
struct Initialization {
    document: DocumentLease,
    surface: Option<Arc<dyn SurfacePort>>,
    armed: bool,
}
impl Drop for Initialization {
    fn drop(&mut self) {
        if self.armed {
            self.document.cancel();
            if let Some(surface) = &self.surface {
                surface.close();
            }
        }
    }
}
impl DocumentRuntime {
    pub fn new() -> wasmtime::Result<Self> {
        let mut config = Config::new();
        config
            .wasm_component_model_async(true)
            .consume_fuel(true)
            .cranelift_opt_level(wasmtime::OptLevel::None);
        Ok(Self {
            engine: Engine::new(&config)?,
        })
    }
    pub async fn instantiate(
        &self,
        bytes: &[u8],
        expected_sha256: &str,
        document: DocumentLease,
        profile: Profile,
        surface: Option<Arc<dyn SurfacePort>>,
    ) -> wasmtime::Result<DocumentProgram> {
        let mut initialization = Initialization {
            document: document.clone(),
            surface: surface.clone(),
            armed: true,
        };
        ensure!(!document.is_cancelled(), "initialization cancelled");
        ensure!(bytes.len() <= 32 * 1024 * 1024, "artifact exceeds 32MiB");
        ensure!(
            expected_sha256.len() == 64
                && expected_sha256 == format!("{:x}", Sha256::digest(bytes)),
            "artifact SHA256 mismatch"
        );
        ensure!(
            (profile == Profile::Semantic) == surface.is_some(),
            "surface/profile mismatch"
        );
        let component = Component::new(&self.engine, bytes)?;
        ensure!(!document.is_cancelled(), "initialization cancelled");
        validate_profile(&self.engine, &component, profile)?;
        let linker = linker(&self.engine, &component, profile)?;
        let mut store = Store::new(
            &self.engine,
            State {
                table: ResourceTable::new(),
                limits: StoreLimitsBuilder::new()
                    .memory_size(256 * 1024 * 1024)
                    .instances(32)
                    .tables(32)
                    .memories(16)
                    .build(),
            },
        );
        store.limiter(|s| &mut s.limits);
        store.set_hostcall_fuel(HOSTCALL_BYTE_BUDGET);
        store.set_fuel(100_000_000)?;
        store.fuel_async_yield_interval(Some(100_000))?;
        // Failed initialization drops its store and any partially acquired imports.
        let instance = tokio::select! {
            biased;
            _ = document.cancelled() => wasmtime::error::bail!("initialization cancelled"),
            result = tokio::time::timeout(Duration::from_secs(5), linker.instantiate_async(&mut store, &component)) => result.map_err(|_| wasmtime::Error::msg("initialization deadline"))??,
        };
        ensure!(!document.is_cancelled(), "initialization cancelled");
        let replace = if profile == Profile::Document {
            Some(instance.get_typed_func::<(Resource<DocumentLease>,String,String),(Result<String,Failure>,)>(&mut store,"replace-text")?)
        } else {
            None
        };
        let run = if profile == Profile::Semantic {
            Some(instance.get_typed_func::<(Resource<DocumentLease>,Resource<SurfaceResource>),(Result<String,Failure>,)>(&mut store,"run")?)
        } else {
            None
        };
        let document_rep = store.data_mut().table.push(document.clone())?.rep();
        let surface_rep = match &surface {
            Some(s) => Some(
                store
                    .data_mut()
                    .table
                    .push(SurfaceResource(s.clone()))?
                    .rep(),
            ),
            None => None,
        };
        initialization.armed = false;
        Ok(DocumentProgram {
            store,
            replace,
            run,
            document_rep,
            surface_rep,
            document,
            surface,
            poisoned: false,
        })
    }
}
/// Exclusive mutable entry serializes guest calls. Dropped/cancelled/trapped entry
/// poisons this instance; create a fresh store to restart. No write is retried.
pub struct DocumentProgram {
    store: Store<State>,
    replace: Option<Replace>,
    run: Option<Run>,
    document_rep: u32,
    surface_rep: Option<u32>,
    document: DocumentLease,
    surface: Option<Arc<dyn SurfacePort>>,
    poisoned: bool,
}
impl DocumentProgram {
    pub async fn replace_text(
        &mut self,
        from: String,
        to: String,
    ) -> wasmtime::Result<Result<String, Failure>> {
        ensure!(
            from.len() <= SOURCE_BYTE_BUDGET && to.len() <= SOURCE_BYTE_BUDGET,
            "input budget"
        );
        ensure!(!self.poisoned, "instance poisoned; restart required");
        ensure!(
            !self.document.is_cancelled(),
            "instance cancelled; restart required"
        );
        let func = self
            .replace
            .ok_or_else(|| wasmtime::Error::msg("not document profile"))?;
        self.poisoned = true;
        self.store.set_fuel(100_000_000)?;
        let rep = self.document_rep;
        let result = tokio::time::timeout(
            Duration::from_secs(5),
            self.store.run_concurrent(async |a| {
                func.call_concurrent(a, (Resource::new_borrow(rep), from, to))
                    .await
            }),
        )
        .await
        .map_err(|_| wasmtime::Error::msg("guest deadline; instance poisoned; effects may already be committed; reconcile before retry"))?
        .map_err(uncertain_entry)?
        .map_err(uncertain_entry)?
        .0;
        validate_result(&result).map_err(uncertain_entry)?;
        self.poisoned = false;
        Ok(result)
    }
    pub async fn run(&mut self) -> wasmtime::Result<Result<String, Failure>> {
        ensure!(!self.poisoned, "instance poisoned; restart required");
        ensure!(
            !self.document.is_cancelled(),
            "instance cancelled; restart required"
        );
        let func = self
            .run
            .ok_or_else(|| wasmtime::Error::msg("not semantic profile"))?;
        self.poisoned = true;
        self.store.set_fuel(100_000_000)?;
        let dr = self.document_rep;
        let sr = self.surface_rep.unwrap();
        // Human event wait may be long. Fuel bounds non-yielding execution; the
        // process supervisor supplies a hard wall deadline for UI/host failures.
        let result = self
            .store
            .run_concurrent(async |a| {
                func.call_concurrent(a, (Resource::new_borrow(dr), Resource::new_borrow(sr)))
                    .await
            })
            .await
            .map_err(uncertain_entry)?
            .map_err(uncertain_entry)?
            .0;
        validate_result(&result).map_err(uncertain_entry)?;
        self.poisoned = false;
        Ok(result)
    }
    /// Initiate pre-join shutdown. Store drop releases nominal resources even if
    /// guest cleanup never runs. This does not roll back an earlier commit.
    pub fn stop(&self) {
        self.document.cancel();
        if let Some(s) = &self.surface {
            s.close();
        }
    }
}
impl Drop for DocumentProgram {
    fn drop(&mut self) {
        self.stop();
    }
}
fn uncertain_entry(error: wasmtime::Error) -> wasmtime::Error {
    wasmtime::Error::msg(format!(
        "guest entry failed; instance poisoned; effects may already be committed; reconcile before retry: {error:#}"
    ))
}
fn validate_result(result: &Result<String, Failure>) -> wasmtime::Result<()> {
    match result {
        Ok(s) => ensure!(s.len() <= SOURCE_BYTE_BUDGET + 256, "output budget"),
        Err(Failure::Conflict(s)) => ensure!(
            s.source.len() <= SOURCE_BYTE_BUDGET && s.revision.len() <= 128,
            "snapshot budget"
        ),
        Err(Failure::InvalidSource(s)) => ensure!(s.len() <= 65536, "error budget"),
        _ => {}
    }
    Ok(())
}
fn validate_profile(
    engine: &Engine,
    component: &Component,
    profile: Profile,
) -> wasmtime::Result<()> {
    use wasmtime::component::types::{ComponentItem, Type};
    fn signature(
        function: &wasmtime::component::types::ComponentFunc,
        asynchronous: bool,
        parameters: &[&str],
    ) -> wasmtime::Result<()> {
        ensure!(
            function.async_() == asynchronous,
            "profile async signature mismatch"
        );
        let actual: Vec<_> = function.params().map(|(_, ty)| ty).collect();
        ensure!(
            actual.len() == parameters.len(),
            "profile parameter arity mismatch"
        );
        for (actual, expected) in actual.iter().zip(parameters) {
            ensure!(
                matches!(
                    (actual, *expected),
                    (Type::Borrow(_), "borrow") | (Type::String, "string")
                ),
                "profile borrow/string signature mismatch"
            );
        }
        Ok(())
    }
    let ty = component.component_type();
    let export = match profile {
        Profile::Document => "replace-text",
        Profile::Semantic => "run",
    };
    let item = ty
        .exports(engine)
        .find(|(name, _)| *name == export)
        .ok_or_else(|| wasmtime::Error::msg("missing profile export"))?
        .1;
    let ComponentItem::ComponentFunc(function) = item.ty else {
        wasmtime::error::bail!("profile export is not a function");
    };
    signature(
        &function,
        true,
        if profile == Profile::Document {
            &["borrow", "string", "string"]
        } else {
            &["borrow", "borrow"]
        },
    )?;
    for (name, item) in ty.imports(engine) {
        if name != DOCUMENT_INTERFACE && name != SURFACE_INTERFACE {
            continue;
        }
        let ComponentItem::ComponentInstance(interface) = item.ty else {
            wasmtime::error::bail!("profile import must be an interface");
        };
        for (member, item) in interface.exports(engine) {
            let ComponentItem::ComponentFunc(function) = item.ty else {
                continue;
            };
            match (name, member) {
                (DOCUMENT_INTERFACE, "[method]document.read") => {
                    signature(&function, true, &["borrow"])?
                }
                (DOCUMENT_INTERFACE, "[method]document.write") => {
                    signature(&function, true, &["borrow", "string", "string"])?
                }
                (SURFACE_INTERFACE, "[method]surface.render") => {
                    signature(&function, false, &["borrow", "string"])?
                }
                (SURFACE_INTERFACE, "[method]surface.next-event") => {
                    signature(&function, true, &["borrow"])?
                }
                _ => wasmtime::error::bail!("unreviewed profile operation {name}.{member}"),
            }
        }
    }
    Ok(())
}
fn linker(
    engine: &Engine,
    component: &Component,
    profile: Profile,
) -> wasmtime::Result<Linker<State>> {
    use wasmtime::component::types::ComponentItem;
    let mut linker = Linker::<State>::new(engine);
    struct Pollable;
    struct WasiError;
    struct InputStream;
    struct OutputStream;
    struct TerminalInput;
    struct TerminalOutput;
    // Exact pinned compiler-emitted leaf allowlist, not a `wasi:*` permission.
    for (id, item) in component.component_type().imports(engine) {
        if id == DOCUMENT_INTERFACE || (profile == Profile::Semantic && id == SURFACE_INTERFACE) {
            continue;
        }
        // Root resource aliases are type identities, not additional operations.
        if matches!(item.ty, ComponentItem::Resource(_))
            && (id == "document" || (profile == Profile::Semantic && id == "surface"))
        {
            continue;
        }
        let allowed: &[&str] = match id {
            "wasi:io/poll@0.2.9" => &["pollable", "[method]pollable.block", "poll"],
            "wasi:io/error@0.2.9" => &["error"],
            "wasi:io/streams@0.2.9" => &[
                "input-stream",
                "output-stream",
                "[method]output-stream.subscribe",
                "[method]output-stream.check-write",
                "[method]output-stream.write",
                "[method]output-stream.blocking-flush",
            ],
            "wasi:clocks/monotonic-clock@0.2.9" => &["subscribe-duration"],
            "wasi:cli/exit@0.2.9" => &["exit"],
            "wasi:cli/stdin@0.2.9" => &["get-stdin"],
            "wasi:cli/stdout@0.2.9" => &["get-stdout"],
            "wasi:cli/stderr@0.2.9" => &["get-stderr"],
            "wasi:cli/environment@0.2.9" => &["get-environment"],
            "wasi:cli/terminal-input@0.2.9" => &["terminal-input"],
            "wasi:cli/terminal-output@0.2.9" => &["terminal-output"],
            "wasi:cli/terminal-stdin@0.2.9" => &["get-terminal-stdin"],
            "wasi:cli/terminal-stdout@0.2.9" => &["get-terminal-stdout"],
            "wasi:cli/terminal-stderr@0.2.9" => &["get-terminal-stderr"],
            _ => wasmtime::error::bail!("unreviewed import {id}"),
        };
        let ComponentItem::ComponentInstance(ty) = item.ty else {
            wasmtime::error::bail!("non-interface import {id}");
        };
        let mut iface = linker.instance(id)?;
        for (name, entry) in ty.exports(engine) {
            // Non-resource value aliases cannot be invoked and carry no host authority.
            if matches!(entry.ty, ComponentItem::Type(_)) {
                continue;
            }
            ensure!(
                allowed.contains(&name) || matches!(entry.ty, ComponentItem::Resource(_)),
                "unreviewed runtime import {id}.{name}"
            );
            match entry.ty {
                ComponentItem::Resource(_) => {
                    let rt = match name {
                        "pollable" => wasmtime::component::ResourceType::host::<Pollable>(),
                        "error" => wasmtime::component::ResourceType::host::<WasiError>(),
                        "input-stream" => wasmtime::component::ResourceType::host::<InputStream>(),
                        "output-stream" => {
                            wasmtime::component::ResourceType::host::<OutputStream>()
                        }
                        "terminal-input" => {
                            wasmtime::component::ResourceType::host::<TerminalInput>()
                        }
                        "terminal-output" => {
                            wasmtime::component::ResourceType::host::<TerminalOutput>()
                        }
                        _ => wasmtime::error::bail!("runtime resource denied"),
                    };
                    iface.resource(name, rt, |_, _| {
                        wasmtime::error::bail!("unused runtime resource drop denied")
                    })?;
                }
                ComponentItem::ComponentFunc(_) => {
                    let denied = format!("denied runtime import {id}.{name}");
                    iface.func_new(name, move |_, _, _, _| wasmtime::error::bail!("{denied}"))?;
                }
                _ => wasmtime::error::bail!("runtime type denied {id}.{name}"),
            }
        }
    }
    let mut docs = linker.instance(DOCUMENT_INTERFACE)?;
    docs.resource(
        "document",
        wasmtime::component::ResourceType::host::<DocumentLease>(),
        |mut s, r| {
            s.data_mut()
                .table
                .delete(Resource::<DocumentLease>::new_own(r))?;
            Ok(())
        },
    )?;
    docs.func_wrap_concurrent(
        "[method]document.read",
        |a, (h,): (Resource<DocumentLease>,)| {
            Box::pin(async move {
                let d = a.with(|mut s| s.get().table.get(&h).cloned())?;
                Ok((d.read().await,))
            })
        },
    )?;
    docs.func_wrap_concurrent(
        "[method]document.write",
        |a, (h, r, text): (Resource<DocumentLease>, String, String)| {
            Box::pin(async move {
                let d = a.with(|mut s| s.get().table.get(&h).cloned())?;
                Ok((d.write(r, text).await,))
            })
        },
    )?;
    if profile == Profile::Semantic {
        let mut ui = linker.instance(SURFACE_INTERFACE)?;
        ui.resource(
            "surface",
            wasmtime::component::ResourceType::host::<SurfaceResource>(),
            |mut s, r| {
                let surface = s
                    .data_mut()
                    .table
                    .delete(Resource::<SurfaceResource>::new_own(r))?;
                surface.0.close();
                Ok(())
            },
        )?;
        ui.func_wrap(
            "[method]surface.render",
            |s, (h, text): (Resource<SurfaceResource>, String)| {
                ensure!(text.len() <= 65536, "frame byte budget");
                s.data().table.get(&h)?.0.render(text)
            },
        )?;
        ui.func_wrap_concurrent(
            "[method]surface.next-event",
            |a, (h,): (Resource<SurfaceResource>,)| {
                Box::pin(async move {
                    let s = a.with(|mut s| s.get().table.get(&h).cloned())?;
                    Ok((s.0.next_event().await,))
                })
            },
        )?;
    }
    Ok(linker)
}
#[cfg(test)]
mod conformance;
#[cfg(test)]
mod tests;
