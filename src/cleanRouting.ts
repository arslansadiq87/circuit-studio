import * as THREE from 'three';
import type {Component, Wire} from './model';
import {worldPin, worldPinDirection, worldPinWireEntry} from './geometry';

export type RoutedPath={wire:Wire;points:THREE.Vector3[];start:THREE.Vector3;end:THREE.Vector3;accessPin?:Wire['from'];joinPoint?:THREE.Vector3};
type Box={minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number};
const pitch=1.27;
const samePin=(a:Wire['from'],b:Wire['from'])=>a.componentId===b.componentId&&a.pinId===b.pinId;

function bounds(component:Component,margin:number):Box{
 const box=new THREE.Box3(),rotation=new THREE.Euler(...component.rotation.map(THREE.MathUtils.degToRad) as [number,number,number]);
 const [w,h,d]=component.dimensions??[28,20,8];
 for(const x of [-w/2,w/2])for(const y of [-h/2,h/2])for(const z of [-d/2,d/2])
  box.expandByPoint(new THREE.Vector3(x,y,z).applyEuler(rotation).add(new THREE.Vector3(...component.position)));
 return {minX:box.min.x-margin,maxX:box.max.x+margin,minY:box.min.y-margin,maxY:box.max.y+margin,minZ:box.min.z-margin,maxZ:box.max.z+margin};
}
function inside(x:number,y:number,box:Box){return x>box.minX+1e-5&&x<box.maxX-1e-5&&y>box.minY+1e-5&&y<box.maxY-1e-5}

/** Keep connector insertion and outward egress fixed; descend outside the body. */
export function cleanEndpoints(wire:Wire,components:Component[],fanout=0,elevated=0){
 const source=components.find(c=>c.id===wire.from.componentId),target=components.find(c=>c.id===wire.to.componentId);
 const first=source?.pins.find(p=>p.id===wire.from.pinId),last=target?.pins.find(p=>p.id===wire.to.pinId);
 if(!source||!target||!first||!last)return undefined;
 const a=worldPin(first,source),b=worldPin(last,target);
 const plane=Math.min(a.z,b.z)+Math.max(.7,wire.diameter*.4)+Math.max(0,wire.liftHeight??0);
 const lead=(component:Component,pin:typeof first,point:THREE.Vector3,destination:THREE.Vector3)=>{
  const entry=worldPinWireEntry(pin,component),box=bounds(component,1.8+wire.diameter*.32);
  const points=entry?[
   entry.opening.clone().addScaledVector(entry.insertionDirection,entry.insertionDepth),entry.opening.clone(),
   entry.opening.clone().addScaledVector(entry.insertionDirection,-entry.approachLength),
   entry.opening.clone().addScaledVector(entry.insertionDirection,-entry.approachLength).addScaledVector(entry.clearanceDirection,entry.clearanceOffset)
  ]:[point.clone()];
  const direction=entry?.clearanceDirection??worldPinDirection(pin,component),body=bounds(component,0);
  const edgeDistance=Math.min(point.x-body.minX,body.maxX-point.x,point.y-body.minY,body.maxY-point.y);
  // Interior PCB pads must leave vertically before travelling across populated
  // board space. The final 3D retry can also lift crowded connector approaches.
  const interiorPad=!entry&&direction.z>.6&&edgeDistance>2;
  if((interiorPad||elevated>0)&&!(direction.z<-.6&&point.z<body.minZ)){
   const tip=points.at(-1)!;
   points.push(tip.clone().setZ(tip.z+(interiorPad?3:Math.min(elevated,3.3))));
  }
  const tip=points.at(-1)!;
  const escape=tip.clone();
  if(Math.abs(direction.x)>.6)escape.x=direction.x>0?Math.max(tip.x+1.5,box.maxX):Math.min(tip.x-1.5,box.minX);
  else if(Math.abs(direction.y)>.6)escape.y=direction.y>0?Math.max(tip.y+1.5,box.maxY):Math.min(tip.y-1.5,box.minY);
  else if(interiorPad){
   const dx=destination.x-tip.x,dy=destination.y-tip.y;
   if(Math.abs(dx)>=Math.abs(dy))escape.x=dx>=0?box.maxX:box.minX;
   else escape.y=dy>=0?box.maxY:box.minY;
  }
  else{
   const sides=[{distance:Math.abs(tip.x-box.minX),x:box.minX,y:tip.y},{distance:Math.abs(tip.x-box.maxX),x:box.maxX,y:tip.y},{distance:Math.abs(tip.y-box.minY),x:tip.x,y:box.minY},{distance:Math.abs(tip.y-box.maxY),x:tip.x,y:box.maxY}];
   const side=sides.reduce((best,item)=>item.distance<best.distance?item:best);escape.x=side.x;escape.y=side.y;
  }
  const outward=escape.clone().sub(tip).setZ(0).normalize();
  // Tall connector rows descend together in their common X/Y plane. Allocate
  // individual fan-out lanes after the drop, on the low routing plane.
  if(Math.abs(tip.z-plane)<2)escape.addScaledVector(outward,fanout);
  points.push(escape);if(!elevated)points.push(escape.clone().setZ(plane));return points;
 };
 return {start:lead(source,first,a,b),end:lead(target,last,b,a),plane};
}

