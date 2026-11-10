import {expect,it} from 'vitest';
import * as THREE from 'three';
import {shortenCleanDetours,pathsOverlap} from '../src/autoRouting';
import {cleanEndpoints} from '../src/cleanRouting';
import {makeWireCurve,worldPin,worldPinDirection} from '../src/geometry';
import type {Component,Wire} from '../src/model';

const terminal=(id:string,x:number,y:number,side:number):Component=>({id,modelId:'terminal',name:id,position:[x,y,0],rotation:[0,0,0],dimensions:[2,2,2],pins:[{id:'P',label:'Signal',side:'right',index:0,localPosition:[side,0,0],exitDirection:[side||1,0,0]}]});
function path(wire:Wire,components:Component[]){
 const a=components.find(c=>c.id===wire.from.componentId)!,b=components.find(c=>c.id===wire.to.componentId)!;
 const start=worldPin(a.pins[0],a),end=worldPin(b.pins[0],b),curve=makeWireCurve(wire,start,end,worldPinDirection(a.pins[0],a),worldPinDirection(b.pins[0],b),undefined,undefined,components);
 return {wire,start,end,curve,points:curve.getSpacedPoints(Math.ceil(curve.getLength()/.35))};
}
it.each([0,90,180,270])('uses a short crossing above a fixed wire at %s degrees without moving neighbors',angle=>{
 const components=[terminal('a',-20,0,1),terminal('b',20,0,-1),terminal('bottom',0,-20,0),terminal('top',0,20,0),terminal('c',-20,30,1),terminal('d',20,30,-1)];
 const base=(id:string,from:string,to:string):Wire=>({id,from:{componentId:from,pinId:'P'},to:{componentId:to,pinId:'P'},color:'#40ccbb',diameter:1.05,label:id,curvature:19,routeMode:'clean'});
 const detour=base('detour','a','b'),ends=cleanEndpoints(detour,components)!,a=ends.start.at(-1)!,b=ends.end.at(-1)!;
 detour.routingPoints=[...ends.start,new THREE.Vector3(a.x,-24,.7),new THREE.Vector3(b.x,-24,.7),...[...ends.end].reverse()].map(p=>p.toArray() as [number,number,number]);
 const blocker={...base('fixed','bottom','top'),routeMode:'straight' as const};
 const neat=base('neat','c','d'),neatEnds=cleanEndpoints(neat,components)!;
 neat.routingPoints=[...neatEnds.start,...[...neatEnds.end].reverse()].map(p=>p.toArray() as [number,number,number]);
 const rotation=new THREE.Euler(0,0,THREE.MathUtils.degToRad(angle));
 const rotated=components.map(c=>({...c,position:new THREE.Vector3(...c.position).applyEuler(rotation).toArray() as [number,number,number],rotation:[0,0,angle] as [number,number,number]}));
 const input=[detour,blocker,neat].map(w=>({...w,routingPoints:w.routingPoints?.map(p=>new THREE.Vector3(...p).applyEuler(rotation).toArray() as [number,number,number])}));
 const result=shortenCleanDetours(input,rotated),before=path(input[0],rotated),after=path(result[0],rotated);
 expect(result[1]).toBe(input[1]);expect(result[2]).toBe(input[2]);
 expect(after.curve.getLength()).toBeLessThan(before.curve.getLength()*.65);
 expect(Math.max(...after.points.map(p=>p.z))).toBeGreaterThan(1.1);
 expect(Math.max(...after.points.map(p=>p.z))).toBeLessThan(4.5);
 expect(after.points.every(p=>p.z>=-.01)).toBe(true);
 expect(after.curve.getPoint(0).distanceTo(after.start)).toBeLessThan(.01);expect(after.curve.getPoint(1).distanceTo(after.end)).toBeLessThan(.01);
 expect(pathsOverlap(after,path(result[1],rotated))).toBe(false);
});
