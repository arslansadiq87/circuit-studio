import {useEffect,useRef} from 'react';
import {useThree,type ThreeEvent} from '@react-three/fiber';
import * as THREE from 'three';
import type {OrbitControls} from 'three-stdlib';
import type {Wire} from './model';
import {useEditor} from './store';
import {useWireAnimation} from './wireAnimation';
type Point=[number,number,number];
type Props={preview:Point[]|null;wire:Wire;curve:THREE.Curve<THREE.Vector3>;onPreview:(points:Point[]|null)=>void};
type Drag={pointerId:number;wire:Wire;index:number;plane:THREE.Plane;start:THREE.Vector3;points:Point[];client:Point;pending:Point[]|null;enabled:boolean;release:()=>void};
// The handles render above the scene, so their hit priority must match that overlay.
function handleRaycast(this:THREE.Mesh,raycaster:THREE.Raycaster,hits:THREE.Intersection[]){const start=hits.length;THREE.Mesh.prototype.raycast.call(this,raycaster,hits);for(let i=start;i<hits.length;i++)hits[i].distance=0}

// Edit locally while dragging; one store commit on release keeps Undo atomic.
export function WireRouteHandles(props:Props){
 const {camera,gl,invalidate}=useThree(),controls=useThree(s=>s.controls) as OrbitControls|undefined;
 const current=useRef(props);current.current=props;const drag=useRef<Drag|null>(null);
 const finish=(accept:boolean)=>{
  const d=drag.current;if(!d)return;drag.current=null;
  const {wire,onPreview}=current.current,s=useEditor.getState();
  if(accept&&d.pending&&s.selectedId===wire.id&&s.project.wires.find(w=>w.id===wire.id)===d.wire)s.updateWire(wire.id,{bendPoints:d.pending});
  onPreview(null);if(controls)controls.enabled=d.enabled;gl.domElement.style.cursor='';d.release();invalidate();
 };
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){finish(false);e.preventDefault()}};
  const cancel=()=>finish(false);window.addEventListener('keydown',key);window.addEventListener('blur',cancel);
  return()=>{window.removeEventListener('keydown',key);window.removeEventListener('blur',cancel);finish(false);gl.domElement.style.cursor=''};
 },[controls,gl]);
 const points=props.preview??(props.wire.bendPoints?.length?props.wire.bendPoints:[props.curve.getPoint(.5).toArray() as Point]);
 const down=(e:ThreeEvent<PointerEvent>,index:number)=>{
  if(e.button!==0||drag.current)return;e.stopPropagation();
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),new THREE.Vector3(...points[index]));
  const start=e.ray.intersectPlane(plane,new THREE.Vector3());if(!start)return;
  const target=e.target as unknown as {setPointerCapture:(id:number)=>void;releasePointerCapture:(id:number)=>void};target.setPointerCapture(e.pointerId);
  drag.current={pointerId:e.pointerId,wire:props.wire,index,plane,start,points:points.map(p=>[...p]),client:[e.clientX,e.clientY,0],pending:null,enabled:controls?.enabled??true,release:()=>{try{target.releasePointerCapture(e.pointerId)}catch{/* already released */}}};
  useWireAnimation.getState().stop();useEditor.getState().setHoveredWire(null);if(controls)controls.enabled=false;gl.domElement.style.cursor='grabbing';
 };
 const move=(e:ThreeEvent<PointerEvent>)=>{
  const d=drag.current;if(!d||d.pointerId!==e.pointerId)return;e.stopPropagation();
  if(!d.pending&&Math.hypot(e.clientX-d.client[0],e.clientY-d.client[1])<3)return;
  const p=e.ray.intersectPlane(d.plane,new THREE.Vector3());if(!p)return;
  const delta=p.sub(d.start);d.pending=d.points.map((point,i)=>i===d.index?point.map((v,axis)=>Number((v+delta.getComponent(axis)).toFixed(2))) as Point:[...point]);
  current.current.onPreview(d.pending);invalidate();
 };
 return <group>{points.map((point,index)=><mesh key={index} raycast={handleRaycast} position={point} renderOrder={1000} userData={{wireRouteHandle:true,wireId:props.wire.id,pointIndex:index}} onPointerDown={e=>down(e,index)} onPointerMove={move} onPointerUp={e=>{if(drag.current){e.stopPropagation();finish(true)}}} onPointerCancel={()=>finish(false)} onLostPointerCapture={()=>finish(false)} onPointerEnter={()=>{if(!drag.current)gl.domElement.style.cursor='grab'}} onPointerLeave={()=>{if(!drag.current)gl.domElement.style.cursor=''}} onClick={e=>e.stopPropagation()}><sphereGeometry args={[1.15,16,12]}/><meshBasicMaterial color="#78e3bd" depthTest={false} depthWrite={false}/></mesh>)}</group>;
}
