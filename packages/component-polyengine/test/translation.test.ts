import { test, expect } from "bun:test";
import { translationSha256 } from "../src/index.js";
test("prepared translation digest binds plan, adapter names and exact bytes independent of map order", async () => {
  const plan = { worldDigest: "world", component: { sha256: "component" } } as never;
  const a = { plan, adapters: new Map([["b.wasm", new Uint8Array([2])], ["a.wasm", new Uint8Array([1])]]) };
  const baseline = await translationSha256(a);
  expect(await translationSha256({ plan, adapters: new Map([...a.adapters].reverse()) })).toBe(baseline);
  expect(await translationSha256({ plan: { altered: true } as never, adapters: a.adapters })).not.toBe(baseline);
  expect(await translationSha256({ plan, adapters: new Map([["b.wasm", new Uint8Array([3])], ["a.wasm", new Uint8Array([1])]]) })).not.toBe(baseline);
  expect(await translationSha256({ plan, adapters: new Map([["renamed.wasm", new Uint8Array([2])], ["a.wasm", new Uint8Array([1])]]) })).not.toBe(baseline);
});