class MinHeap{
 private items:{id:number;cost:number}[]=[];
 push(id:number,cost:number){const item={id,cost};let i=this.items.length;this.items.push(item);while(i>0){const parent=(i-1)>>1;if(this.items[parent].cost<=cost)break;this.items[i]=this.items[parent];i=parent}this.items[i]=item}
 pop(){const first=this.items[0],last=this.items.pop()!;if(this.items.length){let i=0;while(i*2+1<this.items.length){let child=i*2+1;if(child+1<this.items.length&&this.items[child+1].cost<this.items[child].cost)child++;if(this.items[child].cost>=last.cost)break;this.items[i]=this.items[child];i=child}this.items[i]=last}return first}
 get length(){return this.items.length}
}

/** Orthogonal routing on shared tracks. Height changes are local crossing bridges. */
export function cleanRoutePoints(wire:Wire,components:Component[],occupied:RoutedPath[]=[],attempt=0,allowBridges=true,fanout=0,endpointOverride?:ReturnType<typeof cleanEndpoints>,avoidOverComponents=false,preferShort=false):THREE.Vector3[]|undefined{
 const ends=endpointOverride??cleanEndpoints(wire,components,fanout,allowBridges?Math.max(0,attempt-1)*1.65:0);if(!ends)return undefined;
 const a=ends.start.at(-1)!,b=ends.end.at(-1)!,plane=ends.plane;
 const margin=Math.max(14,Math.min(32,occupied.length*.9+10))+attempt*16;
 const region={minX:Math.min(a.x,b.x)-margin,maxX:Math.max(a.x,b.x)+margin,minY:Math.min(a.y,b.y)-margin,maxY:Math.max(a.y,b.y)+margin};
 const boxes=components.filter(c=>c.visible!==false).map(c=>bounds(c,wire.diameter*.32+.8)).filter(box=>box.maxX>=region.minX&&box.minX<=region.maxX&&box.maxY>=region.minY&&box.minY<=region.maxY);
 const step=Math.max(pitch,(region.maxX-region.minX)/180,(region.maxY-region.minY)/180);
 const axis=(min:number,max:number,first:number,last:number)=>{
  const values=[first,last];for(let n=Math.floor(min/step);n<=Math.ceil(max/step);n++)values.push(n*step);
  return [...new Set(values.map(v=>Math.round(v*1e6)/1e6))].sort((x,y)=>x-y);
 };
 const xs=axis(region.minX,region.maxX,a.x,b.x),ys=axis(region.minY,region.maxY,a.y,b.y),nx=xs.length,ny=ys.length;
 const indexOf=(values:number[],value:number)=>values.indexOf(Math.round(value*1e6)/1e6);
 const startXY=indexOf(xs,a.x)*ny+indexOf(ys,a.y),endXY=indexOf(xs,b.x)*ny+indexOf(ys,b.y);
 // Spatial buckets keep collision checks independent of overall wire count.
 type Segment={a:THREE.Vector3;b:THREE.Vector3;radius:number;shared:THREE.Vector3[];bundle:boolean;joinPoint?:THREE.Vector3};
 const buckets=new Map<string,Segment[]>(),cell=3;
 for(const path of occupied){
  if(path.wire.id===wire.id)continue;
  if(path.accessPin&&(samePin(path.accessPin,wire.from)||samePin(path.accessPin,wire.to)))continue;
  const shared:THREE.Vector3[]=[];
  for(const [pin,point] of [[path.wire.from,path.start],[path.wire.to,path.end]] as const)if(samePin(pin,wire.from)&&point.distanceTo(ends.start[0])<.01||samePin(pin,wire.to)&&point.distanceTo(ends.end[0])<.01)shared.push(point);
  const radius=Math.max(.38,wire.diameter*.32)+Math.max(.38,path.wire.diameter*.32)+.37+attempt*.04;
  for(let i=1;i<path.points.length;i++){
   const p=path.points[i-1],q=path.points[i],bundle=[path.wire.from.componentId,path.wire.to.componentId].sort().join('|')===[wire.from.componentId,wire.to.componentId].sort().join('|'),segment={a:p,b:q,radius,shared,bundle,joinPoint:path.joinPoint};
   for(let x=Math.floor((Math.min(p.x,q.x)-3.2)/cell);x<=Math.floor((Math.max(p.x,q.x)+3.2)/cell);x++)
    for(let y=Math.floor((Math.min(p.y,q.y)-3.2)/cell);y<=Math.floor((Math.max(p.y,q.y)+3.2)/cell);y++){
     const key=`${x},${y}`,list=buckets.get(key);if(list)list.push(segment);else buckets.set(key,[segment]);
    }
  }
 }
 const clear=(x:number,y:number,z:number)=>{
  const segments=buckets.get(`${Math.floor(x/cell)},${Math.floor(y/cell)}`);if(!segments)return true;
  for(const segment of segments){
   if(segment.joinPoint&&(x-segment.joinPoint.x)**2+(y-segment.joinPoint.y)**2+(z-segment.joinPoint.z)**2<4)continue;
   if(segment.shared.some(p=>(x-p.x)**2+(y-p.y)**2+(z-p.z)**2<144))continue;
   const p=segment.a,q=segment.b,dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z,len=dx*dx+dy*dy+dz*dz;
   const t=len?Math.max(0,Math.min(1,((x-p.x)*dx+(y-p.y)*dy+(z-p.z)*dz)/len)):0;
   if((x-p.x-t*dx)**2+(y-p.y-t*dy)**2+(z-p.z-t*dz)**2<segment.radius**2)return false;
  }
  return true;
 };
 const bundled=(x:number,y:number,z:number,dir:number)=>{
  for(const segment of buckets.get(`${Math.floor(x/cell)},${Math.floor(y/cell)}`)??[]){
   if(!segment.bundle)continue;
   const p=segment.a,q=segment.b;
   if(Math.abs(z-p.z)>1||Math.abs(z-q.z)>1)continue;
   if(dir===1&&Math.abs(p.y-q.y)<.01&&Math.abs(x-(p.x+q.x)/2)<Math.abs(p.x-q.x)/2+.7&&Math.abs(y-p.y)<3.2)return true;
   if(dir===2&&Math.abs(p.x-q.x)<.01&&Math.abs(y-(p.y+q.y)/2)<Math.abs(p.y-q.y)/2+.7&&Math.abs(x-p.x)<3.2)return true;
  }
  return false;
 };
 const bridgeStep=Math.max(1.65,wire.diameter*.64+.65);
 const ceiling=Math.max(a.z,b.z,plane)+3.5;
 // Crossing bridges stay close to their contacts, not at the top of a board.
 const levels=allowBridges?[...new Set([...(preferShort?[]:[plane-bridgeStep]),plane,a.z,b.z,...Array.from({length:4+attempt*2},(_,i)=>plane+i*bridgeStep)])].filter(z=>z<=ceiling+1e-6).sort((x,y)=>x-y):[plane];
 const layers=levels.length,startLevel=levels.indexOf(a.z),endLevel=levels.indexOf(b.z);
 const state=(xy:number,level:number,direction:number)=>(xy*layers+level)*4+direction;
 const total=nx*ny*layers*4,dist=new Float64Array(total).fill(Infinity),previous=new Int32Array(total).fill(-1),heap=new MinHeap();
 const first=state(startXY,startLevel,0);dist[first]=0;heap.push(first,0);let goal=-1;
 const maxVisits=preferShort?60000:allowBridges?45000:18000;let visits=0;
 while(heap.length){
  if(++visits>maxVisits)break;
  const current=heap.pop(),direction=current.id%4,node=Math.floor(current.id/4),level=node%layers,xy=Math.floor(node/layers),ix=Math.floor(xy/ny),iy=xy%ny;
  const heuristic=(Math.abs(xs[ix]-b.x)+Math.abs(ys[iy]-b.y))*(preferShort?1:.7)+Math.abs(levels[level]-b.z)*(preferShort?1:3);
  if(current.cost>dist[current.id]+heuristic+1e-5&&current.id!==first)continue;
  if(xy===endXY&&level===endLevel){goal=current.id;break}
  for(const [dx,dy,dl,dir] of [[-1,0,0,1],[1,0,0,1],[0,-1,0,2],[0,1,0,2],[0,0,-1,3],[0,0,1,3]]){
   const x=ix+dx,y=iy+dy,l=level+dl;if(x<0||x>=nx||y<0||y>=ny||l<0||l>=layers)continue;
   const nextXY=x*ny+y;
   if(boxes.some(box=>inside(xs[x],ys[y],box)&&(avoidOverComponents||levels[l]<plane-1e-6||levels[l]>=box.minZ&&levels[l]<=box.maxZ)))continue;
   const x0=xs[ix],y0=ys[iy],z0=levels[level],x1=xs[x],y1=ys[y],z1=levels[l];
   if(boxes.some(box=>(avoidOverComponents||Math.min(z0,z1)<plane-1e-6||Math.min(z0,z1)<=box.maxZ&&Math.max(z0,z1)>=box.minZ)&&inside((x0+x1)/2,(y0+y1)/2,box)))continue;
   const length=Math.abs(x1-x0)+Math.abs(y1-y0)+Math.abs(z1-z0);
   let free=true;const samples=Math.max(2,Math.ceil(length/.6));
   for(let i=1;i<=samples;i++){const t=i/samples;if(!clear(x0+(x1-x0)*t,y0+(y1-y0)*t,z0+(z1-z0)*t)){free=false;break}}
   if(!free)continue;
   const trackCost=preferShort?1:bundled((x0+x1)/2,(y0+y1)/2,z1,dir) ? .7 : 1;
   const cost=dist[current.id]+length*(preferShort?1:dl?3:trackCost+l*.35)+(direction&&direction!==dir?(preferShort?.25:2.4):0)+(dl>0?(preferShort?.2:3):0);
   const next=state(nextXY,l,dir);
   if(cost+1e-6<dist[next]){dist[next]=cost;previous[next]=current.id;heap.push(next,cost+(Math.abs(x1-b.x)+Math.abs(y1-b.y))*(preferShort?1:.7)+Math.abs(z1-b.z)*(preferShort?1:3))}
  }
 }
 if(goal<0)return attempt<1?cleanRoutePoints(wire,components,occupied,attempt+1,allowBridges,fanout,endpointOverride,avoidOverComponents,preferShort):undefined;
 const route:THREE.Vector3[]=[];
 for(let id=goal;id>=0;id=previous[id]){const node=Math.floor(id/4),level=node%layers,xy=Math.floor(node/layers);route.push(new THREE.Vector3(xs[Math.floor(xy/ny)],ys[xy%ny],levels[level]));}
 route.reverse();
 const points=[...ends.start,...route,...[...ends.end].reverse()],simple:THREE.Vector3[]=[];
 for(const p of points){
  const last=simple.at(-1);if(last&&last.distanceToSquared(p)<1e-10)continue;
  // Joining a fixed pin lead to another routing plane can briefly double back
  // on the same axis. Remove that excursion before making a rounded tube.
  while(simple.length>1){const v=simple.at(-1)!.clone().sub(simple.at(-2)!),w=p.clone().sub(simple.at(-1)!);if(v.clone().cross(w).lengthSq()>1e-9)break;simple.pop()}
  simple.push(p);
 }
 return simple;
}
