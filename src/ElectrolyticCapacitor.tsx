import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Component } from './model';
import { CAPACITOR_DEFAULTS } from './capacitor';

const bodyMaterials:Record<string,THREE.MeshStandardMaterial>={
 black:new THREE.MeshStandardMaterial({color:'#151719',roughness:.88,metalness:.02}),
 blue:new THREE.MeshStandardMaterial({color:'#0758a2',roughness:.76,metalness:.03}),
 seal:new THREE.MeshStandardMaterial({color:'#111315',roughness:.94}),
 top:new THREE.MeshStandardMaterial({color:'#777e80',roughness:.42,metalness:.78}),
 lead:new THREE.MeshStandardMaterial({color:'#c2c8c9',roughness:.29,metalness:.88}),
 stripe:new THREE.MeshStandardMaterial({color:'#deded6',roughness:.7})
};
// Every instance uses the same two low-poly cylinders; transforms supply its size.
const bodyGeometry=new THREE.CylinderGeometry(1,1,1,24,1,true);
const leadGeometry=new THREE.CylinderGeometry(1,1,1,8,1,false);
const diskGeometry=new THREE.CircleGeometry(1,24);
const textureCache=new Map<string,{texture:THREE.CanvasTexture;refs:number}>();

function makeLabel(value:number,unit:string,voltage:number,showValue:boolean,showVoltage:boolean,showPolarity:boolean,finish:string){
 const key=JSON.stringify([value,unit,voltage,showValue,showVoltage,showPolarity,finish]),cached=textureCache.get(key);
 if(cached){cached.refs++;return cached.texture}
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
 const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,512,256);ctx.fillStyle=finish==='blue'?'#0758a2':'#151719';ctx.fillRect(0,0,512,256);
 // Artwork occupies the front of the cylinder. A stripe sits at one edge of the UV wrap.
 if(showPolarity){ctx.fillStyle='#e5e3d8';ctx.fillRect(112,0,34,256);ctx.fillStyle='#1d2022';ctx.font='bold 24px Arial';ctx.textAlign='center';ctx.fillText('−',129,40);ctx.fillText('−',129,222)}
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=finish==='blue'?'#f6f8f9':'#eee';
 if(showValue){ctx.font=`bold ${value>=1000?38:46}px Arial`;ctx.fillText(`${value} ${unit}`,20,100,280);ctx.fillText(`${value} ${unit}`,532,100,280)}
 if(showVoltage){ctx.font='bold 38px Arial';ctx.fillText(`${voltage} V`,20,164,260);ctx.fillText(`${voltage} V`,532,164,260)}
 const texture=new THREE.CanvasTexture(canvas);texture.wrapS=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
 textureCache.set(key,{texture,refs:1});return texture;
}
function releaseLabel(texture:THREE.CanvasTexture){for(const [key,item] of textureCache){if(item.texture===texture){if(--item.refs===0){item.texture.dispose();textureCache.delete(key)}return}}}

export const ElectrolyticCapacitor=memo(function ElectrolyticCapacitor({component}:{component:Component}){
 const c=component.capacitor??CAPACITOR_DEFAULTS;
 const r=c.diameter/2, bodyH=c.height, leadR=Math.max(.22,Math.min(.34,c.diameter*.035));
 const leads=useRef<THREE.InstancedMesh>(null);
 const label=useMemo(()=>makeLabel(c.value,c.unit,c.voltage,c.showValue,c.showVoltage,c.showPolarity,c.finish),[c.value,c.unit,c.voltage,c.showValue,c.showVoltage,c.showPolarity,c.finish]);
 const wrapMaterial=useMemo(()=>new THREE.MeshStandardMaterial({map:label,color:'#fff',roughness:c.finish==='black'?.88:.76,metalness:.02}),[label,c.finish]);
 useEffect(()=>()=>{releaseLabel(label);wrapMaterial.dispose()},[label,wrapMaterial]);
 useLayoutEffect(()=>{const mesh=leads.current;if(!mesh)return;const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0)),scale=new THREE.Vector3(leadR,c.leadLength,leadR);for(let i=0;i<2;i++){matrix.compose(new THREE.Vector3(i===0?-c.pitch/2:c.pitch/2,0,-c.leadLength/2),rotation,scale);mesh.setMatrixAt(i,matrix)}mesh.instanceMatrix.needsUpdate=true},[leadR,c.leadLength,c.pitch]);
 return <group dispose={null} position={[0,0,(c.leadLength-bodyH)/2]}>
  <mesh geometry={bodyGeometry} material={wrapMaterial} rotation={[Math.PI/2,0,0]} scale={[r,bodyH,r]} position={[0,0,bodyH/2]} castShadow receiveShadow/>
  <mesh geometry={diskGeometry} material={bodyMaterials.seal} scale={[r*.94,r*.94,1]} position={[0,0,.02]}/>
  <mesh geometry={diskGeometry} material={bodyMaterials.top} scale={[r*.91,r*.91,1]} position={[0,0,bodyH+.015]}/>
  <instancedMesh ref={leads} args={[leadGeometry,bodyMaterials.lead,2]} castShadow/>
 </group>
});
