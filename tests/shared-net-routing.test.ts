import {expect,it} from 'vitest';
import * as THREE from 'three';
import {pathsOverlap,shareCleanNetRoutes} from '../src/autoRouting';
import {makeWireCurve,worldPin,worldPinDirection} from '../src/geometry';
import {ProjectSchema,initialProject,type Component,type Wire} from '../src/model';

const component=(id:string,x:number,y:number):Component=>({id,modelId:'test',name:id,position:[x,y,0],rotation:[0,0,0],dimensions:[2,2,2],pins:[{id:'P',label:'GND',side:'top',index:0,localPosition:[0,0,1],exitDirection:[0,0,1]}]});
const wire=(id:string,from:string,to:string,points:[number,number,number][]):Wire=>({id,from:{componentId:from,pinId:'P'},to:{componentId:to,pinId:'P'},label:'GND',color:'#222222',diameter:1.05,curvature:19,routeMode:'clean',routingPoints:points});
function path(w:Wire,components:Component[]){
 const a=components.find(c=>c.id===w.from.componentId)!,b=components.find(c=>c.id===w.to.componentId)!;
 const start=worldPin(a.pins[0],a),end=worldPin(b.pins[0],b),curve=makeWireCurve(w,start,end,worldPinDirection(a.pins[0],a),worldPinDirection(b.pins[0],b),undefined,undefined,components);
 return {wire:w,start,end,curve,points:curve.getSpacedPoints(Math.ceil(curve.getLength()/.4))};
}

it('joins the nearest same-net trunk while preserving unrelated routes and electrical endpoints',()=>{
 const components=[component('a',-40,0),component('b',40,0),component('c',0,20),component('d',-30,-20),component('e',30,-20)];
 const trunk=wire('trunk','a','b',[[-40,0,1],[-43,0,1],[-43,4,1.7],[43,4,1.7],[43,0,1],[40,0,1]]);
 const branch=wire('branch','c','a',[[0,20,1],[-3,20,1],[-3,20,1.7],[-43,20,1.7],[-43,0,1.7],[-43,0,1],[-40,0,1]]);
 // An equal label alone must never connect separate electrical nets.
 const signal=wire('separate-net','d','e',[[-30,-20,1],[-33,-20,1],[-33,-24,1.7],[33,-24,1.7],[33,-20,1],[30,-20,1]]);
 const result=shareCleanNetRoutes([trunk,branch,signal],components),shortened=result[1];
 expect(result[0]).toBe(trunk);expect(result[2]).toBe(signal);
 expect(shortened.from).toEqual(branch.from);expect(shortened.to).toEqual(branch.to);
 expect(shortened.routingJunction?.wireId).toBe(trunk.id);
 expect(shortened.routingJunction?.at).toBe('to');
 const before=path(branch,components),after=path(shortened,components),trunkPath=path(trunk,components);
 expect(after.curve.getLength()).toBeLessThan(before.curve.getLength()-15);
 const junction=new THREE.Vector3(...shortened.routingJunction!.position);
 expect(after.curve.getPoint(1).distanceTo(junction)).toBeLessThan(.001);
 expect(Math.min(...trunkPath.points.map(point=>point.distanceTo(junction)))).toBeLessThan(.3);
 expect(pathsOverlap(after,trunkPath)).toBe(false);
 expect(pathsOverlap(after,path(signal,components))).toBe(false);
 const saved=ProjectSchema.parse({...initialProject,components,wires:result});
 expect(saved.wires[1].from).toEqual(branch.from);expect(saved.wires[1].to).toEqual(branch.to);
 expect('routingJunction' in saved.wires[1]).toBe(false);
});

it('keeps manual routes and single connections untouched',()=>{
 const components=[component('a',-40,0),component('b',40,0),component('c',0,20)];
 const trunk={...wire('manual','a','b',[[-40,0,1],[40,0,1]]),routeMode:'manual' as const};
 const branch=wire('branch','c','a',[[0,20,1],[-40,0,1]]);
 const wires=[trunk,branch];expect(shareCleanNetRoutes(wires,components)).toBe(wires);
});
