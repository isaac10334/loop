import { expect, test } from "bun:test";
import { defineCapability, type Capability } from "../src/index.ts";

interface Clock { now(): number }
const clock = defineCapability<Clock>({ id: "loop:time/clock", version: "1.0.0" });
const typed: Capability<Clock> = clock;
void typed;

test("identity is stable data, independent of implementation", () => {
  expect(clock).toEqual({ id: "loop:time/clock", version: "1.0.0" });
  expect(Object.isFrozen(clock)).toBe(true);
  expect(defineCapability<Clock>({ id: clock.id, version: clock.version })).toEqual(clock);
  expect(() => defineCapability<Clock>({ id: "clock", version: "1" })).toThrow();
});

test("WIT-backed identities retain immutable source provenance without claiming authority", () => {
  const contract = { format: "wit" as const, package: "loop:editor@0.1.0", world: "editor", sourceSha256: `sha256:${"a".repeat(64)}` as const, bindings: "jco" as const };
  const capability = defineCapability<Clock>({ id: clock.id, version: clock.version, contract });
  expect(capability.contract).toEqual(contract);
  expect(Object.isFrozen(capability.contract)).toBe(true);
  expect(() => defineCapability({ id: clock.id, version: clock.version, contract: { ...contract, sourceSha256: "sha256:bad" } })).toThrow("Invalid WIT");
});
