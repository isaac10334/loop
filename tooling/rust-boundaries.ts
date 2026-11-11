/** Checks every declared Cargo edge, including inactive targets/features. No Cargo execution or installs. */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

type Table = Record<string, any>;
export interface RustCrateRule {
  path: string;
  allows: readonly string[];
  /** Inward crates cannot reach these native packages, even through disabled features. */
  portable?: boolean;
  /** Desktop composition may intentionally activate native features by default. */
  allowNativeDefaults?: boolean;
}
export interface RustPolicy {
  crates: Record<string, RustCrateRule>;
  nativePackages: readonly string[];
  devExceptions?: readonly { owner: string; dependency: string; reason: string }[];
}
export const defaultRustPolicy: RustPolicy = {
  crates: {
    'loop-cli': { path: 'crates/loop-cli', allows: ['loop-host', 'loop-host-plan'], allowNativeDefaults: true },
    'loop-host': { path: 'crates/loop-host', allows: [] },
    'loop-host-plan': { path: 'crates/loop-host-plan', allows: [], portable: true },
  },
  nativePackages: ['wasmtime', 'wasmtime-wasi', 'wry', 'tao'],
};
export interface RustEdge {
  from: string; to: string; alias: string; kind: string; target?: string;
  optional: boolean; defaultFeatures: boolean; features: string[]; manifest: string;
  local: boolean; procMacro: boolean;
}
export interface RustViolation { rule: string; manifest: string; message: string }
interface Crate { name: string; file: string; data: Table; edges: RustEdge[] }
export interface RustInspection { crates: string[]; edges: RustEdge[]; violations: RustViolation[] }
const slash = (path: string) => path.replaceAll('\\', '/');
const inside = (root: string, path: string) => { const rel = relative(root, path); return rel !== '..' && !rel.startsWith('..' + '/') && !rel.startsWith('..\\') && !isAbsolute(rel); };

