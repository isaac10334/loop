# Using and releasing Loop Kit

Install public packages with `bun add @loop-kit/host @loop-kit/capabilities` once
the first npm release is published. The nine prepared packages currently have version
0.1.0: capabilities, host, ui, scripting, workspace, host-browser, host-native,
renderer-dom and component-polyengine. This is a source inventory, not publication evidence.
Source capability IDs and WIT versions are independent of npm versions and must remain compatible.

Build and publish order comes from the manifests via `tooling/packages.ts`:
capabilities precedes host; host and ui precede host-browser, host-native and
renderer-dom; capabilities and ui precede scripting; ui precedes component-polyengine.
Workspace is independent. UI has no React dependency or peer.
All public packages ship ESM JavaScript, declarations and maps with referenced
source, README, dual licenses and repository metadata. Scripting also ships its
optional engine inputs and build script; ordinary imports need no native tools.
The optional engine build retains its pinned Windows compiler and Rust toolchain.

## Published versus prepared (checked November 11, 2026)

Read-only checks of all nine package endpoints at
[the npm registry](https://registry.npmjs.org/) returned HTTP 404. This establishes
neither scope ownership nor permission to publish. Recheck before a release.
[crates.io](https://crates.io/api/v1/crates/loop-host) serves non-yanked `loop-host`
0.1.0, and the [latest Windows CLI release](https://api.github.com/repos/isaac10334/loop/releases/latest)
is v0.1.0. The [published host source](https://docs.rs/crate/loop-host/0.1.0/source/src/lib.rs)
lacks the `native_kit` and `document_runtime` modules used by current source.
The [v0.1.0 CLI](https://github.com/isaac10334/loop/blob/v0.1.0/crates/loop-cli/src/main.rs)
lacks the current typed host-kit commands. Neither published artifact establishes
current host-kit support. This repository's CLI is `publish = false`;
[the similarly named crates.io CLI](https://crates.io/api/v1/crates/loop-cli) is an
unrelated project, not an installation route for Loop Kit.

The prepared Rust source is now versioned **0.1.1**, with the CLI's exact host
dependency and Cargo.lock updated together. This version is not yet published;
0.1.1 is the minimum next release, subject to API review choosing a higher version.
New legacy projects derive their host version from the CLI version; do not change
WIT, source, profile or npm versions merely to match the Rust release.
Publish the new host crate first, verify the extracted CLI against that actual
registry crate without a local patch, then run checkout-free create/run/build and
relocation tests before releasing the matching Windows CLI. Paired local archives,
local `--host-source` tests and a passing workspace build do not prove this gate.
See [workflow setup](.github/README.md) for human account and GitHub configuration.

## Inspect a release

Run `bun install --frozen-lockfile`, `bun run release:prepare --base <previous-ref>`.
Omit `--base` for the initial release. This builds, typechecks, tests, checks
boundaries, packs every package with `bun pm pack`, and installs the tarballs
into separate temporary projects outside the repository. It checks Bun and Node
ESM, strict NodeNext types, private import rejection, maps and published resources.
Local tarball overrides supply unpublished transitive packages during these tests.

`target/npm-pack/release-plan.json` lists the source revision, dirty state, changed
packages, reverse dependents requiring version/range review, dependency order,
distribution tag and exact archive hashes. It also lists the selected publish
order, minimum patch suggestions and missing version updates relative to `--base`.
A dirty tree or unchanged previously released version makes `readyToPublish` false;
the publishing workflow refuses that plan. Breaking changes still require a
manual major/minor decision. `SHA256SUMS` accompanies the tarballs.
The helper packs and npm-dry-runs **all nine** packages, even when `--base` selects
only a subset for publication. `dryRunOrder` records that full validation inventory;
`publishOrder` records only the changed/dependent selection. Both dry run and actual
publish explicitly target `https://registry.npmjs.org`. A dry run does not authenticate
OIDC, check account authority, reserve a name or prove that a version is unpublished.
`readyToPublish` is a local planning gate, not registry authorization or compatibility proof.
The helper **never publishes**. Update package versions and internal dependency ranges
deliberately, regenerate `bun.lock`, then rerun.
Automatic semver inference cannot establish API compatibility; dependent patch
releases require review even when an existing range still accepts the new version.

## Explicit npm publication

A human maintainer must first sign in to npm, verify their email, enable 2FA,
and confirm ownership/admin access to the `loop-kit` organization and write access
for all nine public packages. GitHub repository access does not grant npm access;
an npm 404 does not prove scope ownership. If package settings are unavailable before
first publication, bootstrap the reviewed tarballs interactively with that maintainer's
npm account, in the plan's dependency order, using public access and its selected tag.
Do not store an npm token in GitHub or this repository. Bootstrap is a real publication,
not a dry run: the same versions cannot subsequently be published by OIDC.

For every package, open npm → package → Settings → Trusted publishing → Add trusted
publisher → GitHub Actions. Set owner `isaac10334`, repository `loop`, workflow filename
`npm-publish.yml` (not its full path), environment `npm`, and enable **Allow npm publish**
(the default staged-publish permission alone is insufficient for this workflow).
In GitHub → repository Settings → Environments, create `npm`, add required reviewers
and restrict allowed release branches/tags. Confirm these protection features are
available for the repository's plan. A maintainer must configure both services;
these instructions and a dry-run dispatch do not configure either one.

According to [npm's trusted-publishing documentation](https://docs.npmjs.com/trusted-publishers/),
new publisher configurations must complete their first successful publish within two
days or be recreated. After a successful OIDC release, require 2FA/disallow tokens in
npm Publishing access and retire any old automation tokens. No account or repository
settings are changed by release preparation.
The manual workflow defaults to **dry run**, uploads reviewable artifacts, and
publishes only when its `publish` input is explicitly true and the environment
review allows it. It uses hosted Linux, npm >=11.5.1, Node 24, `id-token: write`
and provenance; no long-lived npm credential. Existing versions cannot be replaced.
Use a dry-run dispatch first, inspect the tarballs and plan, then explicitly
dispatch publication for that same source revision. Never use this workflow as a
push-triggered release job. Rust releases remain independent.

## Canary route

Set all nine package versions to `0.1.1-canary.<sequence>` and update internal
workspace dependencies to `workspace:0.1.1-canary.<sequence>` in a release change.
Regenerate the lockfile and run release preparation. The plan selects `canary`;
the workflow publishes to that tag. Consumers explicitly install
`@loop-kit/host@canary`. Stable releases keep plain semver and use `latest`.
Canary builds are explicit release actions, not every commit. Never promote by
silently reusing or overwriting a prerelease version.

## Before the first npm release

Station temporarily uses reviewed, checksum-pinned package tarballs through root
overrides. Public dependency declarations remain semver. After npm publication,
remove those overrides/artifacts and regenerate Station's lockfile.

For CI pinned to Git source, run
`bun tooling/git-artifacts.ts https://github.com/isaac10334/loop.git <full-sha> <output>`.
It fetches that exact revision into an isolated temporary checkout, installs with
the frozen lockfile, runs release preparation and writes a remote revision receipt.
It fails if the revision is unavailable remotely or lacks the packaging scripts;
it never substitutes local dirty source. Upload the resulting artifacts from CI
and use those reviewed tarballs in Station's portable overrides. Bare monorepo Git
dependencies cannot select nine npm package roots, so do not point every package
at the repository root or commit developer filesystem paths.

## Local development and documentation

In Station run `bun run repo link on <Loop checkout>`, `bun run repo link watch`,
then restart Station development after generated dependency output changes.
`repo link status --json` verifies entries and actual paths; `repo link off`
restores the frozen install. Bun links never belong in committed manifests.

Run `bun run docs:build` for `target/site/docs/index.html`. The explicit public catalog
in `site/content.ts` generates pages, search, Markdown alternatives, llms.txt and
the sitemap. Release instructions, contributor docs and internal plans remain in
the repository and are not public site pages. The Pages workflow builds the site;
building locally does not deploy it.
