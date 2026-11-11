/** Portable UI description and event contracts. */
import type { IconRef } from "./descriptors.js";
export type NodeType =
  | "column"
  | "row"
  | "text"
  | "icon"
  | "button"
  | "popover"
  | "input"
  | "toggle"
  | "select"
  | "list"
  | "tree"
  | "table"
  | "metric"
  | (string & {});
export interface UiNode {
  readonly key: string;
  readonly type: NodeType;
  readonly label?: string;
  readonly text?: string;
  readonly icon?: string | IconRef;
  readonly properties?: Readonly<Record<string, string | boolean>>;
  readonly value?: string | boolean;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly tone?: "default" | "muted" | "danger" | "accent";
  readonly options?: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  readonly children?: readonly UiNode[];
}
/** Optimistic revision identifies the frame that emitted an interaction. */
export interface UiFrame {
  readonly revision: number;
  readonly root: UiNode;
}
export interface UiEvent {
  readonly revision: number;
  readonly sequence: number;
  readonly key: string;
  readonly type: "activate" | "change" | "select";
  readonly value?: string | boolean;
}
export interface Surface {
  render(frame: UiFrame): void | Promise<void>;
  nextEvent(): Promise<UiEvent | undefined>;
  dispose(): void;
}
