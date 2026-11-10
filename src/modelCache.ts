import * as THREE from 'three';
import {GLTFLoader,OBJLoader,STLLoader} from 'three-stdlib';
import {MeshoptDecoder} from 'meshoptimizer/decoder';
import {assetFromUrl} from './assets';
import {getPartBlob} from './library';
import type {Component} from './model';
import {diagnostics} from './graphics';
export type Lod='low'|'medium'|'high';
export const cadLods={low:'/models/yd-esp32-s3-v34-low.glb',medium:'/models/yd-esp32-s3-v34-medium.glb',high:'/models/yd-esp32-s3-v34-high.glb'};
type Entry={promise:Promise<THREE.Group>;refs:number;timer?:ReturnType<typeof setTimeout>};
const models=new Map<string,Entry>();
export const noRaycast=()=>{};
export function modelUrl(component:Component,level:Lod){return component.geometry?.lodUrls?.[level]??(component.modelId==='yd-esp32-s3-v34'?cadLods[level]:component.geometry?.modelUrl)}
export async function modelResource(component:Component,level:Lod){const url=modelUrl(component,level);if(url)return assetFromUrl(url);const id=component.geometry?.modelAssetId;if(!id)throw new Error('No model asset reference');return getPartBlob(id)}
export async function acquireModel(component:Component,level:Lod){const started=performance.now();const {blob,hash}=await modelResource(component,level);const fetched=performance.now(),format=component.geometry?.modelFormat??'glb',key=`${hash}:${format}`;let entry=models.get(key);
 if(entry){diagnostics.cacheHits++;if(entry.timer)clearTimeout(entry.timer)}
 else{entry={refs:0,promise:(async()=>{diagnostics.parses++;const bytes=await blob.arrayBuffer();let group:THREE.Group;if(format==='obj')group=new OBJLoader().parse(new TextDecoder().decode(bytes));else if(format==='stl'){group=new THREE.Group();group.add(new THREE.Mesh(new STLLoader().parse(bytes),new THREE.MeshStandardMaterial({color:'#738b79',metalness:.2,roughness:.55})))}else{const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);group=(await loader.parseAsync(bytes,'')).scene}group.traverse(o=>{o.raycast=noRaycast;if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true}});diagnostics.modelTimings.push({key,fetchMs:fetched-started,parseMs:performance.now()-fetched});return group})()};models.set(key,entry);entry.promise.catch(()=>models.delete(key))}
 entry.refs++;const active=entry;
 const release=()=>{active.refs=Math.max(0,active.refs-1);if(active.refs===0){active.timer=setTimeout(()=>{if(active.refs)return;void active.promise.then(group=>{const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();group.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value)}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose())});models.delete(key)},300000)}};
 try{return {group:await active.promise,release,key}}catch(error){release();throw error}
}
export function loadedModelCount(){return models.size}
export function modelCacheReferences(){return [...models.values()].map(entry=>entry.refs)}
// Resize only texture objects, sharing geometry; originals remain available to exports.
const textureVariants=new WeakMap<THREE.Texture,Map<number,THREE.Texture>>();
export function capTextures(group:THREE.Group,max:number){const owned:THREE.Material[]=[],originals=new Map<THREE.Mesh,THREE.Material|THREE.Material[]>();group.traverse(o=>{if(!(o instanceof THREE.Mesh))return;originals.set(o,o.material);const next=(material:THREE.Material)=>{let copy:THREE.Material|undefined;for(const [key,value] of Object.entries(material)){if(!(value instanceof THREE.Texture)||!value.image?.width||Math.max(value.image.width,value.image.height)<=max)continue;let variants=textureVariants.get(value);if(!variants){variants=new Map();textureVariants.set(value,variants)}let texture=variants.get(max);if(!texture){const canvas=document.createElement('canvas'),scale=max/Math.max(value.image.width,value.image.height);canvas.width=Math.max(1,Math.round(value.image.width*scale));canvas.height=Math.max(1,Math.round(value.image.height*scale));canvas.getContext('2d')?.drawImage(value.image,0,0,canvas.width,canvas.height);texture=value.clone();texture.source=new THREE.Source(canvas);texture.needsUpdate=true;variants.set(max,texture);value.addEventListener('dispose',()=>texture?.dispose())}copy??=material.clone();(copy as unknown as Record<string,unknown>)[key]=texture}if(copy)owned.push(copy);return copy??material};o.material=Array.isArray(o.material)?o.material.map(next):next(o.material)});return ()=>{originals.forEach((material,mesh)=>{mesh.material=material});owned.forEach(m=>m.dispose())}}
