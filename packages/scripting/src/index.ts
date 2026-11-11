/** Execution contracts and a guest-owned SDK. Hosts enforce bindings, quotas and lifecycle. */
import { h, validateFrame, type UiNode, type UiEvent, type NodeType } from "@loop-kit/ui";
import { defineCapability } from "@loop-kit/capabilities";
export interface ScriptBindings {
  invoke(binding: string, input: unknown): Promise<unknown>;
  subscribe(binding: string, input?: unknown): Promise<{ next(): Promise<string | undefined>; cancel(): void }>;
  openSurface(): Promise<{ render(document: string): void; nextEvent(): Promise<string | undefined>; dispose(): void }>;
}
export interface ActivatedIdentity { readonly sourceSha256: string; readonly dependenciesSha256: string; readonly engineSha256: string; readonly snapshotId: string }
export interface ScriptSession { dispatch(input: unknown, signal?: AbortSignal): Promise<unknown>; stop(): void }
export interface ScriptExecutor { run(source: string, input: unknown, bindings: ScriptBindings, signal?: AbortSignal): Promise<unknown> }
export const scripting = defineCapability<ScriptExecutor>({ id: "loop:scripting/executor", version: "0.1.0" });
export interface GuestNode extends Omit<UiNode, "children"> {
  children?: GuestNode[];
  onActivate?: (value?: string | boolean) => unknown;
  onChange?: (value?: string | boolean) => unknown;
  onSelect?: (value?: string | boolean) => unknown;
}
/** SDK instances belong to one guest session. Event callbacks never cross WIT. */
export function createGuestSdk(bindings: ScriptBindings) {
  let surface: Awaited<ReturnType<ScriptBindings["openSurface"]>> | undefined;
  let revision = -1;
  let callbacks = new Map<string, (value?: string | boolean) => unknown>();
  const ui = {
    h(type: NodeType | ((props:Record<string,unknown>)=>GuestNode), props: Omit<GuestNode,"type" | "children">, ...children: (GuestNode | string | number | null | undefined | boolean | (GuestNode|string|number|null|undefined|boolean)[])[]): GuestNode {
      if(typeof type==='function')return type({...props,children});
      const { onActivate, onChange, onSelect, ...data } = props;
      return { ...h(type, data, ...children as UiNode[]), ...(onActivate ? { onActivate } : {}), ...(onChange ? { onChange } : {}), ...(onSelect ? { onSelect } : {}) } as GuestNode;
    },
    async render(root: GuestNode) {
      const next = new Map<string, (value?: string | boolean) => unknown>();
      function encode(node: GuestNode): UiNode {
        const { onActivate, onChange, onSelect, children, ...data } = node;
        if (onActivate) next.set(`${node.key}:activate`, onActivate);
        if (onChange) next.set(`${node.key}:change`, onChange);
        if (onSelect) next.set(`${node.key}:select`, onSelect);
        return { ...data, ...(children ? { children: children.map(encode) } : {}) };
      }
      const frame = validateFrame({ revision: revision + 1, root: encode(root) });
      surface ??= await bindings.openSurface();
      surface.render(JSON.stringify(frame));
      revision++; callbacks = next;
    },
    /** Called by the host after queuing a validated surface interaction. */
    async update() {
      if (!surface) throw new Error("No surface is open");
      const raw = await surface.nextEvent();
      if (raw === undefined) return null;
      const event: UiEvent = JSON.parse(raw);
      if (event.revision !== revision) throw new Error("Stale guest event");
      await callbacks.get(`${event.key}:${event.type}`)?.(event.value);
      return null;
    },
    dispose() { surface?.dispose(); surface = undefined; callbacks.clear(); },
  };
  return { invoke: bindings.invoke, subscribe: bindings.subscribe, ui };
}
