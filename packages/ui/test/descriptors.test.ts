import { expect, test } from "bun:test";
import {
  validateFrame,
  RecordingSurface,
  defineElement,
  createElementRegistry,
  validateIconRef,
  invokeAction,
  matchesActionShortcut,
  collectionView,
  readReference,
  createUiController,
  type ActionDescriptor,
} from "../src/index.js";
test("registry preserves stable IDs, typed extension schemas, slots and missing elements", () => {
  const badge = defineElement({
    id: "example:badge/v1",
    properties: { count: { type: "string", default: "0" } },
    children: { max: 0 },
    events: [],
    accessibility: { labelRequired: false, role: "status" },
  });
  const registry = createElementRegistry([badge.definition]);
  const frame = { revision: 0, root: badge.node("badge", { count: "3" }) };
  expect(validateFrame(frame, registry)).toEqual(frame);
  expect(() => validateFrame(frame)).toThrow("missing element");
  expect(() =>
    validateFrame(
      { revision: 0, root: { ...frame.root, properties: { count: true } } },
      registry,
    ),
  ).toThrow("property");
  expect(() =>
    validateFrame(
      {
        revision: 0,
        root: { ...frame.root, children: [{ key: "x", type: "text" }] },
      },
      registry,
    ),
  ).toThrow("children");
  expect(() =>
    createElementRegistry([badge.definition, badge.definition]),
  ).toThrow("duplicate");
  // @ts-expect-error extension property type is inferred
  badge.node("invalid", { count: 3 });
});
test("icons reject markup, paths, unknown fields and unlabeled images", () => {
  expect(
    validateIconRef({
      kind: "svg",
      assetId: "asset",
      path: "icons/run.svg",
      role: "image",
      label: "Run",
    }).kind,
  ).toBe("svg");
  for (const icon of [
    { kind: "svg", assetId: "a", path: "../x.svg" },
    { kind: "symbol", name: "Run", role: "image" },
    { kind: "provider", provider: "p", name: "n", url: "https://remote" },
  ])
    expect(() => validateIconRef(icon)).toThrow();
});
test("action conditions recheck and route commands without using authority metadata as a grant", () => {
  const calls: string[] = [];
  let enabled = true;
  const action: ActionDescriptor = {
    id: "save",
    label: "Save",
    source: { kind: "shell", id: "test" },
    requiredAuthority: ["files.write"],
    enabledWhen: "ready",
    invocation: { kind: "command", id: "files.save", params: { id: "x" } },
  };
  const ports = {
    condition: () => enabled,
    command: (id: string) => calls.push(id),
    shell: () => {
      throw new Error("wrong route");
    },
  };
  invokeAction(action, ports);
  enabled = false;
  expect(() => invokeAction(action, ports)).toThrow("unavailable");
  expect(calls).toEqual(["files.save"]);
  expect(() =>
    invokeAction(
      { ...action, enabledWhen: undefined },
      {
        ...ports,
        command: () => {
          throw new Error("permission denied");
        },
      },
    ),
  ).toThrow("permission denied");
});
test("platform input yields to composition, editors, handled keys and exact modifiers", () => {
  const input = {
    key: "z",
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
  };
  expect(matchesActionShortcut("mod+z", input, "other")).toBe(true);
  for (const changed of [
    { typing: true },
    { composing: true },
    { handled: true },
    { shiftKey: true },
    { altKey: true },
  ])
    expect(
      matchesActionShortcut("mod+z", { ...input, ...changed }, "other"),
    ).toBe(false);
  expect(matchesActionShortcut("mod+z", input, "mac")).toBe(false);
});
test("collections and references preserve identity and fail on missing sources", () => {
  const items = collectionView({
    roots: () => [{ id: "a", label: "A" }],
    id: (item) => item.id,
    label: (item) => item.label,
    children: () => undefined,
  });
  expect(items[0]?.id).toBe("a");
  expect(() =>
    collectionView({
      roots: () => ["a", "a"],
      id: (item) => item,
      label: (item) => item,
      children: () => undefined,
    }),
  ).toThrow("identity");
  expect(
    readReference({ source: "asset", key: "name" }, { asset: { name: "A" } }),
  ).toBe("A");
  expect(() =>
    readReference({ source: "asset", key: "missing" }, { asset: {} }),
  ).toThrow("Missing");
});
test("controller snapshots are stable and disposal releases subscriptions", () => {
  const controller = createUiController(
    { query: "" },
    (state, query: string) => ({ ...state, query }),
  );
  let calls = 0;
  const initial = controller.getSnapshot(),
    release = controller.subscribe(() => calls++);
  expect(controller.getSnapshot()).toBe(initial);
  controller.dispatch("hello");
  expect(controller.getSnapshot()).not.toBe(initial);
  expect(calls).toBe(1);
  release();
  controller.dispose();
  expect(() => controller.dispatch("x")).toThrow("disposed");
});
test("recording checks accessibility, event support and revision replay", async () => {
  const surface = new RecordingSurface();
  expect(() =>
    surface.render({ revision: 0, root: { key: "x", type: "button" } }),
  ).toThrow("labels");
  surface.render({
    revision: 0,
    root: {
      key: "x",
      type: "button",
      label: "Run",
      icon: { kind: "symbol", name: "Play" },
    },
  });
  surface.event({ revision: 0, sequence: 1, key: "x", type: "activate" });
  expect((await surface.nextEvent())?.key).toBe("x");
  expect(() =>
    surface.event({ revision: 0, sequence: 1, key: "x", type: "activate" }),
  ).toThrow("Stale");
  surface.dispose();
});
