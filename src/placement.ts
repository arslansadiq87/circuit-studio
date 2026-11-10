import type {Component} from './model';

type Footprint={x:number;y:number;halfX:number;halfY:number};
function footprint(component:Component):Footprint{
 const [width,height,depth]=component.dimensions??[28,20,3];
 const angle=component.rotation[2]*Math.PI/180;
 const cosine=Math.abs(Math.cos(angle)),sine=Math.abs(Math.sin(angle));
 return {x:component.position[0],y:component.position[1],halfX:cosine*width/2+sine*height/2+depth/2,halfY:sine*width/2+cosine*height/2+depth/2};
}

export function placeComponent(existing:Component[],component:Component):Component{
 const occupied=existing.map(footprint),part=footprint(component),gap=7;
 const clear=(x:number,y:number)=>occupied.every(other=>
  Math.abs(x-other.x)>=part.halfX+other.halfX+gap||
  Math.abs(y-other.y)>=part.halfY+other.halfY+gap);
 const step=Math.max(12,Math.min(26,Math.max(part.halfX,part.halfY)));
 for(let ring=0;ring<100;ring++){
  for(let row=-ring;row<=ring;row++)for(let column=-ring;column<=ring;column++){
   if(ring&&Math.max(Math.abs(row),Math.abs(column))!==ring)continue;
   const x=column*step,y=row*step;
   if(clear(x,y))return {...component,position:[x,y,0]};
  }
 }
 let x=100*step;
 while(!clear(x,0))x+=step;
 return {...component,position:[x,0,0]};
}
