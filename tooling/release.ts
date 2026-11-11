/** Explicit npm release preparation. Never publishes; the reviewed workflow owns publication.
 * @example bun run release:prepare --base HEAD~1
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { packages, ordered, root, run } from './packages';
export function releaseRequirements(changed: string[], previous: Record<string,string> = {}) {
  const required = new Set(changed);
  let progress = true;
  while (progress) { progress = false; for (const pkg of packages) {
    if (!required.has(pkg.name) && Object.keys(pkg.dependencies ?? {}).some(name => required.has(name))) {
      required.add(pkg.name); progress = true;
    }
  }}
  return ordered().filter(pkg => required.has(pkg.name)).map(pkg => ({name:pkg.name, version:pkg.version,
    previousVersion:previous[pkg.name] ?? null,
    versionUpdateRequired:previous[pkg.name] === pkg.version,
    minimumSuggestedVersion:previous[pkg.name] === pkg.version ? pkg.version.replace(/^(\d+)\.(\d+)\.(\d+).*$/,(_,major,minor,patch)=>`${major}.${minor}.${Number(patch)+1}`) : pkg.version,
    reason:changed.includes(pkg.name) ? 'changed; review semantic version' : 'dependent; review range and rebuild'}));
}
export const registry = 'https://registry.npmjs.org';
/** npm dry runs validate every packed artifact, not just the selected publish subset.
 * They do not authenticate OIDC, reserve names or prove version availability. */
export function dryRunPublishArgs(file: string, tag: string) {
  return ['npm','publish',file,'--dry-run','--access','public','--tag',tag,'--registry',registry];
}
function git(...args: string[]) {
  const child = Bun.spawnSync(['git', ...args], {cwd:root, stdout:'pipe', stderr:'pipe'});
  if (child.exitCode) throw new Error(new TextDecoder().decode(child.stderr));
  return new TextDecoder().decode(child.stdout).trim();
}
if (import.meta.main) {
  const args = process.argv.slice(2), baseIndex = args.indexOf('--base'), base = baseIndex < 0 ? undefined : args[baseIndex+1];
  if (!(args.length === 0 || (args.length === 2 && args[0] === '--base' && base))) throw new Error('Usage: release:prepare [--base REF]');
  const revision = git('rev-parse','HEAD');
  const dirty = git('status','--porcelain').length > 0;
  const files = base ? [...git('diff','--name-only',base,'--').split(/\r?\n/),...git('ls-files','--others','--exclude-standard').split(/\r?\n/)] : ['package.json'];
  const global = files.some(file => /^(package.json|bun.lock|tsconfig.json|tooling\/|scripts\/|.github\/)/.test(file));
  const changed = packages.filter(pkg => global || files.some(file => file.startsWith(`packages/${pkg.directory}/`))).map(pkg=>pkg.name);
  const previous:Record<string,string>={};
  if(base)for(const pkg of packages) {
    // New packages need no version increment relative to a nonexistent manifest.
    const child=Bun.spawnSync(['git','show',`${base}:packages/${pkg.directory}/package.json`],{cwd:root,stdout:'pipe',stderr:'pipe'});
    if(!child.exitCode)previous[pkg.name]=JSON.parse(new TextDecoder().decode(child.stdout)).version;
  }
  await run(['bun','run','clean']);
  await run(['bun','run','build']);
  await run(['bun','run','typecheck']);
  await run(['bun','run','verify']);
  const output = join(root,'target/npm-pack'); await mkdir(output,{recursive:true});
  const artifacts = [];
  for (const pkg of ordered()) {
    const filename = `${pkg.name.replace('@','').replace('/','-')}-${pkg.version}.tgz`;
    const bytes = await Bun.file(join(output,filename)).bytes();
    const archive=await new Bun.Archive(bytes).files();
    const manifest=JSON.parse(await archive.get('package/package.json')!.text());
    artifacts.push({name:pkg.name,version:pkg.version,file:filename,sha256:createHash('sha256').update(bytes).digest('hex'),dependencies:manifest.dependencies as Record<string,string> ?? {}});
  }
  const prerelease = artifacts.some(pkg => pkg.version.includes('-'));
  if (prerelease && artifacts.some(pkg => !pkg.version.includes('-'))) throw new Error('Mixed stable/prerelease release train');
  const requirements=releaseRequirements(changed,previous);
  for(const pkg of artifacts)for(const [name,range] of Object.entries(pkg.dependencies)) {
    const dependency=artifacts.find(item=>item.name===name);
    if(dependency&&!Bun.semver.satisfies(dependency.version,range))throw new Error(`Dependency range must be updated: ${pkg.name} -> ${name}@${range}`);
  }
  const plan = {revision,dirty,base:base ?? null,registry,tag:prerelease?'canary':'latest',
    dryRunOrder:artifacts.map(item=>item.name),
    requirements,publishOrder:requirements.map(item=>item.name),readyToPublish:!dirty&&requirements.length>0&&!requirements.some(item=>item.versionUpdateRequired),
    artifacts,publication:'Explicit workflow dispatch only; review dry-run artifacts first'};
  await writeFile(join(output,'release-plan.json'),JSON.stringify(plan,null,2)+'\n');
  await writeFile(join(output,'SHA256SUMS'),artifacts.map(pkg=>`${pkg.sha256}  ${pkg.file}`).join('\n')+'\n');
  for (const pkg of artifacts) await run(dryRunPublishArgs(join(output,pkg.file),plan.tag));
  console.log(JSON.stringify(plan,null,2));
}
