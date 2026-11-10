import {describe,expect,it} from 'vitest';
import {makeIcPackage} from '../src/icPackage';
import {planAutoWires,pathsOverlap} from '../src/autoRouting';
import {makeWireCurve,worldPin,worldPinDirection,worldPinWireEntry} from '../src/geometry';
import {ProjectSchema,initialProject,STEPPER_24BYJ_48_COMPONENT,type Component,type Wire} from '../src/model';

const ic=(id:string,x:number,y:number):Component=>({...makeIcPackage(10),id,position:[x,y,0]});
const wire=(id:string,from:string,pinA:string,to:string,pinB:string):Wire=>({id,from:{componentId:from,pinId:pinA},to:{componentId:to,pinId:pinB},diameter:1.05,color:'#40ccbb',label:id,curvature:19,routeMode:'clean'});
function paths(wires:Wire[],components:Component[]){
 return planAutoWires(wires,components).map(w=>{
  expect(w.routingPoints,`route for ${w.id}`).toBeDefined();
  const a=components.find(c=>c.id===w.from.componentId)!,b=components.find(c=>c.id===w.to.componentId)!;
  const pa=a.pins.find(p=>p.id===w.from.pinId)!,pb=b.pins.find(p=>p.id===w.to.pinId)!,start=worldPin(pa,a),end=worldPin(pb,b);
  const curve=makeWireCurve(w,start,end,worldPinDirection(pa,a),worldPinDirection(pb,b),worldPinWireEntry(pa,a),worldPinWireEntry(pb,b),components);
  expect(curve.getPoint(0).distanceTo(start)).toBeLessThan(.02);
  expect(curve.getPoint(1).distanceTo(end)).toBeLessThan(.02);
  return {wire:w,start,end,curve,points:curve.getSpacedPoints(Math.ceil(curve.getLength()/.65))};
 });
}
function separate(routes:ReturnType<typeof paths>){
 for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++)expect(pathsOverlap(routes[i],routes[j]),`${routes[i].wire.id} / ${routes[j].wire.id}`).toBe(false);
}
describe('Automatic Clean shared routing plane',()=>{
 it.each([0,90])('aligns a connector bundle’s vertical drops in a common plane at %s degrees',rotation=>{
  const motor:Component={...STEPPER_24BYJ_48_COMPONENT,id:'motor',position:[-65,0,0],rotation:[0,0,rotation]};
  const components=[motor,ic('target',-25,0)];
  const routes=paths(Array.from({length:5},(_,i)=>wire(`drop${i}`,'motor',`J1-${i+1}`,'target',`P${i+1}`)),components);
  separate(routes);
  const planes=routes.map(route=>{
   const points=route.wire.routingPoints!;
   const index=points.findIndex((p,i)=>i>0&&points[i-1][2]-p[2]>5);
   expect(index).toBeGreaterThan(0);
   expect(points[index][0]).toBeCloseTo(points[index-1][0],5);
   expect(points[index][1]).toBeCloseTo(points[index-1][1],5);
   return points[index][rotation===0?1:0];
  });
  expect(Math.max(...planes)-Math.min(...planes)).toBeLessThan(.01);
 });
 it('keeps a parallel IC bus low, direct and evenly spaced',()=>{
  const components=[ic('a',-18,0),ic('b',18,0)];
  const routes=paths(Array.from({length:5},(_,i)=>wire(`bus${i}`,'a',`P${10-i}`,'b',`P${1+i}`)),components);
  separate(routes);
  for(const route of routes){
   expect(route.curve.getLength()).toBeLessThan(route.start.distanceTo(route.end)+3);
   expect(Math.max(...route.points.map(p=>p.z))).toBeLessThan(1);
   expect(Math.max(...route.points.map(p=>Math.abs(p.y-route.start.y)))).toBeLessThan(.01);
  }
 });
 it('routes around an intervening package rather than raising the entire bus',()=>{
  const components=[ic('a',-25,0),ic('b',25,0),{...ic('obstacle',0,0),dimensions:[10,14,4] as [number,number,number]}];
  const routes=paths(Array.from({length:5},(_,i)=>wire(`around${i}`,'a',`P${10-i}`,'b',`P${1+i}`)),components);
  separate(routes);
  for(const route of routes){
   expect(route.points.every(p=>Math.abs(p.x)>=5.35||Math.abs(p.y)>=7.35)).toBe(true);
   expect(Math.max(...route.points.map(p=>p.z))).toBeLessThan(1);
   expect(route.curve.getLength()).toBeLessThan(90);
  }
 });
 it('keeps rotated bundles compact when connections are drawn in either direction',()=>{
  const components=[{...ic('a',0,-18),rotation:[0,0,90] as [number,number,number]},{...ic('b',0,18),rotation:[0,0,90] as [number,number,number]}];
  const wires=Array.from({length:5},(_,i)=>i%2?wire(`rotated${i}`,'b',`P${1+i}`,'a',`P${10-i}`):wire(`rotated${i}`,'a',`P${10-i}`,'b',`P${1+i}`));
  const routes=paths(wires,components);separate(routes);
  for(const route of routes){
   expect(route.curve.getLength()).toBeLessThan(route.start.distanceTo(route.end)+3);
   expect(Math.max(...route.points.map(p=>p.z))).toBeLessThan(1);
  }
 });
 it('supports several IC bundles and leaves routing results out of saved projects',()=>{
  const components=Array.from({length:3},(_,i)=>[ic(`a${i}`,-18,i*24),ic(`b${i}`,18,i*24)]).flat();
  const wires=Array.from({length:3},(_,row)=>Array.from({length:5},(_,i)=>wire(`row${row}-${i}`,`a${row}`,`P${10-i}`,`b${row}`,`P${1+i}`))).flat();
  wires.push(...Array.from({length:5},(_,i)=>wire(`column${i}`,'a0',`P${1+i}`,'a1',`P${1+i}`)));
  const routes=paths(wires,components);separate(routes);
  expect(Math.max(...routes.flatMap(r=>r.points.map(p=>p.z)))).toBeLessThan(6);
  const saved=ProjectSchema.parse({...initialProject,components,wires:routes.map(r=>r.wire)});
  expect(saved.wires.every(w=>!('routingPoints' in w))).toBe(true);
  expect(wires.every(w=>!w.routingPoints)).toBe(true);
 });
});
