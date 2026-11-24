# Identity and distribution

Proposed product direction, October 30, 2026. Local authoring/build/run works
without login. [Cloud build](../../specs/cloud-build.md) defines the first hosted
operation; [machine access](../../specs/machine-access-and-references.md) defines
local authority. Neither service exists because this page describes it.

## Accounts and credentials

Use one official Loop issuer and separate registered host application/CLI/native/web
clients with API-specific audiences. Store connection identity as issuer+subject;
personal/work connections can coexist. Select a connection per project/operation
and pin it to jobs. Switching the visible account does not retarget running work.
Add compatible self-hosted issuers later; email equality does not link accounts.

Use a maintained OAuth/OIDC implementation. CLI uses device authorization with
denial/expiry/backoff; native clients use system-browser code+S256 PKCE; hosted
web clients prefer server-held tokens and HttpOnly sessions. Installed public
clients carry no shared secret. Better Auth's OAuth provider is a candidate;
host application's existing cookie session is not already an authorization server.

The broker owns refresh rotation and OS-backed storage. One foreground owner per
connection holds an interprocess lock; other native clients route through it or
fail rather than race refresh rotation. Use Windows Credential Manager for
long-lived native secrets. Source, snapshots, arguments and logs exclude tokens.
Same-user malicious native processes remain outside that protection claim.

Proposed access-token maximum: five minutes. Check current project membership and
connection status per operation and at commit. Cancel affected live streams/jobs
through the active registry. A disconnected host cannot observe cloud revocation
at once. OIDC login, project membership, package entitlement, GitHub installation
and native grants remain separate checks.

host application keeps its current login and browser-local data. Add Connect Loop account
before considering login migration. Link legacy identities only after proving
both sessions. Loop login does not upload or partition existing host application assets.

References: [OAuth security BCP](https://www.rfc-editor.org/rfc/rfc9700.html),
[native OAuth](https://www.rfc-editor.org/info/rfc8252),
[Better Auth OAuth provider](https://better-auth.com/docs/plugins/oauth-provider),
[device authorization](https://better-auth.com/docs/plugins/device-authorization).
Verify pinned library/plugin compatibility during implementation.

## Source, packages and hosted UI

Alpha projects use Git as their accepted source stream. Drafts pin a base commit;
checked change requests propose the next tree. [Existing local tooling](../portable-development.md)
already prepares these requests. A managed GitHub App needs selected-repository
installation, server-held credentials, webhook signatures/deduplication and
request reconciliation. No auto-merge. CI verifies selected commit bytes before
advancing asset heads; provenance prevents import/export feedback loops.

Keep download, install, grant, instance and activation separate. Registry data
(images/themes/docs), Component/script tools, sandboxed web surfaces and trusted
native extensions each declare their own profile. Show contributions, resolved
bindings, resource restrictions and active consumers. Offer reverse inspection
of which principals/instances can access a resource. Entitlement cannot replace
runtime authority; client code secrecy cannot protect paid services.

One web shell can serve public Markdown guides and private project/build/registry
pages. Anonymous in-memory examples precede optional private save/build. Reuse
the independent editor and semantic surfaces without importing host application's shell.
Sanitize registry documentation and gate runnable examples through installation
and grants. Official pages acquire no machine authority by reputation. Hosted
HTTPS-to-loopback access needs its own browser network-policy acceptance.
