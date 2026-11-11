import { expect, test } from 'bun:test';
import { createHost } from '@loop-kit/host';
import { RecordingSurface } from '@loop-kit/ui';
import { start } from './app.ts';
import { setup } from './counter-provider.ts';
import { counter, counterService } from './counter.ts';

async function fixture(initial = 0) {
  const host = createHost(), scope = host.scope(), surface = new RecordingSurface();
  const abort = new AbortController();
  abort.signal.addEventListener('abort', () => surface.dispose(), { once: true });
  setup({ host, scope, signal: abort.signal, options: { initial } });
  return { host, scope, surface, abort, async dispose() { abort.abort(); await host.dispose(); } };
}
const node = (surface: RecordingSurface, key: string) => surface.frame!.root.children!.find(n => n.key === key)!;
async function rendered(surface: RecordingSurface, revision: number) {
  for (let i = 0; i < 20 && surface.frame?.revision !== revision; i++) await Promise.resolve();
  expect(surface.frame!.revision).toBe(revision);
}

test('semantic input changes bounded state, invalid input cannot invoke, stop joins pending read', async () => {
  const f = await fixture();
  try {
    await start({ ...f, signal: f.abort.signal });
    expect(node(f.surface, 'count').text).toBe('Count: 0');
    f.surface.event({ revision: 0, sequence: 1, key: 'step', type: 'change', value: '5' });
    await rendered(f.surface, 1);
    f.surface.event({ revision: 1, sequence: 2, key: 'increment', type: 'activate' });
    await rendered(f.surface, 2);
    expect(node(f.surface, 'count').text).toBe('Count: 5');
    f.surface.event({ revision: 2, sequence: 3, key: 'step', type: 'change', value: '0' });
    await rendered(f.surface, 3);
    expect(node(f.surface, 'increment').disabled).toBe(true);
    expect(() => f.surface.event({ revision: 3, sequence: 4, key: 'increment', type: 'activate' })).toThrow();
    expect(() => f.surface.event({ revision: 1, sequence: 5, key: 'step', type: 'change', value: '2' })).toThrow();
    expect(node(f.surface, 'count').text).toBe('Count: 5');
    await f.dispose();
    await f.dispose();
    expect(() => f.surface.event({ revision: 3, sequence: 6, key: 'step', type: 'change', value: '2' })).toThrow();
  } finally { await f.dispose(); }
});

test('provider validates direct calls, overflow, independent launch and extracted service after disposal', async () => {
  const a = await fixture(Number.MAX_SAFE_INTEGER - 1), b = await fixture();
  try {
    const raw = (await a.scope.bind(counter, counterService).acquire()).value;
    const other = (await b.scope.bind(counter, counterService).acquire()).value;
    for (const invalid of [0, -1, 1.5, 101, NaN]) expect(() => raw.increment(invalid)).toThrow(RangeError);
    expect(() => raw.increment(2)).toThrow('Counter exhausted');
    expect(raw.increment()).toBe(Number.MAX_SAFE_INTEGER);
    expect(other.read()).toBe(0);
    await a.dispose();
    expect(() => raw.read()).toThrow('Counter disposed');
    expect(other.increment()).toBe(1);
  } finally { await a.dispose(); await b.dispose(); }
});
