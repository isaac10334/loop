import {describe,test,expect} from 'bun:test';
import {describeFailure,failureCode,guardRejection} from '../../crates/loop-cli/host-tools/diagnostic';

describe('bounded host diagnostics',()=>{
 test('preserves both primary and nested cleanup failures',()=>{
  const failure=new AggregateError([Error('primary'),new AggregateError([Error('cleanup')],'cleanup phase')],'startup');
  expect(describeFailure(failure)).toBe('startup [primary; cleanup phase [cleanup]]');
 });
 test('limits aggregate text and handles cycles and unprintable errors',()=>{
  const cycle=new AggregateError([],'cycle');cycle.errors.push(cycle);
  expect(describeFailure(cycle)).toContain('[repeated aggregate]');
  const long=new AggregateError([Error('a'.repeat(20000)),Error('cleanup')],'startup');
  const text=describeFailure(long);expect(text.length).toBeLessThanOrEqual(8192);expect(text).toContain('cleanup');
  const wide=new AggregateError([new AggregateError(Array.from({length:8},()=>Error('p'.repeat(2000))),'primary'),new AggregateError([Error('cleanup-sentinel')],'cleanup')],'startup');
  const balanced=describeFailure(wide);expect(balanced.length).toBeLessThanOrEqual(8192);expect(balanced).toContain('cleanup-sentinel');
  expect(describeFailure(new AggregateError(Array.from({length:9},(_,i)=>Error(String(i))),'wide'))).toContain('additional errors omitted');
  expect(describeFailure({get message(){throw Error('no');}})).toBe('[unprintable error]');
 });
 test('guarded rejection is handled immediately and still rejects when joined',async()=>{
  const unhandled:unknown[]=[],listener=(reason:unknown)=>{unhandled.push(reason);};process.on('unhandledRejection',listener);
  try{const error=Error('disposal failure'),pending=guardRejection(Promise.reject(error));await Bun.sleep(20);expect(unhandled).toEqual([]);await expect(pending).rejects.toBe(error);}
  finally{process.off('unhandledRejection',listener);}
 });
 test('null and malformed thrown codes fall back without throwing',()=>{
  expect(failureCode(null)).toBe('E_RUNTIME');expect(failureCode({code:42})).toBe('E_RUNTIME');
  expect(failureCode({get code(){throw Error('no');}})).toBe('E_RUNTIME');expect(failureCode({code:'ENOENT'})).toBe('ENOENT');
 });
 test('preserves normal error messages and their existing size limit',()=>{
  expect(describeFailure(Error('plain'))).toBe('plain');expect(describeFailure({message:'object'})).toBe('object');
  expect(describeFailure(Error('x'.repeat(70000))).length).toBe(65536);
 });
});
