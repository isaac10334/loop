/** Official browser kit + explicit application-local capability provider. */
import { defineConfig, defineHostPlugin } from '@loop-kit/host';
import { browser } from '@loop-kit/host-browser';
import { semanticDom } from '@loop-kit/renderer-dom';
import { counter, counterService } from './counter.ts';

export default defineConfig({
  schemaVersion: 1,
  source: { manifest: './loop.package.json' },
  targets: [{
    id: 'counter',
    kit: browser({ profile: 'loop:profile/browser-ts@0.1.0' }),
    application: { specifier: './app.ts', export: 'start' },
    plugins: [defineHostPlugin({
      apiVersion: 1,
      identity: { id: 'example:plugin/counter', version: '1.0.0' },
      key: 'counter', targets: ['browser'],
      runtime: [{
        key: 'service', host: 'application', requires: [],
        provides: [{ kind: 'provider', host: 'application', id: counter.id, version: counter.version, serviceId: counterService }],
        entry: { specifier: './counter-provider.ts', export: 'setup' },
        options: { initial: 0 },
      }],
    }), semanticDom({ key: 'dom', root: '#app' })],
  }],
});
