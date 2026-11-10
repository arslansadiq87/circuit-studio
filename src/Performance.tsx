import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {diagnostics,useGraphics} from './graphics';
import {loadedModelCount} from './modelCache';
export function PerformanceBridge(){const {gl,scene,size,invalidate}=useThree();const last=useRef(0),lastSample=useRef(0);const enabled=useGraphics(s=>s.monitor);
 useFrame(()=>{const now=performance.now();diagnostics.frames++;const gap=now-last.current;last.current=now;if(gap<1000&&gap>0){diagnostics.frameIntervals.push(gap);if(diagnostics.frameIntervals.length>180)diagnostics.frameIntervals.shift()}
  // Regression is based on slow measured moving frames, not GPU vendor guesses.
  const state=useGraphics.getState();if(state.moving&&diagnostics.frameIntervals.length>=20){const recent=diagnostics.frameIntervals.slice(-20),avg=recent.reduce((a,b)=>a+b,0)/recent.length;if(avg>25&&!state.constrained)state.setConstrained(true)}
  if(!enabled||now-lastSample.current<500)return;lastSample.current=now;const frames=diagnostics.frameIntervals.slice().sort((a,b)=>a-b),average=frames.reduce((a,b)=>a+b,0)/(frames.length||1);let meshes=0,bytes=0;const seen=new Set<THREE.BufferGeometry>();scene.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;if(!seen.has(o.geometry)){seen.add(o.geometry);for(const a of Object.values(o.geometry.attributes))bytes+=(a as THREE.BufferAttribute).array?.byteLength??0;bytes+=o.geometry.index?.array.byteLength??0}}});diagnostics.snapshot={fps:average?1000/average:0,averageMs:average,p95Ms:frames[Math.floor(frames.length*.95)]??0,calls:gl.info.render.calls,triangles:gl.info.render.triangles,meshes,models:loadedModelCount(),textures:gl.info.memory.textures,width:gl.domElement.width,height:gl.domElement.height,heap:(performance as Performance&{memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize,geometryBytes:bytes};
 });
 useEffect(()=>{diagnostics.frameIntervals.length=0;invalidate()},[enabled,size,invalidate]);
 return null
}
