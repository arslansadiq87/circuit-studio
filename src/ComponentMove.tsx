import {useEffect,useRef} from 'react';
import {useThree,type ThreeEvent} from '@react-three/fiber';
import * as THREE from 'three';
import type {OrbitControls} from 'three-stdlib';
import type {Component} from './model';
import {useEditor} from './store';
import {useGraphics} from './graphics';
import {useWireAnimation} from './wireAnimation';
import {noRaycast} from './modelCache';

type Drag={pointerId:number;plane:THREE.Plane;start:THREE.Vector3;position:[number,number,number];client:[number,number];pending?:[number,number,number];frame?:number;controlsEnabled:boolean;release:()=>void};
export function ComponentMoveProxy({component}:{component:Component}){
 const mode=useEditor(s=>s.mode),selected=useEditor(s=>s.selectedId===component.id),exporting=useGraphics(s=>s.exporting),{gl,invalidate}=useThree();
 const controls=useThree(s=>s.controls) as OrbitControls|undefined;
 const drag=useRef<Drag|null>(null);
 const finish=(accept:boolean)=>{
  const current=drag.current;if(!current)return;drag.current=null;
  if(current.frame)cancelAnimationFrame(current.frame);
  if(accept&&current.pending)useEditor.getState().previewMove(component.id,current.pending);
  useEditor.getState().finishMove(accept);
  if(controls)controls.enabled=current.controlsEnabled;
  useGraphics.getState().setMoving(false);gl.domElement.style.cursor=useEditor.getState().mode==='move'?'grab':'';
  current.release();invalidate();
 };
 useEffect(()=>{
  if(!drag.current)gl.domElement.style.cursor=mode==='move'?'grab':'';
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&useEditor.getState().mode==='move'){if(useEditor.getState().moveTransaction&&!drag.current)return;finish(false);useEditor.getState().setMode('select')}};
  const blur=()=>finish(false);
  window.addEventListener('keydown',key);window.addEventListener('blur',blur);
  return()=>{window.removeEventListener('keydown',key);window.removeEventListener('blur',blur);finish(false)};
 },[mode,controls,gl]);
 const down=(e:ThreeEvent<PointerEvent>)=>{
  if(mode!=='move'||e.button!==0||drag.current)return;
  e.stopPropagation();useEditor.getState().select(component.id);
  if(Math.abs(e.ray.direction.z)<.05)return;
  const plane=new THREE.Plane(new THREE.Vector3(0,0,1),-component.position[2]),point=e.ray.intersectPlane(plane,new THREE.Vector3());if(!point)return;
  useWireAnimation.getState().stop();useEditor.getState().setHoveredWire(null);useEditor.getState().beginMove(component.id);
  const target=e.target as unknown as {setPointerCapture:(id:number)=>void;releasePointerCapture:(id:number)=>void};
  target.setPointerCapture(e.pointerId);
  drag.current={pointerId:e.pointerId,plane,start:point,position:[...component.position],client:[e.clientX,e.clientY],controlsEnabled:controls?.enabled??true,release:()=>{try{target.releasePointerCapture(e.pointerId)}catch{/* capture already lost */}}};
  if(controls)controls.enabled=false;gl.domElement.style.cursor='grabbing';useGraphics.getState().setMoving(true);
 };
 const move=(e:ThreeEvent<PointerEvent>)=>{
  const current=drag.current;if(!current||current.pointerId!==e.pointerId)return;e.stopPropagation();
  if(!current.pending&&Math.hypot(e.clientX-current.client[0],e.clientY-current.client[1])<3)return;
  const point=e.ray.intersectPlane(current.plane,new THREE.Vector3());if(!point)return;
  current.pending=[Number((current.position[0]+point.x-current.start.x).toFixed(2)),Number((current.position[1]+point.y-current.start.y).toFixed(2)),current.position[2]];
  if(!current.frame)current.frame=requestAnimationFrame(()=>{current.frame=undefined;if(drag.current===current&&current.pending){useEditor.getState().previewMove(component.id,current.pending);invalidate()}});
 };
 const dimensions=component.dimensions??[28,20,8],origin=(component.geometry?.origin??[0,0,0]).map(v=>-v) as [number,number,number];
 return <group position={origin}><mesh userData={{pickingProxy:true,moveComponentId:component.id}} raycast={mode==='wire'||mode==='calibration'?noRaycast:THREE.Mesh.prototype.raycast} onPointerDown={down} onPointerMove={move} onPointerUp={e=>{if(drag.current){e.stopPropagation();finish(true)}}} onPointerCancel={()=>finish(false)} onLostPointerCapture={()=>finish(false)} onClick={e=>{e.stopPropagation();useEditor.getState().select(component.id)}}><boxGeometry args={dimensions}/><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false}/></mesh>{mode==='move'&&selected&&!exporting&&<mesh raycast={noRaycast}><boxGeometry args={dimensions.map(v=>v+.7) as [number,number,number]}/><meshBasicMaterial color="#71d6ab" transparent opacity={.5} wireframe/></mesh>}</group>;
}
