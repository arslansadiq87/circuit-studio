import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,flatten,join,weld,prune,meshopt,getBounds} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';

await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const specs=[
 {slug:'stepper-24byj-48',name:'24BYJ-48 stepper motor',source:'stepper 24BYJ-48 .STEP',shaftUp:true},
 {slug:'dvr8825',name:'DVR8825 stepper driver module',source:'DVR8825.stp',shaftUp:false},
 {slug:'sonoff-cam-s3w',name:'Sonoff CAM-S3W camera',source:'sonoff-cam-s3w.step',shaftUp:false},
];
const round=n=>Number(n.toFixed(6));
const center=s=>s.min.map((n,i)=>(n+s.max[i])/2);
function removeDriverHeatSink(doc){
 let removed=0;
 for(const mesh of doc.getRoot().listMeshes())for(const primitive of [...mesh.listPrimitives()]){
  const a=primitive.getAttribute('POSITION'),min=a.getMin([]).map(n=>n*1000),max=a.getMax([]).map(n=>n*1000);
  if(min[0]>21&&min[1]>22&&max[0]<31&&max[1]<32){mesh.removePrimitive(primitive);removed++}
 }
 if(!removed)throw new Error('Expected isolated 9 × 9 mm driver heat sink');
 return removed;
}
function colorUnstyledDriver(doc){
 if(doc.getRoot().listMaterials().length) return 'STEP';
 const material=(name,rgb,metallic=0)=>doc.createMaterial(name).setBaseColorFactor([...rgb,1]).setMetallicFactor(metallic).setRoughnessFactor(metallic?.32:.78);
 const purple=material('Driver PCB · inferred purple',[.036,.014,.078]),black=material('Driver IC and headers · inferred black',[.055,.06,.08]),metal=material('Driver contacts · inferred metal',[.69,.72,.75],.75),mark=material('Driver markings · inferred light',[.82,.84,.86]);
 for(const mesh of doc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
  const a=primitive.getAttribute('POSITION'),min=a.getMin([]).map(n=>n*1000),max=a.getMax([]).map(n=>n*1000),size=max.map((n,i)=>n-min[i]);
  const m=min[2]<6.2&&max[2]>6.2?metal:max[2]<6.5?metal:max[2]<9.5?black:size[0]>12&&size[1]>9?purple:max[2]>10&&size[0]<1.5&&size[1]<1.5?mark:black;
  primitive.setMaterial(m);
 }
 return 'inferred component palette (source STEP has no colors)';
}
for(const spec of specs){
 const cad=JSON.parse(await fs.readFile(`artifacts/${spec.slug}-cad.json`,'utf8'));
 const doc=await io.read(`artifacts/${spec.slug}-source.glb`),scene=doc.getRoot().listScenes()[0];
 const removedHeatSinkFaces=spec.slug==='dvr8825'?removeDriverHeatSink(doc):0;
 const colorSource=spec.slug==='dvr8825'?colorUnstyledDriver(doc):'STEP XCAF colors';
 const transform=doc.createNode('STEP metres to app millimetres').setScale([1000,1000,1000]);
 if(spec.shaftUp)transform.setRotation([Math.SQRT1_2,0,0,Math.SQRT1_2]);
 for(const node of scene.listChildren()){scene.removeChild(node);transform.addChild(node)}scene.addChild(transform);
 await doc.transform(dedup(),flatten(),join({keepNamed:false}),weld(),prune(),meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:12}));
 await io.write(`public/models/${spec.slug}.glb`,doc);
 const runtime=await io.read(`public/models/${spec.slug}.glb`),bounds=getBounds(runtime.getRoot().listScenes()[0]);
 if(spec.slug==='dvr8825'&&(bounds.max[0]>20.3||bounds.max[1]>15.1))throw new Error('Driver heat sink remains in exported bounds');
 const modelCenter=bounds.min.map((n,i)=>round((n+bounds.max[i])/2));
 const origin=[0,0,round(bounds.min[2]-modelCenter[2])];
 const toLocal=p=>{const q=spec.shaftUp?[p[0],-p[2],p[1]]:p;return q.map((n,i)=>round(n-modelCenter[i]-origin[i]))};
 let pins=[];
 if(spec.slug==='stepper-24byj-48'){
  const contacts=cad.solids.filter(s=>Math.abs(s.boundsMm.size[0]-1.4)<.01&&Math.abs(s.boundsMm.size[1]-1.4)<.01&&Math.abs(s.boundsMm.size[2]-4)<.01).sort((a,b)=>a.boundsMm.min[0]-b.boundsMm.min[0]);
  if(contacts.length!==5||contacts.some(s=>Math.abs(s.boundsMm.max[2]-20.52)>.01))throw new Error('Stepper connector geometry changed');
  const tipFaces=cad.faces.filter(f=>f.type==='PLANE'&&Math.abs(f.center[2]-20.52)<.001&&Math.abs(f.area-1.53938)<.01);
  if(tipFaces.length!==5)throw new Error('Expected five planar stepper contact end faces');
  pins=contacts.map((s,i)=>{const b=s.boundsMm,p=[round((b.min[0]+b.max[0])/2),round((b.min[1]+b.max[1])/2),b.max[2]];return {id:`J1-${i+1}`,label:`Contact ${i+1}`,side:'top',index:i,physicalPosition:i+1,electrical:'passive',localPosition:toLocal(p),cadPosition:p,exitDirection:[0,-1,0],notes:'Calibrated to the exposed end of connector contact; winding/common assignment is not identified in STEP.'}});
 }
 if(spec.slug==='dvr8825'){
  const contacts=cad.solids.filter(s=>{const b=s.boundsMm;return Math.abs(b.size[0]-.64)<.01&&Math.abs(b.size[1]-.64)<.01&&b.size[2]>10});
  if(contacts.length!==16)throw new Error('Expected 16 driver header pins');
  const tipFaces=cad.faces.filter(f=>f.type==='PLANE'&&Math.abs(f.center[2]-.156379)<.001&&Math.abs(f.area-.0576)<.001);
  if(tipFaces.length!==16)throw new Error('Expected 16 planar driver header end faces');
  for(const [row,y] of [['J1',1.27],['J2',13.73]]){
   const side=contacts.filter(s=>Math.abs((s.boundsMm.min[1]+s.boundsMm.max[1])/2-y)<.01).sort((a,b)=>a.boundsMm.min[0]-b.boundsMm.min[0]);
   if(side.length!==8||side.some((s,i)=>Math.abs((s.boundsMm.min[0]+s.boundsMm.max[0])/2-(1.17+2.54*i))>.01))throw new Error(`Driver ${row} pitch changed`);
   side.forEach((s,i)=>{const b=s.boundsMm,p=[round((b.min[0]+b.max[0])/2),round((b.min[1]+b.max[1])/2),b.min[2]];pins.push({id:`${row}-${i+1}`,label:`${row}-${i+1}`,side:row==='J1'?'left':'right',index:i,physicalPosition:i+1,electrical:'passive',localPosition:toLocal(p),cadPosition:p,exitDirection:[0,0,-1],notes:'Header tip measured from STEP. Signal name is not established by this CAD file.'})});
  }
 }
 let triangleCount=0;for(const mesh of runtime.getRoot().listMeshes())for(const primitive of mesh.listPrimitives())triangleCount+=(primitive.getIndices()?.getCount()??primitive.getAttribute('POSITION').getCount())/3;
 const component={id:spec.slug,modelId:spec.slug,name:spec.name,position:[0,55,0],rotation:[0,0,0],dimensions:bounds.max.map((n,i)=>round(n-bounds.min[i])),pins,geometry:{kind:'model',quality:'detailed',modelFormat:'glb',modelAssetId:`${spec.slug}-cad`,modelUrl:`/models/${spec.slug}.glb?v=${spec.slug==='dvr8825'?'no-heatsink-1':'colors-1'}`,modelCenter,origin,calibrated:true,verified:spec.slug==='sonoff-cam-s3w',geometryVerified:true,pinPositionsVerified:spec.slug!=='sonoff-cam-s3w',electricalMappingVerified:false,pinToleranceMm:.05,modelSource:'Imported STEP CAD',sourceFilename:spec.source,sourceSha256:cad.sourceSha256,triangleCount,meshCount:runtime.getRoot().listMeshes().length,materialCount:runtime.getRoot().listMaterials().length}};
 await fs.writeFile(`src/data/${spec.slug}.json`,JSON.stringify(component,null,2));
 await fs.writeFile(`public/models/${spec.slug}.manifest.json`,JSON.stringify({source:cad.source,sourceSha256:cad.sourceSha256,sourceBoundsMm:cad.boundsMm,colorSource,removedHeatSinkFaces,component,bytes:(await fs.stat(`public/models/${spec.slug}.glb`)).size,note:spec.slug==='sonoff-cam-s3w'?'Placeable visual model; no wire pins by request.':'Physical contact positions calibrated from STEP; electrical signal mapping not supplied by CAD.'},null,2));
 console.log(spec.slug,component.dimensions,pins.length,'pins',triangleCount,'triangles');
}
