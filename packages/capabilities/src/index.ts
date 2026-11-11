/**
 * Typed identities for service contracts. This package defines identities only;
 * a host or provider supplies the service value.
 *
 * @example
 * ```ts
 * interface Clock { now(): number }
 * const clock = defineCapability<Clock>({ id: "loop:time/clock", version: "1.0.0" });
 * ```
 */
declare const serviceType: unique symbol;

/** Pinned WIT source and generated binding dialect. This is provenance, not
 * runtime validation or authority. Hosts inspect actual executable imports. */
export interface WitContractSource {
  readonly format: "wit";
  readonly package: string;
  readonly world: string;
  readonly sourceSha256: `sha256:${string}`;
  readonly bindings: "jco" | "polyengine";
}

/** Portable JSON-schema vocabulary. Hosts validate authored schemas and apply policy. */
export interface ValueSchema {
  readonly type?: "null" | "boolean" | "number" | "integer" | "string" | "array" | "object";
  readonly properties?: Readonly<Record<string, ValueSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly items?: ValueSchema;
  readonly enum?: readonly (null | boolean | number | string)[];
  readonly description?: string;
}
/** Discoverable method semantics; declaring an effect never grants it. */
export interface MethodDescriptor {
  readonly name: string;
  readonly input: ValueSchema;
  readonly output: ValueSchema;
  readonly effects: readonly { readonly operation: string; readonly resource?: string }[];
  readonly subscription?: boolean;
}

/**
 * A stable runtime identity associated with a TypeScript service type.
 * Identities with equal `id` and `version` denote the same runtime contract;
 * `T` is erased and implementations are not checked at runtime.
 * @typeParam T - The service interface consumers expect to acquire.
 */
export interface Capability<T> {
  /** Namespaced contract ID, for example `loop:time/clock`. */
  readonly id: string;
  /** Explicit contract version. The host requires an exact string match. */
  readonly version: string;
  /** Explicit portable metadata, independent of the erased service type. */
  readonly methods?: readonly MethodDescriptor[];
  /** Optional independently stored executable-interface source identity. */
  readonly contract?: WitContractSource;
  /** Type-only marker; no implementation is stored on a capability. */
  readonly [serviceType]?: (value: T) => T;
}

/**
 * Define an immutable contract identity. Recreate the same ID and version in
 * another module to refer to the same runtime contract; coordinate `T` separately.
 *
 * @typeParam T - Service interface associated with this identity.
 * @param definition - Namespaced ID and nonempty version string.
 * @returns A frozen identity carrying no service implementation.
 * @throws {TypeError} If the ID is malformed or the version is blank.
 * @example
 * ```ts
 * const clock = defineCapability<{ now(): number }>({
 *   id: "loop:time/clock", version: "1.0.0"
 * });
 * ```
 */
export function defineCapability<T>(definition: { readonly id: string; readonly version: string; readonly methods?: readonly MethodDescriptor[]; readonly contract?: WitContractSource }): Capability<T> {
  if (!/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)+$/.test(definition.id)) {
    throw new TypeError(`Invalid capability ID: ${definition.id}`);
  }
  if (!definition.version.trim()) throw new TypeError("Capability version must be nonempty");
  const freeze = <V>(value: V): V => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const methods = definition.methods && structuredClone(definition.methods);
  const contract = definition.contract && structuredClone(definition.contract);
  if (contract && (contract.format !== "wit" || !/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*@\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(contract.package)
    || !/^[a-z][a-z0-9-]*$/.test(contract.world) || !/^sha256:[a-f0-9]{64}$/.test(contract.sourceSha256)
    || !["jco", "polyengine"].includes(contract.bindings))) throw new TypeError("Invalid WIT contract source");
  if (methods && (methods.length > 64 || new Set(methods.map(method => method.name)).size !== methods.length || methods.some(method => !/^[a-zA-Z][\w-]{0,79}$/.test(method.name)))) throw new TypeError("Invalid method descriptors");
  return Object.freeze({ id: definition.id, version: definition.version, ...(methods ? { methods: freeze(methods) } : {}), ...(contract ? { contract: freeze(contract) } : {}) }) as Capability<T>;
}
