/** Trusted in-process TS composition without a renderer or guest isolation. */
import { createHost } from '../runtime.js';
import { canonicalHostJson, hostPlanData } from './resolve.js';
import type { HostKit, Json, ResolvedHostPlan } from './contracts.js';
import type { Host, Scope } from '../contracts.js';

/** Trusted application receives launch-owned objects; it must not dispose the host. */
export interface HeadlessApplicationContext { readonly host: Host; readonly scope: Scope; readonly signal: AbortSignal }
/** Contribution setup owns its child scope; registrations are checked against its declaration. */
export interface HeadlessPluginContext extends HeadlessApplicationContext { readonly options: Json; readonly ports: Readonly<Record<string, never>> }
export type HeadlessStart = (context: HeadlessApplicationContext) => void | Promise<void>;
export type HeadlessSetup = (context: HeadlessPluginContext) => void | Promise<void>;

/** Create a versioned, renderer-free kit use. No code is started and no authority is granted. */
export function headless(options: { readonly options?: Json } = {}): HostKit<'headless'> {
  const data = hostPlanData(options) as { readonly options?: Json };
  if (!data || Array.isArray(data) || typeof data !== 'object' || Object.keys(data).some(k => k !== 'options')) throw new TypeError('Unknown headless kit options');
  const profile = { id: 'loop:profile/headless-ts', version: '0.1.0' };
  return { apiVersion: 1, identity: { id: 'loop:kit/headless', version: '0.1.0' }, kind: 'headless', profile, options: data.options ?? {}, hosts: [{ key: 'application', realm: 'application', profile }], coordinator: { specifier: '@loop-kit/host', export: 'bootstrapHeadless' }, plugins: [] };
}

/** A fresh host and root scope per invocation. Modules are trusted same-user code;
 * abort is cooperative. Startup failure disposes partial registrations and scopes. */
export async function bootstrapHeadless({ plan, modules, signal }: { readonly plan: ResolvedHostPlan; readonly modules: Readonly<Record<string, any>>; readonly signal: AbortSignal }): Promise<{ dispose(): Promise<void> }> {
  if (plan.kind !== 'headless' || plan.kit.id !== 'loop:kit/headless' || plan.kit.version !== '0.1.0' || plan.profile.id !== 'loop:profile/headless-ts' || plan.profile.version !== '0.1.0' || plan.hosts.length !== 1 || plan.hosts[0]?.key !== 'application' || plan.hosts[0]?.realm !== 'application' || plan.hosts[0]?.profile.id !== plan.profile.id || plan.hosts[0]?.profile.version !== plan.profile.version) throw Object.assign(new Error('Unsupported headless kit/profile'), { code: 'E_HEADLESS_PROFILE' });
  const cancelled = () => { if (signal.aborted) throw Object.assign(new Error('Headless startup cancelled'), { code: 'E_CANCELLED' }); };
  cancelled();
  const host = createHost(), scope = host.scope();
  let disposal: Promise<void> | undefined;
  const dispose = () => { signal.removeEventListener('abort', onAbort); return disposal ??= host.dispose('headless stop'); };
  const onAbort = () => { void dispose().catch(() => {}); };
  signal.addEventListener('abort', onAbort, { once: true });
  if (signal.aborted) onAbort();
  try {
    for (const plugin of plan.plugins) for (const contribution of plugin.contributions) {
      cancelled();
      if (contribution.host !== 'application' || contribution.provides.some(r => r.kind !== 'provider')) throw Object.assign(new Error('Headless runtime supports application providers only'), { code: 'E_HEADLESS_REGISTRATION' });
      const setup = modules[contribution.entry.specifier]?.[contribution.entry.export];
      if (typeof setup !== 'function') throw Object.assign(new Error(contribution.entry.export), { code: 'E_MODULE_EXPORT' });
      const before = host.inspect().providers;
      await setup({ host, scope: scope.scope({ name: contribution.key }), signal, options: contribution.options, ports: {} });
      cancelled();
      const after = host.inspect().providers;
      if (before.some(b => !after.some(r => b.registrationId === r.registrationId))) throw Object.assign(new Error('Contribution removed a prior registration'), { code: 'E_REGISTRATION_RECEIPT' });
      const expected = contribution.provides.map(r => canonicalHostJson({ id: r.id, version: r.version, serviceId: r.kind === 'provider' ? r.serviceId ?? null : null })).sort();
      const actual = after.filter(r => !before.some(b => b.registrationId === r.registrationId)).map(r => canonicalHostJson({ id: r.capabilityId, version: r.version, serviceId: r.serviceId ?? null })).sort();
      if (canonicalHostJson(expected) !== canonicalHostJson(actual)) throw Object.assign(new Error(contribution.key), { code: 'E_REGISTRATION_RECEIPT' });
    }
    cancelled(); const start = modules[plan.application.specifier]?.[plan.application.export];
    if (typeof start !== 'function') throw Object.assign(new Error(plan.application.export), { code: 'E_MODULE_EXPORT' });
    await start({ host, scope, signal }); cancelled();
    return { dispose };
  } catch (primary) {
    try { await dispose(); } catch (cleanup) { throw Object.assign(new AggregateError([primary, cleanup], 'Headless startup and cleanup failed'), { code: 'E_HEADLESS_CLEANUP' }); }
    throw primary;
  }
}
