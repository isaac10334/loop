/** Source-backed official factory compatibility: unsupported inputs cannot silently select a default. */
import { describe, expect, test } from 'bun:test';
import { browser } from '../../packages/host-browser/src/index';
import { native } from '../../packages/host-native/src/index';
describe('HK09 official factories reject unsupported profiles before activation',()=>{
 test('native default and explicit TS preserve intentional profiles',()=>{expect(native().profile.id).toBe('loop:profile/native-ts');expect(native({profile:'ts'}).profile.id).toBe('loop:profile/native-ts');expect(native({profile:'components'}).profile.id).toBe('loop:profile/native-components');});
 test('browser default and explicit Component preserve intentional profiles',()=>{expect(browser().profile.id).toBe('loop:profile/browser-ts');expect(browser({profile:'loop:profile/browser-components@0.1.0'}).profile.id).toBe('loop:profile/browser-components');});
 for(const factory of [native,browser]){
  test(`${factory.name} unknown profile rejects`,()=>expect(()=>factory({profile:'unknown'} as any)).toThrow());
  test(`${factory.name} unknown option rejects`,()=>expect(()=>factory({unreviewed:true} as any)).toThrow());
 }
 test('browser incompatible profile version rejects',()=>expect(()=>browser({profile:'loop:profile/browser-ts@99.0.0'} as any)).toThrow());
 test('native incompatible profile version rejects',()=>expect(()=>native({profile:'loop:profile/native-ts@99.0.0'} as any)).toThrow());
});
