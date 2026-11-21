# Decisions

- **TypeScript first-class:** capability and host APIs work in ordinary JS/TS applications without a component runtime.
- **Separate identity and implementation:** a capability is a stable runtime ID and version plus a TypeScript type association. A provider supplies instances for that contract.
- **Exact runtime matching:** acquisition requires an exact capability version and explicit default or named resolution. No implicit compatibility or fallback to a default provider; see [host lifecycle semantics](packages/host/LIFECYCLE.md).
- **Explicit ownership:** acquisitions are independent by default; explicit shared generations dispose after their last ownership ticket releases. Scope revocation, provider removal and host disposal cancel work and await cleanup. Retain, transfer and borrow have distinct ownership semantics in the lifecycle contract.
- **Cooperative cancellation:** plain JS values are not proxied. Existing references may still be callable after revocation; providers and callers must observe signals.
- **Living repository knowledge:** keep authoritative docs beside their owners and use a small [knowledge-wiki reference web](knowledge/README.md) for discovery, generated indexes/backlinks and structural lint. Agents supply semantic judgment; deterministic tools do bookkeeping. [Tooling evaluation](knowledge/research/knowledge-tools.md) records the pinned adoption and limits; GitHub issues/PRs remain the shared engineering record.
- **Rust remains useful:** the existing native/Wasmtime host and CLI remain maintained implementation work, separate from the TypeScript SDK until an adapter is built.
