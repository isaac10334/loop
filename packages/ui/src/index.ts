/** Portable semantic UI. Hosts own rendering, placement, focus and authority. */
import {
  semanticElements,
  validateElement,
  type ElementRegistry,
} from "./elements.js";
import { validateIconRef, type IconRef } from "./descriptors.js";
export * from "./descriptors.js";
export * from "./elements.js";
export * from "./theme.js";
export * from "./nodes.js";
import type { NodeType, UiNode, UiFrame, UiEvent } from "./nodes.js";
const allowed = new Set([
  "key",
  "type",
  "label",
  "text",
  "icon",
  "value",
  "disabled",
  "loading",
  "tone",
  "options",
  "children",
  "properties",
]);
/** Validate bounded, keyed data before a host updates its surface. No URLs, HTML or CSS. */
export function validateFrame(
  value: unknown,
  registry: ElementRegistry = semanticElements,
): UiFrame {
  if (!value || typeof value !== "object")
    throw new TypeError("Expected a UI frame");
  const frame = value as UiFrame;
  if (
    Object.keys(frame).some((key) => !["revision", "root"].includes(key)) ||
    !Number.isSafeInteger(frame.revision) ||
    frame.revision < 0
  )
    throw new TypeError("Invalid UI revision");
  const keys = new Set<string>();
  let count = 0;
  function visit(node: UiNode, depth: number) {
    if (
      !node ||
      typeof node !== "object" ||
      ++count > 512 ||
      depth > 16 ||
      Object.keys(node).some((key) => !allowed.has(key))
    )
      throw new TypeError("Invalid UI node or budget");
    if (
      typeof node.key !== "string" ||
      !/^[\w:./-]{1,120}$/.test(node.key) ||
      keys.has(node.key) ||
      !registry.has(node.type)
    )
      throw new TypeError("UI keys must be valid and unique; missing element");
    keys.add(node.key);
    for (const key of ["label", "text"] as const)
      if (
        node[key] !== undefined &&
        (typeof node[key] !== "string" || node[key]!.length > 4096)
      )
        throw new TypeError("Invalid UI text");
    if (node.icon !== undefined) {
      if (typeof node.icon === "string") {
        if (node.icon.length > 256) throw new TypeError("Invalid icon");
      } else validateIconRef(node.icon);
    }
    validateElement(node, registry);
    if (
      ["button", "popover", "input", "toggle", "select"].includes(node.type) &&
      !node.label?.trim()
    )
      throw new TypeError("Interactive controls need accessible labels");
    if (
      node.value !== undefined &&
      typeof node.value !== "string" &&
      typeof node.value !== "boolean"
    )
      throw new TypeError("Invalid UI value");
    if (node.disabled !== undefined && typeof node.disabled !== "boolean")
      throw new TypeError("Invalid disabled state");
    if (node.loading !== undefined && typeof node.loading !== "boolean")
      throw new TypeError("Invalid loading state");
    if (
      node.tone !== undefined &&
      !["default", "muted", "danger", "accent"].includes(node.tone)
    )
      throw new TypeError("Invalid semantic tone");
    if (
      node.options &&
      (!Array.isArray(node.options) ||
        node.options.length > 128 ||
        node.options.some(
          (option) =>
            typeof option.value !== "string" ||
            typeof option.label !== "string" ||
            option.value.length > 256 ||
            option.label.length > 256 ||
            Object.keys(option).some(
              (key) => !["value", "label"].includes(key),
            ),
        ))
    )
      throw new TypeError("Invalid selection options");
    if (node.children && !Array.isArray(node.children))
      throw new TypeError("Invalid UI children");
    node.children?.forEach((child) => visit(child, depth + 1));
  }
  visit(frame.root, 0);
  if (JSON.stringify(frame).length > 65536)
    throw new TypeError("UI frame exceeds budget");
  return structuredClone(frame);
}
/** Independent recording/event adapter, usable without Station or a DOM. */
export class RecordingSurface {
  constructor(private readonly registry: ElementRegistry = semanticElements) {}
  private current?: UiFrame;
  private sequence = 0;
  private closed = false;
  private queue: UiEvent[] = [];
  private waiter?: (event: UiEvent | undefined) => void;
  get frame(): UiFrame | undefined {
    return this.current && structuredClone(this.current);
  }
  render(value: UiFrame) {
    if (this.closed) throw new Error("Surface disposed");
    const frame = validateFrame(value, this.registry);
    if (frame.revision !== (this.current ? this.current.revision + 1 : 0))
      throw new Error("Stale UI update");
    this.current = frame;
    this.queue = [];
  }
  event(event: UiEvent) {
    if (
      !event ||
      Object.keys(event).some(
        (key) =>
          !["revision", "sequence", "key", "type", "value"].includes(key),
      ) ||
      !["activate", "change", "select"].includes(event.type)
    )
      throw new Error("Invalid UI event");
    if (
      this.closed ||
      !this.current ||
      event.revision !== this.current.revision ||
      !Number.isSafeInteger(event.sequence) ||
      event.sequence <= this.sequence
    )
      throw new Error("Stale UI event");
    let node: UiNode | undefined;
    const find = (candidate: UiNode) => {
      if (candidate.key === event.key) node = candidate;
      candidate.children?.forEach(find);
    };
    find(this.current.root);
    if (
      !node ||
      node.disabled ||
      node.loading ||
      !this.registry.get(node.type)?.events.includes(event.type)
    )
      throw new Error("Invalid UI event target");
    if (
      event.value !== undefined &&
      typeof event.value !== "string" &&
      typeof event.value !== "boolean"
    )
      throw new Error("Invalid UI event value");
    if (typeof event.value === "string" && event.value.length > 4096)
      throw new Error("UI event exceeds budget");
    if (node.type === "toggle" && typeof event.value !== "boolean")
      throw new Error("Toggle events need a boolean");
    if (node.type === "input" && typeof event.value !== "string")
      throw new Error("Input events need text");
    if (
      ["list", "tree", "table"].includes(node.type) &&
      !node.children?.some(
        (child) =>
          child.key === event.value && !child.disabled && !child.loading,
      )
    )
      throw new Error("Unknown or disabled row selection");
    if (
      node.type === "select" &&
      !node.options?.some((option) => option.value === event.value)
    )
      throw new Error("Unknown selection");
    if (this.queue.length >= 32) throw new Error("UI event queue is full");
    this.sequence = event.sequence;
    const copy = structuredClone(event);
    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = undefined;
      waiter(copy);
    } else this.queue.push(copy);
  }
  nextEvent(): Promise<UiEvent | undefined> {
    if (this.closed) return Promise.resolve(undefined);
    if (this.queue.length) return Promise.resolve(this.queue.shift());
    if (this.waiter)
      return Promise.reject(new Error("An event read is already pending"));
    return new Promise((resolve) => {
      this.waiter = resolve;
    });
  }
  dispose() {
    if (this.closed) return;
    this.closed = true;
    this.queue = [];
    this.waiter?.(undefined);
    this.waiter = undefined;
  }
}
/** Direct composition and JSX produce identical nodes. Callbacks are guest-owned. */
export function h(
  type: NodeType,
  props: Omit<UiNode, "type" | "children"> | null,
  ...children: (
    | UiNode
    | string
    | number
    | null
    | undefined
    | boolean
    | (UiNode | string | number | null | undefined | boolean)[]
  )[]
): UiNode {
  if (!props?.key)
    throw new TypeError("Every UI node needs an explicit stable key");
  const flat = children.flat(16) as (
    UiNode | string | number | null | undefined | boolean
  )[];
  return {
    ...props,
    type,
    ...(flat.length
      ? {
          children: flat
            .filter(
              (child): child is UiNode | string | number =>
                child !== null &&
                child !== undefined &&
                typeof child !== "boolean",
            )
            .map((child, index) =>
              typeof child === "string" || typeof child === "number"
                ? {
                    key: `${props.key}:text:${index}`,
                    type: "text",
                    text: String(child),
                  }
                : child,
            ),
        }
      : {}),
  };
}
