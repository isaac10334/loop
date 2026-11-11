/** Runtime-only coordinator export: no Bun, config callbacks or private imports. */
import { bootstrapBrowser, type BrowserBootstrapOptions } from '@loop-kit/host-browser';

export function startCounterBrowser(context: BrowserBootstrapOptions) {
  const { kit, kind, profile } = context.plan;
  if (kit.id !== 'example:kit/counter-browser' || kit.version !== '1.0.0'
      || kind !== 'browser' || profile.id !== 'loop:profile/browser-ts' || profile.version !== '0.1.0') {
    throw new TypeError('Counter kit requires its exact identity and browser-ts profile');
  }
  return bootstrapBrowser(context);
}