export function inspectRustBoundaries(directory: string, policy: RustPolicy = defaultRustPolicy): RustInspection {
  const root = realpathSync(directory), crates = new Map<string, Crate>(), byFile = new Map<string, Crate>();
  const violations: RustViolation[] = [], edges: RustEdge[] = [];
  const fail = (rule: string, file: string, message: string) => violations.push({ rule, manifest: slash(relative(root, file)), message });
  const parse = (file: string): Table => { try { return Bun.TOML.parse(readFileSync(file, 'utf8')) as Table; } catch (error) { fail('manifest', file, String(error)); return {}; } };
  const workspaceFile = resolve(root, 'Cargo.toml'), workspace = parse(workspaceFile);
  const workspaceDeps = workspace.workspace?.dependencies ?? {};
  const readCrate = (file: string): Crate | undefined => {
    if (!existsSync(file)) { fail('local-path', file, 'Missing Cargo manifest'); return; }
    const real = realpathSync(file);
    if (!inside(root, real)) { fail('local-path', file, 'Local dependency escapes checkout (including symlink/reparse escapes)'); return; }
    if (byFile.has(real)) return byFile.get(real);
    const data = real === workspaceFile ? workspace : parse(real), name = data.package?.name;
    if (typeof name !== 'string') { fail('manifest', real, 'Expected a named Cargo package'); return; }
    const crate: Crate = { name, file: real, data, edges: [] };
    byFile.set(real, crate);
    if (crates.has(name)) fail('identity', real, `Duplicate local package ${name}`);
    crates.set(name, crate);
    const rule = policy.crates[name];
    if (!rule || realpathSafe(resolve(root, rule.path, 'Cargo.toml')) !== real) fail('owner', real, `Undeclared local package/path ${name}`);
    return crate;
  };
  if (workspace.package) readCrate(workspaceFile);
  for (const member of workspace.workspace?.members ?? []) {
    if (typeof member !== 'string') { fail('workspace', workspaceFile, 'Invalid workspace member'); continue; }
    if (/[?*\[\]{}]/.test(member)) {
      const matches = [...new Bun.Glob(`${slash(member)}/Cargo.toml`).scanSync({ cwd: root, onlyFiles: true })];
      if (!matches.length) fail('workspace', workspaceFile, `Unmatched member ${member}`);
      for (const match of matches) readCrate(resolve(root, match));
    } else readCrate(resolve(root, member, 'Cargo.toml'));
  }
  // New local dependencies discovered while iterating are included, even if not workspace members.
  for (const crate of crates.values()) {
    const tables: { table: Table; kind: string; target?: string }[] = [];
    const collect = (data: Table, target?: string) => { for (const kind of ['dependencies', 'build-dependencies', 'dev-dependencies']) if (data[kind]) tables.push({ table: data[kind], kind, target }); };
    collect(crate.data);
    for (const [target, data] of Object.entries(crate.data.target ?? {})) collect(data as Table, target);
    for (const { table, kind, target } of tables) for (const [alias, raw] of Object.entries(table)) {
      let dep: Table = typeof raw === 'string' ? { version: raw } : raw as Table;
      let base = dirname(crate.file);
      if (!dep || typeof dep !== 'object') { fail('dependency', crate.file, `Invalid dependency ${alias}`); continue; }
      if (dep.workspace === true) {
        const forbidden = Object.keys(dep).filter(key => !['workspace', 'features', 'optional', 'default-features'].includes(key));
        if (forbidden.length) { fail('workspace-inheritance', crate.file, `${alias} overrides non-inheritable workspace fields: ${forbidden.join(', ')}`); continue; }
        const childDefault = dep['default-features'];
        const inherited = workspaceDeps[alias];
        if (!inherited) { fail('workspace-inheritance', crate.file, `Missing workspace dependency ${alias}`); continue; }
        const shared = typeof inherited === 'string' ? { version: inherited } : inherited;
        if (![shared.features ?? [], dep.features ?? []].every(list => Array.isArray(list) && list.every(value => typeof value === 'string'))) { fail('feature', crate.file, `Invalid inherited dependency features ${alias}`); continue; }
        dep = { ...shared, ...dep, features: [...(shared.features ?? []), ...(dep.features ?? [])] };
        // Cargo inheritance is additive; default-features=false on the child cannot turn off inherited defaults.
        dep['default-features'] = shared['default-features'] !== false || childDefault === true;
        base = root;
      }
      if (!Array.isArray(dep.features ?? []) || (dep.features ?? []).some((value: unknown) => typeof value !== 'string')) { fail('feature', crate.file, `Invalid dependency features ${alias}`); continue; }
      if (dep.path !== undefined && typeof dep.path !== 'string') { fail('local-path', crate.file, `Invalid dependency path ${alias}`); continue; }
      let to = dep.package ?? alias;
      const local = typeof dep.path === 'string';
      let dependency: Crate | undefined;
      if (local) {
        if (isAbsolute(dep.path) || /^[a-z]:|^\\\\|station/i.test(dep.path)) fail('local-path', crate.file, `${alias}: absolute/Station dependency path ${dep.path}`);
        const file = resolve(base, dep.path, 'Cargo.toml');
        dependency = readCrate(file);
        if (dependency && dependency.name !== to) fail('identity', crate.file, `${alias} declares ${to} but path contains ${dependency.name}`);
        if (dependency) to = dependency.name;
      }
      const edge: RustEdge = { from: crate.name, to, alias, kind, target, optional: dep.optional === true,
        defaultFeatures: dep['default-features'] !== false, features: dep.features ?? [], manifest: slash(relative(root, crate.file)),
        local, procMacro: dependency?.data.lib?.['proc-macro'] === true };
      crate.edges.push(edge); edges.push(edge);
    }
    // Registry patches/replacements can smuggle local/private implementations around dependency identity checks.
    for (const key of ['patch', 'replace']) if (crate.data[key]) fail('source-override', crate.file, `${key} source override requires explicit review`);
  }
  for (const key of ['patch', 'replace']) if (workspace[key] && !workspace.package) fail('source-override', workspaceFile, `${key} source override requires explicit review`);
  for (const crate of crates.values()) {
    if (crate.data.features !== undefined && (typeof crate.data.features !== 'object' || Array.isArray(crate.data.features) || crate.data.features === null)) { fail('feature', crate.file, 'Expected a features table'); crate.data.features = {}; }
    const features = crate.data.features ?? {};
    const suppressed = new Set<string>((Object.values(features).flat() as string[]).filter(x => typeof x === 'string' && x.startsWith('dep:')).map(x => x.slice(4)));
    for (const [feature, values] of Object.entries(features)) {
      if (!Array.isArray(values) || values.some(v => typeof v !== 'string')) { fail('feature', crate.file, `Invalid feature ${feature}`); features[feature] = []; continue; }
      for (const value of values) {
        const alias = value.startsWith('dep:') ? value.slice(4) : value.includes('/') ? value.split('/')[0]!.replace(/\?$/, '') : undefined;
        if (alias !== undefined && !crate.edges.some(e => e.alias === alias)) fail('feature', crate.file, `${feature} refers to undeclared dependency ${alias}`);
        if (alias === undefined && !(value in features) && (suppressed.has(value) || !crate.edges.some(e => e.alias === value && e.optional))) fail('feature', crate.file, `${feature} refers to unknown/suppressed feature ${value}`);
      }
    }
  }
  for (const edge of edges) {
    const from = crates.get(edge.from)!, rule = policy.crates[edge.from];
    const excepted = edge.kind === 'dev-dependencies' && policy.devExceptions?.some(e => e.owner === edge.from && e.dependency === edge.to && e.reason.trim());
    if ((edge.local || policy.crates[edge.to]) && !rule?.allows.includes(edge.to) && !excepted)
      fail('crate-edge', from.file, `${edge.from} -> ${edge.to} (${edge.alias}, ${edge.kind}${edge.target ? ', '+edge.target : ''}${edge.procMacro ? ', proc-macro' : ''}) is not allowed`);
  }
  // Count every edge for cycles and portable reachability; optional/target flags never hide backedges.
  const walk = (name: string, path: string[], origin: Crate) => {
    if (path.includes(name)) { fail('cycle', origin.file, [...path, name].join(' -> ')); return; }
    const crate = crates.get(name); if (!crate) return;
    for (const edge of crate.edges) {
      if (policy.crates[origin.name]?.portable && policy.nativePackages.includes(edge.to)) fail('portable-native', origin.file, [...path, name, edge.to].join(' -> '));
      if (edge.local) walk(edge.to, [...path, name], origin);
    }
  };
  for (const crate of crates.values()) walk(crate.name, [], crate);
  // Feature activation models defaults, implicit optional features, dep:, strong and weak forwarding.
  for (const origin of crates.values()) {
    if (policy.crates[origin.name]?.allowNativeDefaults) continue;
    const active = new Map<string, Set<string>>(), enabled = new Set<RustEdge>();
    const ensure = (name: string) => { if (!active.has(name)) active.set(name, new Set()); return active.get(name)!; };
    ensure(origin.name).add('default');
    let changed = true;
    const add = (set: Set<string>, value: string) => { if (!set.has(value)) { set.add(value); changed = true; } };
    while (changed) {
      changed = false;
      for (const [name, features] of active) {
        const crate = crates.get(name); if (!crate) continue;
        const declarations = crate.data.features ?? {};
        const suppressed = new Set<string>((Object.values(declarations).flat() as string[]).filter(x => x.startsWith('dep:')).map(x => x.slice(4)));
        for (const feature of features) for (const item of declarations[feature] ?? (suppressed.has(feature) ? [] : [`dep:${feature}`])) {
          if (item.startsWith('dep:')) { for (const edge of crate.edges.filter(e => e.alias === item.slice(4))) if (!enabled.has(edge)) { enabled.add(edge); changed = true; } }
          else if (item.includes('/')) {
            const [alias, forwarded] = item.split('/'), weak = alias.endsWith('?');
            for (const edge of crate.edges.filter(e => e.alias === alias.replace(/\?$/, ''))) {
              if (!weak && !enabled.has(edge)) { enabled.add(edge); changed = true; }
              if (!weak || enabled.has(edge)) add(ensure(edge.to), forwarded);
            }
          } else add(features, item);
        }
        for (const edge of crate.edges) {
          if (!edge.optional && !enabled.has(edge)) { enabled.add(edge); changed = true; }
          if (!enabled.has(edge)) continue;
          const dest = ensure(edge.to);
          if (edge.defaultFeatures) add(dest, 'default');
          for (const feature of edge.features) add(dest, feature);
        }
      }
    }
    for (const edge of enabled) if (policy.nativePackages.includes(edge.to) && (edge.optional || ['wry', 'tao'].includes(edge.to)))
      fail('native-default', origin.file, `${origin.name} default closure activates optional native dependency ${edge.from} -> ${edge.to}`);
  }
  return { crates: [...crates.keys()].sort(), edges, violations: [...new Map(violations.map(v => [JSON.stringify(v), v])).values()] };
}
function realpathSafe(path: string) { return existsSync(path) ? realpathSync(path) : path; }
if (import.meta.main) {
  const result = inspectRustBoundaries(resolve(import.meta.dir, '..'));
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else { for (const v of result.violations) console.error(`${v.manifest}: [${v.rule}] ${v.message}`); console.log(`${result.crates.length} crates, ${result.edges.length} declared edges, ${result.violations.length} violations`); }
  process.exitCode = result.violations.length ? 1 : 0;
}
