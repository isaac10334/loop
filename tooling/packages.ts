/** Public npm inventory and dependency-first ordering, derived from manifests. */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
export const root = resolve(import.meta.dir, '..');
export const packages = readdirSync(join(root, 'packages')).filter(directory => existsSync(join(root,'packages',directory,'package.json'))).map(directory => {
  const path = join(root, 'packages', directory);
  return { path, directory, ...JSON.parse(readFileSync(join(path, 'package.json'), 'utf8')) };
}).filter(pkg => !pkg.private && pkg.name.startsWith('@loop-kit/')) as {
  name: string; version: string; path: string; directory: string; dependencies?: Record<string,string>;
}[];
export function ordered() {
  const result: typeof packages = [], active = new Set<string>(), done = new Set<string>();
  function visit(name: string) {
    if (active.has(name)) throw new Error(`Package cycle: ${name}`);
    if (done.has(name)) return;
    const pkg = packages.find(item => item.name === name)!;
    active.add(name);
    for (const dependency of Object.keys(pkg.dependencies ?? {})) if (packages.some(item => item.name === dependency)) visit(dependency);
    active.delete(name); done.add(name); result.push(pkg);
  }
  for (const pkg of packages) visit(pkg.name);
  return result;
}
/** Runs in a fresh process; failed checks never advance a release. */
export async function run(args: string[], cwd = root) {
  const child = Bun.spawn(args, {cwd, stdout:'inherit', stderr:'inherit'});
  if (await child.exited) throw new Error(`Failed: ${args.join(' ')}`);
}
