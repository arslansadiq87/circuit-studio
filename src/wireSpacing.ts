import * as THREE from 'three';
import type {Component,Wire} from './model';

export const AUTO_WIRE_SPACING_MM=1.8;

function pairKey(from:Wire['from'],to:Wire['to']):string{
 return [from.componentId,to.componentId].sort().join('\u0000');
}

export function nextAutoLane(wires:Wire[],from:Wire['from'],to:Wire['to']):number{
 const pair=pairKey(from,to);
 return wires.filter(wire=>(wire.routeMode===undefined||wire.routeMode==='auto'||wire.routeMode==='clean')&&pairKey(wire.from,wire.to)===pair).length;
}

function endpoints(wire:Wire,components:Component[]):[THREE.Vector3,THREE.Vector3]|undefined{
 const find=(endpoint:Wire['from'])=>{
  const component=components.find(c=>c.id===endpoint.componentId),pin=component?.pins.find(p=>p.id===endpoint.pinId);
  if(!component||!pin?.localPosition)return undefined;
  return new THREE.Vector3(...pin.localPosition).applyEuler(new THREE.Euler(...component.rotation.map(THREE.MathUtils.degToRad) as [number,number,number])).add(new THREE.Vector3(...component.position));
 };
 const a=find(wire.from),b=find(wire.to);
 return a&&b?[a,b]:undefined;
}

function crossings(a:[THREE.Vector3,THREE.Vector3],b:[THREE.Vector3,THREE.Vector3]):boolean{
 const [p,p2]=a,[q,q2]=b,rx=p2.x-p.x,ry=p2.y-p.y,sx=q2.x-q.x,sy=q2.y-q.y,denom=rx*sy-ry*sx;
 if(Math.abs(denom)<1e-6)return false;
 const qx=q.x-p.x,qy=q.y-p.y,t=(qx*sy-qy*sx)/denom,u=(qx*ry-qy*rx)/denom;
 return t>.025&&t<.975&&u>.025&&u<.975;
}

export function assignAutoLanes(wires:Wire[],components?:Component[]):Wire[]{
 const lanes=new Map<string,number>(),routed:{points:[THREE.Vector3,THREE.Vector3];lane:number;pair:string}[]=[];
 let changed=false;
 const spaced=wires.map(wire=>{
  if(wire.routeMode!==undefined&&wire.routeMode!=='auto'&&wire.routeMode!=='clean')return wire;
  const pair=pairKey(wire.from,wire.to),points=components?endpoints(wire,components):undefined;
  let lane:number;
  if(points){
   const occupied=new Set(routed.filter(previous=>previous.pair===pair||crossings(points,previous.points)).map(previous=>previous.lane));
   lane=0;while(occupied.has(lane))lane++;
   routed.push({points,lane,pair});
  }else{lane=lanes.get(pair)??0;lanes.set(pair,lane+1)}
  if(wire.autoLane===lane)return wire;
  changed=true;
  return {...wire,autoLane:lane};
 });
 return changed?spaced:wires;
}
