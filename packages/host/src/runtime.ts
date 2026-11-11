/** Portable ownership runtime. Authorization and concrete dependency composition belong to callers. */
import type { Capability } from "@loop-kit/capabilities";
import type {
  Host, Scope, ScopeOptions, Provider, ProviderOptions, ProviderRegistration,
  CapabilityDefinitionOptions, CapabilityDefinition, HostSnapshot, CapabilityHandle,
  AcquisitionOptions, AcquisitionSnapshot, ResourceLease, ResourceOwner,
  TaskOptions, RuntimeTask, TaskSnapshot, ServiceOptions, RunningService, BindingSnapshot, ServiceSnapshot, LegacyCapabilityHandle,
} from "./contracts.js";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  void promise.catch(() => {});
  return { promise, resolve, reject };
}
async function attempt(errors: unknown[], action: () => unknown) {
  try { await action(); } catch (error) { errors.push(error); }
}
function failures(errors: unknown[], message: string) {
  if (errors.length) throw new AggregateError(errors, message);
}
function immutable<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(immutable); Object.freeze(value); }
  return value;
}
function validServiceId(value: unknown): value is string {
  return typeof value === "string" && /^[\w:./-]{1,160}$/.test(value);
}
function cancelled(reason?: unknown): Error {
  return reason instanceof Error ? reason : new Error("Acquisition cancelled", { cause: reason });
}
function waitFor<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error("Acquisition cancelled"));
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("Acquisition cancelled"));
    signal.addEventListener("abort", abort, { once: true });
    void promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
function autoDispose(value: unknown): void | Promise<void> {
  if (value == null) return;
  const resource = value as Partial<AsyncDisposable & Disposable>;
  if (typeof resource[Symbol.asyncDispose] === "function") return Promise.resolve(resource[Symbol.asyncDispose]!());
  if (typeof resource[Symbol.dispose] === "function") resource[Symbol.dispose]!();
}
/** A dependency-free AsyncDisposableStack-compatible initialization owner. */
export function createResourceOwner(): ResourceOwner {
  const callbacks: (() => void | Promise<void>)[] = [];
  let closing: Promise<void> | undefined;
  const owner: ResourceOwner = {
    use(value) { owner.defer(() => autoDispose(value)); return value; },
    adopt(value, cleanup) { owner.defer(() => cleanup(value)); return value; },
    defer(callback) { if (closing) throw new Error("Resource owner is disposed"); callbacks.push(callback); },
    [Symbol.asyncDispose]() {
      if (closing) return closing;
      const done = deferred<void>(); closing = done.promise;
      void (async () => {
        const errors: unknown[] = [];
        while (callbacks.length) await attempt(errors, callbacks.pop()!);
        failures(errors, "Resource cleanup failed");
      })().then(() => done.resolve(), done.reject);
      return closing;
    },
  };
  return owner;
}
/** Preserve legacy raw-value access and equality with ProviderContext.signal. Own/release the source lease. */
export function toLegacyHandle<T>(lease: ResourceLease<T>): LegacyCapabilityHandle<T> {
  return Object.freeze({ value: lease.value, signal: lease.resourceSignal, release: () => lease.release() });
}

type Entry = { cancel(reason?: unknown): void; close(): Promise<void> };
type ScopeRecord = {
  api: Scope; parent?: ScopeRecord; controller: AbortController; closing?: Promise<void>;
  entries: Set<Entry>; tickets: Set<Ticket>; children: Set<ScopeRecord>;
  joins: Set<Promise<unknown>>; tasks: Map<string, TaskSnapshot>; bindings: BindingSnapshot[];
};
type Cell = {
  id: string; controller: AbortController; resources: ResourceOwner; tickets: Set<Ticket>;
  ready: ReturnType<typeof deferred<unknown>>; value: unknown; initialized: boolean;
  initializationCleanup?: unknown; closing?: Promise<void>; registration?: Registration;
  begin(owner: Scope): void; close(): Promise<void>;
};
type Ticket = Entry & {
  id: string; cell: Cell; owner: ScopeRecord; controller: AbortController;
  state: AcquisitionSnapshot["state"]; api: ResourceLease<unknown>; closing?: Promise<void>;
};
type Registration = {
  id: string;
  capability: Capability<unknown>; provider: Provider<unknown>; options: ProviderOptions;
  api: ProviderRegistration; controller: AbortController; resources: ResourceOwner;
  activation: "idle" | "activating" | "active" | "failed"; activationTask?: Promise<void>;
  closing?: Promise<void>; cells: Set<Cell>; shared?: Cell; key: string;
};

