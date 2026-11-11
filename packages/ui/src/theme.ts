/** Semantic token names shared by authored definitions and host adapters. No CSS or global state. */
export interface SemanticTokens {
  readonly mode: "light" | "dark";
  readonly color: Readonly<
    Record<
      | "surface"
      | "raised"
      | "text"
      | "muted"
      | "border"
      | "hover"
      | "selection"
      | "focus"
      | "disabled"
      | "danger",
      string
    >
  >;
  readonly typography: {
    readonly family: string;
    readonly body: number;
    readonly label: number;
    readonly lineHeight: number;
  };
  readonly spacing: {
    readonly unit: number;
    readonly control: number;
    readonly row: number;
  };
  readonly radius: number;
  readonly icon: {
    readonly small: number;
    readonly medium: number;
    readonly large: number;
  };
}
