import { test, expect } from "bun:test";
import { semanticDom, validateDomFrame } from "../src/index.js";
test("data-only plugin uses public runtime export", () => {
  const plugin = semanticDom({ key: "dom", root: "#app" });
  expect(plugin.runtime[0]?.entry).toEqual({ specifier: "@loop-kit/renderer-dom", export: "setup" });
  expect(() => semanticDom({ key: "bad", root: "body > script" })).toThrow();
});
test("safe data validation rejects accessor/prototype/unknown properties before reading", () => {
  let touched = false;
  const accessor = { get revision() { touched = true; return 0; }, root: { key: "a", type: "text" } };
  expect(() => validateDomFrame(accessor)).toThrow(); expect(touched).toBe(false);
  const bad = [Object.assign(Object.create({ evil: true }), { revision: 0 }), { revision: 0, root: { key: "a", type: "text", html: "<img>" } }, { revision: 0, root: { key: "a", type: "button", text: "Unlabelled" } }, { revision: 0, root: { key: "a", type: "text", properties: { style: "color:red" } } }];
  for (const frame of bad) expect(() => validateDomFrame(frame)).toThrow();
  const valid = validateDomFrame({ revision: 0, root: { key: "a", type: "text", text: "<script>not HTML</script>" } });
  expect(valid.root.text).toContain("<script>");
});
test("frame UTF8 bounds and duplicate keys", () => {
  expect(() => validateDomFrame({ revision: 0, root: { key: "r", type: "column", children: [{ key: "same", type: "text" }, { key: "same", type: "text" }] } })).toThrow();
  expect(() => validateDomFrame({ revision: 0, root: { key: "r", type: "column", children: Array.from({ length: 10 }, (_, n) => ({ key: `t${n}`, type: "text", text: "€".repeat(4000) })) } })).toThrow();
});
