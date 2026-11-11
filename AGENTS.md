# Loop Kit agent notes

Loop Kit supplies reusable typed capabilities, explicit resource ownership, portable authored execution and renderer-independent UI. Station (`C:/Users/ijhar/Desktop/station`) owns saved workspaces, defaults, policy and product adapters. Read [architecture](ARCHITECTURE.md) before shared-contract work; proposed adapters are not implemented promises.

Own only agreed files; preserve dirty changes and independent Git/CI ownership. Before editing, name the observable result, owned paths, finite acceptance checks and non-goals. Stop when those checks are satisfied; report actual checks and limits. Capture relevant deferred work in the handoff or owning document, with a reason and next check. Do not create external tasks, install tools or change global settings without an explicit request. Historical ledgers and [the capture workflow](docs/reference/agent-workflow.md) are context, not mandatory reading or task-capture requirements for every change.

For package changes read `packages/AGENTS.md` and the target README; consult relevant architecture sections and `ENGINEERING_PLAN.md` only when its gate affects the task. Use `bun run repo context <package>`, `bun run repo check` and `bun run repo verify <package>` for focused work. `bun run verify` is the full TypeScript/packed-consumer gate; `bun run typecheck` includes automation types. Keep exports and wire identities compatible; no Station imports, service locator or native dependency in ordinary TypeScript consumers. Document API invariants, failure, authority and disposal beside the API.

For documentation read [docs guidance](docs/AGENTS.md), including [public-doc guidance](docs/public/AGENTS.md) for that subtree; for proposals read [spec guidance](specs/AGENTS.md). For substantial prose drafting or editing, explicitly read [the local writing skill](skills/loop-writing/SKILL.md); skip it for mechanical edits. Keep unresolved product/trust decisions in [QUESTIONS.md](QUESTIONS.md) when relevant, with a recommendation; continue independent work without inventing an answer.

Delegate only independent bounded slices when useful; name cwd, baseline, owned files, exclusions and acceptance. Keep shared contracts and integration under one owner. Repo-scoped Codex roles live in `.codex/agents/`; their presence does not configure other harnesses.

Before config, host-kit/plugin, renderer-adapter or dependency-boundary work, read [the host-kit skill](skills/loop-host-kits/SKILL.md) and [proposed contract](specs/host-kits.md). Installation is optional. Executable config/plugins are trusted host code; guests receive only granted imports.

Before adding shared property, action, UI or scripting abstractions, inspect existing public descriptors/controllers/bindings. Keep permissions and live callbacks in trusted hosts. Plain objects, registries, scope IDs and `requiredAuthority` metadata grant no authority. Each DOM/remote adapter needs its own policy, resource and denial evidence; replacing an iframe proves no security property.

The Rust host/CLI and Windows distribution remain active: preserve `.github/workflows`, `scripts/*.ps1`, `site/`, CLI embedded templates and crate packaging. For Rust changes run formatting, locked workspace tests and clippy as documented in [README](README.md). Isolate experiments; source checks do not prove installed native execution.

For releases read [RELEASING.md](RELEASING.md). `bun run release:prepare` produces checksummed tarballs and dry runs; npm publishing is an explicit manual OIDC action. Keep source IDs stable. Never copy package source into Station; use development links or reviewed installed artifacts. Git artifact preparation must fetch a remotely available full revision.
