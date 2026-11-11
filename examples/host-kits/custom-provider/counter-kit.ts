/** An independently identified kit reusing the public browser profile and runtime. */
import { defineHostKit } from '@loop-kit/host';
import { browser } from '@loop-kit/host-browser';

export function counterBrowser() {
  const base = browser({ profile: 'loop:profile/browser-ts@0.1.0' });
  return defineHostKit({
    ...base,
    identity: { id: 'example:kit/counter-browser', version: '1.0.0' },
    coordinator: { specifier: './counter-runtime.ts', export: 'startCounterBrowser' },
  });
}
