import 'fake-indexeddb/auto';
import {it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {capTextures} from '../src/modelCache';
import {builtInModel,modelUrl} from '../src/modelCache';
import fixture from './fixtures/crowded-c6-project.json';
it('resolves reference-free built-in CAD parts from modelId',()=>{
 const parts=(fixture as {components:{modelId:string;geometry?:{kind:string;modelUrl?:string}}[]}).components.filter(c=>c.geometry?.kind==='model');
 expect(parts.length).toBeGreaterThan(0);
 for(const part of parts){
  const template=builtInModel({...part,id:part.modelId,name:part.modelId,pins:[],position:[0,0,0],rotation:[0,0,0]});
  expect(template,`missing built-in template for ${part.modelId}`).toBeDefined();
  expect(modelUrl({id:part.modelId,modelId:part.modelId,name:part.modelId,pins:[],position:[0,0,0],rotation:[0,0,0],geometry:undefined},'high')).toBe(template!.geometry?.lodUrls?.high??template!.geometry?.modelUrl);
 }
});
it('resolves built-in CAD parts saved with a reference-free geometry',()=>{
 const parts=(fixture as {components:{id:string;modelId:string;geometry?:{kind:string;modelUrl?:string;modelAssetId?:string}}[]}).components.filter(c=>c.geometry?.kind==='model'&&!c.geometry.modelUrl&&!c.geometry.modelAssetId);
 expect(parts.length).toBeGreaterThan(0);
 for(const part of parts){
  const component={...part,name:part.modelId,pins:[],position:[0,0,0],rotation:[0,0,0]} as Parameters<typeof modelUrl>[0];
  const template=builtInModel(component)!.geometry;
  expect(modelUrl(component,'high'),part.id).toBe(template?.lodUrls?.high??template?.modelUrl);
 }
});
it('caps interactive textures without changing the shared original and restores them for export',()=>{
 vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>({drawImage:()=>{}})})});
 try{const image={width:2048,height:1024};const texture=new THREE.Texture(image);const material=new THREE.MeshStandardMaterial({map:texture});const group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);group.add(mesh);const restore=capTextures(group,512);const capped=mesh.material as THREE.MeshStandardMaterial;expect(capped).not.toBe(material);expect(capped.map!.image.width).toBe(512);expect(capped.map!.image.height).toBe(256);expect(texture.image).toBe(image);expect(texture.image.width).toBe(2048);restore();expect(mesh.material).toBe(material);expect((mesh.material as THREE.MeshStandardMaterial).map!.image.width).toBe(2048);const high=capTextures(group,4096);expect(mesh.material).toBe(material);high();mesh.geometry.dispose();material.dispose();texture.dispose()}finally{vi.unstubAllGlobals()}
});
