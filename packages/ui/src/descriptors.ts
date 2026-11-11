/** Renderer-independent identities. References describe intent; hosts resolve resources. */
export type IconRef = (
  | { readonly kind: "symbol"; readonly name: string }
  | { readonly kind: "svg"; readonly assetId: string; readonly path: string }
  | {
      readonly kind: "provider";
      readonly provider: string;
      readonly name: string;
    }
) & {
  readonly size?: "small" | "medium" | "large";
  readonly role?: "decorative" | "image";
  readonly label?: string;
};
export function validateIconRef(value: unknown): IconRef {
  if (!value || typeof value !== "object")
    throw new TypeError("Invalid icon reference");
  const icon = value as IconRef;
  const keys =
    icon.kind === "symbol"
      ? ["name"]
      : icon.kind === "svg"
        ? ["assetId", "path"]
        : icon.kind === "provider"
          ? ["provider", "name"]
          : [];
  if (
    !keys.length ||
    Object.keys(icon).some(
      (key) => !["kind", "size", "role", "label", ...keys].includes(key),
    ) ||
    keys.some(
      (key) =>
        typeof (icon as unknown as Record<string, unknown>)[key] !== "string" ||
        !String((icon as unknown as Record<string, unknown>)[key]).trim() ||
        String((icon as unknown as Record<string, unknown>)[key]).length > 256,
    )
  )
    throw new TypeError("Invalid icon identity");
  if (
    icon.kind === "svg" &&
    (!icon.path.endsWith(".svg") ||
      icon.path.startsWith("/") ||
      icon.path.includes("..") ||
      icon.path.includes("\\") ||
      icon.path.includes(":"))
  )
    throw new TypeError("Invalid SVG asset path");
  if (
    icon.size !== undefined &&
    !["small", "medium", "large"].includes(icon.size)
  )
    throw new TypeError("Invalid icon size");
  if (icon.role !== undefined && !["decorative", "image"].includes(icon.role))
    throw new TypeError("Invalid icon role");
  if (
    icon.label !== undefined &&
    (typeof icon.label !== "string" || icon.label.length > 256)
  )
    throw new TypeError("Invalid icon label");
  if (icon.role === "image" && !icon.label?.trim())
    throw new TypeError("Image icons need accessible labels");
  return structuredClone(icon);
}
export type DataValue =
  | null
  | string
  | number
  | boolean
  | readonly DataValue[]
  | { readonly [key: string]: DataValue };
