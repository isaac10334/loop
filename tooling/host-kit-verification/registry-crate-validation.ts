/** Pure validation for the local, trusted Cargo archive verification gate. */
export interface LockPackage { name: string; version: string; source?: string; checksum?: string }
export const CRATES_IO = 'registry+https://github.com/rust-lang/crates.io-index';

/** Validate portable archive paths before any entry is written to disk. */
export function validateCratePaths(paths: readonly string[], crate: 'loop-cli' | 'loop-host' = 'loop-cli'): string {
  if (!paths.length || paths.length > 10000) throw new Error('Invalid archive inventory size');
  const roots = new Set(paths.map(path => path.split('/')[0]));
  if (roots.size !== 1) throw new Error('Archive must contain one crate root');
  const root = [...roots][0]!;
  if (!new RegExp(`^${crate}-[0-9A-Za-z.+-]+$`).test(root) || !paths.includes(root+'/Cargo.toml')) throw new Error(`Unexpected ${crate} archive root`);
  const files = new Set<string>();
  for (const path of paths) {
    const pieces = path.split('/');
    if (pieces[0] !== root || pieces.some(part => !part || part === '.' || part === '..' || /[\\:<>"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error(`Unsafe archive path: ${path}`);
    const key=path.toLowerCase();
    if (files.has(key)) throw new Error(`Archive path collision: ${path}`);
    files.add(key);
  }
  for (const path of paths) {
    const pieces=path.toLowerCase().split('/');
    for(let i=1;i<pieces.length;i++) if(files.has(pieces.slice(0,i).join('/'))) throw new Error(`Archive file/directory collision: ${path}`);
  }
  return root;
}

/** Allow only the extracted CLI as a path package and one checksummed crates.io host. */
export function validateRegistryLock(packages: readonly LockPackage[]): {version:string;source:string;checksum:string} {
  const hosts=packages.filter(pkg=>pkg.name==='loop-host');
  const local=packages.filter(pkg=>!pkg.source);
  const nonRegistry=packages.filter(pkg=>pkg.source&&!pkg.source.startsWith('registry+'));
  if(hosts.length!==1||hosts[0]?.source!==CRATES_IO||!/^[a-f0-9]{64}$/.test(hosts[0].checksum??'')||local.length!==1||local[0]?.name!=='loop-cli'||nonRegistry.length) throw new Error(`Expected one crates.io loop-host and only the extracted CLI as local; hosts=${hosts.length}, local=${local.length}, nonRegistry=${nonRegistry.length}`);
  return {version:hosts[0].version,source:hosts[0].source,checksum:hosts[0].checksum!};
}

/** Require exactly the extracted CLI and host as local packages; all others are checksummed crates.io entries. */
export function validatePairedLock(packages: readonly LockPackage[], cliVersion: string, hostVersion: string): void {
  const local=packages.filter(pkg=>!pkg.source),cli=packages.filter(pkg=>pkg.name==='loop-cli'),host=packages.filter(pkg=>pkg.name==='loop-host');
  if(local.length!==2||cli.length!==1||host.length!==1||cli[0]?.source||host[0]?.source||cli[0]?.version!==cliVersion||host[0]?.version!==hostVersion||packages.some(pkg=>pkg.source&&(pkg.source!==CRATES_IO||!/^[a-f0-9]{64}$/.test(pkg.checksum??''))))throw new Error('Expected exactly the extracted CLI and host as local packages and checksummed crates.io dependencies');
}
