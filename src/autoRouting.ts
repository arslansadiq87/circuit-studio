import * as THREE from 'three';
import type {Component,Wire} from './model';
import {makeWireCurve,worldPin,worldPinDirection,worldPinWireEntry} from './geometry';
import {cleanEndpoints,cleanRoutePoints} from './cleanRouting';

type Path={wire:Wire;points:THREE.Vector3[];start:THREE.Vector3;end:THREE.Vector3;accessPin?:Wire['from'];joinPoint?:THREE.Vector3};
const samePin=(a:Wire['from'],b:Wire['from'])=>a.componentId===b.componentId&&a.pinId===b.pinId;

/** Only physical changes invalidate routing; labels and electrical metadata do not. */
export function routingGeometryKey(components:Component[],wires?:Wire[]):string{
 const connected=wires?new Set(wires.flatMap(w=>[w.from.componentId,w.to.componentId])):undefined;
 return JSON.stringify(components.filter(c=>!connected||connected.has(c.id)).map(c=>[c.id,c.modelId,c.visible,c.position,c.rotation,c.dimensions,c.pins.map(p=>[p.id,p.side,p.index,p.localPosition,p.orientation,p.exitDirection,p.wireEntry])]));
}

function pathFor(wire:Wire,components:Component[]):Path|undefined{
 const source=components.find(c=>c.id===wire.from.componentId),target=components.find(c=>c.id===wire.to.componentId);
 const first=source?.pins.find(p=>p.id===wire.from.pinId),last=target?.pins.find(p=>p.id===wire.to.pinId);
 if(!source||!target||!first||!last)return undefined;
 const start=worldPin(first,source),end=worldPin(last,target);
 const curve=makeWireCurve(wire,start,end,worldPinDirection(first,source),worldPinDirection(last,target),worldPinWireEntry(first,source),worldPinWireEntry(last,target),components);
 const segments=Math.min(1200,Math.max(64,Math.ceil(curve.getLength()/.45)));
 return {wire,points:curve.getSpacedPoints(segments),start:curve.getPoint(0),end:curve.getPoint(1)};
}

function segmentDistanceSquared(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3):number{
 const u=b.clone().sub(a),v=d.clone().sub(c),w=a.clone().sub(c),aa=u.dot(u),bb=u.dot(v),cc=v.dot(v),dd=u.dot(w),ee=v.dot(w),denom=aa*cc-bb*bb;
 if(aa<1e-10&&cc<1e-10)return a.distanceToSquared(c);
 if(aa<1e-10)return a.distanceToSquared(c.clone().addScaledVector(v,THREE.MathUtils.clamp(ee/cc,0,1)));
 if(cc<1e-10)return c.distanceToSquared(a.clone().addScaledVector(u,THREE.MathUtils.clamp(-dd/aa,0,1)));
 let sn:number,sd=denom,tn:number,td=denom;
 if(denom<1e-10){sn=0;sd=1;tn=ee;td=cc}else{
  sn=bb*ee-cc*dd;tn=aa*ee-bb*dd;
  if(sn<0){sn=0;tn=ee;td=cc}else if(sn>sd){sn=sd;tn=ee+bb;td=cc}
 }
 if(tn<0){tn=0;if(-dd<0)sn=0;else if(-dd>aa)sn=sd;else{sn=-dd;sd=aa}}
 else if(tn>td){tn=td;if(-dd+bb<0)sn=0;else if(-dd+bb>aa)sn=sd;else{sn=-dd+bb;sd=aa}}
 const s=Math.abs(sn)<1e-10?0:sn/sd,t=Math.abs(tn)<1e-10?0:tn/td;
 return w.addScaledVector(u,s).addScaledVector(v,-t).lengthSq();
}

export function pathsOverlap(a:Path,b:Path):boolean{
 const shared:THREE.Vector3[]=[];
 const endpointPoint=(path:Path,at:'from'|'to')=>path.wire.routingJunction?.at===at?new THREE.Vector3(...path.wire.routingJunction.position):at==='from'?path.start:path.end;
 for(const at of ['from','to'] as const){const endpoint=a.wire[at],point=endpointPoint(a,at);
  if((samePin(endpoint,b.wire.from)&&point.distanceTo(endpointPoint(b,'from'))<.01)||(samePin(endpoint,b.wire.to)&&point.distanceTo(endpointPoint(b,'to'))<.01))shared.push(point);
 }
 const joins=[a.wire.routingJunction?.wireId===b.wire.id?a.wire.routingJunction:undefined,b.wire.routingJunction?.wireId===a.wire.id?b.wire.routingJunction:undefined].filter(Boolean).map(join=>new THREE.Vector3(...join!.position));
 if(a.wire.routingJunction&&b.wire.routingJunction&&a.wire.routingJunction.wireId===b.wire.routingJunction.wireId){
  const point=new THREE.Vector3(...a.wire.routingJunction.position);if(point.distanceTo(new THREE.Vector3(...b.wire.routingJunction.position))<.01)joins.push(point);
 }
 const radius=Math.max(.38,a.wire.diameter*.32)+Math.max(.38,b.wire.diameter*.32)+.25,limit=radius*radius;
 for(let i=1;i<a.points.length;i++)for(let j=1;j<b.points.length;j++){
  const a0=a.points[i-1],a1=a.points[i],b0=b.points[j-1],b1=b.points[j];
  if(joins.some(point=>a0.distanceTo(point)<2&&a1.distanceTo(point)<2&&b0.distanceTo(point)<2&&b1.distanceTo(point)<2))continue;
  if(shared.some(point=>a0.distanceTo(point)<12&&a1.distanceTo(point)<12&&b0.distanceTo(point)<12&&b1.distanceTo(point)<12))continue;
  if(Math.max(Math.min(a0.x,a1.x),Math.min(b0.x,b1.x))-Math.min(Math.max(a0.x,a1.x),Math.max(b0.x,b1.x))>radius)continue;
  if(Math.max(Math.min(a0.y,a1.y),Math.min(b0.y,b1.y))-Math.min(Math.max(a0.y,a1.y),Math.max(b0.y,b1.y))>radius)continue;
  if(Math.max(Math.min(a0.z,a1.z),Math.min(b0.z,b1.z))-Math.min(Math.max(a0.z,a1.z),Math.max(b0.z,b1.z))>radius)continue;
  if(segmentDistanceSquared(a0,a1,b0,b1)<limit)return true;
 }
 return false;
}

