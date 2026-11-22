/** Trusted service: initialize, register cleanup, then return to the supervisor. */
import type { HeadlessApplicationContext } from '@loop-kit/host';

export function start({ scope, signal }: HeadlessApplicationContext): void {
  signal.throwIfAborted();
  console.log('Headless application ready. Stop this owned instance with loop stop.');
  const timer = setInterval(() => console.log('Headless application running'), 5000);
  scope.defer(() => clearInterval(timer));
}
