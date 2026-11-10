import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';
import type {Component} from './model';
import {acquireModel,capTextures,noRaycast,type Lod} from './modelCache';
import {fitModelScale} from './geometry';
import {useGraphics} from './graphics';
export const exportPreparers=new Set<(detail:Lod)=>Promise<void>>();
const driverPinXs=Array.from({length:8},(_,i)=>-8.89+i*2.54);
function trimTriangles(mesh:THREE.Mesh,removePoint:(point:THREE.Vector3)=>boolean){
 const source=mesh.geometry,index=source.getIndex(),positions=source.getAttribute('position');
 if(!index||!positions)return;
 const remove=new Uint8Array(positions.count),point=new THREE.Vector3();
 for(let i=0;i<positions.count;i++){
  point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
  remove[i]=removePoint(point)?1:0;
 }
 const kept:number[]=[];
 for(let i=0;i<index.count;i+=3){
  const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
  if(!remove[a]&&!remove[b]&&!remove[c])kept.push(a,b,c);
 }
 if(kept.length===index.count)return;
 const geometry=source.clone();geometry.setIndex(kept);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.pcbTrimOwned=true;
 mesh.geometry=geometry;
}
function softenS3ShieldMarks(mesh:THREE.Mesh){
 const source=mesh.geometry,index=source.getIndex(),position=source.getAttribute('position');
 if(!index||!position||Array.isArray(mesh.material))return;
 const normal:number[]=[],marks:number[]=[],point=new THREE.Vector3();
 for(let i=0;i<index.count;i+=3){
  const vertices=[index.getX(i),index.getX(i+1),index.getX(i+2)];
  const onShield=vertices.every(vertex=>{point.fromBufferAttribute(position,vertex).applyMatrix4(mesh.matrixWorld);return point.x>-24&&point.x<-11&&point.y>-8&&point.y<8&&point.z>3.48});
  (onShield?marks:normal).push(...vertices);
 }
 if(!marks.length)return;
 const geometry=source.clone();geometry.setIndex([...normal,...marks]);geometry.clearGroups();geometry.addGroup(0,normal.length,0);geometry.addGroup(normal.length,marks.length,1);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.pcbTrimOwned=true;
 const markMaterial=(mesh.material as THREE.MeshStandardMaterial).clone();markMaterial.color.set('#878b89');markMaterial.metalness=.08;markMaterial.roughness=.82;markMaterial.userData.s3ShieldMarkOwned=true;
 if(source.userData.pcbTrimOwned)source.dispose();
 mesh.geometry=geometry;mesh.material=[mesh.material,markMaterial];
}
export function RuntimeModel({component}:{component:Component}){
 const [objects,setObjects]=useState<Partial<Record<Lod,THREE.Group>>>({}),[level,setLevel]=useState<Lod>(()=>{const setting=useGraphics.getState().settings.geometry;return component.modelId==='yd-esp32-s3-v34'||component.geometry?.lodUrls?setting==='auto'?'medium':setting:'high'}),[error,setError]=useState('');
 const anchor=useRef<THREE.Group>(null);
 const {camera,size,invalidate}=useThree();const detail=useGraphics(s=>s.settings.geometry),maxTexture=useGraphics(s=>s.exporting?4096:s.settings.maxTextureSize),exporting=useGraphics(s=>s.exporting);
 const constrainedMotion=useGraphics(s=>s.moving&&s.constrained);
 const g=component.geometry;const identity=JSON.stringify([g?.modelUrl,g?.modelAssetId,g?.lodUrls,g?.modelContentHash]);
 const context=useMemo(()=>({alive:true,loading:new Map<Lod,Promise<void>>(),releases:[] as (()=>void)[]}),[identity]);
 const currentLevel=useRef(level),beforeExport=useRef<Lod|undefined>(undefined);currentLevel.current=level;
 const visibleModel=useRef<THREE.Group|null>(null),readyWaiters=useRef<{level:Lod;resolve:()=>void;reject:(error:Error)=>void}[]>([]);
 const ensure=useMemo(()=>{const current=context;return (next:Lod)=>{let promise=current.loading.get(next);if(!promise){promise=acquireModel(component,next).then(result=>{if(!current.alive){result.release();return}current.releases.push(result.release);setObjects(v=>({...v,[next]:result.group}));setError('');invalidate();window.dispatchEvent(new Event('c3d-model-ready'))}).catch(e=>{if(current.alive)setError(e instanceof Error?e.message:'Model load failed');current.loading.delete(next);throw e});current.loading.set(next,promise)}return promise}},[context,invalidate]);
 useEffect(()=>{setObjects({});const current=context;current.alive=true;void ensure(level).catch(()=>{});const prepare=async(next:Lod)=>{beforeExport.current=currentLevel.current;await ensure(next);if(visibleModel.current?.userData.lod===next)return;await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Timed out preparing CAD export detail')),30000);readyWaiters.current.push({level:next,resolve:()=>{clearTimeout(timer);resolve()},reject:error=>{clearTimeout(timer);reject(error)}});setLevel(next);invalidate()})};exportPreparers.add(prepare);return()=>{current.alive=false;current.releases.splice(0).forEach(release=>release());readyWaiters.current.splice(0).forEach(waiter=>waiter.reject(new Error('Component changed during image preparation')));exportPreparers.delete(prepare)}},[ensure]);
 useEffect(()=>{if(exporting)return;if(beforeExport.current){setLevel(beforeExport.current);beforeExport.current=undefined}else if(detail!=='auto')setLevel(detail);invalidate()},[detail,exporting,invalidate]);
 useEffect(()=>{void ensure(level).catch(()=>{})},[ensure,level]);
 const lastCheck=useRef(0),position=useMemo(()=>new THREE.Vector3(),[]);
 useEffect(()=>{lastCheck.current=-Infinity;invalidate()},[constrainedMotion,invalidate]);
 useFrame(({clock})=>{if(exporting||clock.elapsedTime-lastCheck.current<.2)return;lastCheck.current=clock.elapsedTime;const custom=component.modelId!=='yd-esp32-s3-v34'&&!g?.lodUrls;if(custom){if(level!=='high')setLevel('high');return}let next:Lod;if(detail!=='auto')next=detail;else{anchor.current?.getWorldPosition(position);const distance=Math.max(1,position.distanceTo(camera.position)),pixels=Math.max(...(component.dimensions??[64,28,12]))*size.height/(2*Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov??38)/2)*distance);next=level;if(level==='low'&&pixels>165)next='medium';if(level==='medium'&&pixels<115)next='low';if(level==='medium'&&pixels>680)next='high';if(level==='high'&&pixels<500)next='medium';const state=useGraphics.getState();if(state.moving&&state.constrained)next=next==='high'?'medium':'low'}if(next!==level){setLevel(next);invalidate()}});
 useEffect(()=>{if(!objects[level]||detail!=='auto'||exporting)return;const timer=setTimeout(()=>{if(level==='high')void ensure('medium').catch(()=>{});else if(level==='low')void ensure('medium').catch(()=>{})},1000);return()=>clearTimeout(timer)},[objects,level,ensure,detail,exporting]);
 // While a level loads retain the last rendered one. Every level uses the fixed
 // master center, not a new bounding-box center that could shift wire anchors.
 const source=objects[level]??objects.medium??objects.high??objects.low;
 const model=useMemo(()=>{if(!source)return null;const child=source.clone(true);child.traverse(o=>{o.raycast=noRaycast;if((component.modelId==='esp32-30pin'&&/^(6130xx11121_PIN|61301511121)/i.test(o.name))||(component.modelId==='esp32-c6-supermini'&&(o.name==='body1'||o.name==='pin1'))||(component.modelId==='yd-esp32-s3-v34'&&/^22way_PCB_Header/i.test(o.name))||(component.modelId==='dvr8825'&&o.name==='COMPOUND')){o.visible=false}if(component.modelId==='dvr8825'&&o instanceof THREE.Mesh){const tint=(m:THREE.Material)=>{if(!m.name.startsWith('Driver PCB'))return m;const copy=m.clone() as THREE.MeshStandardMaterial;copy.color.set(component.geometry?.pcbColor??'#35204f');copy.roughness=.82;copy.metalness=0;copy.userData.driverPcbOwned=true;return copy};o.material=Array.isArray(o.material)?o.material.map(tint):tint(o.material)}if(component.modelId==='led'&&o instanceof THREE.Mesh){const tint=(m:THREE.Material)=>{if(m.name!=='LED_LENS')return m;const copy=m.clone() as THREE.MeshStandardMaterial;copy.color.set(component.color??'#00ff00');copy.userData.ledTintOwned=true;return copy};o.material=Array.isArray(o.material)?o.material.map(tint):tint(o.material)}});const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),center=g?.modelCenter?new THREE.Vector3(...g.modelCenter):bounds.getCenter(new THREE.Vector3());child.position.sub(center);const wrapper=new THREE.Group();wrapper.add(child);if(g?.modelOrientation)wrapper.rotation.set(...g.modelOrientation);if(g?.calibrated){const actual=new THREE.Box3().setFromObject(wrapper).getSize(new THREE.Vector3());if(!component.modelId.startsWith('esp32-')&&component.modelId!=='yd-esp32-s3-v34'&&component.modelId!=='dvr8825'&&component.dimensions&&actual.toArray().some((n,i)=>Math.abs(n-component.dimensions![i])>.15))throw new Error('Calibrated model bounds do not match its physical dimensions')}else wrapper.scale.set(...fitModelScale([size.x,size.y,size.z],component.dimensions??[24,18,4]));if(g?.origin)wrapper.position.set(...g.origin.map(v=>-v) as [number,number,number]);if(component.modelId==='yd-esp32-s3-v34'||component.modelId==='dvr8825'||component.modelId==='esp32-wroom'){wrapper.updateMatrixWorld(true);wrapper.traverse(o=>{if(!(o instanceof THREE.Mesh))return;if(component.modelId==='esp32-wroom')trimTriangles(o,p=>Math.abs(Math.abs(p.y)-11.45)<1.4&&(p.z<1.95||p.z>3.52||((o.name==='mesh_0_7'||o.name==='mesh_0_13')&&p.z>=1.95)));else if(component.modelId==='yd-esp32-s3-v34'){trimTriangles(o,p=>Math.abs(p.y)>11.4&&Math.abs(p.z)>.56);if(o.name==='PCB1_3')softenS3ShieldMarks(o)}else if(o.name==='COMPOUND_2')trimTriangles(o,p=>Math.abs(p.y)>5.2&&p.z<9.72);else if(o.name==='COMPOUND_1')trimTriangles(o,p=>Math.abs(Math.abs(p.y)-6.23)<.55&&driverPinXs.some(x=>Math.abs(p.x-x)<.55))})}wrapper.userData={cadVisual:true,modelId:component.modelId,lod:objects[level]?level:objects.medium?'medium':objects.high?'high':'low'};return wrapper},[source,g,component.dimensions,component.color,component.modelId,level]);
 useLayoutEffect(()=>{visibleModel.current=model;if(model){const ready=readyWaiters.current.filter(waiter=>waiter.level===model.userData.lod);readyWaiters.current=readyWaiters.current.filter(waiter=>waiter.level!==model.userData.lod);ready.forEach(waiter=>waiter.resolve())}},[model]);
 useEffect(()=>{if(!model)return;return()=>{model.traverse(o=>{if(o instanceof THREE.Mesh){if(o.geometry.userData.pcbTrimOwned)o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.ledTintOwned||m.userData.driverPcbOwned||m.userData.s3ShieldMarkOwned)m.dispose()}})}},[model]);
 useEffect(()=>model?capTextures(model,maxTexture):undefined,[model,maxTexture]);
 return <group ref={anchor}>{model?<primitive object={model} dispose={null}/>:<mesh><boxGeometry args={component.dimensions??[24,18,4]}/><meshBasicMaterial color={error?'#b7584a':'#577065'} wireframe/></mesh>}{(!model||error)&&<Html center><span className="model-status" role="status">{error?`Model unavailable: ${error}`:'Loading model…'}</span></Html>}</group>
}

