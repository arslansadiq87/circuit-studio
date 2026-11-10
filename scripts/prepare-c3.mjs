import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,flatten,join,weld,prune,meshopt,getBounds} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const doc=await io.read('artifacts/c3-source.glb'),scene=doc.getRoot().listScenes()[0];
// Direct XCAF export retains CAD axes but writes meters. Center on the PCB
// mid-plane and turn the board so USB points +Y, matching the official diagram.
const center=doc.createNode('C3 millimeters / PCB center / USB +Y').setScale([1000,1000,1000]).setTranslation([0,0,.8]).setRotation([0,0,1,0]);
for(const node of scene.listChildren()){scene.removeChild(node);center.addChild(node)}scene.addChild(center);
await doc.transform(dedup(),flatten(),join({keepNamed:false}),weld(),prune(),meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:12}));
await io.write('public/models/esp32-c3-zero.glb',doc);
const runtime=await io.read('public/models/esp32-c3-zero.glb'),bounds=getBounds(runtime.getRoot().listScenes()[0]);let triangles=0;
for(const mesh of runtime.getRoot().listMeshes())for(const p of mesh.listPrimitives())triangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3;
const metadata={boundsMm:bounds,dimensions:bounds.max.map((n,i)=>n-bounds.min[i]),triangles,materials:runtime.getRoot().listMaterials().length,bytes:(await fs.stat('public/models/esp32-c3-zero.glb')).size};
await fs.writeFile('artifacts/c3-runtime.json',JSON.stringify(metadata,null,2));console.log(metadata);
const cad=JSON.parse(await fs.readFile('artifacts/c3-cad.json','utf8'));
if(cad.sourceSha256!=='670a80bce24e2a33c418da38056006d08fbfd25365cd7e8358394e15cd9dfba9')throw new Error('Unreviewed C3 source: recheck mapping');
const holes=cad.pcbCylinders.filter(c=>Math.abs(c.radius-.45)<.00001&&Math.abs(c.axis[2])>.999&&c.boundsMm.size[2]>1.5&&Math.abs(c.boundsMm.size[0]-.9)<.00001);
if(holes.length!==18)throw new Error('Expected eighteen full plated header holes');
// Source is rotated 180 degrees from Waveshare's published top view. Order
// P1..P18 exactly as the manufacturer's diagram, not as the C6 Supermini.
const sourceRight=holes.filter(h=>h.boundsMm.min[0]>0).sort((a,b)=>a.boundsMm.min[1]-b.boundsMm.min[1]);
const sourceLeft=holes.filter(h=>h.boundsMm.max[0]<0).sort((a,b)=>b.boundsMm.min[1]-a.boundsMm.min[1]);
if(sourceRight.length!==9||sourceLeft.length!==9)throw new Error('Expected nine contacts on each side');
const labels=['5V','GND','3V3','GPIO0','GPIO1','GPIO2','GPIO3','GPIO4','GPIO5','GPIO6','GPIO7','GPIO8','GPIO9','GPIO10','GPIO18','GPIO19','GPIO20','GPIO21'];
const markings=['5V','GND','3V3','0','1','2','3','4','5','6','7','8','9','10','18','19','RX','TX'];
const pins=[...sourceRight,...sourceLeft].map((h,i)=>{
 const b=h.boundsMm,source=[(b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,0],side=i<9?'left':'right';
 // Top copper annulus: inner radius .45, outer radius .8. Use its inward
 // midpoint (.625 mm), keeping the anchor on metal rather than in the hole.
 const position=[-source[0]+(i<9?.625:-.625),-source[1],.8].map(n=>Number(n.toFixed(6))),gpio=labels[i].startsWith('GPIO')?Number(labels[i].slice(4)):undefined,functions=[],notes=[];
 if(gpio!==undefined){
  if(gpio<=4)functions.push(`ADC1_CH${gpio}`);if(gpio===5)functions.push('ADC2_CH0 (check driver support)');
  if(gpio===18)functions.push('USB D-');if(gpio===19)functions.push('USB D+');if(gpio===20)functions.push('UART0 RX');if(gpio===21)functions.push('UART0 TX');
  if(gpio>=4&&gpio<=7)functions.push(`JTAG ${['MTMS','MTDI','MTCK','MTDO'][gpio-4]}`);
  if([2,8,9].includes(gpio))notes.push('Strapping pin: external levels affect startup.');
  if(gpio===9)notes.push('Shared with the BOOT button.');if(gpio===10)notes.push('Shared with onboard WS2812 RGB LED data input.');
  if(gpio===18||gpio===19)notes.push('Shared with native USB Serial/JTAG; GPIO use can interrupt USB.');
 }
 return {id:`P${i+1}`,label:gpio===20?'RX / GPIO20':gpio===21?'TX / GPIO21':labels[i],silkscreen:markings[i],side,index:i<9?i:17-i,physicalPosition:i+1,electrical:gpio!==undefined?'bidirectional':i===1?'ground':i===2?'power-out':'power-in',voltage:gpio!==undefined||i===2?3.3:i===1?0:5,aliases:gpio!==undefined?[`GPIO${gpio}`,`IO${gpio}`,...(gpio===18?['USB D-']:gpio===19?['USB D+']:gpio===20?['RX','U0RXD']:gpio===21?['TX','U0TXD']:[])]:i===2?['3.3V']:[],functions,notes:notes.join(' '),localPosition:position,cadPosition:position,exitDirection:[0,0,1]};
});
const component={id:'esp32-c3-zero',modelId:'esp32-c3-zero',name:'ESP32-C3 Zero',position:[0,55,0],rotation:[0,0,0],pins,dimensions:metadata.dimensions,geometry:{kind:'model',quality:'detailed',modelFormat:'glb',modelAssetId:'esp32-c3-zero',modelUrl:'/models/esp32-c3-zero.glb',modelCenter:[0,0,0],origin:[0,0,0],calibrated:true,verified:true,geometryVerified:true,pinPositionsVerified:true,electricalMappingVerified:true,pinMappingVersion:1,pinToleranceMm:.02,modelSource:'Imported STEP CAD / Waveshare ESP32-C3-Zero',sourceFilename:'ESP32-C3_Zero.step',sourceSha256:cad.sourceSha256,triangleCount:metadata.triangles,meshCount:1,materialCount:metadata.materials}};
await fs.writeFile('src/data/esp32-c3-zero.json',JSON.stringify(component,null,2));
await fs.writeFile('public/models/esp32-c3-zero.manifest.json',JSON.stringify({sourceSha256:cad.sourceSha256,...metadata,component,sourceBoundsMm:cad.boundsMm,measuredHoles:holes,physicalHardwareVerified:false,verification:'18 contacts numbered using Waveshare official diagram and schematic; anchors measured on top copper annuli in supplied STEP. Original model has no fitted pin headers.',references:['https://docs.waveshare.com/ESP32-C3-Zero','https://files.waveshare.com/wiki/ESP32-C3-Zero/ESP32-C3-Zero-Sch-V2.pdf','https://documentation.espressif.com/esp32-c3_datasheet_en.html']},null,2));
console.log('Mapped',pins.length,'contacts');
