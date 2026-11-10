import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,flatten,join,weld,prune,meshopt,getBounds} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const doc=await io.read('artifacts/c6-source.glb'),scene=doc.getRoot().listScenes()[0];
// Direct XCAF export retains CAD axes but writes meters. Use the source PCB center.
const center=doc.createNode('C6 millimeters / PCB center').setScale([1000,1000,1000]).setTranslation([-9,-13,-.575]);
for(const node of scene.listChildren()){scene.removeChild(node);center.addChild(node)}scene.addChild(center);
await doc.transform(dedup(),flatten(),join({keepNamed:false}),weld(),prune(),meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:12}));
await io.write('public/models/esp32-c6-supermini.glb',doc);
const runtime=await io.read('public/models/esp32-c6-supermini.glb'),bounds=getBounds(runtime.getRoot().listScenes()[0]);let triangles=0;
for(const mesh of runtime.getRoot().listMeshes())for(const p of mesh.listPrimitives())triangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3;
const metadata={boundsMm:bounds,dimensions:bounds.max.map((n,i)=>n-bounds.min[i]),triangles,materials:runtime.getRoot().listMaterials().length,bytes:(await fs.stat('public/models/esp32-c6-supermini.glb')).size};
await fs.writeFile('artifacts/c6-runtime.json',JSON.stringify(metadata,null,2));console.log(metadata);
const cad=JSON.parse(await fs.readFile('artifacts/c6-cad.json','utf8'));
if(cad.sourceSha256!=='d9810a2aa01813701d7cf2bf6f06b5e51e5b7dc61a8628fadd68cd8553b4d6e1')throw new Error('Unreviewed C6 source: recheck all markings');
const local=p=>p.map((n,i)=>Number((n-[9,13,.575][i]).toFixed(6)));
const shafts=cad.solids.filter(s=>Math.abs(s.size[0]-.64)<.0001&&Math.abs(s.size[1]-.64)<.0001&&Math.abs(s.size[2]-11.6)<.0001);
if(shafts.length!==20)throw new Error('Expected twenty square header shafts');
const rows=[shafts.filter(s=>s.min[0]<9),shafts.filter(s=>s.min[0]>9)].map(row=>row.sort((a,b)=>a.min[1]-b.min[1]));
const marks=[['5V','GND','3V3','20','19','18','15','14','9','8'],['TX','RX','0','1','2','3','4','5','6','7']];
function electrical(mark){
 const gpio=mark==='TX'?16:mark==='RX'?17:/^\d+$/.test(mark)?Number(mark):undefined;
 if(gpio===undefined)return {label:mark,electrical:mark==='GND'?'ground':'power-in',voltage:mark==='GND'?0:mark==='3V3'?3.3:5,aliases:mark==='3V3'?['3.3V']:[]};
 const functions=[];if(gpio<=6)functions.push(`ADC1_CH${gpio}`);if(gpio===16)functions.push('UART0 TX');if(gpio===17)functions.push('UART0 RX');if(gpio===12)functions.push('USB D-');if(gpio===13)functions.push('USB D+');if(gpio===6)functions.push('JTAG MTCK','LP I2C SDA');if(gpio===7)functions.push('JTAG MTDO','LP I2C SCL');if(gpio===4)functions.push('JTAG MTMS','LP UART RX');if(gpio===5)functions.push('JTAG MTDI','LP UART TX');
 const notes=[];if([4,5,8,9,15].includes(gpio))notes.push('Strapping pin: external levels affect startup.');if(gpio===9)notes.push('GPIO9 participates in boot-mode selection.');if(gpio===12||gpio===13)notes.push('Shared with native USB Serial/JTAG; GPIO use can interrupt USB.');
 return {label:mark==='TX'||mark==='RX'?`${mark} / GPIO${gpio}`:`GPIO${gpio}`,electrical:'bidirectional',voltage:3.3,aliases:[`GPIO${gpio}`,`IO${gpio}`,...(gpio===16?['TX','U0TXD']:gpio===17?['RX','U0RXD']:[])],functions,notes:notes.join(' ')};
}
const pins=[];
rows.forEach((row,r)=>{if(row.length!==10)throw new Error('Expected ten pins per row');row.forEach((s,i)=>{if(i&&Math.abs(s.min[1]-row[i-1].min[1]-2.54)>.0001)throw new Error('Unexpected pin pitch');const position=local([(s.min[0]+s.max[0])/2,(s.min[1]+s.max[1])/2,s.min[2]]),mark=marks[r][i];pins.push({id:`J${r+1}-${i+1}`,silkscreen:mark,side:r?'right':'left',index:i,physicalPosition:i+1,...electrical(mark),localPosition:position,cadPosition:position,exitDirection:[0,0,-1]})})});
// Five circular plated solder holes. Wire on the top annular copper rather than
// the empty center; radius .5355 is halfway between .473 inner and .598 outer.
const holes=cad.pcbCylinders.filter(c=>Math.abs(c.radius-.473)<.0001&&c.boundsMm.size[2]>1.16&&c.boundsMm.min[0]>2&&c.boundsMm.max[0]<16).sort((a,b)=>a.boundsMm.min[0]-b.boundsMm.min[0]||a.boundsMm.min[1]-b.boundsMm.min[1]);
if(holes.length!==5)throw new Error('Expected five interior GPIO solder holes');
const padMarks=['12','13','21','22','23'];
holes.forEach((h,i)=>{const b=h.boundsMm,center=[(b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,b.max[2]],position=local([center[0]+.5355,center[1],center[2]]);pins.push({id:`PAD-GPIO${padMarks[i]}`,silkscreen:padMarks[i],side:'top',index:i,...electrical(padMarks[i]),localPosition:position,cadPosition:position,exitDirection:[0,0,1],notes:`${electrical(padMarks[i]).notes??''} Top annular solder pad; not a header pin.`.trim()})});
const battery=cad.batteryPlaneCandidates.filter(p=>Math.abs(p.center[2]+.01)<.0001).sort((a,b)=>a.center[0]-b.center[0]);if(battery.length!==2)throw new Error('Expected B+ / B- underside pads');
battery.forEach((p,i)=>{const position=local(p.center);pins.push({id:i?'B-':'B+',label:i?'Battery -':'Battery +',silkscreen:i?'B-':'B+',side:'bottom',index:i,electrical:i?'power-return':'power-in',localPosition:position,cadPosition:position,exitDirection:[0,0,-1],notes:'Underside battery solder pad. Label verified from CAD; battery operating limits are not established by the STEP model.'})});
const component={id:'esp32-c6-supermini',modelId:'esp32-c6-supermini',name:'ESP32-C6 Supermini',position:[0,55,0],rotation:[0,0,0],pins,dimensions:metadata.dimensions,geometry:{kind:'model',quality:'detailed',modelFormat:'glb',modelAssetId:'esp32-c6-supermini',modelUrl:'/models/esp32-c6-supermini.glb',modelCenter:[0,0,0],origin:[0,0,0],calibrated:true,verified:true,geometryVerified:true,pinPositionsVerified:true,electricalMappingVerified:true,pinMappingVersion:1,pinToleranceMm:.02,modelSource:'Imported STEP CAD / Tenstar C6 Supermini',sourceFilename:'ESP32 C6 Supermini.step',sourceSha256:cad.sourceSha256,triangleCount:metadata.triangles,meshCount:1,materialCount:metadata.materials}};
await fs.writeFile('src/data/esp32-c6-supermini.json',JSON.stringify(component,null,2));
await fs.writeFile('public/models/esp32-c6-supermini.manifest.json',JSON.stringify({sourceSha256:cad.sourceSha256,...metadata,component,sourceBoundsMm:cad.boundsMm,headerShafts:shafts,interiorHoles:holes,batteryPads:battery,physicalHardwareVerified:false,verification:'27 CAD-labeled contacts: 20 header tips, 5 annular GPIO solder pads, 2 underside battery pads. GPIO capabilities cross-checked against Espressif ESP32-C6 datasheet. Board continuity and battery limits not independently tested.',reference:'https://documentation.espressif.com/esp32-c6_dataSheet_en.pdf'},null,2));
console.log('Mapped',pins.length,'contacts');
