/** Bun-owned installed native backend composition. All portable imports use public roots. */
import {createHost,canonicalHostJson,type ResolvedHostPlan} from '@loop-kit/host';
import type {NativeConnection} from '@loop-kit/host-native';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {error,sha,localFile} from './evaluate';
import {guardRejection} from './diagnostic';
import {closeNativeProcess} from './native-process';
export class NativeStartupCleanupError extends AggregateError {}
export interface NativeLaunchOptions {plan:ResolvedHostPlan;modules:Record<string,any>;root:string;profileDir:string;instanceId:string;epoch:string;signal:AbortSignal;backend?:string;onClosed?:()=>void;deferHostStop?:()=>boolean}
/** Acquires ownership before waiting for health. Abort closes event reads before host task joins. */
export async function startNativeRuntime(options:NativeLaunchOptions):Promise<{dispose():Promise<void>}> {
 const {plan,signal,epoch}=options;if(plan.kind!=='desktop'||plan.profile.version!=='0.1.0'||!['loop:profile/native-ts','loop:profile/native-components'].includes(plan.profile.id))error('E_NATIVE_PROFILE','Unsupported native profile');if(signal.aborted)error('E_CANCELLED','Native startup cancelled');const connectNativeSurface=options.modules[plan.coordinator.specifier]?.[plan.coordinator.export] as ((options:any)=>NativeConnection)|undefined;if(typeof connectNativeSurface!=='function')error('E_MODULE_EXPORT',plan.coordinator.export);const component=plan.profile.id==='loop:profile/native-components';const kit=plan.kitOptions as any;await mkdir(dirname(options.profileDir),{recursive:true});
 const args=[options.backend??process.env.LOOP_CLI_EXECUTABLE??'loop',component?'native-component':'native-surface','--profile-dir',options.profileDir,'--instance-id',options.instanceId,'--epoch',epoch];
 if(component){const config=kit.component;if(!config||typeof config.path!=='string'||!(/^[a-f0-9]{64}$/).test(config.sha256))error('E_COMPONENT_ARTIFACT','native-components requires explicit component {path,sha256}');const path=await localFile(options.root,config.path);if(sha(await readFile(path))!==config.sha256)error('E_STALE_INPUT','Component digest mismatch');args.push('--component',path,'--expected-sha256',config.sha256,'--source',kit.document?.source??'');if(kit.document?.writable===true)args.push('--writable');}
 if(signal.aborted)error('E_CANCELLED','Native startup cancelled');
 const child=Bun.spawn(args,{stdin:'pipe',stdout:'pipe',stderr:'inherit',env:{SystemRoot:process.env.SystemRoot??'',WINDIR:process.env.WINDIR??'',PATH:process.env.PATH??'',BUN_RUNTIME_TRANSPILER_CACHE_PATH:'0'}});
 let dispose:Promise<void>|undefined,closing=false;const listeners=new Set<(bytes:Uint8Array)=>void>();let reader:Promise<void>;
 const transport={send:async(bytes:Uint8Array)=>{child.stdin.write(bytes);await child.stdin.flush();},subscribe:(fn:(bytes:Uint8Array)=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);},close:async()=>{closing=true;await closeNativeProcess(child,reader);}};
 let connection:NativeConnection,host:ReturnType<typeof createHost>,scope:ReturnType<ReturnType<typeof createHost>['scope']>;
 let partialConnection:NativeConnection|undefined,partialHost:ReturnType<typeof createHost>|undefined;
 try{
  if(signal.aborted)error('E_CANCELLED','Native startup cancelled');
  partialConnection=connectNativeSurface({transport,epoch,signal});
  if(!partialConnection||typeof partialConnection.dispose!=='function')throw new Error('Native coordinator returned an invalid connection');
  connection=partialConnection;partialHost=createHost();host=partialHost;scope=host.scope();
 }catch(primary){
  closing=true;const errors:unknown[]=[];
  try{child.stdin.end();}catch(e){errors.push(e);}try{child.kill();}catch(e){errors.push(e);}
  // Join the child and any partially acquired owners, but never claim cleanup if they hang.
  const actions:Promise<unknown>[]=[child.exited,Promise.resolve().then(()=>child.stdout.cancel())];
  if(partialConnection)actions.push(Promise.resolve().then(()=>partialConnection!.dispose()));
  if(partialHost)actions.push(Promise.resolve().then(()=>partialHost!.dispose('native startup failed')));
  let timer:ReturnType<typeof setTimeout>|undefined;
  const results=await Promise.race([Promise.allSettled(actions),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),5000);})]);
  if(timer)clearTimeout(timer);
  if(results===null)errors.push(new Error('Native partial-start cleanup deadline; child or resources may remain'));
  else for(const result of results)if(result.status==='rejected')errors.push(result.reason);
  if(errors.length)throw new NativeStartupCleanupError([primary,...errors],'Native connection setup and child cleanup failed');
  throw primary;
 }
 let notified=false;const notifyClosed=()=>{if(!closing&&!notified){notified=true;options.onClosed?.();}};
 reader=guardRejection((async()=>{try{for await(const bytes of child.stdout)for(const listener of listeners)listener(bytes);}finally{notifyClosed();}})());
 let starting=true,abortSurface:Promise<unknown>|undefined;
 function stop():Promise<void>{
  if(dispose)return dispose;
  let succeed!:()=>void,fail!:(error:unknown)=>void;dispose=new Promise<void>((resolve,reject)=>{succeed=resolve;fail=reject;});
  signal.removeEventListener('abort',onAbort);
  let hostDisposal:Promise<unknown>,surfaceDisposal:Promise<unknown>;
  try{hostDisposal=Promise.resolve(host.dispose('native stop'));}catch(error){hostDisposal=Promise.reject(error);}
  try{surfaceDisposal=abortSurface??Promise.resolve(connection.dispose());}catch(error){surfaceDisposal=Promise.reject(error);}
  void Promise.allSettled([surfaceDisposal,hostDisposal]).then(results=>{const errors=results.filter(r=>r.status==='rejected').map(r=>(r as PromiseRejectedResult).reason);if(errors.length)throw new AggregateError(errors,'Native runtime cleanup failed');}).then(succeed,fail);
  return dispose;
 }
 const onAbort=()=>{
  if(!starting&&!options.deferHostStop?.()){void stop().catch(e=>console.error(e));return;}
  // Cancel surface reads now; host scope disposal waits until in-flight setup returns.
  try{abortSurface=Promise.resolve(connection.dispose());}catch(error){abortSurface=Promise.reject(error);}
  void abortSurface.catch(()=>{});
 };signal.addEventListener('abort',onAbort,{once:true});
 try{if(signal.aborted)error('E_CANCELLED','Native startup cancelled');await connection.ready;if(signal.aborted)error('E_CANCELLED','Native startup cancelled');
 if(!component){for(const plugin of plan.plugins)for(const contribution of plugin.contributions){if(signal.aborted)error('E_CANCELLED','Native startup cancelled');if(contribution.host!=='application')error('E_NATIVE_REALM','Native TS setup supports declared application host only');if(contribution.provides.some(r=>r.kind!=='provider'))error('E_NATIVE_REGISTRATION','Native presentation is owned by the Rust surface; TS contributions declare providers only');const setup=options.modules[contribution.entry.specifier]?.[contribution.entry.export];if(typeof setup!=='function')error('E_MODULE_EXPORT',contribution.entry.export);const before=host.inspect().providers;await setup({host,scope:scope.scope({name:contribution.key}),signal,options:contribution.options,ports:{}});if(signal.aborted)error('E_CANCELLED','Native startup cancelled');const after=host.inspect().providers;const added=after.filter(r=>!before.some(b=>b.registrationId===r.registrationId));if(before.some(b=>!after.some(r=>b.registrationId===r.registrationId)))error('E_REGISTRATION_RECEIPT','Contribution removed a prior registration');const expected=contribution.provides.map(r=>canonicalHostJson({id:r.id,version:r.version,serviceId:r.kind==='provider'?r.serviceId??null:null})).sort();const actual=added.map(r=>canonicalHostJson({id:r.capabilityId,version:r.version,serviceId:r.serviceId??null})).sort();if(canonicalHostJson(expected)!==canonicalHostJson(actual))error('E_REGISTRATION_RECEIPT',contribution.key);}
 if(signal.aborted)error('E_CANCELLED','Native startup cancelled');const start=options.modules[plan.application.specifier]?.[plan.application.export];if(typeof start!=='function')error('E_MODULE_EXPORT',plan.application.export);await start({host,scope,surface:connection.surface,signal});if(signal.aborted)error('E_CANCELLED','Native startup cancelled');}
 starting=false;void connection.closed.then(notifyClosed,notifyClosed).catch(e=>console.error(e));return {dispose:stop};
 }catch(primary){starting=false;try{await stop();}catch(cleanup){throw new NativeStartupCleanupError([primary,cleanup],'Native startup and cleanup failed');}throw primary;}
}
