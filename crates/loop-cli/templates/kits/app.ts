import type { Host, Scope } from '@loop-kit/host';
import { h, type Surface } from '@loop-kit/ui';
import { status } from './status';
// The kit owns the host, scope and borrowed surface. No global runtime or grants.
export async function start({ scope, surface, signal }: { host: Host; scope: Scope; surface: Surface; signal: AbortSignal }) {
  const service = await scope.bind(status, 'main').acquire();
  let revision = 0;
  await surface.render({ revision, root: h('column', { key: 'root' }, h('text', { key: 'greeting', text: service.value.next() }), h('button', { key: 'next', text: 'Next', label: 'Next greeting' })) });
  const events = scope.task(async () => {
  while (!signal.aborted) {
    const event = await surface.nextEvent();
    if (!event || signal.aborted) return;
    await surface.render({ revision: ++revision, root: h('column', { key: 'root' }, h('text', { key: 'greeting', text: service.value.next() }), h('button', { key: 'next', text: 'Next', label: 'Next greeting' })) });
  }
  });
  void events.result.catch(error => { if (!signal.aborted) console.error(error); });
}
