/** Ordinary trusted TypeScript provider. Mutable state belongs to this launch. */
import type { Host, Scope, Json } from '@loop-kit/host';
import { counter, counterService } from './counter.ts';

export function setup(context: { host: Host; scope: Scope; signal: AbortSignal; options: Json }) {
  if (context.options === null || typeof context.options !== 'object' || Array.isArray(context.options)) {
    throw new TypeError('Counter options must be an object');
  }
  const initial = (context.options as { initial?: unknown }).initial;
  if (!Number.isSafeInteger(initial) || (initial as number) < 0) throw new TypeError('Expected nonnegative safe initial count');
  const registration = context.host.provide(counter, {
    create({ signal }) {
      let value = initial as number;
      const active = () => { if (signal.aborted) throw new Error('Counter disposed'); };
      return {
        read() { active(); return value; },
        increment(step = 1) {
          active();
          // Validate at the operation boundary, not just in the UI's disabled state.
          if (!Number.isSafeInteger(step) || step < 1 || step > 100) throw new RangeError('Step must be an integer from 1 to 100');
          if (value > Number.MAX_SAFE_INTEGER - step) throw new RangeError('Counter exhausted');
          return value += step;
        },
      };
    },
  }, { serviceId: counterService, lifetime: 'shared' });
  context.scope.own(registration);
}
