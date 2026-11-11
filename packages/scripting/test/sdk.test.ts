import {test,expect} from 'bun:test';
import {createGuestSdk} from '../src/index.js';
test('guest callbacks stay inside the SDK and JSX lists share keyed semantic updates',async()=>{
 const frames:string[]=[];let event:string|undefined,count=0;const sdk=createGuestSdk({invoke:async()=>null,subscribe:async()=>({next:async()=>undefined,cancel(){}}),openSurface:async()=>({render:value=>{frames.push(value);},nextEvent:async()=>event,dispose(){}})});
 const render=()=>sdk.ui.render(sdk.ui.h('column',{key:'root'},[sdk.ui.h('text',{key:'label'},count)],sdk.ui.h('button',{key:'button',label:'Increment',onActivate:async()=>{count++;await render();}})));
 await render();expect(frames[0]).not.toContain('onActivate');event=JSON.stringify({revision:0,sequence:1,key:'button',type:'activate'});await sdk.ui.update();expect(JSON.parse(frames[1]!).root.children[0].children[0].text).toBe('1');expect(JSON.parse(frames[1]!).revision).toBe(1);sdk.ui.dispose();
});