/** Create an isolated runtime. Pass acquired narrow ports explicitly to application factories. */
export function createHost(): Host {
  const definitions = new Map<string, CapabilityDefinition>();
  const registrations = new Map<string, Registration>();
  const observed = new Set<Registration>();
  const services = new Map<string, ServiceSnapshot>();
  const scopes = new Map<Scope, ScopeRecord>();
  const listeners = new Set<() => void>();
  let next = 0, scheduled = false, disposed = false;
  let closing: Promise<void> | undefined, snapshot: HostSnapshot | undefined;
  const identity = (prefix: string) => `${prefix}:${++next}`;
  const keyFor = (capability: Capability<unknown>, serviceId?: string) => JSON.stringify([capability.id, serviceId ?? null]);
  function changed() {
    snapshot = undefined;
    if (scheduled || !listeners.size) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      for (const listener of [...listeners]) if (listeners.has(listener)) {
        try { listener(); } catch { /* Observers cannot change lifecycle outcomes. */ }
      }
    });
  }
  function activeHost() { if (closing) throw new Error("Host is disposed"); }
  function activeScope(scope: Scope): ScopeRecord {
    activeHost();
    const record = scopes.get(scope);
    if (!record || record.closing) throw new Error("Scope is revoked or does not belong to this host");
    return record;
  }
  function define<T>(capability: Capability<T>, options: CapabilityDefinitionOptions = {}) {
    activeHost();
    const colon = capability.id.indexOf(":"), slash = capability.id.indexOf("/", colon + 1);
    const item: CapabilityDefinition = Object.freeze({
      id: capability.id, version: capability.version,
      name: options.name?.trim() || capability.id.slice(slash + 1), description: options.description ?? "",
      namespace: capability.id.slice(0, colon), package: capability.id.slice(colon + 1, slash),
      ...(capability.methods ? { methods: immutable(structuredClone(capability.methods)) } : {}),
      ...(capability.contract ? { contract: immutable(structuredClone(capability.contract)) } : {}),
    });
    const key = JSON.stringify([capability.id, capability.version]);
    if (JSON.stringify(item) !== JSON.stringify(definitions.get(key))) { definitions.set(key, item); changed(); }
  }
  function acquisition(ticket: Ticket): AcquisitionSnapshot {
    const reg = ticket.cell.registration!;
    return Object.freeze({ id: ticket.id, capabilityId: reg.capability.id, version: reg.capability.version,
      state: ticket.state, ...(reg.options.serviceId ? { serviceId: reg.options.serviceId } : {}) });
  }
  function inspect(): HostSnapshot {
    if (snapshot) return snapshot;
    snapshot = Object.freeze({ state: disposed ? "disposed" : closing ? "disposing" : "active",
      definitions: Object.freeze([...definitions.values()]),
      services: Object.freeze([...services.values()].map(service => Object.freeze({ ...service }))),
      scopes: Object.freeze([...scopes.values()].map(record => Object.freeze({
        id: record.api.id, name: record.api.name, parentId: record.parent?.api.id ?? null,
        state: record.closing ? "revoking" as const : "active" as const,
        acquisitions: Object.freeze([...record.tickets].filter(t => t.cell.registration).map(acquisition)),
        resources: Object.freeze([...record.tickets].map(t => Object.freeze({ id: t.id, state: t.state, references: t.cell.tickets.size }))),
        tasks: Object.freeze([...record.tasks.values()].map(t => Object.freeze({ ...t }))),
        bindings: Object.freeze(record.bindings.map(binding => Object.freeze({ ...binding }))),
      }))),
      providers: Object.freeze([...observed].map(reg => Object.freeze({
        registrationId: reg.id,
        capabilityId: reg.capability.id, version: reg.capability.version,
        name: reg.options.name?.trim() || reg.capability.id, description: reg.options.description ?? "",
        ...(reg.options.serviceId ? { serviceId: reg.options.serviceId } : {}),
        state: reg.closing ? "unregistering" as const : "registered" as const,
        activation: reg.activation, lifetime: reg.options.lifetime ?? "acquisition",
        acquisitions: Object.freeze([...reg.cells].flatMap(cell => [...cell.tickets].map(t => Object.freeze({ ...acquisition(t), scopeId: t.owner.api.id })))),
      }))),
    });
    return snapshot;
  }
  function makeCell(registration?: Registration, supplied?: { value: unknown; cleanup?: (value: unknown) => void | Promise<void> }): Cell {
    const cell: Cell = {
      id: identity("resource"), registration, controller: new AbortController(), resources: createResourceOwner(),
      tickets: new Set(), ready: deferred<unknown>(), value: undefined, initialized: false,
      begin(owner) {
        if (!registration!.provider.activate && !registration!.activationTask) {
          registration!.activation = "active";
          registration!.activationTask = Promise.resolve();
          changed();
        }
        const initialize = () => {
          if (cell.controller.signal.aborted) throw cancelled();
          return registration!.provider.create({ scope: owner, signal: cell.controller.signal, resources: cell.resources,
            ...(registration!.options.serviceId ? { serviceId: registration!.options.serviceId } : {}) });
        };
        let creation: unknown;
        try {
          // Preserve immediate provider invocation for registrations without async activation.
          creation = registration!.provider.activate ? registration!.api.activate().then(initialize) : initialize();
        } catch (error) { creation = Promise.reject(error); }
        void Promise.resolve(creation).then(value => {
          cell.value = value; cell.initialized = true; cell.ready.resolve(value);
        }, async error => {
          try { await cell.resources[Symbol.asyncDispose](); } catch (cleanup) { cell.initializationCleanup = cleanup; }
          cell.ready.reject(cell.initializationCleanup ? new AggregateError([error, cell.initializationCleanup], "Provider initialization failed") : error);
        });
      },
      close() {
        if (cell.closing) return cell.closing;
        const done = deferred<void>(); cell.closing = done.promise;
        if (registration?.shared === cell) registration.shared = undefined;
        cell.controller.abort(new Error("Resource released")); changed();
        void (async () => {
          const errors: unknown[] = [];
          try { await cell.ready.promise; } catch { /* Creation errors belong to acquire. */ }
          if (cell.initialized) await attempt(errors, () => supplied?.cleanup ? supplied.cleanup(cell.value) : registration?.provider.dispose ? registration.provider.dispose(cell.value) : autoDispose(cell.value));
          await attempt(errors, () => cell.resources[Symbol.asyncDispose]());
          registration?.cells.delete(cell); changed();
          if (errors.length === 1) throw errors[0];
          failures(errors, "Resource disposal failed");
        })().then(() => done.resolve(), done.reject);
        return cell.closing;
      },
    };
    registration?.cells.add(cell);
    if (supplied) { cell.value = supplied.value; cell.initialized = true; cell.ready.resolve(supplied.value); }
    return cell;
  }
  function ticketFor<T>(cell: Cell, owner: ScopeRecord): Ticket & { api: ResourceLease<T> } {
    const ticket: Ticket = {
      id: identity("acquisition"), cell, owner, controller: new AbortController(), state: cell.initialized ? "active" : "pending", api: undefined!,
      cancel(reason) {
        if (ticket.controller.signal.aborted) return;
        ticket.state = "releasing";
        // Abort the resource only when all remaining tickets are cancelled.
        ticket.controller.abort(reason);
        if ([...cell.tickets].every(t => t.controller.signal.aborted)) {
          if (cell.registration?.shared === cell) cell.registration.shared = undefined;
          cell.controller.abort(reason);
        }
        changed();
      },
      close() {
        if (ticket.closing) return ticket.closing;
        const done = deferred<void>(); ticket.closing = done.promise;
        ticket.cancel(new Error("Handle released"));
        // Closing tickets no longer retain a value, but remain inspectable until cleanup finishes.
        void (async () => {
          try { if ([...cell.tickets].every(t => t.closing)) await cell.close(); }
          finally { cell.tickets.delete(ticket); ticket.owner.entries.delete(ticket); ticket.owner.tickets.delete(ticket); changed(); }
        })().then(() => done.resolve(), done.reject);
        return ticket.closing;
      },
    };
    const assert = () => {
      if (ticket.controller.signal.aborted || cell.controller.signal.aborted) throw new Error("Resource lease is released or revoked");
      if (!cell.initialized) throw new Error("Resource is not initialized");
    };
    ticket.api = {
      get value() { assert(); return cell.value; }, get signal() { return ticket.controller.signal; },
      get resourceSignal() { return cell.controller.signal; },
      retain(scope) { assert(); return ticketFor(cell, activeScope(scope)).api; },
      transferTo(scope) {
        assert(); const destination = ticketFor(cell, activeScope(scope)).api;
        void ticket.close(); return destination;
      },
      borrow() { assert(); return Object.freeze({ get value() { return ticket.api.value; }, signal: ticket.controller.signal }); },
      release: () => ticket.close(), [Symbol.asyncDispose]: () => ticket.close(),
    };
    cell.tickets.add(ticket); owner.entries.add(ticket); owner.tickets.add(ticket); changed();
    return ticket as Ticket & { api: ResourceLease<T> };
  }
  function provide<T>(capability: Capability<T>, provider: Provider<T>, options: ProviderOptions = {}): ProviderRegistration {
    activeHost();
    if (options.serviceId !== undefined && !validServiceId(options.serviceId)) throw new TypeError("Invalid service identity");
    if (options.lifetime !== undefined && options.lifetime !== "shared" && options.lifetime !== "acquisition") throw new TypeError("Invalid provider lifetime");
    const key = keyFor(capability as Capability<unknown>, options.serviceId);
    if (registrations.has(key)) throw new Error(`Capability already provided: ${capability.id}`);
    if (!definitions.has(JSON.stringify([capability.id, capability.version]))) define(capability);
    const reg: Registration = {
      id: identity("registration"),
      capability: capability as Capability<unknown>, provider: provider as Provider<unknown>, options: { ...options }, key,
      controller: new AbortController(), resources: createResourceOwner(), activation: "idle", cells: new Set(), api: undefined!,
    };
    reg.api = {
      activate() {
        if (reg.closing) return Promise.reject(new Error("Provider is unregistered"));
        if (reg.activationTask) return reg.activationTask;
        const done = deferred<void>(); reg.activationTask = done.promise; reg.activation = "activating"; changed();
        void (async () => {
          try {
            await provider.activate?.({ signal: reg.controller.signal, resources: reg.resources });
            if (reg.controller.signal.aborted) throw cancelled();
            reg.activation = "active";
          } catch (error) {
            reg.activation = "failed";
            reg.controller.abort(error);
            const errors: unknown[] = [error];
            await attempt(errors, () => reg.resources[Symbol.asyncDispose]());
            failures(errors, "Provider activation failed");
          } finally { changed(); }
        })().then(() => done.resolve(), done.reject);
        return reg.activationTask;
      },
      unregister(reason) {
        if (reg.closing) return reg.closing;
        const done = deferred<void>(); reg.closing = done.promise;
        if (registrations.get(key) === reg) registrations.delete(key);
        reg.controller.abort(reason);
        for (const cell of reg.cells) {
          cell.controller.abort(reason);
          for (const ticket of cell.tickets) ticket.cancel(reason);
        }
        changed();
        void (async () => {
          const errors: unknown[] = [];
          for (const cell of [...reg.cells].reverse()) {
            for (const ticket of [...cell.tickets].reverse()) await attempt(errors, () => ticket.close());
            await attempt(errors, () => cell.close());
          }
          // Activation failures are reported to activate/acquire; removal reports cleanup failures.
          try { await reg.activationTask; } catch { /* Sticky startup failure. */ }
          await attempt(errors, () => reg.resources[Symbol.asyncDispose]());
          observed.delete(reg); changed(); failures(errors, "Provider removal failed");
        })().then(() => done.resolve(), done.reject);
        return reg.closing;
      },
      [Symbol.asyncDispose]: () => reg.api.unregister(),
    };
    registrations.set(key, reg); observed.add(reg); changed(); return reg.api;
  }
  function scope(options: ScopeOptions = {}): Scope {
    activeHost();
    const parent = options.parent && scopes.get(options.parent);
    if (options.parent && (!parent || parent.closing)) throw new Error("Parent scope must be active and belong to this host");
    const id = identity("scope"); let name = options.name?.trim() || id;
    const record: ScopeRecord = { api: undefined!, parent, controller: new AbortController(), entries: new Set(), tickets: new Set(), children: new Set(), joins: new Set(), tasks: new Map(), bindings: [] };
    const api: Scope = {
      id, get name() { return name; }, get signal() { return record.controller.signal; },
      rename(value) { activeScope(api); if (!value.trim()) throw new TypeError("Scope name must be nonempty"); if (name !== value.trim()) { name = value.trim(); changed(); } },
      scope(childOptions) { activeScope(api); return scope({ ...childOptions, parent: api }); },
      own<T>(value: T, cleanup?: (value: T) => void | Promise<void>) {
        activeScope(api);
        return ticketFor<T>(makeCell(undefined, { value, cleanup: cleanup as ((value: unknown) => void | Promise<void>) | undefined }), record).api;
      },
      defer(callback) { api.own(undefined, callback); },
      bind<T>(capability: Capability<T>, serviceId: string) {
        activeScope(api);
        if (!validServiceId(serviceId)) throw new TypeError("Invalid service identity");
        record.bindings.push({ capabilityId: capability.id, version: capability.version, serviceId }); changed();
        return Object.freeze({ capability, serviceId, acquire: () => api.acquire(capability, { serviceId }) });
      },
      acquire<T>(capability: Capability<T>, selection: AcquisitionOptions = {}): Promise<CapabilityHandle<T>> {
        try { activeScope(api); } catch (error) { return Promise.reject(error); }
        if (selection.serviceId !== undefined && !validServiceId(selection.serviceId)) return Promise.reject(new TypeError("Invalid service identity"));
        const reg = registrations.get(keyFor(capability as Capability<unknown>, selection.serviceId));
        if (!reg || reg.closing) return Promise.reject(new Error(`No provider for ${capability.id}`));
        if (reg.capability.version !== capability.version) return Promise.reject(new Error(`Version mismatch for ${capability.id}: expected ${reg.capability.version}, got ${capability.version}`));
        let cell = reg.options.lifetime === "shared" ? reg.shared : undefined;
        const fresh = !cell;
        cell ??= makeCell(reg);
        if (reg.options.lifetime === "shared") reg.shared = cell;
        const ticket = ticketFor<T>(cell, record);
        if (fresh) cell.begin(api);
        const result = (async () => {
          try {
            await waitFor(cell.ready.promise, ticket.controller.signal);
            if (ticket.controller.signal.aborted || cell.controller.signal.aborted) {
              await ticket.close(); throw new Error("Acquisition cancelled");
            }
            ticket.state = "active"; changed(); return ticket.api;
          } catch (error) {
            // Revocation owns cleanup ordering, but cancellation must settle the
            // acquisition immediately: a joined child task can itself be awaiting
            // this acquisition from its parent scope. Awaiting owner.closing here
            // creates parent-revoke -> task-body -> acquire -> parent-revoke.
            if (ticket.controller.signal.aborted && ticket.owner.closing) {
              throw error;
            }
            if (cell.initializationCleanup) {
              // ready already reports both the creation error and its unwind error.
              // Join the cached cleanup without replacing that primary diagnostic.
              try { await ticket.close(); } catch { /* Included in the initialization error. */ }
              throw error;
            }
            await ticket.close(); throw error;
          }
        })();
        void result.catch(() => {}); return result;
      },
      task<T>(run: (context: { signal: AbortSignal; scope: Scope }) => T | Promise<T>, taskOptions: TaskOptions = {}): RuntimeTask<T> {
        activeScope(api);
        if (taskOptions.timeout !== undefined && (!Number.isFinite(taskOptions.timeout) || taskOptions.timeout < 0)) throw new TypeError("Invalid task timeout");
        if (taskOptions.deadline !== undefined && !Number.isFinite(taskOptions.deadline)) throw new TypeError("Invalid task deadline");
        const taskId = identity("task"), taskScope = api.scope({ name: taskOptions.name ?? taskId });
        const taskRecord = scopes.get(taskScope)!;
        const body = deferred<T>(), result = deferred<T>();
        taskRecord.joins.add(body.promise);
        const meta = { id: taskId, name: taskOptions.name ?? taskId, state: "running" as const };
        record.tasks.set(taskId, meta); changed();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const abort = (reason?: unknown) => { void taskScope.revoke(reason).catch(() => {}); };
        const externalAbort = () => abort(taskOptions.signal!.reason);
        const cancelling = () => { record.tasks.set(taskId, { ...meta, state: "cancelling" }); changed(); };
        taskScope.signal.addEventListener("abort", cancelling, { once: true });
        if (taskOptions.signal?.aborted) externalAbort();
        else taskOptions.signal?.addEventListener("abort", externalAbort, { once: true });
        const deadline = Math.min(taskOptions.deadline ?? Infinity, taskOptions.timeout === undefined ? Infinity : Date.now() + taskOptions.timeout);
        if (deadline <= Date.now()) abort(new Error("Task deadline exceeded"));
        else if (deadline !== Infinity) {
          const schedule = () => { const remaining = deadline - Date.now(); if (remaining <= 0) abort(new Error("Task deadline exceeded")); else timer = setTimeout(schedule, Math.min(remaining, 2_147_483_647)); };
          schedule();
        }
        let running: T | Promise<T>;
        try { if (taskScope.signal.aborted) throw cancelled(taskScope.signal.reason); running = run({ signal: taskScope.signal, scope: taskScope }); }
        catch (error) { running = Promise.reject(error); }
        void Promise.resolve(running).then(body.resolve, body.reject);
        void (async () => {
          let value!: T; const errors: unknown[] = [];
          try { value = await body.promise; } catch (error) { errors.push(error); }
          taskRecord.joins.delete(body.promise);
          const wasCancelled = taskScope.signal.aborted;
          const reason = taskScope.signal.reason;
          await attempt(errors, () => taskScope.revoke());
          if (wasCancelled && !errors.length) errors.push(cancelled(reason));
          if (timer !== undefined) clearTimeout(timer);
          taskOptions.signal?.removeEventListener("abort", externalAbort);
          taskScope.signal.removeEventListener("abort", cancelling);
          record.tasks.delete(taskId); changed();
          failures(errors, "Task failed or cancelled"); return value;
        })().then(result.resolve, result.reject);
        let cancellation: Promise<void> | undefined;
        const task: RuntimeTask<T> = { id: taskId, signal: taskScope.signal, result: result.promise,
          cancel(reason) {
            if (cancellation) return cancellation;
            const done = deferred<void>(); cancellation = done.promise;
            const cleanup = taskScope.revoke(reason);
            void cleanup.then(async () => { try { await result.promise; } catch { /* Body failure is reported by result. */ } }).then(() => done.resolve(), done.reject);
            return cancellation;
          },
          [Symbol.asyncDispose]: () => task.cancel(),
        };
        return task;
      },
      revoke(reason) {
        if (record.closing) return record.closing;
        const done = deferred<void>(); record.closing = done.promise;
        // Cache the completion before abort dispatch, allowing reentrant lifecycle calls.
        record.controller.abort(reason);
        const children = [...record.children].reverse().map(child => child.api.revoke(reason));
        for (const entry of record.entries) entry.cancel(reason);
        changed();
        void (async () => {
          const errors: unknown[] = [];
          for (const child of children) await attempt(errors, () => child);
          // Body failures are reported by task.result; owned cleanup failures still propagate.
          await Promise.allSettled([...record.joins]);
          for (const entry of [...record.entries].reverse()) await attempt(errors, () => entry.close());
          scopes.delete(api); parent?.children.delete(record); changed();
          failures(errors, "Scope revocation failed");
        })().then(() => done.resolve(), done.reject);
        return record.closing;
      },
      [Symbol.asyncDispose]: () => api.revoke(),
    };
    record.api = api; scopes.set(api, record); parent?.children.add(record); changed(); return api;
  }
  const host: Host = {
    define, provide, scope, inspect,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async start<T>(capability: Capability<T>, provider: Provider<T>, options: ServiceOptions): Promise<RunningService<T>> {
      if (!validServiceId(options.serviceId)) throw new TypeError("Invalid service identity");
      const owner = scope({ name: options.name ?? options.serviceId, parent: options.owner });
      const serviceId = identity("service");
      const service: ServiceSnapshot = { id: serviceId, scopeId: owner.id, capabilityId: capability.id, version: capability.version, serviceId: options.serviceId, state: "starting" };
      let registration: ProviderRegistration | undefined;
      try {
        registration = provide(capability, provider, { ...options, lifetime: "shared" });
        const reg = registration;
        services.set(serviceId, service); changed();
        owner.signal.addEventListener("abort", () => { services.set(serviceId, { ...service, state: "stopping" }); changed(); }, { once: true });
        owner.defer(async () => { try { await reg.unregister(); } finally { services.delete(serviceId); changed(); } });
        const pin = await owner.acquire(capability, { serviceId: options.serviceId });
        if (pin.signal.aborted || owner.signal.aborted) throw new Error("Service startup cancelled");
        services.set(serviceId, { ...service, state: "running" }); changed();
        let stopping: Promise<void> | undefined;
        return Object.freeze({ serviceId: options.serviceId, get value() { return pin.value; }, signal: pin.signal,
          stop(reason?: unknown) {
            if (stopping) return stopping;
            const done = deferred<void>(); stopping = done.promise;
            const removal = reg.unregister(reason);
            void Promise.allSettled([removal, owner.revoke(reason)]).then(results => failures(results.filter(r => r.status === "rejected").map(r => (r as PromiseRejectedResult).reason), "Service stop failed")).then(() => done.resolve(), done.reject);
            return stopping;
          },
          [Symbol.asyncDispose]() { return this.stop(); },
        });
      } catch (error) {
        const errors: unknown[] = [error];
        await attempt(errors, () => registration?.unregister()); await attempt(errors, () => owner.revoke());
        failures(errors, "Service startup failed"); throw error;
      }
    },
    dispose(reason) {
      if (closing) return closing;
      const done = deferred<void>(); closing = done.promise; changed();
      // Registration startup is not owned by a consumer scope. Abort it before
      // joining scopes whose pending creations may be waiting on activation.
      for (const reg of observed) reg.controller.abort(reason);
      const roots = [...scopes.values()].filter(record => !record.parent).map(record => record.api.revoke(reason));
      void (async () => {
        const errors: unknown[] = [];
        for (const root of roots) await attempt(errors, () => root);
        for (const reg of [...observed].reverse()) await attempt(errors, () => reg.api.unregister(reason));
        definitions.clear(); disposed = true; changed(); failures(errors, "Host disposal failed");
      })().then(() => done.resolve(), done.reject);
      return closing;
    },
    [Symbol.asyncDispose]: () => host.dispose(),
  };
  return host;
}