/** Shorten only electrically shared clean nets; all other routes stay intact. */
export function shareCleanNetRoutes(wires:Wire[],components:Component[]):Wire[]{
 const eligible=wires.filter(w=>w.routeMode==='clean'&&w.visible!==false&&!w.routingBlocked&&w.routingPoints);
 const pinKey=(pin:Wire['from'])=>JSON.stringify([pin.componentId,pin.pinId]);
 const degree=new Map<string,number>();
 for(const wire of eligible)for(const pin of [wire.from,wire.to]){const key=pinKey(pin);degree.set(key,(degree.get(key)??0)+1)}
 // A connection between two shared terminals is a bridge in the net. Keep
 // its complete route so branch optimization cannot turn it into a short stub.
 const bridgesSharedPins=(wire:Wire)=>(degree.get(pinKey(wire.from))??0)>1&&(degree.get(pinKey(wire.to))??0)>1;
 const parent=new Map<string,string>();
 const root=(key:string):string=>{const next=parent.get(key);if(!next){parent.set(key,key);return key}if(next===key)return key;const result=root(next);parent.set(key,result);return result};
 for(const wire of eligible)parent.set(root(pinKey(wire.from)),root(pinKey(wire.to)));
 const groups=new Map<string,Wire[]>();
 for(const wire of eligible){const key=root(pinKey(wire.from)),group=groups.get(key)??[];group.push(wire);groups.set(key,group)}
 if(![...groups.values()].some(group=>group.length>1))return wires;
 const result=new Map(wires.map(w=>[w.id,w])),paths=new Map<string,Path>();
 for(const wire of wires.filter(w=>w.visible!==false&&!w.routingBlocked)){const path=pathFor(wire,components);if(path)paths.set(wire.id,path)}
 const length=(path:Path)=>path.points.slice(1).reduce((total,p,i)=>total+p.distanceTo(path.points[i]),0);
 // Junctions belong in open space, never inside or underneath a component.
 const footprints=components.filter(c=>c.visible!==false).map(c=>{
  const box=new THREE.Box3(),[w,h,d]=c.dimensions??[28,20,8],rotation=new THREE.Euler(...c.rotation.map(THREE.MathUtils.degToRad) as [number,number,number]);
  for(const x of [-w/2,w/2])for(const y of [-h/2,h/2])for(const z of [-d/2,d/2])box.expandByPoint(new THREE.Vector3(x,y,z).applyEuler(rotation).add(new THREE.Vector3(...c.position)));
  return {id:c.id,box:box.expandByScalar(1)};
 });
 const open=(point:THREE.Vector3)=>!footprints.some(({box})=>point.x>box.min.x&&point.x<box.max.x&&point.y>box.min.y&&point.y<box.max.y);
 const clearOfBodies=(path:Path,leads:{id:string;points:THREE.Vector3[]}[])=>!path.points.some(point=>footprints.some(({id,box})=>{
  if(point.x<=box.min.x+1||point.x>=box.max.x-1||point.y<=box.min.y+1||point.y>=box.max.y-1)return false;
  return !leads.some(lead=>lead.id===id&&lead.points.slice(1).some((end,i)=>segmentDistanceSquared(point,point,lead.points[i],end)<.25));
 }));
 const continuationLength=(ids:Set<string>,queryWire:string,query:THREE.Vector3,target:THREE.Vector3)=>{
  const key=(p:THREE.Vector3)=>p.toArray().map(v=>v.toFixed(5)).join(','),graph=new Map<string,{to:string;cost:number}[]>();
  const connect=(a:string,b:string,cost:number)=>{graph.set(a,[...(graph.get(a)??[]),{to:b,cost}]);graph.set(b,[...(graph.get(b)??[]),{to:a,cost}])};
  for(const id of ids){
   const path=paths.get(id)!;
   const arc=(point:THREE.Vector3)=>{
    let travelled=0,best=Infinity,along=0;
    for(let i=1;i<path.points.length;i++){
     const a=path.points[i-1],delta=path.points[i].clone().sub(a),size=delta.length(),t=size?THREE.MathUtils.clamp(point.clone().sub(a).dot(delta)/(size*size),0,1):0;
     const gap=point.distanceToSquared(a.clone().addScaledVector(delta,t));
     if(gap<best){best=gap;along=travelled+t*size}travelled+=size;
    }
    return along;
   };
   const split=[{node:key(path.start),at:0},{node:key(path.end),at:length(path)}];
   for(const childId of ids){const junction=paths.get(childId)!.wire.routingJunction;if(junction?.wireId===id){const point=new THREE.Vector3(...junction.position);split.push({node:key(point),at:arc(point)})}}
   if(id===queryWire)split.push({node:key(query),at:arc(query)});
   split.sort((a,b)=>a.at-b.at);for(let i=1;i<split.length;i++)connect(split[i-1].node,split[i].node,split[i].at-split[i-1].at);
  }
  const distance=new Map([[key(query),0]]),done=new Set<string>();
  while(true){let next:string|undefined;for(const node of distance.keys())if(!done.has(node)&&(next===undefined||distance.get(node)!<distance.get(next)!))next=node;
   if(next===undefined)return Infinity;if(next===key(target))return distance.get(next)!;done.add(next);
   for(const edge of graph.get(next)??[]){const cost=distance.get(next)!+edge.cost;if(cost<(distance.get(edge.to)??Infinity))distance.set(edge.to,cost)}
  }
 };
 for(const group of groups.values()){
  if(group.length<2||group.some(w=>!paths.has(w.id)))continue;
  // Retain a complete trunk, then connect each remaining terminal to the tree.
  const remaining=[...group].sort((a,b)=>length(paths.get(b.id)!)-length(paths.get(a.id)!)),trunk=remaining.shift()!;
  const tree=new Set([trunk.id]),connected=new Set([pinKey(trunk.from),pinKey(trunk.to)]);
  const freeEnds=new Map<string,'from'|'to'>();
  for(let refinement=0;refinement<2;refinement++){
  while(remaining.length){
   const index=remaining.findIndex(w=>connected.has(pinKey(w.from))||connected.has(pinKey(w.to)));
   if(index<0)break;
   const wire=remaining.splice(index,1)[0],oldPath=paths.get(wire.id)!;
   const fromConnected=connected.has(pinKey(wire.from)),toConnected=connected.has(pinKey(wire.to));
   if(fromConnected!==toConnected)freeEnds.set(wire.id,fromConnected?'to':'from');
   const freeAt=freeEnds.get(wire.id);
   if(freeAt&&!bridgesSharedPins(wire)){
    const joinAt=freeAt==='to'?'from':'to',ends=cleanEndpoints(wire,components);
    if(ends){
     const freeLead=freeAt==='from'?ends.start:ends.end,free=freeLead.at(-1)!;
     const freePoints=freeAt==='from'?oldPath.points:[...oldPath.points].reverse();
     type JoinCandidate={id:string;point:THREE.Vector3;distance:number;prefix?:THREE.Vector3[]};
     const candidates:JoinCandidate[]=[...tree].filter(id=>id!==wire.id).flatMap(id=>{
      const path=paths.get(id)!,points=path.points.filter(open);
      const point=points.reduce<THREE.Vector3|undefined>((nearest,p)=>!nearest||p.distanceToSquared(free)<nearest.distanceToSquared(free)?p:nearest,undefined);
      const options:JoinCandidate[]=point?[{id,point,distance:point.distanceTo(free)}]:[];
      // Nearby parallel runs can merge along their existing route, even when
      // the nearest point in a straight line is obstructed by a component.
      let travelled=0,nearby:JoinCandidate|undefined;
      for(let i=1;i<freePoints.length;i++){
       travelled+=freePoints[i].distanceTo(freePoints[i-1]);
       for(const target of points){const gap=freePoints[i].distanceTo(target),cost=travelled+gap;
        if(gap<3&&(!nearby||cost<nearby.distance))nearby={id,point:target,distance:cost,prefix:freePoints.slice(0,i+1)};
       }
      }
      if(nearby)options.unshift(nearby);
      return options;
     }).sort((a,b)=>a.distance-b.distance).slice(0,6);
     const oldLength=length(oldPath),saving=.5;
     let chosen=wire,chosenPath=oldPath;
     for(const junction of candidates){
      if(junction.distance>=oldLength-saving)continue;
      const occupied=[...paths.values()].filter(path=>path.wire.id!==wire.id).map(path=>path.wire.id===junction.id?{...path,joinPoint:junction.point}:path);
      const override={...ends,start:freeAt==='from'?ends.start:[junction.point],end:freeAt==='to'?ends.end:[junction.point]};
      const points=junction.prefix?(freeAt==='from'?[...junction.prefix,junction.point]:[junction.point,...[...junction.prefix].reverse()]):cleanRoutePoints(wire,components,occupied,0,true,0,override,true);
      if(!points)continue;
      const candidate:Wire={...wire,routingJunction:{at:joinAt,wireId:junction.id,position:junction.point.toArray() as [number,number,number]},routingPoints:points.map(p=>p.toArray() as [number,number,number])};
      const path=pathFor(candidate,components);
      if(!path||length(path)>length(chosenPath)-saving||occupied.some(other=>pathsOverlap(path,other)))continue;
      const freeComponent=wire[freeAt].componentId;
      if(!clearOfBodies(path,[{id:freeComponent,points:freeLead}]))continue;
      chosen=candidate;chosenPath=path;
     }
     // Sharing a trunk must not force a detour when a direct pin connection
     // has become the shorter clear route after neighboring branches merged.
     if(chosen.routingJunction&&oldPath.start.distanceTo(oldPath.end)<length(chosenPath)-saving){
      const occupied=[...paths.values()].filter(path=>path.wire.id!==wire.id);
      for(const elevation of [0,1.65]){
       const directEnds=cleanEndpoints(wire,components,0,elevation);if(!directEnds)continue;
       const points=cleanRoutePoints(wire,components,occupied,0,true,0,directEnds,true);if(!points)continue;
       const candidate:Wire={...wire,routingJunction:undefined,routingPoints:points.map(p=>p.toArray() as [number,number,number])},path=pathFor(candidate,components);
       const continuation=chosen.routingJunction?continuationLength(new Set([...tree].filter(id=>id!==wire.id)),chosen.routingJunction.wireId,new THREE.Vector3(...chosen.routingJunction.position),joinAt==='from'?ends.start[0]:ends.end[0]):0;
       // A junction also adds a turn and a branch. Prefer a direct connection
       // when the complete paths are close in length, rather than adding a
       // detour merely to save a small amount of newly drawn wire.
       const junctionCost=chosen.routingJunction?1.5:0;
       if(!path||length(path)>=length(chosenPath)+continuation+junctionCost-saving||occupied.some(other=>pathsOverlap(path,other)))continue;
       if(!clearOfBodies(path,[{id:wire.from.componentId,points:directEnds.start},{id:wire.to.componentId,points:directEnds.end}]))continue;
       chosen=candidate;chosenPath=path;
      }
     }
     if(chosen!==wire){result.set(wire.id,chosen);paths.set(wire.id,chosenPath)}
    }
   }
   tree.add(wire.id);connected.add(pinKey(wire.from));connected.add(pinKey(wire.to));
  }
  if(refinement===0)remaining.push(...group.filter(w=>w.id!==trunk.id&&freeEnds.has(w.id)&&!result.get(w.id)!.routingJunction&&!group.some(other=>result.get(other.id)!.routingJunction?.wireId===w.id)));
  }
 }
 // Merge only the final, nearby approaches to the same physical pin. This
 // preserves the direct routes above while avoiding duplicate runs into a pad.
 const contacts=new Map<string,{id:string;at:'from'|'to'}[]>();
 for(const wire of eligible)for(const at of ['from','to'] as const){
  if(result.get(wire.id)!.routingJunction?.at===at)continue;
  const key=pinKey(wire[at]),list=contacts.get(key)??[];list.push({id:wire.id,at});contacts.set(key,list);
 }
 for(const contact of contacts.values()){
  if(contact.length<2)continue;
  const hasChildren=(id:string)=>[...result.values()].some(w=>w.routingJunction?.wireId===id);
  contact.sort((a,b)=>Number(hasChildren(b.id))-Number(hasChildren(a.id))||length(paths.get(b.id)!)-length(paths.get(a.id)!));
  const main=contact[0],trunk=paths.get(main.id)!;
  const pin=main.at==='from'?trunk.start:trunk.end;
  const toward=main.at==='from'?trunk.points:[...trunk.points].reverse();
  const targets:{point:THREE.Vector3;along:number}[]=[];let travelled=0;
  for(let i=1;i<toward.length;i++){travelled+=toward[i].distanceTo(toward[i-1]);if(travelled>16)break;if(travelled>2&&open(toward[i]))targets.push({point:toward[i],along:travelled})}
  for(let pass=0;pass<2;pass++)for(const approach of contact.slice(1)){
   const wire=result.get(approach.id)!;if(bridgesSharedPins(wire)||hasChildren(wire.id)||wire.routingJunction?.at===approach.at)continue;
   const old=paths.get(wire.id)!,free=approach.at==='to'?old.points:[...old.points].reverse(),oldLength=length(old);
   let fromPin=0,best:Path|undefined,bestSaving=.5;
   const occupied=[...paths.values()].filter(path=>path.wire.id!==wire.id);
   const nearbyTargets=targets.map(target=>({...target,id:main.id}));
   for(const other of contact){
    if(other.id===main.id||other.id===wire.id)continue;
    const otherPath=paths.get(other.id)!,junction=otherPath.wire.routingJunction;if(junction?.at!==other.at)continue;
    const samples=other.at==='from'?otherPath.points:[...otherPath.points].reverse();let along=new THREE.Vector3(...junction.position).distanceTo(pin);
    for(let i=1;i<samples.length;i++){along+=samples[i].distanceTo(samples[i-1]);if(along>16)break;if(open(samples[i]))nearbyTargets.push({id:other.id,point:samples[i],along})}
   }
   const options:{i:number;target:THREE.Vector3;wireId:string;saved:number;along:number}[]=[];
   for(let i=free.length-2;i>0;i--){
    fromPin+=free[i].distanceTo(free[i+1]);if(fromPin>16)break;
    if(!open(free[i]))continue;
    for(const target of nearbyTargets){
     const gap=free[i].distanceTo(target.point),saved=fromPin-gap;
     if(gap>3||saved<=bestSaving||gap+target.along>fromPin+3)continue;
     options.push({i,target:target.point,wireId:target.id,saved,along:target.along});
    }
   }
   for(const option of options.sort((a,b)=>a.along-b.along||b.saved-a.saved).slice(0,20)){
     const prefix=[...free.slice(0,option.i+1),option.target],points=approach.at==='to'?prefix:prefix.reverse();
     const candidate:Wire={...wire,routingJunction:{at:approach.at,wireId:option.wireId,position:option.target.toArray() as [number,number,number]},routingPoints:points.map(p=>p.toArray() as [number,number,number])},path=pathFor(candidate,components);
     if(!path||oldLength-length(path)<=bestSaving||occupied.some(other=>pathsOverlap(path,other)))continue;
     const ends=cleanEndpoints(wire,components),freeAt=approach.at==='to'?'from':'to';
     if(!ends||!clearOfBodies(path,[{id:wire[freeAt].componentId,points:freeAt==='from'?ends.start:ends.end}]))continue;
     best=path;bestSaving=oldLength-length(path);break;
   }
   if(best){result.set(wire.id,best.wire);paths.set(wire.id,best)}
  }
 }
 return wires.map(w=>result.get(w.id)!);
}

