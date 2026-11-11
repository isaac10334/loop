/** Bounded diagnostic text for trusted host failures, including nested cleanup errors. */
export function failureCode(value:unknown):string {
 try{const code=(value as {code?:unknown}|null)?.code;return typeof code==='string'&&code.length>0&&code.length<=128?code:'E_RUNTIME';}catch{return 'E_RUNTIME';}
}
/** Mark a promise handled immediately without changing the result observed by a later await. */
export function guardRejection<T>(promise:Promise<T>):Promise<T>{void promise.catch(()=>{});return promise;}
export function describeFailure(value:unknown):string {
 try{if(!(value instanceof AggregateError))return String((value as {message?:unknown}|null)?.message??value).slice(0,65536);}catch{return '[unprintable error]';}
 const seen=new Set<object>();
 function visit(error:unknown,depth:number,budget:number):string {
  if(budget<=0)return '';
  try{
   if(!(error instanceof AggregateError))return String((error as {message?:unknown}|null)?.message??error).slice(0,Math.min(budget,1024));
   if(seen.has(error))return '[repeated aggregate]'.slice(0,budget);seen.add(error);
   const head=String(error.message??error).slice(0,Math.min(budget,1024));
   if(depth>=4)return (head+' [nested errors omitted]').slice(0,budget);
   const children=error.errors;if(!Array.isArray(children)||children.length===0)return head;
   const selected=children.slice(0,8),suffix=children.length>8?'; additional errors omitted':'',overhead=3+2*(selected.length-1)+suffix.length;
   if(budget<=overhead)return head.slice(0,budget);
   // Reserve a fair share for each sibling so a huge primary cannot hide cleanup.
   const prefix=head.slice(0,Math.max(0,budget-overhead-selected.length));
   const available=Math.max(0,budget-prefix.length-overhead),share=Math.floor(available/selected.length),remainder=available%selected.length;
   const detail=selected.map((child,index)=>visit(child,depth+1,share+(index<remainder?1:0))).join('; ');
   return prefix+' ['+detail+suffix+']';
  }catch{return '[unprintable error]'.slice(0,budget);}
 }
 return visit(value,0,8192);
}
