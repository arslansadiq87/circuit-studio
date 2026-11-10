import * as THREE from 'three';
import type { Component, Pin } from './model';
import type { Wire } from './model';
import {AUTO_WIRE_SPACING_MM} from './wireSpacing';
import {cleanRoutePoints} from './cleanRouting';
export function localPin(pin:Pin,_component:Component){if(pin.localPosition)return new THREE.Vector3(...pin.localPosition);return new THREE.Vector3(pin.side==='left'?-15:15,9-pin.index*.87,2.4)}
export function worldPin(pin:Pin,component:Component){return localPin(pin,component).applyEuler(new THREE.Euler(...component.rotation.map(v=>THREE.MathUtils.degToRad(v)) as [number,number,number])).add(new THREE.Vector3(...component.position))}
export function resolvePin(component:Component,pinId:string){return component.pins.find(pin=>pin.id===pinId)}
export function fitModelScale(source:[number,number,number],target:[number,number,number]):[number,number,number]{return target.map((value,axis)=>value/(Math.abs(source[axis])>1e-9?Math.abs(source[axis]):1)) as [number,number,number]}


export function worldPinDirection(pin:Pin,component:Component){const local=new THREE.Vector3(...(pin.exitDirection??[0,0,1]));if(component.modelId==='stepper-24byj-48'&&(pin.localPosition?.[1]??0)<-15.8&&local.y>0.9)local.set(0,-1,0);if(pin.orientation)local.applyEuler(new THREE.Euler(...pin.orientation.map(v=>THREE.MathUtils.degToRad(v)) as [number,number,number]));return local.applyEuler(new THREE.Euler(...component.rotation.map(v=>THREE.MathUtils.degToRad(v)) as [number,number,number])).normalize()}
export type WireEntry={opening:THREE.Vector3;insertionDirection:THREE.Vector3;insertionDepth:number;approachLength:number;clearanceDirection:THREE.Vector3;clearanceOffset:number;flatApproach?:boolean};
export function worldPinWireEntry(pin:Pin,component:Component):WireEntry|undefined{const entry=pin.wireEntry??(component.modelId==='stepper-24byj-48'&&(pin.localPosition?.[1]??0)<-15.8?{entryPosition:pin.localPosition!,insertionDirection:[0,1,0] as [number,number,number],insertionDepth:.01,approachLength:4,clearanceDirection:[0,-1,0] as [number,number,number],clearanceOffset:3}:undefined);if(!entry)return undefined;const componentRotation=new THREE.Euler(...component.rotation.map(v=>THREE.MathUtils.degToRad(v)) as [number,number,number]),pinRotation=pin.orientation?new THREE.Euler(...pin.orientation.map(v=>THREE.MathUtils.degToRad(v)) as [number,number,number]):undefined,rotate=(direction:[number,number,number])=>{const value=new THREE.Vector3(...direction);if(pinRotation)value.applyEuler(pinRotation);return value.applyEuler(componentRotation).normalize()};return {opening:new THREE.Vector3(...entry.entryPosition).applyEuler(componentRotation).add(new THREE.Vector3(...component.position)),insertionDirection:rotate(entry.insertionDirection),insertionDepth:entry.insertionDepth,approachLength:entry.approachLength,clearanceDirection:rotate(entry.clearanceDirection),clearanceOffset:entry.clearanceOffset,flatApproach:component.modelId==='stepper-24byj-48'}}
type Footprint={minX:number;maxX:number;minY:number;maxY:number};
function footprint(component:Component,margin:number):Footprint{
 const [width,height,depth]=component.dimensions??[28,20,8],rotation=new THREE.Euler(...component.rotation.map(THREE.MathUtils.degToRad) as [number,number,number]);
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const x of [-width/2,width/2])for(const y of [-height/2,height/2])for(const z of [-depth/2,depth/2]){
  const point=new THREE.Vector3(x,y,z).applyEuler(rotation).add(new THREE.Vector3(...component.position));
  minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);
 }
 return {minX:minX-margin,maxX:maxX+margin,minY:minY-margin,maxY:maxY+margin};
}
function outsideContact(point:THREE.Vector3,box:Footprint):THREE.Vector3{
 if(point.x<box.minX||point.x>box.maxX||point.y<box.minY||point.y>box.maxY)return point.clone();
 const sides=[{distance:Math.abs(point.x-box.minX),axis:'x',value:box.minX},{distance:Math.abs(point.x-box.maxX),axis:'x',value:box.maxX},{distance:Math.abs(point.y-box.minY),axis:'y',value:box.minY},{distance:Math.abs(point.y-box.maxY),axis:'y',value:box.maxY}] as const;
 const side=sides.reduce((best,item)=>item.distance<best.distance?item:best);
 return new THREE.Vector3(side.axis==='x'?side.value:point.x,side.axis==='y'?side.value:point.y,point.z);
}
function crossesInterior(a:THREE.Vector3,b:THREE.Vector3,box:Footprint):boolean{
 const minX=box.minX+.02,maxX=box.maxX-.02,minY=box.minY+.02,maxY=box.maxY-.02;
 let enter=0,leave=1;
 for(const [start,delta,min,max] of [[a.x,b.x-a.x,minX,maxX],[a.y,b.y-a.y,minY,maxY]]){
  if(Math.abs(delta)<1e-9){if(start<=min||start>=max)return false;continue}
  const t1=(min-start)/delta,t2=(max-start)/delta;
  enter=Math.max(enter,Math.min(t1,t2));leave=Math.min(leave,Math.max(t1,t2));
  if(enter>=leave)return false;
 }
 return enter<1&&leave>0;
}
function roundedPath(points:THREE.Vector3[],maxRadius=2.2):THREE.Curve<THREE.Vector3>{
 const vertices:THREE.Vector3[]=[];
 for(const point of points){
  const previous=vertices.at(-1);if(previous&&previous.distanceToSquared(point)<1e-12)continue;
  while(vertices.length>1){const a=vertices.at(-1)!.clone().sub(vertices.at(-2)!),b=point.clone().sub(vertices.at(-1)!);if(a.clone().cross(b).lengthSq()>1e-10)break;vertices.pop()}
  vertices.push(point);
 }
 const path=new THREE.CurvePath<THREE.Vector3>();let cursor=vertices[0];
 for(let i=1;i<vertices.length-1;i++){
  const before=vertices[i-1],corner=vertices[i],after=vertices[i+1],incoming=corner.clone().sub(before),outgoing=after.clone().sub(corner);
  const inLength=incoming.length(),outLength=outgoing.length();incoming.normalize();outgoing.normalize();
  const angle=Math.acos(THREE.MathUtils.clamp(incoming.dot(outgoing),-1,1)),halfTurn=Math.tan(angle/2);
  const trim=Math.min(maxRadius*halfTurn,inLength*.45,outLength*.45);
  if(trim<.01||!Number.isFinite(halfTurn)||angle>Math.PI-.001){if(cursor.distanceTo(corner)>1e-6)path.add(new THREE.LineCurve3(cursor,corner));cursor=corner;continue}
  const enter=corner.clone().addScaledVector(incoming,-trim),exit=corner.clone().addScaledVector(outgoing,trim);
  if(cursor.distanceTo(enter)>1e-6)path.add(new THREE.LineCurve3(cursor,enter));
  const handle=4/3*(trim/halfTurn)*Math.tan(angle/4);
  path.add(new THREE.CubicBezierCurve3(enter,enter.clone().addScaledVector(incoming,handle),exit.clone().addScaledVector(outgoing,-handle),exit));cursor=exit;
 }
 if(cursor&&cursor.distanceTo(vertices.at(-1)!)>1e-6)path.add(new THREE.LineCurve3(cursor,vertices.at(-1)!));
 return path;
}
function obstacleRoute(wire:Wire,a:THREE.Vector3,b:THREE.Vector3,components:Component[]):THREE.Curve<THREE.Vector3>|undefined{
 const source=components.find(c=>c.id===wire.from.componentId),target=components.find(c=>c.id===wire.to.componentId);
 if(!source||!target||source.id===target.id)return undefined;
 const margin=4+(wire.autoLane??0)*1.25,boxes=components.filter(c=>c.visible!==false).map(c=>({id:c.id,box:footprint(c,margin)})),sourceBox=boxes.find(c=>c.id===source.id)?.box,targetBox=boxes.find(c=>c.id===target.id)?.box;
 if(!sourceBox||!targetBox)return undefined;
 const start=outsideContact(a,sourceBox),end=outsideContact(b,targetBox),nodes=[start,end,...boxes.flatMap(({box})=>[new THREE.Vector3(box.minX,box.minY,0),new THREE.Vector3(box.minX,box.maxY,0),new THREE.Vector3(box.maxX,box.minY,0),new THREE.Vector3(box.maxX,box.maxY,0)])];
 const distances=new Array<number>(nodes.length).fill(Infinity),previous=new Array<number>(nodes.length).fill(-1),visited=new Set<number>();distances[0]=0;
 for(let step=0;step<nodes.length;step++){
  let current=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(current<0||distances[i]<distances[current]))current=i;
  if(current<0||!Number.isFinite(distances[current])||current===1)break;visited.add(current);
  for(let next=0;next<nodes.length;next++){
   if(next===current||visited.has(next)||boxes.some(({box})=>crossesInterior(nodes[current],nodes[next],box)))continue;
   const candidate=distances[current]+nodes[current].distanceTo(nodes[next]);if(candidate<distances[next]){distances[next]=candidate;previous[next]=current}
  }
 }
 if(!Number.isFinite(distances[1]))return undefined;
 const indices:number[]=[];for(let index=1;index>=0;index=previous[index]){indices.push(index);if(index===0)break}
 indices.reverse();const laneHeight=(wire.liftHeight??0)+(wire.autoLane??0)*AUTO_WIRE_SPACING_MM,routeHeight=Math.max(a.z,b.z)+Math.max(0,laneHeight);
 const middle=indices.map((index,i)=>new THREE.Vector3(nodes[index].x,nodes[index].y,i===0?a.z:i===indices.length-1?b.z:routeHeight));
 return roundedPath([a,...middle,b]);
}
function overheadCleanRoute(wire:Wire,a:THREE.Vector3,b:THREE.Vector3,components:Component[]):THREE.Curve<THREE.Vector3>{
 const lane=wire.autoLane??0,horizontal=Math.abs(b.x-a.x)>=Math.abs(b.y-a.y),distance=horizontal?Math.abs(b.x-a.x):Math.abs(b.y-a.y),direction=horizontal?Math.sign(b.x-a.x)||1:Math.sign(b.y-a.y)||1;
 const approach=Math.min(8,Math.max(3,distance*.16)),arrival=Math.min(5,Math.max(2,distance*.1)),channel=horizontal?(a.y+b.y)/2:(a.x+b.x)/2;
 const xy=horizontal?[
  [a.x+direction*approach,a.y],[a.x+direction*approach,channel],[b.x-direction*arrival,channel],[b.x-direction*arrival,b.y],[b.x,b.y]
 ]:[
  [a.x,a.y+direction*approach],[channel,a.y+direction*approach],[channel,b.y-direction*arrival],[b.x,b.y-direction*arrival],[b.x,b.y]
 ];
 const planar=[a,...xy.map(([x,y])=>new THREE.Vector3(x,y,0)),b],crossed=components.filter(component=>{
  const box=footprint(component,0);
  return planar.some(point=>point.x>box.minX&&point.x<box.maxX&&point.y>box.minY&&point.y<box.maxY)||planar.slice(1).some((point,i)=>crossesInterior(planar[i],point,box));
 });
 const top=Math.max(a.z,b.z,...crossed.map(component=>component.position[2]+(component.dimensions?.[2]??8)/2+1.5));
 const height=top+Math.max(0,wire.liftHeight??0)+lane*1.8;
 return roundedPath([a,...xy.map(([x,y])=>new THREE.Vector3(x,y,height)),b]);
}
function shortestCleanRoute(wire:Wire,a:THREE.Vector3,b:THREE.Vector3,components:Component[]):THREE.Curve<THREE.Vector3>{
 return overheadCleanRoute(wire,a,b,components);
}
export function makeWireCurve(wire:Wire,a:THREE.Vector3,b:THREE.Vector3,da:THREE.Vector3,db:THREE.Vector3,startEntry?:WireEntry,endEntry?:WireEntry,components?:Component[]):THREE.Curve<THREE.Vector3>{
 if(wire.routeMode==='clean'&&components){const points=wire.routingPoints?.map(p=>new THREE.Vector3(...p))??cleanRoutePoints(wire,components);if(points)return roundedPath(points,1.1)}
 if((wire.routeMode??'auto')==='auto'&&!startEntry&&!endEntry&&components){const route=obstacleRoute(wire,a,b,components);if(route)return route}
 if(wire.routeMode==='clean'&&!startEntry&&!endEntry&&components)return shortestCleanRoute(wire,a,b,components);
 const mode=wire.routeMode??'auto',flatAuto=mode==='auto'&&(startEntry?.flatApproach||endEntry?.flatApproach),lift=Math.max(0,flatAuto?(wire.liftHeight??2):(wire.liftHeight??8)+(mode==='auto'?(wire.autoLane??0)*AUTO_WIRE_SPACING_MM:0)),up=new THREE.Vector3(0,0,lift),startInside=startEntry?startEntry.opening.clone().addScaledVector(startEntry.insertionDirection,startEntry.insertionDepth):a.clone(),endInside=endEntry?endEntry.opening.clone().addScaledVector(endEntry.insertionDirection,endEntry.insertionDepth):b.clone(),startApproach=startEntry?startEntry.opening.clone().addScaledVector(startEntry.insertionDirection,-startEntry.approachLength):undefined,endApproach=endEntry?endEntry.opening.clone().addScaledVector(endEntry.insertionDirection,-endEntry.approachLength):undefined,startClear=startEntry?startApproach!.clone().addScaledVector(startEntry.clearanceDirection,startEntry.clearanceOffset):undefined,endClear=endEntry?endApproach!.clone().addScaledVector(endEntry.clearanceDirection,endEntry.clearanceOffset):undefined,stubA=a.clone().add(da.clone().multiplyScalar(3)),stubB=b.clone().add(db.clone().multiplyScalar(3));
 const startPath=startEntry?[startInside,startEntry.opening,startApproach!,startClear!]:[a,stubA],endPath=endEntry?[endClear!,endApproach!,endEntry.opening,endInside]:[stubB,b];
 if(mode==='clean'&&components){const middle=shortestCleanRoute(wire,startEntry?startClear!:a,endEntry?endClear!:b,components),path=new THREE.CurvePath<THREE.Vector3>();if(startEntry){path.add(new THREE.LineCurve3(startInside,startEntry.opening));path.add(new THREE.LineCurve3(startEntry.opening,startApproach!));path.add(new THREE.LineCurve3(startApproach!,startClear!))}path.add(middle);if(endEntry){path.add(new THREE.LineCurve3(endClear!,endApproach!));path.add(new THREE.LineCurve3(endApproach!,endEntry.opening));path.add(new THREE.LineCurve3(endEntry.opening,endInside))}return path}
 if(mode==='straight'){if(!startEntry&&!endEntry)return new THREE.LineCurve3(a,b);const path=new THREE.CurvePath<THREE.Vector3>();if(startEntry){path.add(new THREE.LineCurve3(startInside,startEntry.opening));path.add(new THREE.LineCurve3(startEntry.opening,startApproach!));path.add(new THREE.LineCurve3(startApproach!,startClear!));}path.add(new THREE.LineCurve3(startEntry?startClear!:a,endEntry?endClear!:b));if(endEntry){path.add(new THREE.LineCurve3(endClear!,endApproach!));path.add(new THREE.LineCurve3(endApproach!,endEntry.opening));path.add(new THREE.LineCurve3(endEntry.opening,endInside));}return path}
 if(mode==='manual'&&wire.bendPoints?.length){if(!startEntry&&!endEntry)return new THREE.CatmullRomCurve3([a,stubA,...wire.bendPoints.map(p=>new THREE.Vector3(...p)),stubB,b],false,'centripetal');const path=new THREE.CurvePath<THREE.Vector3>(),routeStart=startEntry?startClear!:a,routeEnd=endEntry?endClear!:b,manualPoints=[routeStart,...wire.bendPoints.map(p=>new THREE.Vector3(...p)),routeEnd];if(startEntry){path.add(new THREE.LineCurve3(startInside,startEntry.opening));path.add(new THREE.LineCurve3(startEntry.opening,startApproach!));path.add(new THREE.LineCurve3(startApproach!,startClear!))}path.add(new THREE.CatmullRomCurve3(manualPoints,false,'centripetal'));if(endEntry){path.add(new THREE.LineCurve3(endClear!,endApproach!));path.add(new THREE.LineCurve3(endApproach!,endEntry.opening));path.add(new THREE.LineCurve3(endEntry.opening,endInside))}return path}
 if(mode==='orthogonal'){const target=endClear??stubB,h1=stubA.clone().add(up),h2=new THREE.Vector3(target.x,stubA.y,(stubA.z+target.z)/2+lift),h3=target.clone().add(up);return new THREE.CatmullRomCurve3([...startPath,h1,h2,h3,...endPath],false,'centripetal')}
 if(startEntry||endEntry){const routeStart=startEntry?startClear!:a,routeEnd=endEntry?endClear!:b,startDirection=startEntry?(startEntry.flatApproach?startEntry.clearanceDirection.clone():startEntry.clearanceDirection.clone().negate()):da.clone(),endDirection=endEntry?(endEntry.flatApproach?endEntry.clearanceDirection.clone().negate():endEntry.clearanceDirection):db.clone().negate(),handle=Math.max(2,Math.abs(wire.curvature??19)),p1=routeStart.clone().addScaledVector(startDirection,handle).add(up),p2=routeEnd.clone().addScaledVector(endDirection,-handle).add(endEntry?new THREE.Vector3():up),path=new THREE.CurvePath<THREE.Vector3>();if(startEntry){path.add(new THREE.LineCurve3(startInside,startEntry.opening));path.add(new THREE.LineCurve3(startEntry.opening,startApproach!));path.add(new THREE.LineCurve3(startApproach!,startClear!))}path.add(new THREE.CubicBezierCurve3(routeStart,p1,p2,routeEnd));if(endEntry){path.add(new THREE.LineCurve3(endClear!,endApproach!));path.add(new THREE.LineCurve3(endApproach!,endEntry.opening));path.add(new THREE.LineCurve3(endEntry.opening,endInside))}return path}
 const distance=a.distanceTo(b),handle=Math.min(7,Math.max(1.2,distance*.18),Math.max(1.2,Math.abs(wire.curvature??19)*.35)),autoLift=Math.max(0,(wire.liftHeight??0)+(wire.autoLane??0)*AUTO_WIRE_SPACING_MM),arc=new THREE.Vector3(0,0,autoLift),p1=a.clone().addScaledVector(da,Math.abs(da.z)>.7?Math.min(3,handle):handle).add(arc),p2=b.clone().addScaledVector(db,Math.abs(db.z)>.7?Math.min(3,handle):handle).add(arc);return new THREE.CubicBezierCurve3(a,p1,p2,b)
}
