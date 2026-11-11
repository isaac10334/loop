/** Element definitions are data. Hosts register trusted renderers separately by stable type ID. */
import type { UiNode, UiEvent } from "./nodes.js";
export interface ElementDefinition {
  readonly id: string;
  readonly properties: Readonly<
    Record<
      string,
      {
        readonly type: "string" | "boolean";
        readonly default?: string | boolean;
        readonly enum?: readonly string[];
      }
    >
  >;
  readonly children: {
    readonly max: number;
    readonly allowed?: readonly string[];
  };
  readonly events: readonly UiEvent["type"][];
  readonly accessibility: {
    readonly labelRequired: boolean;
    readonly role: string;
  };
}
export type ElementRegistry = ReadonlyMap<string, ElementDefinition>;
const containers = [
  "column",
  "row",
  "popover",
  "list",
  "tree",
  "table",
  "grid",
];
const controls = ["button", "popover", "input", "toggle", "select", "menu"];
/** Legacy short IDs are stable public type IDs; registrations cannot replace them. */
export function createElementRegistry(
  extensions: readonly ElementDefinition[] = [],
): ElementRegistry {
  const entries: ElementDefinition[] = [
    "column",
    "row",
    "text",
    "icon",
    "button",
    "popover",
    "input",
    "toggle",
    "select",
    "list",
    "tree",
    "table",
    "metric",
    "grid",
    "menu",
  ].map((id): ElementDefinition => ({
    id,
    properties:
      id === "grid"
        ? {
            columns: {
              type: "string",
              default: "2",
              enum: ["1", "2", "3", "4"],
            },
          }
        : {
            label: { type: "string" },
            text: { type: "string" },
            disabled: { type: "boolean", default: false },
            tone: {
              type: "string",
              default: "default",
              enum: ["default", "muted", "danger", "accent"],
            },
          },
    children:
      id === "menu"
        ? { max: 128, allowed: ["button"] }
        : containers.includes(id)
          ? { max: 512 }
          : ["button", "text"].includes(id)
            ? { max: 128, allowed: ["text", "icon"] }
            : { max: 0 },
    events: ["button", "popover"].includes(id)
      ? ["activate"]
      : ["input", "toggle", "select"].includes(id)
        ? ["change"]
        : ["list", "tree", "table"].includes(id)
          ? ["select"]
          : [],
    accessibility: {
      labelRequired: controls.includes(id),
      role:
        (
          {
            toggle: "checkbox",
            input: "textbox",
            list: "listbox",
            row: "group",
            column: "group",
            grid: "group",
            text: "text",
            icon: "img",
            metric: "status",
            popover: "button",
            select: "combobox",
          } as Record<string, string>
        )[id] ?? id,
    },
  }));
  const registry = new Map<string, ElementDefinition>();
  for (const entry of [...entries, ...extensions]) {
    if (
      !/^[\w:./-]{1,120}$/.test(entry.id) ||
      registry.has(entry.id) ||
      !Number.isSafeInteger(entry.children.max) ||
      entry.children.max < 0
    )
      throw new TypeError("Invalid or duplicate element registration");
    registry.set(entry.id, structuredClone(entry));
  }
  return registry;
}
export const semanticElements = createElementRegistry();
/** Resolve defaults without mutating a description. Trusted renderer adapters consume this projection. */
export function elementProperties(
  node: UiNode,
  registry: ElementRegistry = semanticElements,
): Readonly<Record<string, string | boolean>> {
  validateElement(node, registry);
  const defaults = Object.fromEntries(
    Object.entries(registry.get(node.type)!.properties).flatMap(
      ([key, schema]) =>
        schema.default === undefined ? [] : [[key, schema.default]],
    ),
  );
  return Object.freeze({ ...defaults, ...node.properties });
}
/** Validate slots (the ordered children slot), property schemas and accessibility before render. */
export function validateElement(node: UiNode, registry: ElementRegistry): void {
  const definition = registry.get(node.type);
  if (!definition) throw new TypeError(`Missing element: ${node.type}`);
  if (definition.accessibility.labelRequired && !node.label?.trim())
    throw new TypeError("Interactive controls need accessible labels");
  if (
    (node.children?.length ?? 0) > definition.children.max ||
    node.children?.some(
      (child) =>
        definition.children.allowed &&
        !definition.children.allowed.includes(child.type),
    )
  )
    throw new TypeError(`Invalid children for ${node.type}`);
  for (const [key, value] of Object.entries(node.properties ?? {})) {
    const property = definition.properties[key];
    if (
      !property ||
      typeof value !== property.type ||
      (property.enum && !property.enum.includes(String(value)))
    )
      throw new TypeError(`Invalid property: ${key}`);
  }
}
/** Typed construction checks extension property names/types at the caller boundary. */
export function defineElement<const P extends ElementDefinition["properties"]>(
  definition: Omit<ElementDefinition, "properties"> & {
    readonly properties: P;
  },
) {
  type Values = {
    readonly [K in keyof P]?: P[K]["type"] extends "boolean" ? boolean : string;
  };
  return {
    definition,
    node(
      key: string,
      properties: Values,
      children?: readonly UiNode[],
    ): UiNode {
      return {
        key,
        type: definition.id,
        properties: Object.fromEntries(
          Object.entries(properties).filter(([, value]) => value !== undefined),
        ) as Record<string, string | boolean>,
        ...(children ? { children } : {}),
      };
    },
  };
}
