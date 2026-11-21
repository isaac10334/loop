import { test, expect } from 'bun:test';
import { pinBrowserAssets, writePinnedBrowserAssets } from '../crates/loop-cli/host-tools/browser-assets';
const sha = (bytes: Uint8Array) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
const bytes = new TextEncoder().encode('pinned guest payload');
const hash = sha(bytes);
const localFile = async (root: string, source: string) => {
  if (source.startsWith('/') || source.split('/').some(part => part === '..' || !part)) throw Object.assign(new Error('outside root'), { code: 'E_CONFIG_ROOT' });
  return `${root}/${source}`;
};
const captureFor = (current: Uint8Array) => async (_path: string) => new Uint8Array(current);
const declared = (overrides: Record<string, unknown> = {}) => ({ source: 'assets/guest.wasm', path: 'guest.wasm', sha256: hash, ...overrides });

test('CLI independently rejects malformed asset declarations and roots', async () => {
  await expect(pinBrowserAssets(null, '/project', localFile, captureFor(bytes), sha)).rejects.toMatchObject({ code: 'E_BROWSER_ASSET' });
  for (const value of [
    declared({ source: '../guest.wasm' }), declared({ path: 'app.js' }), declared({ path:'con.wasm' }), declared({path:'asset.'}), declared({ sha256: 'F'.repeat(64) }),
  ]) {
    await expect(pinBrowserAssets({ assets: [value, ...(value === undefined ? [] : [])] }, '/project', localFile, captureFor(bytes), sha)).rejects.toBeDefined();
  }
  await expect(pinBrowserAssets({ assets: [declared(), declared({ source: 'assets/other.wasm' })] }, '/project', localFile, captureFor(bytes), sha)).rejects.toMatchObject({ code: 'E_BROWSER_ASSET' });
  await expect(pinBrowserAssets({ assets: Array.from({ length: 17 }, (_, i) => declared({ source: `asset/${i}`, path: `asset-${i}` })) }, '/project', localFile, captureFor(bytes), sha)).rejects.toMatchObject({ code: 'E_BROWSER_ASSET' });
});

test('asset bytes are digest checked, pinned for currentness, and copied byte-exactly', async () => {
  const pinned = await pinBrowserAssets({ assets: [declared()] }, '/project', localFile, captureFor(bytes), sha);
  const output = new Map<string, Uint8Array>();
  await writePinnedBrowserAssets(pinned, '/project', '/output', localFile, captureFor(bytes), async (path, content) => { output.set(path, content); }, sha);
  expect([...output.values()][0]).toEqual(bytes);
  await expect(pinBrowserAssets({ assets: [declared()] }, '/project', localFile, captureFor(new TextEncoder().encode('changed')), sha)).rejects.toMatchObject({ code: 'E_STALE_INPUT' });
  await expect(writePinnedBrowserAssets(pinned, '/project', '/output', localFile, captureFor(new TextEncoder().encode('changed')), async () => {}, sha)).rejects.toMatchObject({ code: 'E_STALE_INPUT' });
});
