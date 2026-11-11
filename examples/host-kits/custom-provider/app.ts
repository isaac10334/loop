/** Application state and semantic input; the kit owns the borrowed surface. */
import type { BrowserApplicationContext } from '@loop-kit/host-browser';
import { h } from '@loop-kit/ui';
import { counter, counterService } from './counter.ts';

export async function start({ scope, surface, signal }: BrowserApplicationContext) {
  const lease = await scope.bind(counter, counterService).acquire();
  let revision = 0, sequence = 0, draft = '1', message = 'Ready';
  const step = () => /^[1-9]\d{0,2}$/.test(draft) && Number(draft) <= 100 ? Number(draft) : undefined;
  const render = () => surface.render({ revision, root: h('column', { key: 'counter-app' }, [
    h('text', { key: 'heading', text: 'Browser counter' }),
    h('metric', { key: 'count', label: 'Counter value', text: `Count: ${lease.value.read()}` }),
    h('text', { key: 'step-help', text: 'Increment amount (1 to 100)' }),
    h('input', { key: 'step', label: 'Increment amount (1 to 100)', value: draft }),
    h('button', { key: 'increment', label: 'Increment counter', text: 'Increment', disabled: step() === undefined }),
    h('text', { key: 'status', text: message }),
  ]) });
  await render();
  const task = scope.task(async () => {
    while (!signal.aborted) {
      const event = await surface.nextEvent();
      if (!event || signal.aborted) return;
      if (event.revision !== revision || event.sequence <= sequence) continue;
      sequence = event.sequence;
      if (event.key === 'step' && event.type === 'change' && typeof event.value === 'string') {
        draft = event.value.slice(0, 32);
        message = step() === undefined ? 'Enter a whole number from 1 to 100.' : 'Ready';
      } else if (event.key === 'increment' && event.type === 'activate') {
        const amount = step();
        if (amount === undefined) continue;
        // This trusted local app permits this one operation; identity is not a grant.
        try { lease.value.increment(amount); message = `Added ${amount}`; }
        catch (error) { if (!(error instanceof RangeError)) throw error; message = error.message; }
      } else continue;
      revision++;
      await render();
    }
  }, { name: 'Counter semantic actions' });
  // Startup returns after the first frame. The kit closes reads before joining tasks.
  void task.result.catch(error => { if (!signal.aborted) console.error('Counter action failed', error); });
}
