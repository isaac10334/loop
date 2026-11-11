import { expect, test } from "bun:test";
import { createSourceSnapshot, verifySourceSnapshot, createChangeRequest, submitChangeRequest, validateSourcePath, type GitHubChangePort, type ChangeRequest } from "../src/index.js";
import * as source from "../src/source.js";
import * as workspace from "../src/index.js";
import { createForegroundDevelopment } from "../src/foreground.js";

test("package root preserves extracted source and foreground exports and source wire identity", async () => {
  expect(workspace.contentDigest).toBe(source.contentDigest);
  expect(workspace.validateSourcePath).toBe(source.validateSourcePath);
  expect(workspace.createSourceSnapshot).toBe(source.createSourceSnapshot);
  expect(workspace.verifySourceSnapshot).toBe(source.verifySourceSnapshot);
  expect(workspace.createForegroundDevelopment).toBe(createForegroundDevelopment);
  const snapshot = await workspace.createSourceSnapshot({ "b.ts": "b", "a.ts": "a" });
  expect(snapshot).toEqual({
    format: "loop-source-v1", files: { "a.ts": "a", "b.ts": "b" }, dependencies: [],
    digest: "sha256:ff77c5285d8f2d0d8b417ae11e04f0c230df063ee0c311a3527dc26200cf4bbe",
  });
  expect(await source.verifySourceSnapshot(snapshot)).toEqual(snapshot);
});

test("source identity is independent of insertion order and includes dependency pins", async () => {
  const a = await createSourceSnapshot({ "b.ts": "b", "a.ts": "a" });
  const b = await createSourceSnapshot({ "a.ts": "a", "b.ts": "b" });
  expect(a.digest).toBe(b.digest);
  expect(Object.isFrozen(a.files)).toBe(true);
  expect((await createSourceSnapshot(a.files, [{ repository: "npm", assetId: "sdk", revision: a.digest }])).digest).not.toBe(a.digest);
  await expect(verifySourceSnapshot({ ...a, files: { "a.ts": "tampered" } })).rejects.toThrow("mismatch");
});

test("portable sources reject traversal, case collisions, OS devices and limits", async () => {
  for (const path of ["../secret", "C:/secret", ".git/config", "src/../a", "src/con.txt", "a\\b", "name."]) expect(() => validateSourcePath(path)).toThrow();
  await expect(createSourceSnapshot({ "A.ts": "a", "a.ts": "a" })).rejects.toThrow("Case-colliding");
  await expect(createSourceSnapshot({ "a.ts": "x".repeat(1024 * 1024) })).rejects.toThrow("1 MiB");
});

const projection = { repository: "example/app", baseCommit: "a".repeat(40), files: { "a.ts": "packages/a.ts", "b.ts": "packages/b.ts" } };
async function request() {
  return createChangeRequest(await createSourceSnapshot({ "a.ts": "old", "b.ts": "remove" }), await createSourceSnapshot({ "a.ts": "new" }), projection);
}

test("change requests represent updates and deletes with original file hashes", async () => {
  const change = await request();
  expect(change.changes.map(item => [item.path, item.content])).toEqual([["packages/a.ts", "new"], ["packages/b.ts", null]]);
  expect(change.changes.every(item => item.expected?.startsWith("sha256:"))).toBe(true);
  expect((await request()).id).toBe(change.id);
});

test("projection rejects unmapped edits, duplicate destinations and sensitive paths", async () => {
  const base = await createSourceSnapshot({ "a.ts": "old" }), next = await createSourceSnapshot({ "a.ts": "new" });
  const invalidMappings: Record<string, string>[] = [{}, { "a.ts": ".github/workflows/deploy.yml" }, { "a.ts": ".env.local" }, { "a.ts": "same.ts", "b.ts": "same.ts" }];
  for (const files of invalidMappings) {
    await expect(createChangeRequest(base, next, { ...projection, files })).rejects.toThrow();
  }
  await expect(createChangeRequest(base, next, { ...projection, baseCommit: "main" })).rejects.toThrow("full Git");
});

test("Git adapter checks base bytes, reconciles duplicates and never has a merge operation", async () => {
  let submitted = 0;
  const port: GitHubChangePort = {
    readFile: async (_repository, _commit, path) => path.endsWith("a.ts") ? "old" : "remove",
    findRequest: async () => undefined,
    createRequest: async (_change, branch) => { expect(branch.startsWith("codex/loop-")).toBe(true); submitted++; return { url: "https://github.com/example/app/pull/1" }; },
  };
  const change = await request();
  await submitChangeRequest(change, port);
  expect(submitted).toBe(1);
  await submitChangeRequest(change, { ...port, findRequest: async () => ({ url: "existing" }) });
  expect(submitted).toBe(1);
  await expect(submitChangeRequest(change, { ...port, readFile: async () => "wrong base" })).rejects.toThrow("Git base conflict");
  expect(submitted).toBe(1);
});

test("tampering and cancellation prevent Git writes", async () => {
  const change = await request();
  const port: GitHubChangePort = { readFile: async () => { throw Error("unexpected"); }, findRequest: async () => undefined, createRequest: async () => { throw Error("unexpected"); } };
  const invalid = { ...change, changes: [{ ...change.changes[0]!, content: "tampered" }] } as ChangeRequest;
  await expect(submitChangeRequest(invalid, port)).rejects.toThrow("digest mismatch");
  await expect(submitChangeRequest(change, port, AbortSignal.abort())).rejects.toThrow();
});

test("caller mutation during Git lookup cannot replace reviewed bytes or base", async () => {
  const original = structuredClone(await request());
  let submitted: ChangeRequest | undefined;
  await submitChangeRequest(original, {
    findRequest: async () => {
      (original.changes[0] as { content: string }).content = "injected";
      (original.projection as { baseCommit: string }).baseCommit = "b".repeat(40);
      return undefined;
    },
    readFile: async (_repo, commit, path) => { expect(commit).toBe("a".repeat(40)); return path.endsWith("a.ts") ? "old" : "remove"; },
    createRequest: async value => { submitted = value; return { url: "created" }; },
  });
  expect(submitted!.changes[0]!.content).toBe("new");
  expect(Object.isFrozen(submitted!.changes[0])).toBe(true);
});

test("object prototype names need explicit projection mappings", async () => {
  for (const name of ["toString", "constructor", "__proto__"]) {
    const base = await createSourceSnapshot(Object.fromEntries([[name, "before"]]));
    const next = await createSourceSnapshot(Object.fromEntries([[name, "after"]]));
    await expect(createChangeRequest(base, next, { ...projection, files: {} })).rejects.toThrow("Unmapped");
  }
});
