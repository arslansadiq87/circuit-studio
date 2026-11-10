import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';

const source='Custom Components/ESP32Wroom.glb';
const bytes=await fs.readFile(source),hash=crypto.createHash('sha256').update(bytes).digest('hex');
if(hash!=='872bdd0ce72a66e2c4d7cce59642cfeb43f1bb5e3feb49ae1c7993776c085225')throw new Error('Different model: recheck the underside pin silkscreen before assigning electrical identities');
const manifest=JSON.parse(await fs.readFile('public/models/esp32-wroom.manifest.json','utf8'));
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(source);
const primitive=doc.getRoot().listMeshes()[0].listPrimitives()[7];
const values=primitive.getAttribute('POSITION').getArray(),indices=primitive.getIndices()?.getArray()??Array.from({length:values.length/3},(_,i)=>i);
const keys=new Map(),points=[],parents=[],vertexIds=[];
const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i]}return i};
const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parents[b]=a};
for(let i=0;i<values.length;i+=3){
 const [cx,cy,cz]=manifest.sourceCenterMeters;
 const point=[(values[i]-cx)*1000,-(values[i+2]-cz)*1000,(values[i+1]-cy)*1000];
 const key=point.map(v=>Math.round(v*10000)).join(',');let id=keys.get(key);
 if(id===undefined){id=points.length;keys.set(key,id);points.push(point);parents.push(id)}vertexIds.push(id);
}
for(let i=0;i<indices.length;i+=3){union(vertexIds[indices[i]],vertexIds[indices[i+1]]);union(vertexIds[indices[i]],vertexIds[indices[i+2]])}
const pieces=new Map();for(let i=0;i<points.length;i++){const root=find(i);if(!pieces.has(root))pieces.set(root,[]);pieces.get(root).push(points[i])}
const boxes=[...pieces.values()].map(points=>{const min=[0,1,2].map(axis=>Math.min(...points.map(p=>p[axis]))),max=[0,1,2].map(axis=>Math.max(...points.map(p=>p[axis])));return {min,max,size:max.map((v,i)=>v-min[i]),center:max.map((v,i)=>(v+min[i])/2)}});
const shafts=boxes.filter(b=>Math.abs(b.center[1])>11&&Math.abs(b.size[0]-.5)<.001&&Math.abs(b.size[1]-.5)<.001&&Math.abs(b.size[2]-6.2)<.001);
if(shafts.length!==38)throw new Error(`Expected 38 isolated metal header shafts; found ${shafts.length}`);
const left=shafts.filter(b=>b.center[1]>0).sort((a,b)=>b.center[0]-a.center[0]);
const right=shafts.filter(b=>b.center[1]<0).sort((a,b)=>a.center[0]-b.center[0]);
if(left.length!==19||right.length!==19)throw new Error('Expected two 19-contact rows');
for(const row of [left,right])for(let i=1;i<row.length;i++)if(Math.abs(Math.abs(row[i].center[0]-row[i-1].center[0])-2.54)>.0001)throw new Error('Unexpected header pitch');
const rounded=point=>point.map(v=>Number(v.toFixed(6)));
// Physical NodeMCU numbering runs from 3V3 to 5V, then CLK to the opposite GND.
// Cross-checked manually against all labels on the modeled underside, not inferred
// from the module's own 38-pad footprint or from the ESP32-S3 definition.
const labels=['3V3','EN','SVP','SVN','P34','P35','P32','P33','P25','P26','P27','P14','P12','GND','P13','SD2','SD3','CMD','5V','CLK','SD0','SD1','P15','P2','P0','P4','P16','P17','P5','P18','P19','GND','P21','RX','TX','P22','P23','GND'];
const pins=[...left,...right].map((box,index)=>({id:`P${index+1}`,physicalPosition:index+1,silkscreen:labels[index],side:index<19?'left':'right',index:index<19?index:37-index,localPosition:rounded([box.center[0],box.center[1],box.min[2]]),shaftBounds:{min:rounded(box.min),max:rounded(box.max)}}));
const result={version:1,sourceSha256:hash,boardMarking:'NodeMCU ESP-32S V1.1',verifiedDate:'2026-10-29',anchorSurface:'Centers of the 38 underside male header tips',pitchMm:2.54,rowSpacingMm:Number(Math.abs(left[0].center[1]-right[0].center[1]).toFixed(6)),pinPositionsVerified:true,electricalMappingVerified:true,electricalEvidence:'All modeled back-side silkscreen labels cross-checked with the classic ESP32 reference header table; board marking read directly from GLB.',references:['https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html','https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf'],silkscreenEvidence:'artifacts/esp32-wroom-silkscreen-verification.png',pins};
await fs.mkdir('src/data',{recursive:true});await fs.writeFile('src/data/esp32-wroom-anchors.json',JSON.stringify(result,null,2));
await fs.writeFile('public/models/esp32-wroom.pins.json',JSON.stringify(result,null,2));
await fs.writeFile('public/models/esp32-wroom.manifest.json',JSON.stringify({...manifest,pinPositionsVerified:true,electricalMappingVerified:true,pinCount:38,pinMappingFile:'/models/esp32-wroom.pins.json',boardMarking:result.boardMarking},null,2));
console.log(JSON.stringify({pins:pins.length,board:result.boardMarking,pitch:result.pitchMm,rowSpacing:result.rowSpacingMm,first:pins[0],last:pins.at(-1)},null,2));
