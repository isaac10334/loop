//! Native composition. Rust owns windows, Component stores and shutdown; trusted
//! Bun providers use only the explicit bounded semantic frame/event bridge.
mod surface;
use std::path::PathBuf;
pub use surface::NativeSurface;
/// One process per instance, with exclusive fresh WebView profile ownership.
#[derive(Clone, Debug)]
pub struct NativeOptions {
    pub component: PathBuf,
    pub expected_sha256: String,
    pub profile_dir: PathBuf,
    pub instance_id: String,
    pub epoch: String,
    pub source: String,
    pub writable: bool,
}
/// Launch an ordinary trusted TS provider's native presentation. Stdin/out are
/// dedicated u32-LE JSON frames (render/close in, ready/event/closed out).
#[derive(Clone, Debug)]
pub struct SurfaceOptions {
    pub profile_dir: PathBuf,
    pub instance_id: String,
    pub epoch: String,
}
#[cfg(all(windows, feature = "desktop"))]
mod desktop;
#[cfg(all(windows, feature = "desktop"))]
pub use desktop::{run_component, run_surface};
#[cfg(not(all(windows, feature = "desktop")))]
pub fn run_component(_: NativeOptions) -> anyhow::Result<()> {
    anyhow::bail!("native kit requires Windows desktop feature")
}
#[cfg(not(all(windows, feature = "desktop")))]
pub fn run_surface(_: SurfaceOptions) -> anyhow::Result<()> {
    anyhow::bail!("native kit requires Windows desktop feature")
}
