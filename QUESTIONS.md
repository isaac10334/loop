# Architecture questions

Answer the bullets you care about; “use the recommendation” is enough. These are
open choices, not claims that the proposed behavior already exists.

The November 7 [selected scope](specs/host-kits.md) requires only the official
Rust desktop and browser kits. Electrobun is optional compatibility-example work,
not a third kit or release dependency. Preserve host application's independent packaging
and existing Rust compatibility. [Pinned desktop evidence](docs/reference/desktop-hosts.md)
remains reference, not an instruction to integrate it. Same Component bytes remain
required; disposable proof does not complete production acceptance.

## Host-kit follow-up choices

- Which agent-client versions must support project-local skill discovery?
  Recommendation: test Codex's `.agents/skills` route first, keep source usable by
  mandatory AGENTS routing, and advertise no other destination until observed.
  A directory fixture does not prove the real client discovers the skill.
- May the skill manager recover transactions on network/removable filesystems, or
  should v1 require a local same-volume destination? Recommendation: local volume
  first; document Windows sharing and directory-durability limits and reject an
  unsupported backend before writing. Do not promise cross-filesystem atomicity.
- Should a new kit profile support arbitrary third-party executable config/plugins
  or only explicitly trusted local composition at launch? Recommendation: trusted
  local only initially. A remote registry/hostile-code profile needs independent
  isolation, distribution authenticity and review gates; digest verification alone
  does not supply them.
- Which persistent profile/update identity should standalone first-party Loop
  applications use? Recommendation: require each project to name its own identity;
  use transient per-instance development profiles and reserve no host application identifiers,
  ports or update feeds. Choose distribution signing/updates in their own release gate.

## Existing product/runtime questions

- Which first visible tool should we ship: document transform, asset inspector, or a specific existing host application widget? Recommendation: document transform, then an inspector using the same resources.
- Can we retire the old evaluation-only QuickJS experiments once their unique
  findings and a reproducible engine test survive? Recommendation: keep the
  production engine and one useful test; retire duplicate probes.
- Which host application features may disappear before replacements exist? Recommendation:
  only explicitly named experiments; keep user-facing tools and saved data working.
- For portable docking, should Loop own split/tab/floating placement mechanics,
  while host application owns desks, defaults, persistence and permissions? Recommendation:
  yes; prove a second host before moving the implementation.
- Which data feature should follow the runtime: theme variables, asset references,
  or synchronized collections? Recommendation: typed variables/references with an
  inspector before a collection engine.
- Should the first editable source stream remain Git-primary, with asset drafts
  becoming checked PRs? Recommendation: yes; defer simultaneous asset-primary editing.
- Should a connected machine initially expose only selected document/root access
  and build jobs, or also terminals? Recommendation: roots and builds first;
  terminal authority is a separate grant and execution profile.
- Which filesystem rights do you want in the first machine profile: read, write,
  enumerate, create, delete? Recommendation: read/enumerate, then revision-checked
  writes; keep delete separate.
- Should guest grants persist across verified package upgrades, or require review
  on every new artifact? Recommendation: retain only unchanged reviewed contract,
  resource and effect restrictions; review widening before activation.
- Is the first cloud build service private to your projects, or intended for
  external users immediately? Recommendation: private authenticated staging first.
- Should cloud execution ever be selected automatically when local builds fail?
  Recommendation: only through an explicit preapproved provider/cost policy;
  otherwise offer it as a choice.
- Which identity domain/product name should appear in the first Loop login?
  Recommendation: one Loop issuer, separate product clients, host application “Connect Loop.”
- What should the first registry distribute: source templates, Components,
  authored widgets or all three? Recommendation: one tool package containing
  pinned source, Component artifact and a small semantic widget definition.
- Is executing third-party marketplace code a launch requirement? Recommendation:
  keep first-party/local authored execution first; require a separate hostile-code
  isolation gate before third-party activation.
- Should the first docs playground save anonymously on this machine, or require
  Loop login? Recommendation: anonymous local drafts; login for cloud save/build.
- Should TickTick remain a personal capture inbox, with implementation tasks and
  acceptance in repo specs? Recommendation: yes; avoid adding Linear for now.
- Do you want lower-cost models configured for specific Codex agent roles, or
  inherit your current model until we measure a slice? Recommendation: inherit
  initially, then set cheaper models for scans/docs using measured results.
