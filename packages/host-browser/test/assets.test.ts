import { test, expect } from "bun:test";
import { browser } from "../src/index.js";
const digest = "a".repeat(64);
const asset = (overrides: Record<string, unknown> = {}) => ({ source: "public/data.bin", path: "data.bin", sha256: digest, ...overrides });

test("browser assets are validated and copied into inert kit options", () => {
  const declared = asset();
  const kit = browser({ assets: [declared] });
  const options = kit.options as { assets?: typeof declared[] };
  expect(options.assets).toEqual([declared]);
  expect(options.assets?.[0]).not.toBe(declared);
  expect(() => browser({ assets: [asset({ source: "../outside" })] })).toThrow();
  expect(() => browser({ assets: [asset({ path: "index.html" })] })).toThrow();
  expect(() => browser({ assets: [asset(), asset({ source: "other.bin" })] })).toThrow();
  expect(() => browser({ assets: [asset({ sha256: "A".repeat(64) })] })).toThrow();
  expect(() => browser({ assets: Array.from({ length: 17 }, (_, i) => asset({ path: `file-${i}.bin` })) })).toThrow();
  const weird = Object.defineProperty({ source: "public/data.bin", path: "data.bin" }, "sha256", { enumerable: true, get() { throw new Error("getter executed"); } });
  expect(() => browser({ assets: [weird] as never })).toThrow();
});
