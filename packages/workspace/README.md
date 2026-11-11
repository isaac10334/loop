# @loop-kit/workspace

Immutable source snapshots, portable build-provider contracts and checked Git
change requests. No filesystem, credentials, Station state or execution engine.

```ts
import { createSourceSnapshot, createChangeRequest } from '@loop-kit/workspace';
const base = await createSourceSnapshot({ 'src/main.ts': 'export const answer = 1;' });
const next = await createSourceSnapshot({ 'src/main.ts': 'export const answer = 2;' });
const request = await createChangeRequest(base, next, {
  repository: 'example/application', baseCommit: 'a'.repeat(40),
  files: { 'src/main.ts': 'packages/example/src/main.ts' },
});
console.log(request.changes);
```

`createSourceSnapshot` sorts and freezes bounded UTF-8 source and pinned dependency
identities. Digests are content identity, not signatures or authorization.
`createChangeRequest` requires exact path mappings and a full Git base commit.
`submitChangeRequest` verifies identity/base bytes through an injected authenticated
port; its provider owns retry reconciliation and branch/PR creation, never merging.
Deleting a file is explicit. Unmapped edits, case collisions and protected Git
destinations reject. Source dependency changes require a separate lockfile design.

The initial substrate is text-only and bounded to 1 MiB / 512 files. It is not yet
an asset database, distributed journal, workflow engine or general Git synchronizer.
Verify with `bun run repo verify workspace` from the repository root.
