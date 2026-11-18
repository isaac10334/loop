# Release workflow setup

Maintainers configure registry accounts and GitHub settings separately from preparing
artifacts. None of these workflows or local dry runs grants ownership, creates an
account or configures a trusted publisher. See [release preparation and current
published compatibility](../RELEASING.md).

## Agent development

For concurrent issue claims, isolated branches, draft PRs, CI and review replies,
read the [GitHub runbook](agent-development.md) and
[repo skill](../skills/loop-github/SKILL.md). Merges remain human-controlled.
The [dated receipt](../docs/reference/github-agent-evidence.md) records live checks
and the separately configured main-branch ruleset; release workflows are unchanged.

## npm packages

The manual [npm workflow](workflows/npm-publish.yml) defaults to `publish: false`.
It prepares all nine packages, npm-dry-runs every archive and uploads checksums and
a plan. Only `publish: true` starts the `npm` environment-protected publication job;
that job publishes the plan's selected packages in dependency order. A successful
dry run does not test OIDC authorization or establish registry version availability.

A human npm organization/package administrator must confirm the `loop-kit` scope,
verify their email and enable 2FA, arrange first-publication bootstrap if package
settings do not yet exist, and configure **each** package's trusted publisher:

| npm GitHub Actions field | Value |
| --- | --- |
| Organization or user | `isaac10334` |
| Repository | `loop` |
| Workflow filename | `npm-publish.yml` |
| Environment | `npm` |
| Allowed action | **Allow npm publish** (direct publishing) |

In GitHub → repository Settings → Environments, create `npm`, require reviewers and
restrict release branches/tags. Confirm protection rules are supported by the plan.
Review a dry-run dispatch and its exact source revision, then explicitly dispatch
publication for that revision. The workflow uses GitHub-hosted Linux, Node 24,
npm 11.16.0, `id-token: write` and provenance; it needs no npm token secret.
New npm trusted publishers must complete their first publish within two days.
Follow [npm's official guidance](https://docs.npmjs.com/trusted-publishers/) for
expiry, 2FA/disallow-token settings and retiring old automation credentials.
Interactive bootstrap publishes real versions: do not try to publish those same
versions again through the workflow.

## Host crate and Windows CLI

[Publish host crate](workflows/publish-host.yml) is manually dispatched with
`publish: false` by default. Its unprivileged verification job runs the locked
workspace/all-features tests and Cargo publication dry run without registry
credentials or OIDC. Artifact-dependent runtime tests may skip without their
inputs; this job alone does not establish native-window or guest conformance.
Only `publish: true`, successful verification and approval of the `crates`
environment admit the publication job. Both jobs check out the same dispatch SHA.

A human owner of `loop-host` must sign in to crates.io through GitHub, verify their
email and confirm crate ownership. Open `loop-host` → Settings → Trusted Publishing
→ Add → GitHub and configure these exact fields:

| crates.io GitHub field | Value |
| --- | --- |
| Repository owner | `isaac10334` |
| Repository name | `loop` |
| Workflow filename | `publish-host.yml` |
| Environment | `crates` |

In GitHub → repository Settings → Environments, create `crates`, add required
reviewers and restrict release branches/tags; verify the repository plan supports
those protection rules. These settings are prerequisites, not changes performed
by this workflow. First dispatch with `publish: false`; review the source and dry
run before a separate explicit publication dispatch at that revision.

The publication job uses GitHub-hosted Windows, `id-token: write` and
[`rust-lang/crates-io-auth-action@v1`](https://github.com/rust-lang/crates-io-auth-action/tree/v1).
The action needs no inputs for crates.io (`url` defaults to `https://crates.io`);
its `token` output is passed only to the Cargo step as `CARGO_REGISTRY_TOKEN`.
Tokens expire after 30 minutes and the action's post step revokes them. Cargo
publication uses `--no-verify` only because the preceding job already compiled and
dry-ran this exact revision; it avoids repeating the compile after token exchange.
There is no repository-secret fallback. After a successful reviewed OIDC release,
a human should revoke/remove any old publishing token and repository secret.
Initial crate publication requires an API token; `loop-host` already exists.
See [crates.io's trusted-publishing guidance](https://crates.io/docs/trusted-publishing)
and its [official documentation source](https://github.com/rust-lang/crates.io/blob/main/svelte/src/routes/docs/trusted-publishing/+page.svelte).
Local dry runs cannot verify the registry configuration or GitHub environment approval.

Publish `loop-host` **0.1.1 or the higher reviewed matching version first**, then run
the extracted CLI's registry-only check and checkout-free lifecycle tests before
[Release Windows CLI](workflows/release.yml). Prepared 0.1.1 source is not a
published artifact. The CLI's exact host dependency and generated legacy hosts use
the coordinated version. Existing published host/CLI 0.1.0 lacks current host-kit
support; it cannot be overwritten. The Windows workflow checks Cargo, builds embedded
host tools, packages `loop-windows-x64.zip`, tests installer/bootstrap and the
published host, then creates a GitHub release using [release notes](release-notes.md).
Its dispatch version must match the source and name an unused `v<version>` tag.
A local paired-crate test is not a substitute for the registry-only release check.

## Website

[Deploy website](workflows/pages.yml) is manually dispatched. GitHub → repository
Settings → Pages must use **GitHub Actions** as its source. The workflow builds
and uploads the curated `target/site` staging directory, including the generated
stable `install.ps1` installer from `scripts/manage.ps1`; it does not upload the
site source tree. Preserve
the release asset name and installer URL unless manager code and tests are updated
together. Website deployment is separate from npm, host-crate and CLI publication.
