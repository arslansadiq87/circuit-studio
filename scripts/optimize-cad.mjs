// Offline only. Never overwrite the STEP or the original GLB.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,flatten,join,weld,simplify,prune,meshopt,getBounds} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder,MeshoptSimplifier} from 'meshoptimizer';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const master='public/models/yd-esp32-s3-v34.glb';
const bytes=await fs.readFile(master),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
function stats(doc){let triangles=0,vertices=0,primitives=0;for(const m of doc.getRoot().listMeshes())for(const p of m.listPrimitives()){primitives++;vertices+=p.getAttribute('POSITION').getCount();triangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3}return {meshes:doc.getRoot().listMeshes().length,primitives,triangles,vertices,materials:doc.getRoot().listMaterials().length,textures:doc.getRoot().listTextures().length,bounds:getBounds(doc.getRoot().listScenes()[0])}}
const original=await io.read(master);const report={version:1,source:master,sourceSha256:sha256,original:{bytes:bytes.length,...stats(original)},levels:{},method:'glTF Transform: dedup, weld, error-bounded simplification, flatten, material join, meshopt compression. No recentering or scaling; same master origin in every LOD.'};
for(const [level,ratio,error] of [['high',1,0],['medium',.24,.0005],['low',.07,.002]]){
 const doc=await io.read(master);
 // Joining before simplification lets curved CAD faces simplify across their
 // original face primitive boundaries, while keeping material and hard-normal seams.
 await doc.transform(dedup(),flatten(),join({keepNamed:false,keepMeshes:false}),weld());
 if(ratio<1)await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio,error,lockBorder:true}));
 await doc.transform(dedup(),prune());
 // High preserves full original topology; 16-bit position quantization error is <.002mm.
 await doc.transform(meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:12}));
 const path=`public/models/yd-esp32-s3-v34-${level}.glb`;await io.write(path,doc);
 const decoded=await io.read(path);report.levels[level]={path,bytes:(await fs.stat(path)).size,ratio,error,...stats(decoded)};
 console.log(level,JSON.stringify(report.levels[level]));
}
if(crypto.createHash('sha256').update(await fs.readFile(master)).digest('hex')!==sha256)throw new Error('Master changed');
await fs.writeFile('public/models/yd-esp32-s3-v34.optimization.json',JSON.stringify(report,null,2));
