/** Bounded joining of an owned native backend; a deadline never implies termination. */
type Child={stdin:{end():unknown};kill():unknown;exited:Promise<number>;exitCode:number|null};
type Outcome<T>={kind:'fulfilled';value:T}|{kind:'rejected';error:unknown}|{kind:'timeout'};
const coded=(code:string,message:string)=>Object.assign(new Error(message),{code});
async function within<T>(promise:Promise<T>,ms:number):Promise<Outcome<T>>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([promise.then(value=>({kind:'fulfilled' as const,value}),error=>({kind:'rejected' as const,error})),new Promise<{kind:'timeout'}>(resolve=>{timer=setTimeout(()=>resolve({kind:'timeout'}),ms);})]);}
 finally{if(timer)clearTimeout(timer);}
}
export async function closeNativeProcess(child:Child,reader:Promise<void>|undefined,deadlineMs=5000):Promise<void>{
 const errors:unknown[]=[];let forced=false;
 try{child.stdin.end();}catch(error){errors.push(error);forced=true;}
 let exit:Outcome<number>|undefined;
 if(!forced){exit=await within(child.exited,deadlineMs);if(exit.kind==='timeout')forced=true;else if(exit.kind==='rejected'){errors.push(exit.error);forced=true;}}
 if(forced){
  try{child.kill();}catch(error){errors.push(error);}
  exit=await within(child.exited,deadlineMs);
  if(exit.kind==='timeout')errors.push(coded('E_RUNTIME_FORCED_STOP','Native backend did not exit after forced stop; cleanup incomplete'));
  else if(exit.kind==='rejected')errors.push(exit.error);
  else errors.push(coded('E_RUNTIME_FORCED_STOP','Native backend exceeded graceful deadline or stdin close failed; cleanup incomplete'));
 }
 if(exit?.kind==='fulfilled'){
  if(!forced&&exit.value!==0)errors.push(coded('E_RUNTIME_EXIT',`Native backend exited ${exit.value}`));
  if(reader){const drained=await within(reader,deadlineMs);if(drained.kind==='timeout')errors.push(coded('E_RUNTIME_PIPE_TIMEOUT','Native backend stdout did not close; cleanup incomplete'));else if(drained.kind==='rejected')errors.push(drained.error);}
 }
 if(errors.length===1)throw errors[0];
 if(errors.length)throw new AggregateError(errors,'Native backend cleanup incomplete');
}
