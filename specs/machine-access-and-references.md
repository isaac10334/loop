# Machine access and references

Status: proposed supporting contracts, October 30, 2026. Implement the root/file
operations required by foreground development first. A stitched reference view
follows with two consumers/providers; a distributed graph database is not required.

## Identity and host-issued access

A machine/session observation identifies an execution target; it grants no file,
terminal or VM authority. A reference describes an object; policy issues usable
access. Bind native grants to caller, host instance/epoch, resource identity,
operations, expiry/revocation generation and constraints. Keep handles/tokens out
of authored assets. A copied display ID cannot recreate a grant.

The local policy owner selects a directory through an OS picker or reviewed CLI
root and opens a root resource. Initial rights are enumerate/read, create/write,
rename and delete as separate requested operations. A build can receive a read-only
source snapshot and write-only output staging rather than a general live root.
Grant terminal/process spawning separately: filesystem write does not imply exec.
Connecting a cloud account or VM does not preapprove its files or shell.

WASI resource descriptors are a useful guest-facing shape. Pin exact filesystem
interface versions and approved preopens in the execution profile; do not rebrand
custom native/VM operations as standardized `wasi:*` interfaces. A provider can
map a VM filesystem to its own scoped backend, preserving OS and disconnect rules.

## Path and revocation rules

Validate normalized relative components, byte/count limits, OS names and case
collisions before I/O. Bind operations to the selected root handle. Reject parent
traversal, absolute/device paths and symlink/junction/reparse escapes. Resolve and
operate through handle-based/no-follow traversal where the OS/backend supports it;
check the actual opened resource, not only a prior string prefix or realpath.

A name can change between validation and I/O. Test replacement races. If a backend
cannot enforce this boundary against concurrent hostile filesystem changes, label
it trusted-local and constrain untrusted work to an isolated filesystem/VM. Also
consider hardlinks, mount points and inherited descriptors; path containment alone
does not establish data provenance or prevent every disclosure.

Check the grant at acquisition and each operation. Revocation denies new reads,
writes and retained handles and cancels owned watches/processes. Check write rights,
grant generation and expected file/source revision at commit under one owner.
Cancellation before commit prevents it; a later cancel cannot undo committed bytes.
Return a conflict or uncertain outcome, preserve drafts and provide reconciliation.
Root deletion/disconnect invalidates resources; reconnect does not silently rebind
an old handle to a new machine, directory or generation.

## References and relations

| Reference | Required identity |
| --- | --- |
| Authored asset | Repository/provider namespace + stable asset ID; pin revision for builds/installations. |
| Live instance | Host/session epoch + instance ID + generation. |
| External object | Provider namespace + stable external key + optional version. |

Resolvers take caller authority and return a bounded resource or a typed
missing/denied/stale/unavailable outcome. Authoring can follow a mutable asset head;
execution resolves and pins its dependency closure. Labels, visual groups and
filesystem projection paths do not replace IDs. Rename/regroup preserves identity.

Declare relation roles: descriptive, containment, dependency and lifetime ownership.
An `exposes-filesystem` edge does not authorize traversal. A `has-child` edge cannot
imply deletion, grant inheritance or activation ordering. Apply each role's cycle
and write rules. A document link may cycle; a build dependency graph may reject it.

Start with typed `resolve`, bounded `query` and owned `subscribe` ports over two
small provider views, such as source snapshots and live run resources. Filter
visibility on queries and recheck use; record provider consistency/revision cursors.
Bound depth/count, paginate, detect cycles and release subscriptions on owner close.
There is no global atomic transaction across providers. Keep a partial/unavailable
edge visible without pretending that the object was deleted. SQLite/indexed records
can store projections; they do not become a second authoritative workspace store.

## Acceptance

Test read-only/writable roots, wrong principal/epoch, expiry/revoke, retained
handles, root replacement, disconnect and retry. Generate path sequences with
separator/case/Unicode/OS-name boundaries. Race symlink/junction replacement,
rename and concurrent writes against the checked owner; record backend limits.
Fuzz reference/query decoders and graph depth/cycle limits. Check that a hidden
edge or known external ID cannot bypass access, and that stale live generations
cannot resolve after replacement. Verify subscription/resource cleanup and the
write-conflict draft recovery path in both native and browser clients.
