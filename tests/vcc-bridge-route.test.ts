import {expect,it} from 'vitest';
import project from './fixtures/crowded-c6-project.json';
import {ProjectSchema} from '../src/model';
import {planAutoWires} from '../src/autoRouting';
import {makeWireCurve,worldPin,worldPinDirection} from '../src/geometry';

it('keeps the ULN2003 VCC to ESP32-C6 5V connection complete',()=>{
 const saved=ProjectSchema.parse(project),w=planAutoWires(saved.wires,saved.components).find(w=>w.id==='wire-1793787298327')!;
 const a=saved.components.find(c=>c.id===w.from.componentId)!,b=saved.components.find(c=>c.id===w.to.componentId)!;
 const pa=a.pins.find(p=>p.id===w.from.pinId)!,pb=b.pins.find(p=>p.id===w.to.pinId)!;
 const curve=makeWireCurve(w,worldPin(pa,a),worldPin(pb,b),worldPinDirection(pa,a),worldPinDirection(pb,b),undefined,undefined,saved.components);
 expect(w.routingBlocked).toBe(false);
 expect(w.routingJunction).toBeUndefined();
 expect(curve.getPoint(0).distanceTo(worldPin(pa,a))).toBeLessThan(.01);
 expect(curve.getPoint(1).distanceTo(worldPin(pb,b))).toBeLessThan(.01);
 expect(curve.getLength()).toBeGreaterThan(10);
},120000);
