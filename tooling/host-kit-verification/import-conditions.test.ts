/** Independent compiler-resolution and hidden-edge regression fixtures. */
import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { inspect, type Policy } from '../architecture';
function fixture(source: string, options: { type?: string; exports?: unknown; role?: string; extra?: Record<string,string>; dependencies?: Record<string,string> }={}) {
 const root=mkdtempSync(resolve(tmpdir(),'loop-hk09-import-'));
 const files:Record<string,string>={
  'packages/a/package.json':JSON.stringify({name:'@fixture/a',type:options.type??'module',exports:{'.':'./src/index.ts'},dependencies:options.dependencies??{'conditional-only':'1'}}),
  'packages/a/tsconfig.json':JSON.stringify({compilerOptions:{module:'NodeNext',moduleResolution:'NodeNext'}}),
  'packages/a/src/index.ts':source,
  'node_modules/conditional-only/package.json':JSON.stringify({name:'conditional-only',type:'module',exports:options.exports??{'.':{import:'./index.d.ts'}}}),
  'node_modules/conditional-only/index.d.ts':'export declare const value: number;',
  ...options.extra,
 };
 const policy:Policy={version:1,exceptionLimit:0,exceptions:[],packages:{'@fixture/a':{path:'packages/a',owner:'HK09 fixture',role:options.role??'composition',allows:[]}},layers:{contracts:[],domain:['contracts'],application:['contracts','domain'],providers:['contracts','domain','application'],presentation:['contracts','domain','application'],composition:['contracts','domain','application','providers','presentation']}};
 try{for(const [path,text]of Object.entries(files)){const file=resolve(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,text);}return inspect(root,policy);}finally{rmSync(root,{recursive:true,force:true});}
}
describe('HK09 conditional exports resolve the actual usage mode',()=>{
 test('ESM import-only public export resolves',()=>expect(fixture("import {value} from 'conditional-only'; export {value};").violations).toEqual([]));
 test('CJS require-only public export resolves',()=>expect(fixture("const {value}=require('conditional-only');",{type:'commonjs',exports:{'.':{require:'./index.d.ts'}}}).violations).toEqual([]));
 test('dynamic import in a CommonJS source uses import condition',()=>expect(fixture("void import('conditional-only');",{type:'commonjs'}).violations).toEqual([]));
 test('require in an ESM source uses require condition',()=>expect(fixture("const {value}=require('conditional-only');",{exports:{'.':{require:'./index.d.ts'}}}).violations).toEqual([]));
 test('require cannot use an import-only export',()=>expect(fixture("const {value}=require('conditional-only');",{type:'commonjs'}).violations.some(v=>v.rule==='unresolved')).toBe(true));
});
describe('HK09 inactive/type-only/private platform edges remain forbidden',()=>{
 for(const source of ["import type {Stats} from 'node:fs';","export * from 'node:fs';","if(false)void import('node:fs');","type Hidden=typeof import('node:fs');","const x=require('node:fs');"])
  test(source,()=>expect(fixture(source,{role:'contracts',dependencies:{}}).violations.some(v=>v.rule==='portable-layer')).toBe(true));
 test('computed import cannot evade inspection',()=>expect(fixture("const hidden='node:fs'; void import(hidden);",{role:'contracts'}).violations.some(v=>v.rule==='unresolved-dynamic')).toBe(true));
 test('portable resolver cannot import React through type-only edge',()=>expect(fixture("import type {ReactNode} from 'react';",{role:'domain',dependencies:{react:'1'}}).violations.some(v=>v.rule==='portable-layer')).toBe(true));
 test('portable resolver cannot import Polyengine through declared type-only edge',()=>expect(fixture("import type {value} from '@polyengine/runtime';",{role:'domain',dependencies:{'@polyengine/runtime':'1'},extra:{
  'node_modules/@polyengine/runtime/package.json':JSON.stringify({name:'@polyengine/runtime',type:'module',exports:{'.':{import:'./index.d.ts'}}}),
  'node_modules/@polyengine/runtime/index.d.ts':'export declare const value: number;',
 }}).violations.some(v=>v.rule==='portable-layer')).toBe(true));
 test('portable resolver cannot hide Polyengine behind a tsconfig path alias',()=>expect(fixture("import type {value} from '#engine';",{role:'domain',dependencies:{'@polyengine/runtime':'1'},extra:{
  'packages/a/tsconfig.json':JSON.stringify({compilerOptions:{module:'NodeNext',moduleResolution:'NodeNext',baseUrl:'.',paths:{'#engine':['../../node_modules/@polyengine/runtime/index.d.ts']}}}),
  'node_modules/@polyengine/runtime/package.json':JSON.stringify({name:'@polyengine/runtime',type:'module',exports:{'.':{import:'./index.d.ts'}}}),
  'node_modules/@polyengine/runtime/index.d.ts':'export declare const value: number;',
 }}).violations.some(v=>v.rule==='portable-layer')).toBe(true));
 test('provider cannot import private presentation implementation',()=>expect(fixture("import './presentation/render.js';",{role:'providers',dependencies:{},extra:{'packages/a/src/presentation/render.ts':'export {};'}}).violations.some(v=>v.rule==='layer-edge')).toBe(true));
 test('presentation cannot import private provider implementation',()=>expect(fixture("import './providers/store.js';",{role:'presentation',dependencies:{},extra:{'packages/a/src/providers/store.ts':'export {};'}}).violations.some(v=>v.rule==='layer-edge')).toBe(true));
});