/** Align irregular parallel connector bundles without replanning other wires. */
export function alignCleanBundles(wires:Wire[],components:Component[]):Wire[]{
 const key=(pin:Wire['from'])=>JSON.stringify([pin.componentId,pin.pinId]),degree=new Map<string,number>();
 for(const wire of wires)for(const pin of [wire.from,wire.to])degree.set(key(pin),(degree.get(key(pin))??0)+1);
 const groups=new Map<string,Wire[]>(),result=new Map(wires.map(w=>[w.id,w]));
 for(const wire of wires){
  if(wire.routeMode!=='clean'||wire.visible===false||wire.routingBlocked||!wire.routingPoints||wire.routingJunction||degree.get(key(wire.from))!==1||degree.get(key(wire.to))!==1)continue;
  const pair=[wire.from.componentId,wire.to.componentId].sort().join('|'),group=groups.get(pair)??[];group.push(wire);groups.set(pair,group);
 }
 for(const group of groups.values()){
  if(group.length<3)continue;
  const rows=group.map(wire=>{
   const ends=cleanEndpoints(wire,components);if(!ends)return undefined;
   const highFrom=ends.start[0].z>ends.end[0].z,high=highFrom?ends.start:ends.end,low=highFrom?ends.end:ends.start;
   return {wire,highFrom,high,low,a:high.at(-1)!,b:low.at(-1)!,plane:ends.plane};
  });
  if(rows.some(row=>!row))continue;
  const bundle=rows.filter((row):row is NonNullable<typeof row>=>!!row),first=bundle[0];
  if(bundle.some(row=>row.high[0].z-row.low[0].z<5||Math.abs(row.plane-first.plane)>.01))continue;
  const axis:0|1=Math.abs(first.a.x-first.b.x)>=Math.abs(first.a.y-first.b.y)?0:1,cross:0|1=axis===0?1:0;
  const coordinate=(point:THREE.Vector3,index:0|1)=>index===0?point.x:point.y;
  const direction=Math.sign(coordinate(first.b,axis)-coordinate(first.a,axis)),shift=Math.sign(coordinate(first.b,cross)-coordinate(first.a,cross));
  if(!direction||!shift)continue;
  if(bundle.some(row=>Math.abs(coordinate(row.a,axis)-coordinate(first.a,axis))>.01||Math.abs(coordinate(row.b,axis)-coordinate(first.b,axis))>.01||Math.sign(coordinate(row.b,cross)-coordinate(row.a,cross))!==shift))continue;
  bundle.sort((a,b)=>coordinate(a.a,cross)-coordinate(b.a,cross));
  if(bundle.some((row,i)=>i>0&&(coordinate(row.b,cross)-coordinate(bundle[i-1].b,cross)<1.05||coordinate(row.a,cross)-coordinate(bundle[i-1].a,cross)<1.05)))continue;
  const turnProgress=bundle.map(row=>{
   const points=row.highFrom?row.wire.routingPoints!:[...row.wire.routingPoints!].reverse();
   const index=points.findIndex((p,i)=>i>0&&Math.abs(p[cross]-points[i-1][cross])>.1);
   return index<0?0:(points[index][axis]-coordinate(row.a,axis))*direction;
  });
  const unevenLayer=bundle.some(row=>row.wire.routingPoints!.some((p,i,points)=>i>0&&Math.abs(p[2]-points[i-1][2])<.01&&Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>.1&&p[2]<row.high[0].z-2&&Math.abs(p[2]-row.low[0].z)>.05&&Math.abs(p[2]-row.plane)>.05));
  if(!unevenLayer&&!turnProgress.some((value,i)=>i>0&&(value-turnProgress[i-1])*shift>.1))continue;
  const spacing=Math.max(1.27,...group.map(w=>Math.max(.38,w.diameter*.32)*2+.45));
  if(Math.abs(coordinate(first.b,axis)-coordinate(first.a,axis))<(bundle.length-1)*spacing+2.2)continue;
  const proposals=bundle.map((row,i)=>{
   const lane=(coordinate(row.a,axis)+coordinate(row.b,axis))/2+direction*shift*((bundle.length-1)/2-i)*spacing;
   const bendA=row.a.clone(),bendB=row.b.clone();if(axis===0){bendA.x=lane;bendB.x=lane}else{bendA.y=lane;bendB.y=lane}
   const points=[...row.high,bendA,bendB,...[...row.low].reverse()];if(!row.highFrom)points.reverse();
   return {...row.wire,routingPoints:points.map(p=>p.toArray() as [number,number,number])};
  });
  const ids=new Set(group.map(w=>w.id)),fixed=[...result.values()].filter(w=>!ids.has(w.id)&&w.visible!==false&&!w.routingBlocked).map(w=>pathFor(w,components)).filter((path):path is Path=>!!path);
  const proposed=proposals.map(w=>pathFor(w,components));
  if(proposed.some(path=>!path))continue;
  const paths=proposed.filter((path):path is Path=>!!path);
  if(paths.some((path,i)=>[...fixed,...paths.slice(0,i)].some(other=>pathsOverlap(path,other))))continue;
  // The middle of the bundle must remain outside every component footprint.
  if(bundle.some((row,i)=>{
   const middle={...proposals[i],routingPoints:proposals[i].routingPoints!.slice(row.high.length-1,-row.low.length+1)};
   if(!row.highFrom)middle.routingPoints=proposals[i].routingPoints!.slice(row.low.length-1,-row.high.length+1);
   const path=pathFor(middle,components);if(!path)return true;
   return components.filter(c=>c.visible!==false).some(c=>{
    const box=new THREE.Box3(),[w,h,d]=c.dimensions??[28,20,8],rotation=new THREE.Euler(...c.rotation.map(THREE.MathUtils.degToRad) as [number,number,number]);
    for(const x of [-w/2,w/2])for(const y of [-h/2,h/2])for(const z of [-d/2,d/2])box.expandByPoint(new THREE.Vector3(x,y,z).applyEuler(rotation).add(new THREE.Vector3(...c.position)));
    return path.points.some(p=>p.x>box.min.x&&p.x<box.max.x&&p.y>box.min.y&&p.y<box.max.y);
   });
  }))continue;
  for(const wire of proposals)result.set(wire.id,wire);
 }
 return wires.map(w=>result.get(w.id)!);
}

