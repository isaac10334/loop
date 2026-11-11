# Rune comparison: limited renderer findings

Contributor research, 2026-11-11. Optional reference only; no dependency, renderer or UI-contract change is proposed by this task.

Inspected Rune's [README](https://github.com/anomalyco/rune/blob/main/README.md), [core API documentation](https://github.com/anomalyco/rune/blob/main/crates/rune/README.md), and actual [element implementation](https://github.com/anomalyco/rune/blob/main/crates/rune/src/el.rs). The fetched branch is mutable, so these observations are not a pinned dependency evaluation. Rune was not built or benchmarked here.

- `El` is an in-process Rust tree combining compact layout/visual fields, keyed children and type-erased handlers. The source uses `Rc` handler state and cold optional fields, with a release-size assertion for the element. It is not a serializable cross-language UI protocol. Loop's frames/events keep callbacks in the application; copying Rune's element API would change that boundary.
- Rune documents queued state mutations between frames, keyed layout caching, presentation-only property tracks and latest-wins live values. These are concrete strategies for separating high-frequency updates from view/layout work. They do not demonstrate a performance advantage over Loop's current DOM renderer; no comparative benchmark was run.
- Rune exposes headless PNG/tree/script interaction and explicit focus/key routing. Loop can profit from similarly explicit behavioral acceptance: focus retention, keyboard activation, stable keys and deterministic teardown. The current DOM renderer already uses native controls and restores keyed focus/selection; a second renderer is unnecessary to test those behaviors.
- Rune owns its GPU/text/layout/native shell. Loop currently delegates browser presentation to DOM and native presentation to Tao/Wry. Rune's rendering details do not establish an unmet portable-contract need or justify GPU/platform scope here.

Follow-up only if measured application behavior warrants it: profile a representative large semantic tree before designing incremental patch transport or high-frequency input APIs. Keep that investigation separate from the public-site/example acceptance.
