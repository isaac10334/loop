# loop-host

Build a native host for Loop's WebAssembly component applications. Run your
application headlessly or use the optional Windows desktop feature.

The host uses Wasmtime and exposes scoped capabilities through WIT interfaces.
It supports Loop's application dispatch contract, including Rust async components.

> [!WARNING]
> Experimental API. Requires Rust 1.98 or newer. The desktop feature supports
> Windows with WebView2. See the repository for supported component contracts.

[Documentation and examples](https://github.com/isaac10334/loop)

Licensed under MIT OR Apache-2.0.
