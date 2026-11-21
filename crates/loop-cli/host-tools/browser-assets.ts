/** Validate, capture and reproduce the explicitly declared browser asset set. */
import { resolve } from 'node:path';

export interface PinnedBrowserAsset { readonly source: string; readonly path: string; readonly sha256: string; readonly bytes: Uint8Array }
const reserved = new Set(['index.html', 'app.js', 'component-worker.js', 'build-receipt.json']);
const maxAsset = 32 * 1024 * 1024, maxTotal = 64 * 1024 * 1024;

/** Independently validates kit data and captures bytes into evaluator currentness evidence. */
export async function pinBrowserAssets(
  options: unknown,
  root: string,
  localFile: (root: string, source: string) => Promise<string>,
  capture: (path: string) => Promise<Uint8Array>,
  sha: (bytes: Uint8Array) => string,
): Promise<PinnedBrowserAsset[]> {
  if (options === null || typeof options !== 'object' || Array.isArray(options) || Object.getPrototypeOf(options) !== Object.prototype) throw Object.assign(new Error('Malformed browser kit options'), { code: 'E_BROWSER_ASSET' });
  const descriptor = Object.getOwnPropertyDescriptor(options, 'assets');
  if (descriptor && !('value' in descriptor)) throw Object.assign(new Error('Browser asset option cannot be an accessor'), { code: 'E_BROWSER_ASSET' });
  const declarations = (options as Record<string, unknown>).assets;
  if (declarations === undefined) return [];
  if (!Array.isArray(declarations) || declarations.length > 16) throw Object.assign(new Error('Browser kit accepts at most 16 assets'), { code: 'E_BROWSER_ASSET' });
  const seenSource = new Set<string>(), seenPath = new Set<string>(); let total = 0;
  const result: PinnedBrowserAsset[] = [];
  for (const value of declarations) {
    const fail = (message: string): never => { throw Object.assign(new Error(message), { code: 'E_BROWSER_ASSET' }); };
    if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).length !== 3 || Object.keys(value).some(k => !['source', 'path', 'sha256'].includes(k)) || Object.keys(value).some(k => { const d = Object.getOwnPropertyDescriptor(value, k); return !d || !('value' in d); })) fail('Malformed browser asset declaration');
    const { source, path, sha256 } = value as Record<string, unknown>;
    if (typeof source !== 'string' || !source || source.startsWith('/') || source.includes('\\') || source.includes(':') || source.includes('\0') || /^[a-zA-Z]:/.test(source) || source.split('/').some(p => !p || p === '.' || p === '..')) fail('Browser asset source must be a project-relative local file');
    if (typeof path !== 'string' || path.length > 120 || !/^[a-z][a-z0-9.-]*$/.test(path) || reserved.has(path) || path.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(path)) fail('Invalid or reserved browser asset output path');
    if (seenSource.has(source as string) || seenPath.has(path as string)) fail('Duplicate browser asset source or output path');
    if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) fail('Browser asset requires lowercase SHA-256');
    const sourceName = source as string, outputName = path as string, digest = sha256 as string;
    seenSource.add(sourceName); seenPath.add(outputName);
    const local = await localFile(root, sourceName);
    const bytes = await capture(local);
    if (bytes.byteLength > maxAsset) fail(`Browser asset exceeds 32 MiB: ${sourceName}`);
    total += bytes.byteLength;
    if (total > maxTotal) fail('Browser assets exceed 64 MiB total');
    if (sha(bytes) !== digest) throw Object.assign(new Error(`Browser asset bytes differ from configured digest: ${sourceName}`), { code: 'E_STALE_INPUT' });
    result.push({ source: sourceName, path: outputName, sha256: digest, bytes });
  }
  return result;
}

/** Copy only pinned declarations and verify the bytes again immediately before output. */
export async function writePinnedBrowserAssets(assets: readonly PinnedBrowserAsset[], root: string, output: string, localFile: (root: string, source: string) => Promise<string>, capture: (path: string) => Promise<Uint8Array>, write: (path: string, bytes: Uint8Array) => Promise<unknown>, sha: (bytes: Uint8Array) => string): Promise<void> {
  for (const asset of assets) {
    const current = await capture(await localFile(root, asset.source));
    if (sha(current) !== asset.sha256 || sha(asset.bytes) !== asset.sha256) throw Object.assign(new Error(`Browser asset changed after evaluation: ${asset.source}`), { code: 'E_STALE_INPUT' });
    await write(resolve(output, asset.path), asset.bytes);
  }
}
