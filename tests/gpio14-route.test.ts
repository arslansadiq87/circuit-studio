import {expect,it} from 'vitest';
import {ESP32_C6_COMPONENT,STEPPER_24BYJ_48_COMPONENT,type Wire} from '../src/model';
import {pcbContactPins} from '../src/espContacts';
import {makeIcPackage} from '../src/icPackage';
import {planAutoWires,pathsOverlap} from '../src/autoRouting';
import {makeWireCurve,worldPin,worldPinDirection,worldPinWireEntry} from '../src/geometry';
import {cleanEndpoints} from '../src/cleanRouting';

it('routes GPIO14 to IN4 through a crowded four-part circuit',()=>{
 const components=[{...STEPPER_24BYJ_48_COMPONENT,id:'motor',position:[-75,0,0] as [number,number,number]},{...makeIcPackage(10),id:'driver',position:[-35,0,0] as [number,number,number]},{...pcbContactPins(ESP32_C6_COMPONENT),id:'c6',position:[0,0,0] as [number,number,number],rotation:[0,0,-180] as [number,number,number]},{...makeIcPackage(16),id:'uln',position:[35,0,0] as [number,number,number]}];
 const wire=(id:string,a:string,pa:string,b:string,pb:string):Wire=>({id,from:{componentId:a,pinId:pa},to:{componentId:b,pinId:pb},color:'#ffffff',diameter:1.05,label:id,curvature:19,routeMode:'clean'});
 const wires=[...Array.from({length:5},(_,i)=>wire(`motor-${i}`,'motor',`J1-${i+1}`,'driver',`P${i+1}`)),...Array.from({length:5},(_,i)=>wire(`driver-${i}`,'driver',`P${6+i}`,'c6',`J2-${i+1}`)),...Array.from({length:7},(_,i)=>wire(`input-${i}`,'c6',`J1-${i+1}`,'uln',`P${i+1}`)),wire('power','driver','P1','uln','P16'),wire('gpio14-in4','c6','J1-8','driver','P4'),wire('gpio21-in4','c6','PAD-GPIO21','uln','P4'),wire('ground','c6','J1-2','uln','P8'),wire('ground-bus','driver','P10','uln','P6')];
 const planned=planAutoWires(wires,components);
 const gpio21Escape=cleanEndpoints(wires.find(w=>w.id==='gpio21-in4')!,components)!.start.at(-1)!;
 expect(gpio21Escape.x).toBeGreaterThan(0);
 expect(planned.find(w=>w.id==='gpio14-in4')?.routingBlocked,planned.filter(w=>w.routingBlocked).map(w=>w.id).join(',')).toBe(false);
 expect(planned.find(w=>w.id==='gpio21-in4')?.routingBlocked,planned.filter(w=>w.routingBlocked).map(w=>w.id).join(',')).toBe(false);
 expect(planned.find(w=>w.id==='gpio14-in4')!.routingPoints!.every(([x,y,z])=>Math.abs(x)>=9||Math.abs(y)>=14||z>=.2)).toBe(true);
 expect(Math.max(...planned.find(w=>w.id==='ground')!.routingPoints!.map(point=>point[2]))).toBeLessThan(4.5);
 const paths=planned.map(w=>{
  expect(w.routingPoints,`missing route for ${w.id}`).toBeDefined();
  const a=components.find(c=>c.id===w.from.componentId)!,b=components.find(c=>c.id===w.to.componentId)!,pa=a.pins.find(p=>p.id===w.from.pinId)!,pb=b.pins.find(p=>p.id===w.to.pinId)!,start=worldPin(pa,a),end=worldPin(pb,b);
  const terminalHeight=Math.max(start.z,end.z,a.position[2]+(a.dimensions?.[2]??8)/2,b.position[2]+(b.dimensions?.[2]??8)/2)+1.8;
  expect(Math.max(...w.routingPoints!.map(p=>p[2])),`excessive height for ${w.id}`).toBeLessThanOrEqual(terminalHeight);
  const curve=makeWireCurve(w,start,end,worldPinDirection(pa,a),worldPinDirection(pb,b),worldPinWireEntry(pa,a),worldPinWireEntry(pb,b),components);
  return {wire:w,start,end,points:curve.getSpacedPoints(Math.ceil(curve.getLength()/.6))};
 });
 for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++)expect(pathsOverlap(paths[i],paths[j]),`${paths[i].wire.id} and ${paths[j].wire.id}`).toBe(false);
},30000);

it('keeps a C6 ground route to a SOP-16 near the contact plane',()=>{
 const c6={...pcbContactPins(ESP32_C6_COMPONENT),id:'c6',position:[0,0,0] as [number,number,number]};
 const sop={...makeIcPackage(16),id:'sop',position:[35,0,0] as [number,number,number]};
 const wire:Wire={id:'ground',from:{componentId:'c6',pinId:'J1-2'},to:{componentId:'sop',pinId:'P8'},color:'#222222',diameter:1.05,label:'GND',curvature:19,routeMode:'clean'};
 const [planned]=planAutoWires([wire],[c6,sop]);
 expect(planned.routingBlocked).toBe(false);
 expect(Math.max(...planned.routingPoints!.map(point=>point[2]))).toBeLessThan(4.5);
});
