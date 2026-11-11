/// <reference lib="esnext.disposable" preserve="true" />
/** Public ownership contracts. Runtime ownership never grants access to an operation or resource. */
import type { Capability, MethodDescriptor, WitContractSource } from "@loop-kit/capabilities";

/** Context for one resource generation. Retained/shared tickets can outlive the initial caller. */
export interface ProviderContext {
  /** Partial-initialization ownership. Runs after value disposal, or if creation fails. */
  readonly resources: ResourceOwner;
  /** Aborts on final-ticket cancellation, provider removal, or host disposal. */
  readonly signal: AbortSignal;
  /** Scope requesting this instance; it may acquire other registered capabilities. */
  readonly scope: Scope;
  /** Explicitly selected named service, absent for the legacy default provider. */
  readonly serviceId?: string;
}

/**
 * Creates a resource generation and optionally cleans it up. Independent by
 * default; explicit shared registrations coalesce concurrent acquisitions.
 * Creation may be async. Observe `context.signal` for cooperative cancellation;
 * a creation promise that never settles can delay revocation and disposal.
 * @typeParam T - Service value returned by this provider.
 */
export interface Provider<T> {
  /** Optional single-flight registration startup; its resources survive individual acquisitions. */
  activate?(context: ActivationContext): void | Promise<void>;
  /** Create a fresh generation. A rejection rejects every pending ticket for that generation. */
  create(context: ProviderContext): T | Promise<T>;
  /** Clean up a created instance once. Errors reject the relevant lifecycle operation. */
  dispose?(value: T): void | Promise<void>;
}

/**
 * An acquired service. Release it when finished. `value` is ordinary JavaScript:
 * retained references remain callable after cancellation unless the provider
 * implements its own checks. This handle is not a security boundary.
 * @typeParam T - Service interface associated with the acquired capability.
 */
export interface CapabilityHandle<T> extends ResourceLease<T> {
  /** The instance returned by Provider.create. Reading after this ticket closes throws. */
  readonly value: T;
  /** Lease cancellation. Providers receive the underlying resource lifetime signal. */
  readonly signal: AbortSignal;
  /** Abort this ticket immediately; final-ticket release awaits resource cleanup. Idempotent. */
  release(): Promise<void>;
}

/** Owns acquisitions; revocation aborts and releases all of its handles. */
export interface Scope {
  /** Exact named resolution captured as an injected dependency; never falls back to default. */
  bind<T>(capability: Capability<T>, serviceId: string): CapabilityBinding<T>;
  /** Synchronous cancellation; cleanup completion is represented by revoke(). */
  readonly signal: AbortSignal;
  /** Create a child whose cleanup completes before this scope's resources. */
  scope(options?: Omit<ScopeOptions, "parent">): Scope;
  /** Transfer disposal responsibility for a value to this scope. Explicit cleanup overrides symbols. */
  own<T>(value: T, cleanup?: (value: T) => void | Promise<void>): ResourceLease<T>;
  /** LIFO cleanup, compatible with AsyncDisposableStack.defer. */
  defer(cleanup: () => void | Promise<void>): void;
  /** Start owned work. Revocation aborts immediately and joins cooperative completion. */
  task<T>(run: (context: TaskContext) => T | Promise<T>, options?: TaskOptions): RuntimeTask<T>;
  [Symbol.asyncDispose](): Promise<void>;
  /** Host-local identity, stable for this scope's lifetime. */
  readonly id: string;
  /** Human-readable diagnostic name; not an authorization rule. */
  readonly name: string;
  /** Update display metadata without changing ownership or authority. Throws after revocation. */
  rename(name: string): void;
  /**
   * Create a fresh instance for this acquisition.
   * @throws If revoked, no provider exists, versions differ, or creation fails.
   */
  acquire<T>(capability: Capability<T>, options?: AcquisitionOptions): Promise<CapabilityHandle<T>>;
  /**
   * Abort all work immediately and await pending creation and cleanup. Idempotent.
   * Cleanup failures reject with an `AggregateError`.
   */
  revoke(reason?: unknown): Promise<void>;
}

