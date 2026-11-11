/** Verify an extracted CLI crate against registry dependencies, never workspace path patches. */
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { validateCratePaths, validateRegistryLock, type LockPackage } from './registry-crate-validation';

let phase = 'arguments', stage: string | null = null, archive: string | null = null;
try {
const [archiveArg, targetArg] = process.argv.slice(2);
if (!archiveArg) throw new Error('Usage: bun tooling/host-kit-verification/registry-crate.ts <cli.crate> [cargo-target-directory]');
archive = resolve(archiveArg); phase = 'stage'; stage = await mkdtemp(join(tmpdir(), 'loop-registry-crate-'));
phase = 'read-archive'; const bytes = await Bun.file(archive).bytes();
phase = 'decode-archive'; const entries = await new Bun.Archive(bytes).files();
phase = 'validate-paths';
const root = validateCratePaths([...entries.keys()]);
phase = 'extract';
for (const [path, file] of entries) {
  const pieces = path.split('/');
  const destination = join(stage, ...pieces);
  await mkdir(join(stage, ...pieces.slice(0,-1)), { recursive: true });
  await writeFile(destination, new Uint8Array(await file.arrayBuffer()));
}
const project = join(stage, root), manifest = join(project, 'Cargo.toml');
const env: Record<string,string|undefined> = { ...process.env, CARGO_NET_OFFLINE: 'true' };
if (targetArg) env.CARGO_TARGET_DIR = resolve(targetArg);
async function cargo(args: string[]) {
  const child = Bun.spawn(['cargo', ...args], { cwd: project, env, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { code, stdout, stderr };
}
phase = 'generate-lockfile'; const generate = await cargo(['generate-lockfile', '--offline', '--manifest-path', manifest]);
let check: Awaited<ReturnType<typeof cargo>> | null = null, lockError: string | null = null;
let registryHost: {version: string; source: string; checksum: string} | null = null, packageCount = 0;
if (generate.code === 0) {
  phase = 'validate-lock'; const lock = Bun.TOML.parse(await readFile(join(project, 'Cargo.lock'), 'utf8')) as {package?: LockPackage[]};
  const packages = lock.package ?? []; packageCount = packages.length;
  try { registryHost = validateRegistryLock(packages); }
  catch (error) { lockError = String(error); }
  if (!lockError) { phase = 'cargo-check'; check = await cargo(['check', '--offline', '--locked', '--manifest-path', manifest, '-j', '2']); }
}
const passed = generate.code === 0 && !lockError && check?.code === 0;
const receipt = {gate:'registry-only-extracted-cli-compile', archive, archiveSha256:new Bun.CryptoHasher('sha256').update(bytes).digest('hex'), stage, offline:true, packageCount, registryHost, lockError, generate, check, passed, limits:['Trusted local archives only: decompression is not resource-bounded','Uses ambient Cargo configuration and compiler; source replacement or a reused target can affect provenance','Checks Cargo default targets and features only; rejects lockfile path/git dependencies','No package was published; this does not test installed UI or browser conformance']};
phase = 'write-receipt'; await writeFile(join(stage, 'receipt.json'), JSON.stringify(receipt,null,2));
console.log(JSON.stringify({ ...receipt, generate:{code:generate.code,stderr:generate.stderr}, check:check&&{code:check.code,stderr:check.stderr} },null,2));
if (!passed) process.exitCode = 1;
} catch (error) {
  const failure = { gate:'registry-only-extracted-cli-compile', archive, stage, phase, passed:false, error:String(error) };
  if (stage) { try { await writeFile(join(stage,'receipt.json'),JSON.stringify(failure,null,2)); } catch { /* stdout still reports the original failure */ } }
  console.log(JSON.stringify(failure,null,2));
  process.exitCode = 1;
}
