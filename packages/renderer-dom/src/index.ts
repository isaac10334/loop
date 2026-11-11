/** Trusted semantic DOM mapping. Frame data never becomes HTML, CSS, URLs or callbacks. */
import type { HostPlugin, Host, Scope } from "@loop-kit/host";
import { RecordingSurface, validateFrame, type Surface, type UiFrame, type UiEvent, type UiNode } from "@loop-kit/ui";

const profile = { id: "loop:surface/semantic", version: "0.1.0" } as const;
const supported = new Set(["column", "row", "text", "icon", "button", "popover", "input", "toggle", "select", "list", "tree", "table", "metric"]);
/** A renderer registration is metadata, not a grant. DOM access stays in setup's injected ports. */
export function semanticDom(options: { readonly key: string; readonly root: string }): HostPlugin<"browser"> {
  if (!/^[a-z][a-z0-9.-]{0,63}$/.test(options.key) || !/^#[A-Za-z][\w-]{0,119}$/.test(options.root)) throw new TypeError("Expected plugin key and simple #root selector");
  return { apiVersion: 1, identity: { id: "loop:renderer/dom", version: "0.1.0" }, key: options.key, targets: ["browser"], runtime: [{ key: "renderer", host: "application", requires: [], provides: [{ kind: "renderer", host: "application", id: "loop:renderer/dom", version: "0.1.0", surfaceProfile: profile }], entry: { specifier: "@loop-kit/renderer-dom", export: "setup" }, options: { root: options.root } }] };
}

/** Reject accessors, exotic prototypes and cycles before portable validation reads any field. */
export function validateDomFrame(value: unknown): UiFrame {
  let count = 0;
  const seen = new Set<object>();
  function plain(v: unknown, depth: number): void {
    if (++count > 10000 || depth > 40) throw new TypeError("Frame data budget exceeded");
    if (v === null || typeof v === "string" || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v)) return;
    if (typeof v !== "object" || seen.has(v)) throw new TypeError("Frame must be finite plain data");
    seen.add(v);
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null && !(Array.isArray(v) && proto === Array.prototype)) throw new TypeError("Exotic frame object");
    if (Object.getOwnPropertySymbols(v).length) throw new TypeError("Symbol frame property");
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(v))) {
      if (Array.isArray(v) && key === "length") continue;
      if (!descriptor.enumerable || !("value" in descriptor)) throw new TypeError("Frame accessors forbidden");
      plain(descriptor.value, depth + 1);
    }
    seen.delete(v);
  }
  plain(value, 0);
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 65536) throw new TypeError("Frame exceeds 64KiB");
  const frame = validateFrame(value);
  function visit(node: UiNode) {
    if (!supported.has(node.type)) throw new TypeError("Unsupported DOM element");
    // Asset/provider icon resolution is a separate authority boundary, not an implicit URL loader.
    if (node.icon && typeof node.icon !== "string") throw new TypeError("Resource icons need an explicit reviewed resolver");
    node.children?.forEach(visit);
  }
  visit(frame.root);
  return frame;
}
export interface DomSurface extends Surface {
  readonly frame: UiFrame | undefined;
  /** Diagnostics contain no authority or event payloads. */
  inspect(): { readonly closed: boolean; readonly listeners: number; readonly pendingEventReads: number; readonly pendingFrames: number };
  /** Checked ingress for transport/test adapters; rejects stale, duplicate and disabled events. */
  event(event: UiEvent): void;
}
/** Owns listeners, one pending event read and frame commits. Abort closes reads synchronously, before joins. */
export function createDomSurface(options: { readonly root: HTMLElement; readonly signal?: AbortSignal }): DomSurface {
  const { root, signal } = options;
  const doc = root.ownerDocument, view = doc.defaultView;
  if (!view) throw new Error("Root has no browsing context");
  const recording = new RecordingSurface();
  let closed = false, sequence = 0, pendingEventReads = 0;
  let listeners: (() => void)[] = [];
  const frames = new Map<number, () => void>();
  const clearListeners = () => { for (const remove of listeners.splice(0)) remove(); };
  function event(e: UiEvent) { recording.event(e); sequence = e.sequence; }
  function listen(element: HTMLElement, type: string, fn: EventListener) {
    element.addEventListener(type, fn); listeners.push(() => element.removeEventListener(type, fn));
  }
  function build(node: UiNode, revision: number): HTMLElement {
    const tags: Record<string, string> = { text: "span", metric: "output", button: "button", popover: "button", input: "input", toggle: "input", select: "select", list: "ul", tree: "ul", table: "div" };
    const element = doc.createElement(tags[node.type] ?? "div");
    element.dataset.loopKey = node.key;
    if (node.label) element.setAttribute("aria-label", node.label);
    if (node.loading) element.setAttribute("aria-busy", "true");
    if (node.type === "row" || node.type === "column") element.dataset.layout = node.type;
    if (node.type === "tree") element.setAttribute("role", "tree");
    if (node.type === "table") element.setAttribute("role", "table");
    const disabled = !!(node.disabled || node.loading);
    const emit = (type: UiEvent["type"], value?: string | boolean) => {
      // Detached old nodes cannot synthesize events into a new frame; errors are denials, not DOM exceptions.
      try { event({ revision, sequence: sequence + 1, key: node.key, type, ...(value === undefined ? {} : { value }) }); } catch { /* stale/disabled/full */ }
    };
    if (["button", "popover"].includes(node.type)) {
      (element as HTMLButtonElement).type = "button"; (element as HTMLButtonElement).disabled = disabled;
      listen(element, "click", () => emit("activate")); // Native button handles keyboard + pointer without duplicate key handlers.
    }
    if (node.type === "input" || node.type === "toggle") {
      const input = element as HTMLInputElement; input.type = node.type === "toggle" ? "checkbox" : "text"; input.disabled = disabled;
      if (node.type === "toggle") input.checked = node.value === true; else { input.value = typeof node.value === "string" ? node.value : ""; input.maxLength = 4096; }
      listen(input, "change", () => emit("change", node.type === "toggle" ? input.checked : input.value));
    }
    if (node.type === "select") {
      const select = element as HTMLSelectElement; select.disabled = disabled;
      for (const option of node.options ?? []) { const el = doc.createElement("option"); el.value = option.value; el.textContent = option.label; select.append(el); }
      if (typeof node.value === "string") select.value = node.value;
      listen(select, "change", () => emit("change", select.value));
    }
    if (!["input", "toggle", "select"].includes(node.type)) element.append(doc.createTextNode(node.text ?? (typeof node.icon === "string" ? node.icon : "")));
    for (const child of node.children ?? []) {
      const item = build(child, revision);
      if (["list", "tree", "table"].includes(node.type)) {
        item.tabIndex = child.disabled || child.loading ? -1 : 0;
        item.setAttribute("role", node.type === "tree" ? "treeitem" : node.type === "table" ? "row" : "listitem");
        const select = () => emit("select", child.key);
        listen(item, "click", select);
        listen(item, "keydown", e => { const key = (e as KeyboardEvent).key; if (key === "Enter" || key === " ") { e.preventDefault(); select(); } });
      }
      element.append(item);
    }
    return element;
  }
  const surface: DomSurface = {
    get frame() { return recording.frame; }, event,
    inspect: () => ({ closed, listeners: listeners.length, pendingEventReads, pendingFrames: frames.size }),
    render(value) {
      if (closed) throw new Error("Surface disposed");
      const frame = validateDomFrame(value);
      // Build first: invalid data cannot partially change the visible tree or advance revision.
      const oldListeners = listeners; listeners = [];
      let tree: HTMLElement;
      try { tree = build(frame.root, frame.revision); recording.render(frame); }
      catch (error) { clearListeners(); listeners = oldListeners; throw error; }
      for (const remove of oldListeners) remove();
      const active = doc.activeElement as HTMLElement | null;
      const key = active && root.contains(active) ? active.dataset.loopKey : undefined;
      const selection = active?.tagName === "INPUT" && (active as HTMLInputElement).type === "text" ? [(active as HTMLInputElement).selectionStart, (active as HTMLInputElement).selectionEnd] : undefined;
      root.replaceChildren(tree);
      if (key) {
        const next = Array.from(root.querySelectorAll<HTMLElement>("[data-loop-key]")).find(el => el.dataset.loopKey === key);
        next?.focus();
        if (next?.tagName === "INPUT" && selection) (next as HTMLInputElement).setSelectionRange(selection[0] ?? 0, selection[1] ?? 0);
      }
      return new Promise<void>(resolve => { const id = view.requestAnimationFrame(() => { frames.delete(id); resolve(); }); frames.set(id, resolve); });
    },
    nextEvent: () => { pendingEventReads++; return recording.nextEvent().finally(() => { pendingEventReads--; }); },
    dispose() {
      if (closed) return; closed = true;
      signal?.removeEventListener("abort", abort); recording.dispose(); clearListeners();
      for (const [id, resolve] of frames) { view.cancelAnimationFrame(id); resolve(); } frames.clear(); root.replaceChildren();
    },
  };
  const abort = () => surface.dispose();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  return surface;
}
export interface SemanticDomPorts {
  /** The kit owns/adopts the result immediately; setup owns no second surface lifetime. */
  registerRenderer(key: { id: string; version: string; surfaceProfile: { id: string; version: string } }, create: (signal: AbortSignal) => Surface): void;
  readonly document: Document;
}
/** Runtime module entry. The bootstrap supplies explicit renderer registration and document ports. */
export function setup(ctx: { host: Host; scope: Scope; signal: AbortSignal; options: { root: string }; ports: SemanticDomPorts }): void {
  const root = ctx.ports.document.querySelector<HTMLElement>(ctx.options.root);
  if (!root) throw new Error("Semantic DOM root not found");
  ctx.ports.registerRenderer({ id: "loop:renderer/dom", version: "0.1.0", surfaceProfile: profile }, signal => createDomSurface({ root, signal }));
}