/** Compare substantial planar detours with short, low crossings over wires. */
export function shortenCleanDetours(wires:Wire[],components:Component[]):Wire[]{
 const pinKey=(pin:Wire['from'])=>JSON.stringify([pin.componentId,pin.pinId]),degree=new Map<string,number>();
 for(const wire of wires.filter(w=>w.visible!==false))for(const pin of [wire.from,wire.to])degree.set(pinKey(pin),(degree.get(pinKey(pin))??0)+1);
 const paths=new Map<string,Path>(),result=new Map(wires.map(w=>[w.id,w]));
 for(const wire of wires.filter(w=>w.visible!==false&&!w.routingBlocked)){const path=pathFor(wire,components);if(path)paths.set(wire.id,path)}
 const length=(points:THREE.Vector3[])=>points.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(points[i]),0);
 const bodies=components.filter(c=>c.visible!==false).map(c=>{
  const box=new THREE.Box3(),[w,h,d]=c.dimensions??[28,20,8],rotation=new THREE.Euler(...c.rotation.map(THREE.MathUtils.degToRad) as [number,number,number]);
  for(const x of [-w/2,w/2])for(const y of [-h/2,h/2])for(const z of [-d/2,d/2])box.expandByPoint(new THREE.Vector3(x,y,z).applyEuler(rotation).add(new THREE.Vector3(...c.position)));
  return {id:c.id,box:box.expandByScalar(.35)};
 });
 for(const wire of wires){
  if(wire.routeMode!=='clean'||wire.visible===false||wire.routingBlocked||wire.routingJunction||!wire.routingPoints||(degree.get(pinKey(wire.from))??0)>2||(degree.get(pinKey(wire.to))??0)>2)continue;
  const old=paths.get(wire.id),ends=cleanEndpoints(wire,components);if(!old||!ends)continue;
  // Tall connector rows are handled as a bundle, not as independent shortcuts.
  if(Math.abs(ends.start[0].z-ends.end[0].z)>5)continue;
  const a=ends.start.at(-1)!,b=ends.end.at(-1)!,minimum=length(ends.start)+length(ends.end)+Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.z-b.z),oldLength=length(old.points);
  if(oldLength<minimum+Math.max(3,minimum*.15))continue;
  const anchors=[...result.values()].filter(w=>w.routingJunction?.wireId===wire.id).map(w=>new THREE.Vector3(...w.routingJunction!.position));
  let prefix:THREE.Vector3[]|undefined,suffix:THREE.Vector3[]|undefined;
  if(anchors.length){
   const raw=wire.routingPoints.map(p=>new THREE.Vector3(...p)),total=length(raw);
   const positions=anchors.map(point=>{let travelled=0,nearest=Infinity,along=0;
    for(let i=1;i<raw.length;i++){const delta=raw[i].clone().sub(raw[i-1]),size=delta.length(),t=size?THREE.MathUtils.clamp(point.clone().sub(raw[i-1]).dot(delta)/(size*size),0,1):0,gap=point.distanceToSquared(raw[i-1].clone().addScaledVector(delta,t));if(gap<nearest){nearest=gap;along=travelled+t*size}travelled+=size}return along;
   });
   const early=Math.max(...positions)<total*.35,late=Math.min(...positions)>total*.65;
   if(!early&&!late)continue;
   const cut=early?Math.max(...positions)+3:Math.min(...positions)-3;let travelled=0;
   for(let i=1;i<raw.length;i++){const size=raw[i].distanceTo(raw[i-1]);if(travelled+size>=cut){const point=raw[i-1].clone().lerp(raw[i],(cut-travelled)/size);if(early)prefix=[...raw.slice(0,i),point];else suffix=[point,...raw.slice(i)];break}travelled+=size}
  }
  const occupied=[...paths.values()].filter(path=>path.wire.id!==wire.id);let chosen=wire,best=oldLength;
  for(const elevation of [0,1.65]){
   const leads=cleanEndpoints(wire,components,0,elevation);if(!leads)continue;
   const routeEnds={...leads,start:prefix?[prefix.at(-1)!]:leads.start,end:suffix?[suffix[0]]:leads.end};
   const middle=cleanRoutePoints(wire,components,occupied,0,true,0,routeEnds,true,true);if(!middle)continue;
   const points=[...(prefix?.slice(0,-1)??[]),...middle,...(suffix?.slice(1)??[])];
   const candidate:Wire={...wire,routingPoints:points.map(p=>p.toArray() as [number,number,number])},path=pathFor(candidate,components);
   if(!path||length(path.points)>best-Math.max(2,oldLength*.08)||occupied.some(other=>pathsOverlap(path,other)))continue;
   // Existing branches must still meet this trunk at exactly their old nodes.
   if(anchors.some(point=>!path.points.slice(1).some((end,i)=>segmentDistanceSquared(point,point,path.points[i],end)<.0016)))continue;
   if(path.points.some(point=>bodies.some(({id,box})=>{
    if(point.x<=box.min.x||point.x>=box.max.x||point.y<=box.min.y||point.y>=box.max.y)return false;
    const lead=id===wire.from.componentId?(prefix?ends.start:leads.start):id===wire.to.componentId?(suffix?ends.end:leads.end):undefined;
    return !lead?.slice(1).some((end,i)=>segmentDistanceSquared(point,point,lead[i],end)<.25);
   })))continue;
   chosen=candidate;best=length(path.points);
  }
  if(chosen!==wire){result.set(wire.id,chosen);paths.set(wire.id,pathFor(chosen,components)!)}
 }
 return wires.map(w=>result.get(w.id)!);
}

