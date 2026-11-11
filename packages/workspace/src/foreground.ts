/** Foreground edit/build/replace ownership through trusted injected execution ports.
 * No filesystem, daemon, task engine or authorization policy is installed here. */
import { verifySourceSnapshot, type BuildProvider, type BuildReceipt, type BuildRequest, type SourceSnapshot } from "./source.js";

/** Register partial initialization cleanup immediately after acquisition. Cleanup
 * runs once in reverse registration order, continuing after faults. */
export interface ForegroundResources {
  defer(cleanup: () => void | Promise<void>): void;
}

/** Immutable identity passed to a staged, read-only candidate. */
export interface ForegroundCandidateContext {
  readonly generation: number;
  readonly revision: number;
  readonly source: SourceSnapshot;
  readonly request: BuildRequest;
  readonly receipt: BuildReceipt;
  readonly signal: AbortSignal;
  readonly effects: "read-only";
}

/** Trusted execution adapter, not a sandbox. prepare must verify artifact bytes
 * against the receipt and register partial resources before awaiting more work.
 * prepare/health must not grant shared writes. quiesce drains and revokes writes;
 * on rejection it must leave the old generation writable. resume restores a
 * successfully quiesced generation, or rejects visibly (no rollback is claimed).
 * promote is synchronous: atomically grant the candidate writes, or throw without
 * granting any. It must not call back into this owner. No migration is implicit.
 * dispose must revoke grants even when other cleanup fails. */
export interface ForegroundPorts<Candidate> {
  prepare(context: ForegroundCandidateContext, resources: ForegroundResources): Promise<Candidate>;
  health(candidate: Candidate, signal: AbortSignal): Promise<void>;
  quiesce(candidate: Candidate): void | Promise<void>;
  resume(candidate: Candidate): void | Promise<void>;
  promote(candidate: Candidate): void;
  dispose(candidate: Candidate): void | Promise<void>;
}

/** A selected identity, not a live execution handle or grant. */
export interface ForegroundGeneration {
  readonly generation: number;
  readonly revision: number;
  readonly source: SourceSnapshot;
  readonly receipt: BuildReceipt;
}

/** Cleanup faults do not turn a committed promotion into a cancellation/failure. */
export interface ForegroundBuildResult {
  readonly status: "activated" | "failed" | "cancelled" | "superseded";
  readonly generation: number;
  readonly error?: unknown;
  readonly cleanupErrors: readonly unknown[];
}

/** Editor/draft are sibling state: replacement and failed builds never dispose or
 * mutate editor. Only edit advances draft revision, even for identical sources. */
export interface ForegroundDevelopment<Editor> {
  inspect(): { readonly editor: Editor; readonly draft: SourceSnapshot; readonly revision: number; readonly active: ForegroundGeneration | undefined; readonly disposed: boolean };
  edit(source: SourceSnapshot): number;
  /** Newer builds supersede older requests, even at the same revision. Signals
   * are cooperative; late values are owned and disposed, never promoted. */
  build(request: BuildRequest, options?: { readonly signal?: AbortSignal }): Promise<ForegroundBuildResult>;
  /** Closes admission/aborts synchronously, then joins builds and cleanup. Repeats
   * return the same completion. Uncooperative adapters can prevent completion.
   * Editor state remains caller-owned. Rejects AggregateError on cleanup faults. */
  dispose(): Promise<void>;
}

/** Construct one independent foreground owner. Last working execution remains
 * writable throughout compilation/health. Selection is serialized: old writes are
 * quiesced before new grants. Cancellation before promotion forbids promotion;
 * cancellation after promotion cannot undo committed external effects. Plain JS
 * handles are not intercepted: adapters must enforce these grant contracts. */
