/** Injected WebGPU lifetime; importing this module never reads browser globals. */

/** Minimal resources needed for deterministic cleanup. */
export interface GpuBufferResource { destroy(): void }
export interface GpuDeviceResource {
  destroy(): void;
  readonly lost: PromiseLike<{ readonly message?: string }>;
}
export interface GpuCanvasResource { unconfigure(): void }
export interface GpuAdapterResource<D extends GpuDeviceResource> { requestDevice(): PromiseLike<D> }
export interface GpuPlatform<A> { requestAdapter(): PromiseLike<A | null> }

/** One independently owned device and its buffers/canvas configuration. Extracted values
 * are not revoked; callers must check active after their own asynchronous work. */
export interface GpuSession<A, D extends GpuDeviceResource> {
  readonly adapter: A;
  readonly device: D;
  readonly active: boolean;
  assertActive(): void;
  /** Adopt a newly created buffer exactly once; a closed session destroys it immediately. */
  trackBuffer<B extends GpuBufferResource>(buffer: B): B;
  /** Register before configure, so even a throwing configure is unwound. Exclusive context ownership is required. */
  configure(context: GpuCanvasResource, configure: () => void): void;
  /** Idempotent synchronous cleanup; attempts all resources even when one throws. */
  dispose(): void;
}

/** Acquire an owned device from an injected platform. Cancellation rejects promptly;
 * a device arriving after cancellation is destroyed. Device loss disposes the session.
 * Pending platform promises cannot be forcibly terminated. */
export async function createGpuSession<D extends GpuDeviceResource, A extends GpuAdapterResource<D>>(
  options: { readonly gpu?: GpuPlatform<A> | null; readonly signal?: AbortSignal; readonly onLost?: (info: { readonly message?: string }) => void }
): Promise<GpuSession<A, D>> {
  const { gpu, signal } = options;
  if (!gpu) throw new Error("WebGPU unavailable");
  const cancelled = () => signal?.reason ?? new Error("WebGPU session cancelled");
  if (signal?.aborted) throw cancelled();
  let closed = false, device: D | undefined, context: GpuCanvasResource | undefined;
  const buffers = new Set<GpuBufferResource>();
  const dispose = () => {
    if (closed) return;
    closed = true;
    signal?.removeEventListener("abort", abort);
    const errors: unknown[] = [];
    for (const buffer of buffers) try { buffer.destroy(); } catch (error) { errors.push(error); }
    buffers.clear();
    try { context?.unconfigure(); } catch (error) { errors.push(error); }
    try { device?.destroy(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(errors, "WebGPU cleanup failed");
  };
  const abort = () => { try { dispose(); } catch { /* abort dispatch cannot report cleanup errors */ } };
  signal?.addEventListener("abort", abort, { once: true });
  const assertActive = () => { if (closed || signal?.aborted) throw cancelled(); };
  // Race acquisition without abandoning the late device: its continuation destroys it.
  const wait = <T>(promise: PromiseLike<T>): Promise<T> => new Promise((resolve, reject) => {
    const onAbort = () => reject(cancelled());
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
    Promise.resolve(promise).then(value => { signal?.removeEventListener("abort", onAbort); resolve(value); }, error => { signal?.removeEventListener("abort", onAbort); reject(error); });
  });
  try {
    const adapter = await wait(gpu.requestAdapter());
    assertActive();
    if (!adapter) throw new Error("No WebGPU adapter");
    const pending = Promise.resolve(adapter.requestDevice()).then(value => {
      if (closed || signal?.aborted) { value.destroy(); throw cancelled(); }
      device = value;
      return value;
    });
    const acquired = await wait(pending);
    assertActive();
    const session: GpuSession<A, D> = {
      adapter, device: acquired,
      get active() { return !closed; }, assertActive,
      trackBuffer(buffer) { if (closed) { buffer.destroy(); throw cancelled(); } buffers.add(buffer); return buffer; },
      configure(value, configure) { assertActive(); if (context) throw new Error("WebGPU canvas already configured"); context = value; configure(); assertActive(); },
      dispose,
    };
    Promise.resolve(acquired.lost).then(info => {
      if (!closed) { try { dispose(); } finally { options.onLost?.(info); } }
    }).catch(() => {});
    return session;
  } catch (error) {
    try { dispose(); } catch (cleanup) { throw new AggregateError([error, cleanup], "WebGPU acquisition and cleanup failed"); }
    throw error;
  }
}
