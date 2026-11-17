import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,flatten,join,weld,simplify,prune,meshopt,getBounds,textureCompress} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder,MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';import fs from 'node:fs/promises';import crypto from 'node:crypto';
const source='Custom Components/arduino-uno/source/Arduino UNO sketchfab.glb',output='public/models/arduino-uno-r3.glb';
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
function stats(doc){let triangles=0,primitives=0,vertices=0,sceneTriangles=0,sceneDrawCalls=0,sceneMeshInstances=0;for(const m of doc.getRoot().listMeshes())for(const p of m.listPrimitives()){primitives++;vertices+=p.getAttribute('POSITION')?.getCount()??0;triangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION')?.getCount()??0)/3}const visit=node=>{const mesh=node.getMesh();if(mesh){sceneMeshInstances++;for(const p of mesh.listPrimitives()){sceneDrawCalls++;sceneTriangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION')?.getCount()??0)/3}}for(const child of node.listChildren())visit(child)};for(const node of doc.getRoot().listScenes()[0].listChildren())visit(node);return{meshes:doc.getRoot().listMeshes().length,primitives,triangles,vertices,materials:doc.getRoot().listMaterials().length,textures:doc.getRoot().listTextures().length,sceneMeshInstances,sceneDrawCalls,sceneTriangles,bounds:getBounds(doc.getRoot().listScenes()[0])}}
const input=await fs.readFile(source),doc=await io.read(source),original=stats(doc);
await doc.transform(dedup(),weld());
await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio:.6,error:.0005,lockBorder:true}));
// Keep the imported node transforms intact; the runtime applies the metre-to-mm unit scale.
await doc.transform(dedup(),join({keepNamed:false,keepMeshes:false}),weld(),dedup(),prune());
// 4096 diffuse maps keep all native pixels and UVs; roughness maps can use half scale.
await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',quality:92,effort:6,pattern:/roughness/i,resize:[1024,1024]}));
await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',quality:90,effort:6,pattern:/diffuse/i}));
await doc.transform(meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:12}));
await io.write(output,doc);const done=await io.read(output),final=stats(done),bytes=(await fs.stat(output)).size;
const textureFormats=[];for(const t of done.getRoot().listTextures()){let md=await sharp(t.getImage()).metadata();textureFormats.push({name:t.getName(),mimeType:t.getMimeType(),bytes:t.getImage().byteLength,resolution:`${md.width}x${md.height}`})}
const report={source,sourceSha256:crypto.createHash('sha256').update(input).digest('hex'),sourceBytes:input.length,sourceStats:original,output,outputBytes:bytes,outputStats:final,textureFormats,method:'Lossy WebP quality 90 on original 4096px diffuse maps; roughness encoded at quality 92 and reduced to 1024px; Meshopt simplification ratio 0.60 with relative error cap 0.0005, followed by deduplication, welding, same-material merge and Meshopt geometry compression. Original file remains untouched.'};
await fs.writeFile('public/models/arduino-uno-r3.optimization.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