export function planAutoWires(wires:Wire[],components:Component[]):Wire[]{
 const occupied:Path[]=[],planned:Wire[]=[];
 for(const wire of wires){
  if(wire.visible===false){planned.push(wire);continue}
  if(wire.routeMode==='clean')continue;
  if(wire.routeMode!==undefined&&wire.routeMode!=='auto'){
   planned.push(wire);const path=pathFor(wire,components);if(path)occupied.push(path);continue;
  }
  let selected=wire,selectedPath:Path|undefined;
  for(let lane=0;lane<=24;lane++){
   const candidate={...wire,autoLane:lane},path=pathFor(candidate,components);
   if(!path){selected=wire;break}
   selected=candidate;selectedPath=path;
   if(!occupied.some(other=>pathsOverlap(path,other)))break;
  }
  planned.push(selected);if(selectedPath)occupied.push(selectedPath);
 }
 const clean=wires.filter(w=>w.visible!==false&&w.routeMode==='clean').map(wire=>({wire,ends:cleanEndpoints(wire,components)}));
 // Reserve access above every terminal before routing the first wire, so an
 // earlier route cannot trap a later connection behind a crossing bridge.
 clean.sort((a,b)=>(a.ends?a.ends.start.at(-1)!.distanceTo(a.ends.end.at(-1)!):0)-(b.ends?b.ends.start.at(-1)!.distanceTo(b.ends.end.at(-1)!):0));
 // Plan the whole bundle flat first. If one connection is boxed in, give it
 // priority and reroute its neighbors before permitting any vertical bridge.
 type FlatPlan={paths:Path[];wires:Wire[];failed:typeof clean;length:number;leads:Path[];fanouts:Map<string,number>};
 const groups=new Map<string,number[]>();
 const groupKey=(item:typeof clean[number])=>[item.wire.from.componentId,item.wire.to.componentId].sort().join('|');
 const transverse=(item:typeof clean[number])=>{if(!item.ends)return 0;const a=item.ends.start.at(-1)!,b=item.ends.end.at(-1)!;return Math.abs(a.x-b.x)>=Math.abs(a.y-b.y)?(a.y+b.y)/2:(a.x+b.x)/2};
 for(const item of clean){const key=groupKey(item),values=groups.get(key)??[];values.push(transverse(item));groups.set(key,values)}
 const centerDistance=(item:typeof clean[number])=>{const values=groups.get(groupKey(item))!;return Math.abs(transverse(item)-values.reduce((a,b)=>a+b,0)/values.length)};
 const centerOrder=[...clean].sort((a,b)=>centerDistance(a)-centerDistance(b));
 let order=clean,best:FlatPlan|undefined;
 const tried=new Set<string>();
 for(let pass=0;pass<4;pass++){
  let key=order.map(item=>item.wire.id).join('|');
  if(tried.has(key)){order=[...clean].reverse();key=order.map(item=>item.wire.id).join('|');if(tried.has(key))continue}
  tried.add(key);
  const result:FlatPlan={paths:[],wires:[],failed:[],length:0,leads:[],fanouts:new Map()};
  const fanout=(item:typeof clean[number])=>pass===0?0:Math.max(0,(groups.get(groupKey(item))!.length-1)*.7-centerDistance(item));
  result.leads=order.flatMap(item=>{const ends=cleanEndpoints(item.wire,components,fanout(item));return ends?[ends.start,ends.end].map((points,index)=>({wire:item.wire,accessPin:index===0?item.wire.from:item.wire.to,points,start:ends.start[0],end:ends.end[0]})):[]});
  for(const item of order)result.fanouts.set(item.wire.id,fanout(item));
  for(const item of order){
   const points=cleanRoutePoints(item.wire,components,[...occupied,...result.leads,...result.paths],0,false,fanout(item));
   if(!points){result.failed.push(item);continue}
   const selected:Wire={...item.wire,autoLane:0,routingBlocked:false,routingPoints:points.map(p=>p.toArray() as [number,number,number])};
   const path=pathFor(selected,components);
   if(path&&[...occupied,...result.paths].some(other=>pathsOverlap(path,other))){result.failed.push(item);continue}
   result.wires.push(selected);
   if(path){result.paths.push(path);for(let i=1;i<path.points.length;i++)result.length+=path.points[i].distanceTo(path.points[i-1])}
  }
  if(!best||result.failed.length<best.failed.length||(result.failed.length===best.failed.length&&result.length<best.length))best=result;
  if(!result.failed.length)break;
  const failed=new Set(result.failed.map(item=>item.wire.id));
  order=pass===0?centerOrder:pass===2?[...clean].reverse():[...result.failed,...order.filter(item=>!failed.has(item.wire.id))];
 }
 if(best){
  planned.push(...best.wires);occupied.push(...best.paths);
  for(const {wire} of best.failed){
   let selected:Wire={...wire,autoLane:0,routingPoints:undefined,routingBlocked:true},accepted:Path|undefined;
   for(let retry=0;retry<10;retry++){
    const attempt=retry%5,escapeOffset=attempt<2?0:(attempt-1)*1.27;
    const points=cleanRoutePoints(wire,components,retry<5?[...occupied,...best.leads]:occupied,attempt,true,(best.fanouts.get(wire.id)??0)+escapeOffset);
    if(!points)continue;
    const candidate:Wire={...wire,autoLane:0,routingBlocked:false,routingPoints:points.map(p=>p.toArray() as [number,number,number])};
    const path=pathFor(candidate,components);
    if(path&&!occupied.some(other=>pathsOverlap(path,other))){selected=candidate;accepted=path;break}
   }
   // Never substitute an unchecked route through occupied wires.
   planned.push(selected);if(accepted)occupied.push(accepted);
  }
 }
 // A previously placed clean wire may occupy the only useful pin exit.
 // Rip up the clean bundle and give blocked connections first choice of that
 // corridor; then lay their neighbors again around the new bends.
 let blocked=planned.filter(w=>w.routeMode==='clean'&&w.routingBlocked).map(w=>w.id);
 if(blocked.length){
  const fixed=occupied.filter(path=>path.wire.routeMode!=='clean');
  for(let round=0;round<2&&blocked.length;round++){
   const priority=new Set(blocked),order=[...clean.filter(item=>priority.has(item.wire.id)),...clean.filter(item=>!priority.has(item.wire.id))];
   const paths=[...fixed],replacement:Wire[]=[];
   for(const {wire} of order){
    let selected:Wire={...wire,routingPoints:undefined,routingBlocked:true};
    for(let attempt=0;attempt<4;attempt++){
     const points=cleanRoutePoints(wire,components,paths,attempt===0?0:attempt-1,attempt>0,round*1.27);
     if(!points)continue;
     const candidate:Wire={...wire,autoLane:0,routingBlocked:false,routingPoints:points.map(point=>point.toArray() as [number,number,number])};
     const path=pathFor(candidate,components);
     if(path&&!paths.some(other=>pathsOverlap(path,other))){selected=candidate;paths.push(path);break}
    }
    replacement.push(selected);
   }
   const missing=replacement.filter(w=>w.routingBlocked).map(w=>w.id);
   if(missing.length<blocked.length){const byId=new Map(replacement.map(w=>[w.id,w]));for(let i=0;i<planned.length;i++)planned[i]=byId.get(planned[i].id)??planned[i];blocked=missing}
   else break;
  }
 }
 const byId=new Map(planned.map(w=>[w.id,w]));return shortenCleanDetours(shareCleanNetRoutes(alignCleanBundles(wires.map(w=>byId.get(w.id)??w),components),components),components);
}

