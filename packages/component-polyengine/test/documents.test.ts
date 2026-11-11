import { test, expect } from "bun:test";
import { createDocumentOwner, DocumentOperationError, checkSource } from "../src/index.js";
const signal = () => new AbortController();
const owner = (beforeOperation?: (op: "read" | "write", signal: AbortSignal) => Promise<void>) => createDocumentOwner({ source: "hello", authorize: p => p === "author", beforeOperation });
test("nominal ownership, principal and read/write rights are per-use", async () => {
  const a = owner(), b = owner(), s = signal();
  const rw = a.issue({ principal: "author", read: true, write: true });
  const viewer = a.issue({ principal: "author", read: true, write: false });
  const wrong = a.issue({ principal: "other", read: true, write: true });
  await expect(a.read(rw, s.signal)).resolves.toEqual({ revision: "0", source: "hello" });
  for (const grant of [viewer, wrong, {} as typeof rw, b.issue({ principal: "author", read: true, write: true })]) await expect(a.write(grant, "0", "no", s.signal)).rejects.toMatchObject({ failure: { kind: "denied" } });
  expect(a.snapshot.source).toBe("hello");
  a.advanceGeneration(); await expect(a.read(rw, s.signal)).rejects.toMatchObject({ failure: { kind: "revoked" } });
});
test("grant input cannot override issuer binding or execute accessors", async () => {
  const victim = owner(), attacker = owner();
  expect(() => attacker.issue({ principal: "author", read: true, write: true, owner: victim } as never)).toThrow();
  let touched = false;
  expect(() => attacker.issue({ get principal() { touched = true; return "author"; }, read: true, write: true })).toThrow();
  expect(touched).toBe(false);
});
test("revision budget uses UTF-8 bytes like the native host", async () => {
  const a = owner(), grant = a.issue({ principal: "author", read: true, write: true });
  await expect(a.write(grant, "é".repeat(64), "draft", signal().signal)).rejects.toMatchObject({ failure: { kind: "conflict" } });
  await expect(a.write(grant, "é".repeat(65), "draft", signal().signal)).rejects.toMatchObject({ failure: { kind: "invalid-source" } });
  expect(a.snapshot).toEqual({ revision: "0", source: "hello" });
});
test("CAS linearization one winner preserves loser draft", async () => {
  const a = owner(async () => { await Promise.resolve(); }), g = a.issue({ principal: "author", read: true, write: true });
  const drafts = ["A", "B"];
  const results = await Promise.allSettled(drafts.map(d => a.write(g, "0", d, signal().signal)));
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find(r => r.status === "rejected")).toMatchObject({ reason: { failure: { kind: "conflict", value: { revision: "1" } } } });
  expect(drafts).toEqual(["A", "B"]);
});
test("cancel and revoke during await forbid commit; after commit does not rollback", async () => {
  for (const mode of ["cancel", "revoke", "generation", "close"]) {
    let resume!: () => void;
    const a = owner(() => new Promise(r => { resume = r; })), c = signal(), g = a.issue({ principal: "author", read: true, write: true });
    const writing = a.write(g, "0", "changed", c.signal);
    if (mode === "cancel") c.abort(); else if (mode === "revoke") a.revoke(g); else if (mode === "generation") a.advanceGeneration(); else a.dispose();
    resume(); await expect(writing).rejects.toBeInstanceOf(DocumentOperationError); expect(a.snapshot.revision).toBe("0");
  }
  const a = owner(), g = a.issue({ principal: "author", read: true, write: true }), c = signal();
  const committed = await a.write(g, "0", "yes", c.signal); c.abort(); a.revoke(g);
  expect(committed.source).toBe("yes"); expect(a.snapshot.revision).toBe("1");
});
test("generated schedules enforce generation and CAS for 128 deterministic seeds", async () => {
  for (let seed = 1; seed <= 128; seed++) {
    const a = owner(), c = signal(); let g = a.issue({ principal: "author", read: true, write: true }), model = 0, state = seed;
    for (let i = 0; i < 20; i++) {
      state = (state * 1664525 + 1013904223) >>> 0;
      if (state % 5 === 0) { a.advanceGeneration(); await expect(a.read(g, c.signal)).rejects.toMatchObject({ failure: { kind: "revoked" } }); g = a.issue({ principal: "author", read: true, write: true }); }
      else if (state % 3 === 0) await expect(a.write(g, "stale", "draft", c.signal)).rejects.toMatchObject({ failure: { kind: "conflict" } });
      else { await a.write(g, String(model), `source${seed}:${i}`, c.signal); model++; }
      expect(a.snapshot.revision).toBe(String(model));
    }
    a.dispose(); await expect(a.read(g, c.signal)).rejects.toMatchObject({ failure: { kind: "revoked" } });
  }
});
test("UTF8 budgets check actual bytes, not just UTF16 code units", () => {
  expect(() => checkSource("x".repeat(1048576))).not.toThrow();
  expect(() => checkSource("x".repeat(1048577))).toThrow();
  expect(() => checkSource("€".repeat(400000))).toThrow();
  expect(() => checkSource({})).toThrow();
});