export function createForegroundDevelopment<Editor, Candidate>(options: {
  readonly editor: Editor;
  readonly source: SourceSnapshot;
  readonly buildProvider: BuildProvider;
  readonly ports: ForegroundPorts<Candidate>;
}): ForegroundDevelopment<Editor> {
  const { editor, buildProvider, ports } = options;
  let draft = options.source, revision = 0, sequence = 0, latest = 0, closed = false;
  type Owned = { candidate: Candidate; identity: ForegroundGeneration; abort: () => void; cleanup: () => Promise<unknown[]> };
  let active: Owned | undefined;
  let gate: Promise<unknown> = Promise.resolve();
  let disposal: Promise<void> | undefined;
  const controllers = new Set<AbortController>();
  const pending = new Set<Promise<ForegroundBuildResult>>();
  const disposalErrors: unknown[] = [];
  function serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = gate.then(work);
    gate = result.catch(() => {});
    return result;
  }
  function invalidate() {
    for (const controller of controllers) controller.abort();
  }
  return {
    inspect: () => Object.freeze({ editor, draft, revision, active: active?.identity, disposed: closed }),
    edit(source) {
      if (closed) throw new Error("Foreground owner is disposed");
      draft = source; revision++; latest = ++sequence; invalidate();
      return revision;
    },
    build(input, buildOptions = {}) {
      if (closed) return Promise.reject(new Error("Foreground owner is disposed"));
      invalidate();
      const generation = ++sequence;
      latest = generation;
      const source = draft, buildRevision = revision;
      const request = Object.freeze({ ...input });
      const controller = new AbortController();
      controllers.add(controller);
      const signal = buildOptions.signal;
      const abort = () => controller.abort(signal?.reason);
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      const stale = (): "superseded" | "cancelled" | undefined =>
        closed || signal?.aborted ? "cancelled" : latest !== generation ? "superseded" : undefined;
      const cleanups: Array<() => void | Promise<void>> = [];
      let cleanupStarted = false;
      const resources: ForegroundResources = { defer(cleanup) {
        if (cleanupStarted) throw new Error("Candidate cleanup already started");
        cleanups.push(cleanup);
      } };
      const cleanup = async (): Promise<unknown[]> => {
        cleanupStarted = true;
        controller.abort();
        const errors: unknown[] = [];
        while (cleanups.length) {
          try { await cleanups.pop()!(); } catch (error) { errors.push(error); }
        }
        if (closed) disposalErrors.push(...errors);
        return errors;
      };
      const run = async (): Promise<ForegroundBuildResult> => {
        let committed = false;
        const cleanupErrors: unknown[] = [];
        try {
          if (stale()) return { status: stale()!, generation, cleanupErrors };
          const verified = await verifySourceSnapshot(source);
          if (request.source !== verified.digest) throw new Error("Build request source mismatch");
          if (stale()) return { status: stale()!, generation, cleanupErrors };
          const rawReceipt = await buildProvider.build(request, verified, controller.signal);
          // Capture provider-owned mutable records before exposing them to candidates.
          const receipt: BuildReceipt = Object.freeze({ ...rawReceipt, outputs: Object.freeze({ ...rawReceipt.outputs }) });
          if (receipt.source !== request.source || receipt.recipe !== request.recipe || receipt.targetProfile !== request.targetProfile
            || !receipt.toolchain || !Object.keys(receipt.outputs).length
            || Object.values(receipt.outputs).some(value => !/^sha256:[a-f0-9]{64}$/.test(value))) throw new Error("Build receipt mismatch");
          if (stale()) return { status: stale()!, generation, cleanupErrors };
          const candidate = await ports.prepare(Object.freeze({ generation, revision: buildRevision, source: verified, request, receipt, signal: controller.signal, effects: "read-only" }), resources);
          cleanups.push(() => ports.dispose(candidate));
          if (!stale()) await ports.health(candidate, controller.signal);
          const identity = Object.freeze({ generation, revision: buildRevision, source: verified, receipt });
          await serialize(async () => {
            if (stale()) return;
            const previous = active;
            if (previous) await ports.quiesce(previous.candidate);
            if (stale()) {
              if (previous && !closed) await ports.resume(previous.candidate);
              return;
            }
            try {
              ports.promote(candidate);
            } catch (error) {
              if (previous) {
                try { await ports.resume(previous.candidate); }
                catch (resumeError) { throw new AggregateError([error, resumeError], "Promotion and restoration failed"); }
              }
              throw error;
            }
            active = { candidate, identity, abort: () => controller.abort(), cleanup };
            committed = true;
            // A committed generation has its own lifetime until replacement or
            // owner disposal, not the lifetime of the caller's build request.
            controllers.delete(controller);
            signal?.removeEventListener("abort", abort);
            if (previous) cleanupErrors.push(...await previous.cleanup());
          });
          if (!committed) cleanupErrors.push(...await cleanup());
          return { status: committed ? "activated" : stale() ?? "failed", generation, cleanupErrors };
        } catch (error) {
          if (!committed) cleanupErrors.push(...await cleanup());
          return { status: committed ? "activated" : stale() ?? "failed", generation, error, cleanupErrors };
        } finally {
          controllers.delete(controller);
          signal?.removeEventListener("abort", abort);
        }
      };
      const result = run();
      pending.add(result);
      void result.then(() => pending.delete(result));
      return result;
    },
    dispose() {
      if (disposal) return disposal;
      closed = true; invalidate(); active?.abort();
      disposal = (async () => {
        await serialize(async () => {
          const previous = active;
          active = undefined;
          if (previous) await previous.cleanup();
        });
        await Promise.all([...pending]);
        if (disposalErrors.length) throw new AggregateError(disposalErrors, "Foreground disposal failed");
      })();
      return disposal;
    },
  };
}
