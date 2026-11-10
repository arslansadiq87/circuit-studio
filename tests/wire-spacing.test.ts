import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {makeWireCurve,worldPin,worldPinDirection,worldPinWireEntry} from '../src/geometry';
import {assignAutoLanes,nextAutoLane} from '../src/wireSpacing';
import {ESP32_C6_COMPONENT,STEPPER_24BYJ_48_COMPONENT,initialProject,normalizeProjectNames,ProjectSchema,type Wire} from '../src/model';
import {makeIcPackage} from '../src/icPackage';
import {pathsOverlap,planAutoWires} from '../src/autoRouting';

const wire=(id:string,from:string,to:string):Wire=>({id,from:{componentId:'sop',pinId:from},to:{componentId:'c6',pinId:to},color:'#ffffff',diameter:1.05,label:id,curvature:19,routeMode:'auto'});

describe('automatic wire spacing',()=>{
 it('assigns separate lanes to new and restored automatic connections',()=>{
  const old=[wire('one','P1','J1-1'),wire('two','P2','J1-2'),wire('three','P3','J1-3')];
  const spaced=assignAutoLanes(old);
  expect(spaced.map(w=>w.autoLane)).toEqual([0,1,2]);
  expect(nextAutoLane(spaced,old[0].from,old[0].to)).toBe(3);
  expect(nextAutoLane(old,old[0].from,old[0].to)).toBe(3);
  expect(normalizeProjectNames({...initialProject,wires:old}).wires.map(w=>w.autoLane)).toEqual([0,1,2]);
  expect(assignAutoLanes(spaced)).toBe(spaced);
  const separate={...wire('other','P4','J1-4'),to:{componentId:'another-board',pinId:'P1'},autoLane:17};
  expect(assignAutoLanes([...spaced,separate]).map(w=>w.autoLane)).toEqual([0,1,2,0]);
 });
 it('lifts crossing automatic curves onto separate levels while keeping their contacts fixed',()=>{
  const [first,second]=assignAutoLanes([wire('one','P1','J1-2'),wire('two','P2','J1-1')]);
  const a1=new THREE.Vector3(0,-2,0),b1=new THREE.Vector3(20,2,0),a2=new THREE.Vector3(0,2,0),b2=new THREE.Vector3(20,-2,0),out=new THREE.Vector3(1,0,0),enter=new THREE.Vector3(-1,0,0);
  const firstCurve=makeWireCurve(first,a1,b1,out,enter),secondCurve=makeWireCurve(second,a2,b2,out,enter);
  expect(firstCurve.getPoint(0).distanceTo(a1)).toBeLessThan(1e-8);
  expect(secondCurve.getPoint(1).distanceTo(b2)).toBeLessThan(1e-8);
  const firstPoints=firstCurve.getPoints(100),secondPoints=secondCurve.getPoints(100);
  const closest=Math.min(...firstPoints.flatMap(a=>secondPoints.map(b=>a.distanceTo(b))));
  expect(closest).toBeGreaterThan(.75);
 });
 it('keeps long SOP-to-board connections close to their direct distance',()=>{
  const a=new THREE.Vector3(0,0,0),b=new THREE.Vector3(45,0,.65);
  const route=makeWireCurve({...wire('short','P6','J1-1'),autoLane:4},a,b,new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,1));
  const points=route.getPoints(100);
  expect(route.getLength()).toBeLessThan(a.distanceTo(b)*1.25);
  expect(Math.max(...points.map(point=>point.z))).toBeLessThan(12);
 });
 it('keeps parallel wires in distinct tracks within a component pair',()=>{
  const left={...makeIcPackage(4),id:'sop',position:[0,0,0] as [number,number,number]};
  const right={...makeIcPackage(4),id:'c6',position:[20,0,0] as [number,number,number]};
  const parallel=[wire('top','P4','P1'),wire('bottom','P3','P2')];
  expect(assignAutoLanes(parallel,[left,right]).map(w=>w.autoLane)).toEqual([0,1]);
  const crossed=[wire('top','P4','P2'),wire('bottom','P3','P1')];
  expect(assignAutoLanes(crossed,[left,right]).map(w=>w.autoLane)).toEqual([0,1]);
 });
 it('routes SOP wires around the C6 body before reaching far-side pads',()=>{
  const ic={...makeIcPackage(10),id:'sop',position:[-30,0,0] as [number,number,number]};
  const c6={...ESP32_C6_COMPONENT,id:'c6',position:[25,0,0] as [number,number,number]};
  const pinA=ic.pins.find(p=>p.id==='P6')!,pinB=c6.pins.find(p=>p.id==='J2-1')!,a=worldPin(pinA,ic),b=worldPin(pinB,c6);
  const route=makeWireCurve({...wire('around','P6','J2-1'),autoLane:0},a,b,worldPinDirection(pinA,ic),worldPinDirection(pinB,c6),undefined,undefined,[ic,c6]);
  const points=route.getSpacedPoints(200);
  expect(points.every(point=>point.distanceTo(b)<3||!(point.x>17&&point.x<33&&Math.abs(point.y)<13))).toBe(true);
  expect(route.getLength()).toBeLessThan(a.distanceTo(b)*2.5);
 });
 it('keeps five automatic SOP-to-C6 routes physically separate',()=>{
  const ic={...makeIcPackage(10),id:'sop',position:[-30,0,0] as [number,number,number]};
  const c6={...ESP32_C6_COMPONENT,id:'c6',position:[25,0,0] as [number,number,number]};
  const planned=planAutoWires(Array.from({length:5},(_,i)=>wire(`w${i}`,`P${6+i}`,`J2-${i+1}`)),[ic,c6]);
  const paths=planned.map(w=>{
   const first=ic.pins.find(p=>p.id===w.from.pinId)!,last=c6.pins.find(p=>p.id===w.to.pinId)!,start=worldPin(first,ic),end=worldPin(last,c6);
   const curve=makeWireCurve(w,start,end,worldPinDirection(first,ic),worldPinDirection(last,c6),undefined,undefined,[ic,c6]);
   return {wire:w,start,end,points:curve.getSpacedPoints(Math.max(40,Math.ceil(curve.getLength()/1.1)))};
  });
  for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++)expect(pathsOverlap(paths[i],paths[j])).toBe(false);
  expect(Math.max(...planned.map(w=>w.autoLane??0))).toBeLessThan(8);
 });
 it('detects a real 3D crossing but accepts wires on separate levels',()=>{
  const first=wire('first','P1','J1-1'),second=wire('second','P2','J1-2');
  const horizontal={wire:first,start:new THREE.Vector3(-1,0,0),end:new THREE.Vector3(1,0,0),points:[new THREE.Vector3(-1,0,0),new THREE.Vector3(1,0,0)]};
  const vertical={wire:second,start:new THREE.Vector3(0,-1,0),end:new THREE.Vector3(0,1,0),points:[new THREE.Vector3(0,-1,0),new THREE.Vector3(0,1,0)]};
  expect(pathsOverlap(horizontal,vertical)).toBe(true);
  const raised={...vertical,points:vertical.points.map(point=>point.clone().setZ(2)),start:vertical.start.clone().setZ(2),end:vertical.end.clone().setZ(2)};
  expect(pathsOverlap(horizontal,raised)).toBe(false);
 });
 it('lays out Automatic Clean as rounded right-angle tracks without wire collisions',()=>{
  const ic={...makeIcPackage(10),id:'sop',position:[-30,0,0] as [number,number,number]};
  const c6={...ESP32_C6_COMPONENT,id:'c6',position:[25,0,0] as [number,number,number]};
  const wires=Array.from({length:5},(_,i)=>({...wire(`clean-${i}`,`P${6+i}`,`J2-${i+1}`),routeMode:'clean' as const}));
  const planned=planAutoWires(wires,[ic,c6]);
  expect(ProjectSchema.parse({...initialProject,components:[ic,c6],wires}).wires.every(w=>w.routeMode==='clean')).toBe(true);
  const paths=planned.map(w=>{
   const first=ic.pins.find(p=>p.id===w.from.pinId)!,last=c6.pins.find(p=>p.id===w.to.pinId)!,start=worldPin(first,ic),end=worldPin(last,c6);
   const curve=makeWireCurve(w,start,end,worldPinDirection(first,ic),worldPinDirection(last,c6),undefined,undefined,[ic,c6]);
   expect(curve).toBeInstanceOf(THREE.CurvePath);
   for(const segment of (curve as THREE.CurvePath<THREE.Vector3>).curves)if(segment instanceof THREE.LineCurve3){
    const delta=segment.v2.clone().sub(segment.v1);
    expect(Math.abs(delta.x)<1e-5||Math.abs(delta.y)<1e-5).toBe(true);
   }
   return {wire:w,start,end,points:curve.getSpacedPoints(Math.max(40,Math.ceil(curve.getLength()/1.1)))};
  });
  for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++)expect(pathsOverlap(paths[i],paths[j])).toBe(false);
  expect(Math.max(...planned.map(w=>w.autoLane??0))).toBeLessThan(8);
 });
 it('keeps the motor connector to IC bundle compact and separate',()=>{
  const motor={...STEPPER_24BYJ_48_COMPONENT,id:'motor',position:[-65,0,0] as [number,number,number]};
  const ic={...makeIcPackage(10),id:'ic',position:[-25,0,0] as [number,number,number]};
  const wires=Array.from({length:5},(_,i)=>({...wire(`motor-${i}`,`J1-${i+1}`,`P${i+1}`),from:{componentId:'motor',pinId:`J1-${i+1}`},to:{componentId:'ic',pinId:`P${i+1}`},routeMode:'clean' as const}));
  const planned=planAutoWires(wires,[motor,ic]);
  expect(Math.max(...planned.map(w=>w.autoLane??0))).toBeLessThan(3);
  const paths=planned.map(w=>{
   const first=motor.pins.find(p=>p.id===w.from.pinId)!,last=ic.pins.find(p=>p.id===w.to.pinId)!,start=worldPin(first,motor),end=worldPin(last,ic);
   const curve=makeWireCurve(w,start,end,worldPinDirection(first,motor),worldPinDirection(last,ic),worldPinWireEntry(first,motor),undefined,[motor,ic]);
   expect(curve.getLength()).toBeLessThan(100);
   return {wire:w,start,end,points:curve.getSpacedPoints(Math.max(40,Math.ceil(curve.getLength()/1.1)))};
  });
  for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++)expect(pathsOverlap(paths[i],paths[j])).toBe(false);
 });
});
