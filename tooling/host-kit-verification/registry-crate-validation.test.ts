import { describe, expect, test } from 'bun:test';
import { CRATES_IO, validateCratePaths, validateRegistryLock, validatePairedLock, type LockPackage } from './registry-crate-validation';

describe('registry crate gate inventory', () => {
  const root='loop-cli-0.1.0';
  const valid=[`${root}/Cargo.toml`,`${root}/src/main.rs`,`${root}/assets/worker.js`];
  test('accepts a portable single-root archive',()=>expect(validateCratePaths(valid)).toBe(root));
  test('host archives require an explicit host root',()=>{const host=['loop-host-0.1.0/Cargo.toml','loop-host-0.1.0/src/lib.rs'];expect(validateCratePaths(host,'loop-host')).toBe('loop-host-0.1.0');expect(()=>validateCratePaths(host)).toThrow();expect(()=>validateCratePaths(valid,'loop-host')).toThrow();});
  test('rejects traversal, drive, empty and reserved paths',()=>{
    for(const path of [`${root}/../other`,`/absolute`,`${root}/C:stream`,`${root}/a//b`,`${root}/NUL.txt`,`${root}/bad.`,`${root}/bad `,`${root}/bad?`]) expect(()=>validateCratePaths([...valid,path])).toThrow();
  });
  test('rejects Windows case aliases and file-directory collisions',()=>{
    expect(()=>validateCratePaths([...valid,`${root}/cargo.toml`])).toThrow();
    expect(()=>validateCratePaths([...valid,`${root}/src`,`${root}/SRC/other.rs`])).toThrow();
  });
  test('rejects missing manifest or multiple roots',()=>{
    expect(()=>validateCratePaths([`${root}/src/main.rs`])).toThrow();
    expect(()=>validateCratePaths([...valid,'other/file'])).toThrow();
  });
});

describe('paired extracted crate lock graph',()=>{
 const base:LockPackage[]=[{name:'loop-cli',version:'0.1.0'},{name:'loop-host',version:'0.1.0'},{name:'serde',version:'1',source:CRATES_IO,checksum:'a'.repeat(64)}];
 test('accepts only the two expected local archives',()=>expect(()=>validatePairedLock(base,'0.1.0','0.1.0')).not.toThrow());
 test('rejects registry host, other locals, git sources, missing checksums and version mismatch',()=>{
  for(const invalid of [[base[0]!,{...base[1]!,source:CRATES_IO,checksum:'b'.repeat(64)}],[...base,{name:'other',version:'1'}],[...base,{name:'other',version:'1',source:'git+https://example.test'}],[base[0]!,base[1]!,{...base[2]!,checksum:undefined}],[base[0]!,{...base[1]!,version:'0.2.0'}]])expect(()=>validatePairedLock(invalid,'0.1.0','0.1.0')).toThrow();
 });
});

describe('registry crate gate lock graph',()=>{
  const base:LockPackage[]=[{name:'loop-cli',version:'0.1.0'},{name:'loop-host',version:'0.1.0',source:CRATES_IO,checksum:'a'.repeat(64)},{name:'serde',version:'1',source:CRATES_IO,checksum:'b'.repeat(64)}];
  test('accepts only the expected root and checksummed host',()=>expect(validateRegistryLock(base).version).toBe('0.1.0'));
  test('rejects host patches, git sources, other local packages and duplicate hosts',()=>{
    for(const invalid of [
      [base[0]!,{name:'loop-host',version:'0.1.0'}],
      [...base,{name:'other',version:'1'}],
      [...base,{name:'other',version:'1',source:'git+https://example.test/a'}],
      [...base,base[1]!],
      [base[0]!,{...base[1]!,source:'registry+https://example.test/index'}],
      [base[0]!,{...base[1]!,checksum:'z'.repeat(64)}],
      [base[1]!]
    ]) expect(()=>validateRegistryLock(invalid)).toThrow();
  });
});