/** Owns one provider registration and all instances created through it. */
export interface ProviderRegistration {
  /** Explicit, idempotent startup; acquire also activates lazily. Failure is sticky until removal. */
  activate(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
  /**
   * Stop new acquisition, abort active handles, and await cleanup. Idempotent.
   * Cleanup failures reject with an `AggregateError`.
   */
  unregister(reason?: unknown): Promise<void>;
}

/** Local in-process provider runtime. Dispose it to revoke scopes and registrations. */
export interface Host {
  [Symbol.asyncDispose](): Promise<void>;
  /** Eagerly start and pin one shared instance until stop, owner revocation or host disposal. */
  start<T>(capability: Capability<T>, provider: Provider<T>, options: ServiceOptions): Promise<RunningService<T>>;
  /**
   * Describe a contract without registering a provider or granting access.
   * Definitions are keyed by ID and version and retained until host disposal.
   * Calling again replaces display metadata. Throws after disposal.
   */
  define<T>(capability: Capability<T>, options?: CapabilityDefinitionOptions): void;
  /**
   * Register one provider per ID; an exact version is required at acquisition.
   * Records an undocumented definition if this ID/version is not yet known.
   * @throws If the ID is already registered or this host is disposed.
   */
  provide<T>(capability: Capability<T>, provider: Provider<T>, options?: ProviderOptions): ProviderRegistration;
  /** Create an independently revocable acquisition scope. Throws after disposal. */
  scope(options?: ScopeOptions): Scope;
  /** Cached, deeply frozen diagnostic data. Contains no service values, signals or lifecycle controls. */
  inspect(): HostSnapshot;
  /** Coalesced microtask notifications. Observer errors cannot affect provider lifecycle. */
  subscribe(listener: () => void): () => void;
  /** Revoke all scopes and remove providers. Idempotent; cleanup failures reject. */
  dispose(reason?: unknown): Promise<void>;
}

/** Optional contract documentation, independent of any provider implementation. */
export interface CapabilityDefinitionOptions {
  /** Display name; defaults to the path after `namespace:package/`. */
  readonly name?: string;
  /** Contract behavior and limits; defaults to an empty string. */
  readonly description?: string;
}

/** Host-known contract identity and documentation; no service values or inferred TypeScript members. */
export interface CapabilityDefinition {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  /** Prefix before the colon in the capability ID, e.g. `loop`. */
  readonly namespace: string;
  /** Contract package after the colon and before the first slash, e.g. `time`. Not an npm package. */
  readonly package: string;
  readonly methods?: readonly MethodDescriptor[];
  readonly contract?: WitContractSource;
}

/** Omission selects only the default provider; named providers are never guessed. */
export interface AcquisitionOptions { readonly serviceId?: string }

/** Optional display metadata for a provider registration. */
export interface ProviderOptions {
  /** Default: independent acquisition. Shared: one concurrent generation until the final lease closes. */
  readonly lifetime?: "acquisition" | "shared";
  /** Stable application-owned service identity, not a grant or display name. */
  readonly serviceId?: string;
  /** Display name; defaults to the capability ID. */
  readonly name?: string;
  /** Short description of the implementation and its limits. */
  readonly description?: string;
}

/** Named ownership. Revoking a parent also revokes its descendants. */
export interface ScopeOptions {
  /** Display name; defaults to a generated host-local identity. */
  readonly name?: string;
  /** Must be an active scope of this host. A child cannot outlive its parent. */
  readonly parent?: Scope;
}

/** An acquisition stays visible until creation or cleanup finishes. */
export interface AcquisitionSnapshot {
  readonly serviceId?: string;
  readonly id: string;
  readonly capabilityId: string;
  readonly version: string;
  readonly state: "pending" | "active" | "releasing";
}

/** Read-only scope ownership and acquisitions; completed scopes are not retained. */
export interface ScopeSnapshot {
  readonly bindings: readonly BindingSnapshot[];
  readonly resources: readonly ResourceSnapshot[];
  readonly tasks: readonly TaskSnapshot[];
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly state: "active" | "revoking";
  readonly acquisitions: readonly AcquisitionSnapshot[];
}

/** Registration metadata and the instances currently owned by it. */
export interface ProviderSnapshot {
  /** Host-local registration generation identity. Diagnostics only; never a grant.
   * A remove/re-register receives a new value even for the same capability/version. */
  readonly registrationId: string;
  readonly activation: "idle" | "activating" | "active" | "failed";
  readonly lifetime: "acquisition" | "shared";
  readonly serviceId?: string;
  readonly capabilityId: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly state: "registered" | "unregistering";
  readonly acquisitions: readonly (AcquisitionSnapshot & { readonly scopeId: string })[];
}

/** Reflection is host-local lifecycle information, not grants or a security membrane. */
export interface HostSnapshot {
  readonly services: readonly ServiceSnapshot[];
  readonly state: "active" | "disposing" | "disposed";
  readonly definitions: readonly CapabilityDefinition[];
  readonly scopes: readonly ScopeSnapshot[];
  readonly providers: readonly ProviderSnapshot[];
}


/** A non-owning view. It becomes invalid when its source lease closes; it cannot extend lifetime. */
export interface BorrowedResource<T> {
  readonly value: T;
  readonly signal: AbortSignal;
}
/** One ownership ticket. Reading value after cancellation throws; extracted JS values are cooperative. */
export interface ResourceLease<T> extends BorrowedResource<T>, AsyncDisposable {
  /** Underlying provider signal. It can outlive this ticket when other tickets retain the value. */
  readonly resourceSignal: AbortSignal;
  /** Add an independent ticket in an active scope of the same host. */
  retain(owner: Scope): ResourceLease<T>;
  /** Move this ticket atomically. The old lease and all its borrowed views become invalid. */
  transferTo(owner: Scope): ResourceLease<T>;
  borrow(): BorrowedResource<T>;
  /** Close this ticket; only the final ticket disposes the underlying value. */
  release(): Promise<void>;
}
/** Partial-initialization stack. Ownership transfers into use/adopt; cleanup is sequential LIFO. */
export interface ResourceOwner extends AsyncDisposable {
  [Symbol.asyncDispose](): Promise<void>;
  use<T extends Disposable | AsyncDisposable>(value: T): T;
  adopt<T>(value: T, cleanup: (value: T) => void | Promise<void>): T;
  defer(cleanup: () => void | Promise<void>): void;
}
/** Registration startup has a separate lifetime from any consumer. */
export interface ActivationContext {
  readonly signal: AbortSignal;
  readonly resources: ResourceOwner;
}
/** A named dependency passed explicitly to a factory. New acquisitions see replacement generations. */
export interface CapabilityBinding<T> {
  readonly capability: Capability<T>;
  readonly serviceId: string;
  acquire(): Promise<CapabilityHandle<T>>;
}
/** An eager shared provider pin. Stop invalidates every dependent lease; it is idempotent. */
export interface RunningService<T> extends BorrowedResource<T>, AsyncDisposable {
  readonly serviceId: string;
  stop(reason?: unknown): Promise<void>;
}
/** Starting a service always requires an exact name. Optional owner bounds its lifetime. */
export interface ServiceOptions extends Omit<ProviderOptions, "lifetime"> {
  readonly serviceId: string;
  readonly owner?: Scope;
}
/** Task deadlines use Unix milliseconds; timeout is relative. The earlier limit wins. */
export interface TaskOptions {
  readonly name?: string;
  readonly signal?: AbortSignal;
  readonly deadline?: number;
  readonly timeout?: number;
}
/** Task children belong to this task's scope and are joined before result settles. */
export interface TaskContext {
  readonly signal: AbortSignal;
  readonly scope: Scope;
}
/** Cancel aborts synchronously and awaits actual completion. Cancellation rejects result. */
export interface RuntimeTask<T> extends AsyncDisposable {
  readonly id: string;
  readonly signal: AbortSignal;
  readonly result: Promise<T>;
  cancel(reason?: unknown): Promise<void>;
}
/** Source-free metadata; IDs are ephemeral and values/errors are never reflected. */
export interface ResourceSnapshot {
  readonly id: string;
  readonly state: "pending" | "active" | "releasing";
  readonly references: number;
}
/** Only unfinished task groups are retained by the runtime. */
export interface TaskSnapshot {
  readonly id: string;
  readonly name: string;
  readonly state: "running" | "cancelling";
}
/** An exact name captured by a scope. Bindings are dependency descriptions, never grants. */
export interface BindingSnapshot {
  readonly capabilityId: string;
  readonly version: string;
  readonly serviceId: string;
}
/** An eagerly pinned shared instance and its internal owning scope. */
export interface ServiceSnapshot extends BindingSnapshot {
  readonly id: string;
  readonly scopeId: string;
  readonly state: "starting" | "running" | "stopping";
}
/** Compatibility view for callers requiring the old raw value and provider-signal identity. */
export interface LegacyCapabilityHandle<T> {
  readonly value: T;
  readonly signal: AbortSignal;
  release(): Promise<void>;
}
