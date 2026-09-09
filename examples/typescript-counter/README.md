# typescript-counter

Run `loop run .`; build `loop build .`. Rust uses P3 async; TypeScript uses synchronous component ABI. Edit component sources and rerun.

Builds are trusted-local: Cargo build scripts and JS tools execute native code. Generated hosts use loop-host from crates.io. Built bundles need neither Cargo nor the Loop CLI.
