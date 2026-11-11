/** Trusted config executes in Bun; these callbacks never enter the browser bundle. */
import { defineConfig, defineHostPlugin, type PluginContext } from '@loop-kit/host';
import { semanticDom } from '@loop-kit/renderer-dom';
import { counterBrowser } from './counter-kit.ts';
import { counter, counterService } from './counter.ts';

const log = (phase: string, context: PluginContext) => {
  context.log('info', `custom-provider:${phase} target=${context.targetId} instance=${context.instanceId} epoch=${context.epoch}`);
};
const provider = defineHostPlugin({
  apiVersion: 1,
  identity: { id: 'example:plugin/counter', version: '1.0.0' },
  key: 'counter',
  targets: ['browser'],
  runtime: [{
    key: 'service', host: 'application', requires: [],
    provides: [{ kind: 'provider', host: 'application', id: counter.id, version: counter.version, serviceId: counterService }],
    entry: { specifier: './counter-provider.ts', export: 'setup' },
    options: { initial: 0 },
  }],
  prepare(context) { log('prepare', context); },
  ready(context) { log('ready', context); },
  quiesce(context) { log('quiesce', context); },
});

export default defineConfig({
  schemaVersion: 1,
  source: { manifest: './loop.package.json' },
  targets: [{
    id: 'counter', kit: counterBrowser(),
    application: { specifier: './app.ts', export: 'start' },
    plugins: [provider, semanticDom({ key: 'dom', root: '#app' })],
  }],
});
