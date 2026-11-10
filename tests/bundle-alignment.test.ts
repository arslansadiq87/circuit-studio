import {expect,it} from 'vitest';
import * as THREE from 'three';
import {alignCleanBundles,pathsOverlap} from '../src/autoRouting';
import {cleanEndpoints} from '../src/cleanRouting';
import {makeIcPackage} from '../src/icPackage';
import {makeWireCurve,worldPin,worldPinDirection} from '../src/geometry';
import type {Component,Wire} from '../src/model';

it.each([0,90,180,270])('aligns an irregular connector bundle at %s degrees and preserves an existing neat bundle',angle=>{
 const components:Component[]=[],wires:Wire[]=[];
 for(const [name,x,regular] of [['change',0,false],['keep',70,true]] as const){
  const high:Component={id:`${name}-high`,modelId:'connector',name:'Connector',position:[x,0,0],rotation:[0,0,0],dimensions:[4,10,16],pins:Array.from({length:4},(_,i)=>({id:`P${i}`,label:`${i}`,side:'right',index:i,localPosition:[2,-3+i*1.4,8],exitDirection:[1,0,0]}))};
  const low={...makeIcPackage(8),id:`${name}-low`,position:[x+20,0,0] as [number,number,number]};components.push(high,low);
  for(let i=0;i<4;i++){
   const a={componentId:high.id,pinId:`P${i}`},b={componentId:low.id,pinId:`P${4-i}`};
   const wire:Wire={id:`${name}-${i}`,from:i%2?b:a,to:i%2?a:b,label:'Output',color:'#40ccbb',diameter:1.05,curvature:19,routeMode:'clean'};
   const ends=cleanEndpoints(wire,[high,low])!,start=i%2?ends.end:ends.start,end=i%2?ends.start:ends.end;
   const a0=start.at(-1)!,b0=end.at(-1)!,z=!regular&&i===1?-.95:.7;
   const lane=regular?(a0.x+b0.x)/2+(1.5-i)*1.27:i%2?a0.x:b0.x;
   const points=[...start,new THREE.Vector3(a0.x,a0.y,z),new THREE.Vector3(lane,a0.y,z),new THREE.Vector3(lane,b0.y,z),new THREE.Vector3(b0.x,b0.y,z),...[...end].reverse()];if(i%2)points.reverse();
   wires.push({...wire,routingPoints:points.map(p=>p.toArray() as [number,number,number])});
  }
 }
 const rotation=new THREE.Euler(0,0,THREE.MathUtils.degToRad(angle));
 const rotated=components.map(c=>({...c,position:new THREE.Vector3(...c.position).applyEuler(rotation).toArray() as [number,number,number],rotation:[0,0,angle] as [number,number,number]}));
 const input=wires.map(w=>({...w,routingPoints:w.routingPoints!.map(p=>new THREE.Vector3(...p).applyEuler(rotation).toArray() as [number,number,number])}));
 const output=alignCleanBundles(input,rotated);
 for(let i=0;i<4;i++)expect(output[i]).not.toBe(input[i]);
 for(let i=4;i<8;i++)expect(output[i]).toBe(input[i]);
 const paths=output.map(w=>{
  const a=rotated.find(c=>c.id===w.from.componentId)!,b=rotated.find(c=>c.id===w.to.componentId)!,pa=a.pins.find(p=>p.id===w.from.pinId)!,pb=b.pins.find(p=>p.id===w.to.pinId)!;
  const start=worldPin(pa,a),end=worldPin(pb,b),curve=makeWireCurve(w,start,end,worldPinDirection(pa,a),worldPinDirection(pb,b),undefined,undefined,rotated);
  expect(curve.getPoint(0).distanceTo(start)).toBeLessThan(.01);expect(curve.getPoint(1).distanceTo(end)).toBeLessThan(.01);
  expect(w.routingPoints!.every(p=>p[2]>=0)).toBe(true);
  return {wire:w,start,end,points:curve.getSpacedPoints(Math.ceil(curve.getLength()/.4))};
 });
 for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++)expect(pathsOverlap(paths[i],paths[j])).toBe(false);
});
