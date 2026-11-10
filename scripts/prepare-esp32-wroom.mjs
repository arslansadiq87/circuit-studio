import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,flatten,join,weld,prune,metalRough,meshopt,getBounds} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';

const source='Custom Components/ESP32Wroom.glb',output='public/models/esp32-wroom.glb';
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const bytes=await fs.readFile(source),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const doc=await io.read(source),scene=doc.getRoot().listScenes()[0],bounds=getBounds(scene);
const center=bounds.min.map((n,i)=>(n+bounds.max[i])/2),roots=scene.listChildren();
const offset=doc.createNode('Source center').setTranslation(center.map(n=>-n));
for(const node of roots){scene.removeChild(node);offset.addChild(node)}
// glTF uses meters and Y up. The editor uses millimeters and a Z-up board plane.
const orientation=doc.createNode('ESP32 WROOM millimeters').setScale([1000,1000,1000]).setRotation([Math.SQRT1_2,0,0,Math.SQRT1_2]);
orientation.addChild(offset);scene.addChild(orientation);
await doc.transform(metalRough(),dedup(),flatten(),join({keepNamed:false}),weld(),prune(),meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:12}));
await io.write(output,doc);
const result=await io.read(output),runtimeBounds=getBounds(result.getRoot().listScenes()[0]);let triangles=0,vertices=0,primitives=0;
for(const mesh of result.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){primitives++;vertices+=primitive.getAttribute('POSITION').getCount();triangles+=(primitive.getIndices()?.getCount()??primitive.getAttribute('POSITION').getCount())/3}
const manifest={version:1,name:'ESP32 WROOM',source,sourceSha256:sha256,sourceBytes:bytes.length,sourceBoundsMeters:bounds,sourceCenterMeters:center,output,bytes:(await fs.stat(output)).size,dimensionsMm:runtimeBounds.max.map((n,i)=>n-runtimeBounds.min[i]),boundsMm:runtimeBounds,triangles,vertices,meshes:result.getRoot().listMeshes().length,primitives,materials:result.getRoot().listMaterials().length,textures:result.getRoot().listTextures().length,method:'Preserve all source triangles; convert specular/glossiness to core PBR, center, meters to millimeters, rotate Y-up to Z-up, weld/deduplicate and meshopt compress.',physicalDimensionsVerified:false,pinPositionsVerified:false,electricalMappingVerified:false};
if(crypto.createHash('sha256').update(await fs.readFile(source)).digest('hex')!==sha256)throw new Error('Source model changed');
await fs.writeFile('public/models/esp32-wroom.manifest.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest,null,2));
// Recompute measured anchors and restore the verified mapping manifest when
// rebuilding this known source. The verifier refuses an unreviewed source hash.
await import('./verify-esp32-wroom-pins.mjs');
