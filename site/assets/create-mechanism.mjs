/** Reproducible VectorCraft command recipe: one editable 18-tooth graphic gear. */
import { writeFileSync } from 'node:fs';
const anchors=[];
for(let tooth=0;tooth<18;tooth++) for(const [fraction,radius] of [[0,61],[.18,61],[.30,70],[.64,70],[.76,61]]) {
 const a=(tooth+fraction)*Math.PI*2/18;
 anchors.push({x:+(80+Math.cos(a)*radius).toFixed(4),y:+(80+Math.sin(a)*radius).toFixed(4)});
}
const steps=[
 {command:'file.new',params:{title:'Loop kinetic gear',width:160,height:160,units:'Pixels',backgroundContents:'transparent',colorMode:'rgb'}},
 {command:'path.create',params:{anchors,closed:true}},
 {command:'paint.setFill',params:{color:'#182634'}},
 {command:'paint.setStroke',params:{color:'#8acbfa'}},
 {command:'shape.ellipse',params:{x:33,y:33,width:94,height:94}},
 {command:'paint.setFill',params:{color:'#101923'}},
 {command:'paint.setStroke',params:{color:'#3f627a'}},
 {command:'shape.ellipse',params:{x:64,y:64,width:32,height:32}},
 {command:'paint.setFill',params:{color:'#8acbfa'}},
 {command:'paint.setStroke',params:{none:true}},
];
for(let i=0;i<6;i++) { const a=i*Math.PI/3; steps.push(
 {command:'shape.ellipse',params:{x:76+Math.cos(a)*33,y:76+Math.sin(a)*33,width:8,height:8}},
 {command:'paint.setFill',params:{color:'#080c12'}},
 {command:'paint.setStroke',params:{color:'#3f627a'}}
); }
steps.push({command:'document.save',params:{path:'site/assets/kinetic-gear.vectorcraft',pdfCompatible:false}},
 {command:'document.export',params:{path:'site/assets/kinetic-gear.svg',format:'svg'}},
 {command:'document.export',params:{path:'target/kinetic-gear-preview.png',format:'png',scale:3}});
writeFileSync('site/assets/kinetic-gear.commands.json',JSON.stringify(steps,null,2)+'\n');