export type Invocation = {
  readonly kind: "command" | "shell";
  readonly id: string;
  readonly params?: Readonly<Record<string, DataValue>>;
};
/** Metadata is serializable. Conditions and authority are informational keys, never grants. */
export interface ActionDescriptor {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly icon?: IconRef;
  readonly shortcut?: string;
  readonly source: {
    readonly kind: "shell" | "contribution";
    readonly id: string;
  };
  readonly requiredAuthority: readonly string[];
  readonly visibleWhen?: string;
  readonly enabledWhen?: string;
  readonly invocation: Invocation;
}
export interface ActionPorts {
  condition(key: string): boolean;
  command(
    id: string,
    params: Readonly<Record<string, DataValue>>,
    signal?: AbortSignal,
  ): unknown;
  shell(
    id: string,
    params: Readonly<Record<string, DataValue>>,
    signal?: AbortSignal,
  ): unknown;
}
/** Rechecks conditions at invocation. The command port MUST enforce its existing authorization. */
export function actionState(
  action: ActionDescriptor,
  condition: ActionPorts["condition"],
) {
  return {
    visible: !action.visibleWhen || condition(action.visibleWhen),
    enabled: !action.enabledWhen || condition(action.enabledWhen),
  };
}
export function invokeAction(
  action: ActionDescriptor,
  ports: ActionPorts,
  signal?: AbortSignal,
): unknown {
  if (signal?.aborted) throw signal.reason;
  const state = actionState(action, ports.condition);
  if (!state.visible || !state.enabled) throw new Error("Action unavailable");
  return ports[action.invocation.kind](
    action.invocation.id,
    action.invocation.params ?? {},
    signal,
  );
}
/** Normalized key input; adapters determine input ownership before dispatch. */
export interface KeyInput {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly composing?: boolean;
  readonly typing?: boolean;
  readonly handled?: boolean;
}
/** Coordinates are local to the host-measured element, never layout instructions. */
export interface PointerInput {
  readonly phase: "down" | "move" | "up" | "cancel";
  readonly pointer: "mouse" | "touch" | "pen";
  readonly button: "primary" | "secondary" | "auxiliary";
  readonly x: number;
  readonly y: number;
}
export function matchesActionShortcut(
  shortcut: string,
  input: KeyInput,
  platform: "mac" | "other",
): boolean {
  if (input.composing || input.typing || input.handled) return false;
  const keys = shortcut.toLowerCase().split("+");
  const mod = platform === "mac" ? "meta" : "ctrl";
  return (
    input.key.toLowerCase() === keys.at(-1) &&
    input.ctrlKey ===
      (keys.includes("ctrl") || (keys.includes("mod") && mod === "ctrl")) &&
    input.metaKey ===
      (keys.includes("meta") || (keys.includes("mod") && mod === "meta")) &&
    input.shiftKey === keys.includes("shift") &&
    input.altKey === keys.includes("alt")
  );
}
/** Stable identity data source. Hosts add focus, virtualization and DOM measurement. */
export interface CollectionSource<T> {
  roots(): readonly T[];
  id(item: T): string;
  label(item: T): string;
  children(item: T): readonly T[] | undefined;
  icon?(item: T): IconRef | undefined;
}
export interface CollectionItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconRef;
  readonly children?: readonly CollectionItem[];
}
export function collectionView<T>(
  source: CollectionSource<T>,
): readonly CollectionItem[] {
  const ids = new Set<string>();
  let count = 0;
  const visit = (items: readonly T[], depth: number): CollectionItem[] => {
    if (depth > 32) throw new Error("Collection depth exceeded");
    return items.map((item) => {
      const id = source.id(item);
      if (!id || ids.has(id) || ++count > 10000)
        throw new Error("Invalid collection identity or budget");
      ids.add(id);
      const children = source.children(item);
      return {
        id,
        label: source.label(item),
        icon: source.icon?.(item),
        ...(children ? { children: visit(children, depth + 1) } : {}),
      };
    });
  };
  return visit(source.roots(), 0);
}
export interface ValueReference {
  readonly source: string;
  readonly key: string;
}
export interface PropertyDescriptor {
  readonly id: string;
  readonly label: string;
  readonly reference: ValueReference;
  readonly element: "input" | "toggle" | "select";
  readonly readOnly?: boolean;
  readonly options?: readonly {
    readonly value: string;
    readonly label: string;
  }[];
}
export function readReference(
  reference: ValueReference,
  sources: Readonly<Record<string, Readonly<Record<string, DataValue>>>>,
): DataValue {
  if (
    !Object.hasOwn(sources, reference.source) ||
    !Object.hasOwn(sources[reference.source]!, reference.key)
  )
    throw new Error("Missing value reference");
  return sources[reference.source]![reference.key]!;
}
/** Cached immutable snapshots for useSyncExternalStore and non-React consumers. */
export function createUiController<S, A>(
  initial: S,
  reduce: (state: Readonly<S>, action: A) => S,
) {
  const freeze = (value: unknown): void => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
  };
  const copy = (value: S): Readonly<S> => {
    const result = structuredClone(value);
    freeze(result);
    return result;
  };
  let snapshot = copy(initial);
  const listeners = new Set<() => void>();
  let disposed = false;
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (disposed) throw new Error("Controller disposed");
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(action: A) {
      if (disposed) throw new Error("Controller disposed");
      const next = reduce(snapshot, action);
      if (next === snapshot) return;
      snapshot = copy(next);
      listeners.forEach((listener) => listener());
    },
    dispose() {
      disposed = true;
      listeners.clear();
    },
  };
}
