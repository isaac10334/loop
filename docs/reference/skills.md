# Bundled skill manager

HK-07 local build verification, November 7–8, 2026. The offline manager passes
filesystem fixtures and the Rust CLI passes isolated project/user-root commands.
Codex CLI 0.116.0's app-server `skills/list` RPC discovered the skill as enabled and
repo-scoped in a disposable external project, after installation by the locally
packaged, optimized Loop CLI. This verifies client inventory discovery, not model
invocation or a published release. The skill and temporary CLI install were removed
afterward. A disposable `CODEX_HOME` did not isolate other OS-user skill roots; the
probe also observed those roots, without modifying them. The catalog retains its
existing status. Use the repository skill through AGENTS without installing it.

## Run the manager

The current source-built CLI embeds the manager and catalog. It requires Bun
1.3.14 on PATH and streams its embedded code to Bun stdin without creating a
worker file. List needs no destination:

```powershell
loop skills list --json
```

For the other verbs, select an existing root, scope and adapter. These examples use
an isolated project fixture. Create that fixture yourself before invoking the manager.

```powershell
loop skills inspect loop-host-kits --scope project --root ./target/my-skill-fixture --adapter codex-v1
loop skills install loop-host-kits --scope project --root ./target/my-skill-fixture --adapter codex-v1 --dry-run
```

For checkout development without rebuilding Rust, invoke the same manager with
`bun --no-install --no-env-file crates/loop-cli/host-tools/skills/cli.ts` followed
by the arguments after `loop skills`. Published older CLI versions may lack this
command; check `loop --help` for the binary you selected.

`install`, `update`, `remove` and `recover` plan unless you pass `--write`.
`--write --dry-run` rejects. `--version` selects only the exact bundled version;
there is no download, package install, config import or script hook. The parser
accepts `--json` and emits JSON for success and failure even when you omit it.
Duplicate and unknown flags reject. The Rust bridge uses the explicit skills
subcommand; ordinary CLI operations do not invoke this manager. With `--json`, a
failure before the manager starts (for example, missing Bun) uses the CLI's generic
`status: failed`/diagnostics envelope with `E_RUNTIME` and exit 4. Manager results
below apply after startup; handle both error envelopes.

## Operations and destinations

| Verb | Behavior |
| --- | --- |
| `list` | Verify the bundled catalog and list IDs, versions, descriptions and payload digests. Accepts `--json`, no destination options. |
| `inspect <id>` | Verify ownership and current files; report installed, absent or recovery-needed. |
| `install <id>` | Plan a new installation. An identical owned installation returns unchanged. |
| `update <id>` | Require an owned installation; replace its generation, including upstream-deleted files. |
| `remove <id>` | Preflight the whole owned tree, then plan removal. Repeated removal returns absent. |
| `recover <id>` | Validate a journal and plan rollback before receipt commit, or cleanup after commit. Applying requires `--write`. |

All verbs except list require `--scope project|user --root <path> --adapter codex-v1`.
Project destinations use `<root>/.agents/skills/<id>`; user destinations use
`<root>/skills/<id>`, where root is an explicit Codex-home fixture. The manager does
not read CODEX_HOME or choose a home directory. Inspection reports the resolved
payload destination and `.loop-skill-state` directory beside it. Tests use roots
under the checkout's ignored `target/skills-fixtures`; no test installs into a home.

Results include schemaVersion 1, operation, request, status, applied, ordered
file actions with before/after hashes, conflicts and recovery. Destination results
also include catalog/payload digests and the trusted-local backend limit. Mutation
plans include `planDigest`; pass that value through `--plan-digest <digest>` to
reject changed preconditions. Apply also rereads the tree and receipt under an
exclusive destination lock. Exit 0 means success or a plan, 2 means invalid input
or bundled compatibility/data, and 5 means conflict or recovery-needed.

## Ownership and recovery

The manager refuses unmanaged collisions, modified or unknown files, empty unknown
directories and corrupted receipts. Matching bytes without a receipt do not confer
ownership. There is no force, adopt or merge flag. Move/export edits yourself before
retrying. Removing a skill keeps unrelated skills, instructions and root directories.
The manager retains its empty state/adapter parent directories after removal.

Inventory validation rejects traversal, drive/UNC/device paths, backslashes, ADS,
Windows reserved names, trailing dots/spaces and case aliases. Filesystem checks
reject symlinks and Windows junctions in destination ancestors and managed trees.
Bundling reads the existing catalog/payload at build time, so runtime commands do
not read payload paths from the project. A second skill uses the same manager path;
adding payload text imports to the build inventory does not add dispatch branches.

Receipts record the owner/version, root, adapter, payload inventory and directories
that the manager created. Write intent creates an exclusive lock with owner PID,
then a journal and staged files on the destination volume. The manager fsyncs file contents before promotion.
It renames the previous generation to a backup, promotes the stage, replaces the
receipt, then cleans verified remnants. The receipt is the commit point. Inspect
and dry-run do not lock, stage, repair or create directories.

After an interrupted transaction, run inspect, then recover without `--write` to
review rollback/cleanup. A live writer's lock returns busy. Explicit recovery can
reclaim a journaled dead writer's lock through a separate exclusive recovery gate;
PID reuse fails closed. A malformed lock, stale recovery gate, unverifiable backup
or edited transaction file requires manual reconciliation. A crash while creating
the lock header can leave such a malformed lock. Keep the
backup; do not delete it to suppress a conflict.

This backend assumes trusted local files. Node/Bun path checks cannot exclude a
hostile same-user replacement race, and it cannot promise directory-fsync or
power-loss durability. Sharing violations leave the journal for explicit recovery;
Windows directory replacement comprises several operations. These limits do not
change guest permissions or prove agent-client skill discovery.

## Verification

`bun test tooling/skills` covers the existing catalog, a data-only second entry,
project/user separation, zero-write plans and inspection, aliases/junctions, local
edits, owned update/removal, stale plans and lock contention. Fault fixtures stop
before/after backup/promotion/receipt transitions; another child exits after
promotion and leaves its lock for explicit recovery. The tests preserve edited
backups rather than claiming successful repair.

With `LOOP_CLI` set to a freshly built executable, run
`bun tooling/skills/cli-smoke.ts`. The November 8 final-binary run exercised 23
real Rust CLI invocations across all six verbs and both fixture scopes, including
19 zero-write checks over the fixture and its selected TEMP directory. The runner
also compared the embedded catalog and installed file bytes with current source.
It records command JSON, binary SHA-256 and selected roots under ignored
`target/skills-cli-smoke/receipt.json`. A separate missing-Bun invocation returned
the generic JSON `E_RUNTIME` diagnostic with exit 4 and no fixture writes.

The [skill contract](../../specs/host-kits.md#8-repo-skill-and-optional-data-driven-installation)
owns the broader acceptance gate. The app-server discovery observation is recorded
in `target/codex-skill-discovery-round26/receipt.json`; it does not establish that a
model invoked the skill or that a published release behaves identically.
