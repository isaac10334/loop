/** Standalone timer-latency monitor. Application functions receive narrow ports, never a host. */
import { defineCapability } from "@loop-kit/capabilities";
import { createHost } from "@loop-kit/host";
import { RecordingSurface, type UiFrame } from "@loop-kit/ui";
export interface Clock { now(): number }
export interface Reading { readonly at: number; readonly latency: number; readonly source: string }
export interface Sampler { read(signal: AbortSignal): Promise<Reading> }
export interface Journal { append(reading: Reading): void; read(): readonly Reading[] }
export const clock = defineCapability<Clock>({ id: "loop:time/clock", version: "1.0.0" });
export const sampler = defineCapability<Sampler>({ id: "example:monitor/sampler", version: "1" });
export const journal = defineCapability<Journal>({ id: "example:monitor/journal", version: "1" });

function wait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}
/** Clock and delay are explicit factory dependencies. Each read measures actual timer overshoot. */
function createSampler(deps: { clock: Clock; interval: number }): Sampler {
  return { async read(signal) {
    const start = deps.clock.now(); await wait(deps.interval, signal);
    const at = deps.clock.now(); return { at, latency: Math.max(0, at - start - deps.interval), source: `timer-${deps.interval}ms` };
  } };
}
/** This application factory consumes capabilities; it has no registry, permissions or platform lookup. */
export function createMonitor(deps: { sampler: Sampler; journal: Journal; surface: RecordingSurface }) {
  let revision = 0;
  return { async collect(signal: AbortSignal, count: number) {
    for (let n = 0; n < count; n++) {
      const reading = await deps.sampler.read(signal); signal.throwIfAborted(); deps.journal.append(reading);
      const values = deps.journal.read();
      deps.surface.render({ revision: revision++, root: { key: "latency", type: "metric", label: "Mean timer latency",
        text: `${(values.reduce((sum, row) => sum + row.latency, 0) / values.length).toFixed(2)} ms (${values.length} samples)` } });
    }
  } };
}
/** Run a complete monitoring session, replace a provider, then cancel an active collection and close it. */
export async function runDemo() {
  await using host = createHost();
  const app = host.scope({ name: "Telemetry monitor" });
  const disposerOrder: string[] = [];
  app.defer(() => { disposerOrder.push("application"); });
  const resource = app.scope({ name: "Temporary output" });
  resource.own({ [Symbol.dispose]() { disposerOrder.push("temporary"); } });
  host.provide(clock, { create: () => ({ now: Date.now }) });
  const clockLease = await app.acquire(clock);
  let journalClosed = 0;
  const service = await host.start(journal, {
    create() {
      const rows: Reading[] = []; let closed = false;
      const assert = () => { if (closed) throw new Error("Journal closed"); };
      return { append(row: Reading) { assert(); rows.push(row); }, read() { assert(); return rows.slice(); }, [Symbol.dispose]() { closed = true; journalClosed++; } };
    },
  }, { serviceId: "session-journal", owner: app, name: "Shared report journal" });
  const reports = app.scope({ name: "Reports" }), worker = app.scope({ name: "Collector" });
  const journalLease = await worker.bind(journal, "session-journal").acquire();
  const reportLease = journalLease.retain(reports);
  const sharedJournal = service.value === journalLease.value && reportLease.value === journalLease.value;
  const surface = new RecordingSurface(); reports.own(surface, value => value.dispose());
  const startSampler = (interval: number) => host.provide(sampler, { create: () => createSampler({ clock: clockLease.value, interval }) }, { serviceId: "local-timer" });
  let registration = startSampler(10);
  const first = await worker.bind(sampler, "local-timer").acquire();
  const firstApp = createMonitor({ sampler: first.value, journal: journalLease.value, surface });
  await worker.task(({ signal }) => firstApp.collect(signal, 4), { name: "Collect 10ms timers", timeout: 2000 }).result;
  // A fresh surface is a new view/session; the shared journal survives its collector's scope.
  const firstFrame: UiFrame = surface.frame!;
  await registration.unregister();
  let replacementInvalidated = false; try { first.value; } catch { replacementInvalidated = true; }
  registration = startSampler(20);
  const replacement = await worker.acquire(sampler, { serviceId: "local-timer" });
  const replacementSurface = new RecordingSurface(); reports.own(replacementSurface, value => value.dispose());
  const nextApp = createMonitor({ sampler: replacement.value, journal: journalLease.value, surface: replacementSurface });
  await worker.task(({ signal }) => nextApp.collect(signal, 4), { name: "Collect 20ms timers", timeout: 2000 }).result;
  const pending = worker.task(({ signal }) => nextApp.collect(signal, 100), { name: "Cancellable collection" });
  await pending.cancel("session complete");
  let cancelled = false; try { await pending.result; } catch { cancelled = true; }
  const during = host.inspect();
  await worker.revoke();
  const readings = reportLease.value.read();
  const finalFrame = replacementSurface.frame!;
  const retainedJournalSurvives = readings.length === 8 && journalClosed === 0;
  await reports.revoke(); await service.stop(); await registration.unregister(); await app.revoke();
  const after = host.inspect();
  const result = { readings, firstFrame, finalFrame, sharedJournal, replacementInvalidated, retainedJournalSurvives,
    cancelled, journalClosed, disposerOrder, runningServicesObserved: during.services.length,
    remainingScopes: after.scopes.length, remainingServices: after.services.length };
  if (!sharedJournal || !replacementInvalidated || !retainedJournalSurvives || !cancelled || journalClosed !== 1 || after.scopes.length || after.services.length) throw new Error("Monitor lifecycle acceptance failed");
  return result;
}

