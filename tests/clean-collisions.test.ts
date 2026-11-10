import {expect,it} from 'vitest';
import {ESP32_C6_COMPONENT,STEPPER_24BYJ_48_COMPONENT,type Wire} from '../src/model';
import {makeIcPackage} from '../src/icPackage';
import {planAutoWires,pathsOverlap} from '../src/autoRouting';
import {makeWireCurve,worldPin,worldPinDirection,worldPinWireEntry} from '../src/geometry';
import {cleanEndpoints} from '../src/cleanRouting';

it.each([0,90,180])('keeps added cross-board connections clear with the new IC rotated %s degrees',rotation=>{
 const components=[{...makeIcPackage(10),id:'left',position:[-35,0,0] as [number,number,number]},{...makeIcPackage(10),id:'right',position:[35,0,0] as [number,number,number]},{...ESP32_C6_COMPONENT,id:'c6',position:[0,0,0] as [number,number,number]},{...STEPPER_24BYJ_48_COMPONENT,id:'motor',position:[-75,0,0] as [number,number,number]}];
 components[1].rotation=[0,0,rotation];
 const wire=(id:string,a:string,pa:string,b:string,pb:string):Wire=>({id,from:{componentId:a,pinId:pa},to:{componentId:b,pinId:pb},diameter:1.05,color:'#ffffff',label:id,curvature:19,routeMode:'clean'});
 const wires=Array.from({length:5},(_,i)=>[wire(`motor${i}`,'motor',`J1-${i+1}`,'left',`P${i+1}`),wire(`left${i}`,'left',`P${6+i}`,'c6',`J1-${4+i}`),wire(`right${i}`,'right',`P${1+i}`,'c6',`J2-${4+i}`)]).flat();
 wires.push(wire('power','left','P1','right','P10'),wire('ground','left','P10','right','P6'));
 for(const count of rotation===0?[15,16,17]:[17]){
 const planned=planAutoWires(wires.slice(0,count),components);
 const paths=planned.map(w=>{
  expect(w.routingPoints,`unplanned ${w.id}`).toBeDefined();
  const a=components.find(c=>c.id===w.from.componentId)!,b=components.find(c=>c.id===w.to.componentId)!,pa=a.pins.find(p=>p.id===w.from.pinId)!,pb=b.pins.find(p=>p.id===w.to.pinId)!,start=worldPin(pa,a),end=worldPin(pb,b);
  const curve=makeWireCurve(w,start,end,worldPinDirection(pa,a),worldPinDirection(pb,b),worldPinWireEntry(pa,a),worldPinWireEntry(pb,b),components);
  return {wire:w,start,end,points:curve.getSpacedPoints(Math.ceil(curve.getLength()/.45))};
 });
 for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++)expect(pathsOverlap(paths[i],paths[j]),`${paths[i].wire.id} crosses ${paths[j].wire.id}`).toBe(false);
 }
},30000);

it('flags an obstructed connection instead of drawing an unchecked fallback',()=>{
 const a={...makeIcPackage(4),id:'a',position:[-15,0,0] as [number,number,number]},b={...makeIcPackage(4),id:'b',position:[15,0,0] as [number,number,number]};
 const obstruction={...makeIcPackage(4),id:'obstruction',position:[0,0,0] as [number,number,number],dimensions:[200,200,20] as [number,number,number]};
 const wire:Wire={id:'blocked',from:{componentId:'a',pinId:'P4'},to:{componentId:'b',pinId:'P1'},diameter:1.05,color:'#ff0000',label:'Blocked connection',curvature:19,routeMode:'clean'};
 const [planned]=planAutoWires([wire],[a,b,obstruction]);
 expect(planned.routingBlocked).toBe(true);
 expect(planned.routingPoints).toBeUndefined();
 expect(wire.routingBlocked).toBeUndefined();
});

it('does not route beneath a component when its corridor is blocked',()=>{
 const a={...makeIcPackage(4),id:'a',position:[-15,0,0] as [number,number,number]},b={...makeIcPackage(4),id:'b',position:[15,0,0] as [number,number,number]};
 const barrier={...makeIcPackage(4),id:'barrier',position:[0,0,0] as [number,number,number],dimensions:[8,200,10] as [number,number,number]};
 const wire:Wire={id:'over',from:{componentId:'a',pinId:'P4'},to:{componentId:'b',pinId:'P1'},diameter:1.05,color:'#ff0000',label:'Over component',curvature:19,routeMode:'clean'};
 const [planned]=planAutoWires([wire],[a,b,barrier]);
 expect(planned.routingBlocked).toBe(true);
 expect(planned.routingPoints).toBeUndefined();
});

it('raises an interior C6 solder-pad wire before travelling across the PCB',()=>{
 const c6={...ESP32_C6_COMPONENT,id:'c6',position:[0,0,0] as [number,number,number]},ic={...makeIcPackage(4),id:'ic',position:[30,0,0] as [number,number,number]};
 const wire:Wire={id:'interior',from:{componentId:'c6',pinId:'PAD-GPIO22'},to:{componentId:'ic',pinId:'P1'},diameter:1.05,color:'#ffcc00',label:'Interior pad',curvature:19,routeMode:'clean'};
 const ends=cleanEndpoints(wire,[c6,ic])!;
 expect(ends).toBeDefined();
 expect(ends.start[1].x).toBe(ends.start[0].x);
 expect(ends.start[1].y).toBe(ends.start[0].y);
 expect(ends.start[1].z-ends.start[0].z).toBeCloseTo(3,5);
 const [planned]=planAutoWires([wire],[c6,ic]);
 expect(planned.routingBlocked).toBe(false);
});
