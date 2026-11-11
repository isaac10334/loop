import type { Host, Scope } from '@loop-kit/host';
import { status } from './status';
export async function setup({ host, scope, options }: { host: Host; scope: Scope; options: { greeting: string } }) {
  const registration = host.provide(status, { create() { let count = 0; return { next: () => `${options.greeting}: ${++count}` }; } }, { serviceId: 'main', lifetime: 'shared' });
  scope.defer(() => registration.unregister());
  await registration.activate();
}
