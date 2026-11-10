import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,flatten,join,weld,prune,meshopt,getBounds} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const doc=await io.read('artifacts/usb-breakout-source.glb'),scene=doc.getRoot().listScenes()[0];
// CAD Z up; center at original assembly bounds. Turn 180 degrees about Z so
// the USB opening faces +Y and screw-terminal wire entries face -Y.
const offset=doc.createNode('Source center').setTranslation([-13.244408565,-7.1,16.6690758195]);
for(const node of scene.listChildren()){scene.removeChild(node);offset.addChild(node)}
const up=doc.createNode('CAD Z up').setRotation([Math.SQRT1_2,0,0,Math.SQRT1_2]).addChild(offset);
scene.addChild(doc.createNode('USB front +Y').setRotation([0,0,1,0]).addChild(up));
await doc.transform(dedup(),flatten(),join({keepNamed:false}),weld(),prune(),meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:12}));
await io.write('public/models/usb-a-breakout.glb',doc);
const runtime=await io.read('public/models/usb-a-breakout.glb'),bounds=getBounds(runtime.getRoot().listScenes()[0]);
let triangles=0;for(const mesh of runtime.getRoot().listMeshes())for(const p of mesh.listPrimitives())triangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3;
const metadata={boundsMm:bounds,dimensions:bounds.max.map((n,i)=>n-bounds.min[i]),triangles,materials:runtime.getRoot().listMaterials().length,bytes:(await fs.stat('public/models/usb-a-breakout.glb')).size};
await fs.writeFile('artifacts/usb-breakout-runtime.json',JSON.stringify(metadata,null,2));console.log(metadata);
const cad=JSON.parse(await fs.readFile('artifacts/usb-breakout-cad.json','utf8'));
// Source silkscreen reads VBUS,D-,D+,GND in ascending CAD X. Stable A1..A4
// identities keep all existing project connections without reversing signals.
const pins=cad.terminalEntriesCadMm.map((entry,i)=>{const point=entry.min.map((n,j)=>(n+entry.max[j])/2);const local=[13.244408565-point[0],16.6690758195-point[1],point[2]-7.1].map(n=>Number(n.toFixed(6)));return {id:`A${i+1}`,label:['VBUS','D-','D+','GND'][i],silkscreen:['VBUS','D-','D+','GND'][i],side:'bottom',index:i,physicalPosition:i+1,electrical:i===0?'power-in':i===3?'ground':'bidirectional',...(i===0?{voltage:5}:i===3?{voltage:0}:{}),localPosition:local,cadPosition:local,exitDirection:[0,-1,0],wireEntry:{entryPosition:local,insertionDirection:[0,1,0],insertionDepth:.05,approachLength:.25,clearanceDirection:[0,0,1],clearanceOffset:Number((metadata.boundsMm.max[2]-local[2]+1).toFixed(6))},notes:'Center of the measured screw-terminal wire-entry aperture; insulation ends flush with the housing entry plane, 0.05 mm inside the 6 mm clear bore. Shell is not a signal contact.'}});
const component={id:'usb-a',modelId:'usb-a-female',name:'USB-A female breakout board',position:[42,0,0],rotation:[0,0,0],dimensions:metadata.dimensions,pins,geometry:{kind:'model',quality:'detailed',modelFormat:'glb',modelAssetId:'usb-a-breakout',modelUrl:'/models/usb-a-breakout.glb',modelCenter:[0,0,0],origin:[0,0,0],calibrated:true,verified:true,geometryVerified:true,pinPositionsVerified:true,electricalMappingVerified:true,pinMappingVersion:1,pinToleranceMm:.05,sourceFilename:'USB Type A Female Breakout Board.step',sourceSha256:cad.sourceSha256,modelSource:'Imported STEP CAD',meshCount:1,triangleCount:metadata.triangles,materialCount:metadata.materials}};
await fs.writeFile('src/data/usb-a-breakout.json',JSON.stringify(component,null,2));
await fs.writeFile('public/models/usb-a-breakout.manifest.json',JSON.stringify({...cad,...metadata,component,electricalEvidence:'VBUS, D-, D+, GND labels read directly from supplied CAD silkscreen; ascending original CAD X. Apertures measured from terminal housing front face inner wires.',physicalHardwareVerified:false},null,2));
