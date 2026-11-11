import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { inspectRustBoundaries, type RustPolicy } from './rust-boundaries';
const policy: RustPolicy = { crates: {
 core: { path: 'core', allows: ['helper'], portable: true },
 helper: { path: 'helper', allows: [] },
 outer: { path: 'outer', allows: ['core'], allowNativeDefaults: true },
}, nativePackages: ['wry', 'tao', 'wasmtime'] };
function fixture(core: string, extra: { root?: string; helper?: string; outer?: string; files?: Record<string,string>; policy?: RustPolicy; setup?: (root: string) => void } = {}) {
 const root = mkdtempSync(resolve(tmpdir(), 'loop-rust-boundaries-'));
 const files = { 'Cargo.toml': '[workspace]\nmembers=["core","helper","outer"]\nresolver="3"\n' + (extra.root ?? ''),
  'core/Cargo.toml': '[package]\nname="core"\nversion="0.1.0"\n'+core,
  'helper/Cargo.toml': '[package]\nname="helper"\nversion="0.1.0"\n'+(extra.helper ?? ''),
  'outer/Cargo.toml': '[package]\nname="outer"\nversion="0.1.0"\n'+(extra.outer ?? ''), ...extra.files };
 try { for (const [path, text] of Object.entries(files)) { const file=resolve(root,path); mkdirSync(resolve(file,'..'),{recursive:true}); writeFileSync(file,text); } extra.setup?.(root); return inspectRustBoundaries(root,extra.policy ?? policy); }
 finally { rmSync(root,{recursive:true,force:true}); }
}
const rejects = (result: ReturnType<typeof fixture>, rule: string) => expect(result.violations.some(v=>v.rule===rule)).toBe(true);
describe('all declared Cargo graph boundaries (no active metadata filtering)',()=>{
 test('current desktop CLI and optional Windows host remain legal',()=>{
  const result=inspectRustBoundaries(resolve(import.meta.dir,'..')); expect(result.violations).toEqual([]);
  expect(result.edges.some(e=>e.from==='loop-cli' && e.to==='loop-host' && e.features.includes('desktop'))).toBe(true);
  expect(result.edges.some(e=>e.to==='wry' && e.optional && e.target==='cfg(windows)')).toBe(true);
 });
 test('portable headless with inward local helper',()=>expect(fixture('[dependencies]\nhelper={path="../helper"}\n').violations).toEqual([]));
 for (const kind of ['dependencies','build-dependencies','dev-dependencies']) for (const target of ['', 'target.\'cfg(target_os = "never")\'.'])
  test(`rejects hidden renamed optional ${target}${kind}`,()=>{
   const result=fixture(`[${target}${kind}]\ninnocent={package="outer",path="../outer",optional=true}\n`);
   rejects(result,'crate-edge'); expect(result.edges[0]?.to).toBe('outer');
  });
 test('inherited workspace aliases use root-relative paths even inactive',()=>rejects(fixture('[target.\'cfg(windows)\'.build-dependencies]\nsneaky={workspace=true,optional=true}\n',{
  root:'[workspace.dependencies]\nsneaky={package="outer",path="outer"}\n',
 }),'crate-edge'));
 test('proc macro dependency is still an outer edge',()=>{
  const result=fixture('[build-dependencies]\nouter={path="../outer"}\n',{outer:'[lib]\nproc-macro=true\n'});
  rejects(result,'crate-edge'); expect(result.edges.some(e=>e.procMacro)).toBe(true);
 });
 test('transitive disabled native edge rejected for portable core',()=>rejects(fixture('[dependencies]\nhelper={path="../helper",optional=true}\n',{
  helper:'[target.\'cfg(windows)\'.dependencies]\nwry={version="1",optional=true}\n',
 }),'portable-native'));
 test('inactive cycle reports edge path',()=>{
  const result=fixture('[dependencies]\nhelper={path="../helper",optional=true}\n',{helper:'[dev-dependencies]\ncore={path="../core"}\n'});
  rejects(result,'cycle'); expect(result.violations.some(v=>v.message==='core -> helper -> core')).toBe(true);
 });
 test('undeclared private local path cannot bypass owner policy',()=>rejects(fixture('[dependencies]\nprivate={path="../private"}\n',{
  files:{'private/Cargo.toml':'[package]\nname="private"\nversion="0.1.0"\n'},
 }),'owner'));
 test('absolute local path rejected',()=>rejects(fixture(`[dependencies]\nouter={path=${JSON.stringify(resolve(import.meta.dir,'..','crates','loop-host').replaceAll('\\','/'))},package="loop-host"}\n`),'local-path'));
 test('junction cannot hide an outside-workspace local dependency',()=>{
  const external=mkdtempSync(resolve(tmpdir(),'loop-rust-external-'));
  try { writeFileSync(resolve(external,'Cargo.toml'),'[package]\nname="private"\nversion="0.1.0"\n');
   rejects(fixture('[dependencies]\nprivate={path="../linked"}\n',{setup:root=>symlinkSync(external,resolve(root,'linked'),process.platform==='win32'?'junction':'dir')}),'local-path');
  } finally {rmSync(external,{recursive:true,force:true});}
 });
 test('missing workspace inheritance fails closed',()=>rejects(fixture('[dependencies]\nouter.workspace=true\n'),'workspace-inheritance'));
 test('patches cannot bypass declared paths',()=>rejects(fixture('',{root:'[patch.crates-io]\nx={path="elsewhere"}\n'}),'source-override'));
 test('exact dev exception authorizes only its owner and dependency',()=>{
  const reviewed={...policy,devExceptions:[{owner:'core',dependency:'outer',reason:'Reviewed test harness only'}]};
  expect(fixture('[dev-dependencies]\nouter={path="../outer"}\n',{policy:reviewed}).violations).toEqual([]);
  rejects(fixture('[dependencies]\nouter={path="../outer"}\n',{policy:reviewed}),'crate-edge');
  rejects(fixture('',{helper:'[dev-dependencies]\nouter={path="../outer"}\n',policy:reviewed}),'crate-edge');
 });
 for (const activation of ['"dep:wry"','"wry"','"enabled"'] ) test(`native default activation ${activation}`,()=>{
  rejects(fixture('[dependencies]\nhelper={path="../helper"}\n',{helper:`[dependencies]\nwry={version="1",optional=true}\n[features]\ndefault=[${activation}]\n${activation === '"wry"' ? '' : 'enabled=["dep:wry"]\n'}`}), 'native-default');
 });
 test('transitive strong feature forwarding activates native',()=>rejects(fixture('[dependencies]\nhelper={path="../helper",optional=true,default-features=false}\n[features]\ndefault=["helper/desktop"]\n',{
  helper:'[dependencies]\nwry={version="1",optional=true}\n[features]\ndesktop=["dep:wry"]\n',
 }),'native-default'));
 test('weak forwarding alone does not enable optional helper',()=>{
  const result=fixture('[dependencies]\nhelper={path="../helper",optional=true}\n[features]\ndefault=["helper?/desktop"]\n',{
   helper:'[dependencies]\nwry={version="1",optional=true}\n[features]\ndesktop=["dep:wry"]\n',
  }); expect(result.violations.filter(v=>v.rule==='native-default')).toEqual([]);
 });
 test('workspace defaults cannot be disabled by child inheritance',()=>rejects(fixture('[dependencies]\nhelper={workspace=true,default-features=false}\n',{
  root:'[workspace.dependencies]\nhelper={path="helper"}\n',
  helper:'[dependencies]\nwry={version="1",optional=true}\n[features]\ndefault=["dep:wry"]\n',
 }),'native-default'));
 test('member may explicitly activate defaults disabled by workspace declaration',()=>{
  const result=fixture('[dependencies]\nhelper={workspace=true,default-features=true}\n',{
   root:'[workspace.dependencies]\nhelper={path="helper",default-features=false}\n',
   helper:'[dependencies]\nwry={version="1",optional=true}\n[features]\ndefault=["dep:wry"]\n',
  });expect(result.violations.some(v=>v.rule==='native-default'&&v.manifest==='core/Cargo.toml')).toBe(true);
 });
 test('inherited alias cannot override package identity to conceal an outer edge',()=>rejects(fixture('[dependencies]\nsneaky={workspace=true,package="helper"}\n',{
  root:'[workspace.dependencies]\nsneaky={package="outer",path="outer"}\n',
 }),'workspace-inheritance'));
 test('nonoptional Windows presentation cannot silently activate by default',()=>rejects(fixture('',{
  helper:'[target.\'cfg(windows)\'.dependencies]\nwry="1"\n',
 }),'native-default'));
 test('weak forwarding takes effect when dependency is independently enabled',()=>rejects(fixture('[dependencies]\nhelper={path="../helper",optional=true}\n[features]\ndefault=["helper?/desktop","dep:helper"]\n',{
  helper:'[dependencies]\nwry={version="1",optional=true}\n[features]\ndesktop=["dep:wry"]\n',
 }),'native-default'));
 test('suppressed implicit dependency feature fails closed',()=>rejects(fixture('[dependencies]\nhelper={path="../helper",optional=true}\n[features]\ndefault=["helper"]\nexplicit=["dep:helper"]\n'),'feature'));
 test('forwarding to unknown dependency fails closed',()=>rejects(fixture('[features]\ndefault=["hidden/desktop"]\n'),'feature'));
 test('malformed feature table shape fails with diagnostics',()=>rejects(fixture('',{files:{'core/Cargo.toml':'features="not a table"\n[package]\nname="core"\nversion="0.1.0"\n'}}),'feature'));
 test('malformed dependency feature shape fails with diagnostics',()=>rejects(fixture('[dependencies]\nhelper={path="../helper",features="not an array"}\n'),'feature'));
 test('malformed TOML fails closed',()=>rejects(fixture('['),'manifest'));
});
