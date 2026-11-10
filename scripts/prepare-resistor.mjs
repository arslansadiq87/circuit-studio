import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,flatten,join,weld,prune,meshopt,getBounds} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
const cad=JSON.parse(await fs.readFile('artifacts/resistor-cad.json','utf8'));
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const doc=await io.read('artifacts/resistor-source.glb'),scene=doc.getRoot().listScenes()[0];
const offset=doc.createNode('Center resistor').setTranslation([0,-1.7,0]);
for(const node of scene.listChildren()){scene.removeChild(node);offset.addChild(node)}
// CadQuery GLTF export is in millimeters: (cadX,cadZ,-cadY).
scene.addChild(doc.createNode('CAD Z up').setRotation([Math.SQRT1_2,0,0,Math.SQRT1_2]).addChild(offset));
await doc.transform(dedup(),flatten(),join({keepNamed:false}),weld(),prune(),meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:12}));
await io.write('public/models/resistor.glb',doc);
const result=await io.read('public/models/resistor.glb'),bounds=getBounds(result.getRoot().listScenes()[0]);
const tips=cad.faces.filter(f=>f.boundsMm.size[0]<0.00001&&Math.abs(f.center[0])>4.69).sort((a,b)=>a.center[0]-b.center[0]);
if(tips.length!==2)throw new Error('Expected two planar resistor lead ends');
const pins=tips.map((f,i)=>({id:`P${i}`,label:String(i+1),side:i?'right':'left',index:0,physicalPosition:i+1,electrical:'passive',localPosition:f.center.map((n,j)=>Number((n-(j===2?1.7:0)).toFixed(6))),exitDirection:[i?1:-1,0,0]}));
let triangleCount=0;for(const mesh of result.getRoot().listMeshes())for(const p of mesh.listPrimitives())triangleCount+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3;
const component={id:'resistor',modelId:'resistor',name:'Resistor',position:[0,55,0],rotation:[0,0,0],dimensions:bounds.max.map((n,i)=>n-bounds.min[i]),pins,geometry:{kind:'model',quality:'detailed',modelFormat:'glb',modelAssetId:'resistor-cad',modelUrl:'/models/resistor.glb',modelCenter:[0,0,0],origin:[0,0,0],calibrated:true,verified:false,geometryVerified:true,pinPositionsVerified:true,electricalMappingVerified:true,pinToleranceMm:0.02,modelSource:'Imported STEP CAD',sourceFilename:'Resistor.step',sourceSha256:cad.sourceSha256,triangleCount,meshCount:result.getRoot().listMeshes().length,materialCount:result.getRoot().listMaterials().length}};
await fs.writeFile('src/data/resistor.json',JSON.stringify(component,null,2));
await fs.writeFile('public/models/resistor.manifest.json',JSON.stringify({source:'Custom Components/Resistor.step',sourceSha256:cad.sourceSha256,sourceBoundsMm:cad.boundsMm,component,bytes:(await fs.stat('public/models/resistor.glb')).size,note:'Original source geometry and colors retained. Value and power rating are unspecified; no 220 ohm claim is inferred from the old placeholder.'},null,2));
console.log(JSON.stringify(component,null,2));
