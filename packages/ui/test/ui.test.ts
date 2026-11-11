import { expect, test } from "bun:test";
import { h, RecordingSurface } from "../src/index.js";
test("keyed updates and events are validated independently of a renderer", async () => {
  const surface = new RecordingSurface();
  surface.render({ revision: 0, root: h("button", { key: "run", label: "Run" }) });
  surface.event({ revision: 0, sequence: 1, key: "run", type: "activate" });
  expect((await surface.nextEvent())!.key).toBe("run");
  expect(() => surface.event({ revision: 0, sequence: 1, key: "run", type: "activate" })).toThrow("Stale");
  expect(() => surface.render({ revision: 2, root: h("text", { key: "text" }) })).toThrow("Stale");
  expect(() => surface.render({ revision: 1, root: h("column", { key: "root" }, h("text", { key: "same" }), h("text", { key: "same" })) })).toThrow("unique");
  const pending = surface.nextEvent(); surface.dispose(); expect(await pending).toBeUndefined();
});
