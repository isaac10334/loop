import { defineCapability } from '@loop-kit/capabilities';
import { defineHostPlugin } from '@loop-kit/host';
export const status = defineCapability<{ next(): string }>({ id: 'example:hello/status', version: '1' });
export const statusPlugin = () => defineHostPlugin({
  apiVersion: 1, identity: { id: 'example:provider/status', version: '1.0.0' },
  key: 'status', targets: ['browser', 'desktop'],
  runtime: [{ key: 'provider', host: 'application', requires: [],
    provides: [{ kind: 'provider', host: 'application', id: status.id, version: status.version, serviceId: 'main' }],
    entry: { specifier: './src/status-provider.ts', export: 'setup' }, options: { greeting: 'Hello from Loop' } }],
});
