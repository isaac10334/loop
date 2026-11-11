import { expect, test } from "bun:test";
import { createHost } from "../src/index.js";
import { defineCapability } from "@loop-kit/capabilities";
test("named service selection never guesses a default and cleanup is independent", async () => {
  const contract = defineCapability<{ name: string }>({ id: "loop:test/service", version: "1" });
  const host = createHost(), scope = host.scope();
  const first = host.provide(contract, { create: () => ({ name: "first" }) }, { serviceId: "first" });
  host.provide(contract, { create: () => ({ name: "second" }) }, { serviceId: "second" });
  await expect(scope.acquire(contract)).rejects.toThrow("No provider");
  const a = await scope.acquire(contract, { serviceId: "first" });
  const b = await scope.acquire(contract, { serviceId: "second" });
  expect(a.value.name).toBe("first"); expect(b.value.name).toBe("second");
  await first.unregister(); expect(a.signal.aborted).toBe(true); expect(b.signal.aborted).toBe(false);
  host.provide(contract, { create: () => ({ name: "default" }) });
  expect((await scope.acquire(contract)).value.name).toBe("default");
  expect(host.inspect().providers.some(provider => provider.serviceId === "second")).toBe(true);
  await host.dispose();
});
test("method descriptors are copied, immutable and reflected without granting anything", () => {
  const methods = [{ name: "read", input: { type: "string" as const }, output: { type: "object" as const }, effects: [{ operation: "read", resource: "asset" }] }];
  const capability = defineCapability({ id: "loop:test/schema", version: "1", methods });
  methods[0]!.effects[0]!.resource = "other";
  expect(capability.methods![0]!.effects[0]!.resource).toBe("asset");
  expect(Object.isFrozen(capability.methods![0]!.input)).toBe(true);
  const host = createHost(); host.define(capability);
  expect(host.inspect().definitions[0]!.methods).toEqual(capability.methods);
  expect(host.inspect().providers).toEqual([]);
});
