import {expect,it} from 'vitest';
import project from './fixtures/crowded-c6-project.json';
import {ProjectSchema,normalizeProjectNames} from '../src/model';
import {planAutoWires} from '../src/autoRouting';
import {makeWireCurve,worldPin,worldPinDirection} from '../src/geometry';

it('routes the saved eight-component circuit',()=>{
 const saved=normalizeProjectNames(ProjectSchema.parse(project));
 const routes=planAutoWires(saved.wires,saved.components);
 for(const [id,limit] of [['wire-1793787353214',40],['wire-1793808695580',40],['wire-1793817601030',80]] as const){
  const points=routes.find(w=>w.id===id)!.routingPoints!;
  const length=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(...p.map((v,axis)=>v-points[i][axis])),0);
  expect(length,`short route for ${id}`).toBeLessThan(limit);
  expect(Math.max(...points.map(p=>p[2]))).toBeLessThan(4.5);
 }
 const outputs=new Set(['wire-1793787440013','wire-1793787444911','wire-1793787451051','wire-1793787454572']);
 for(const wire of routes.filter(w=>outputs.has(w.id))){
  const floorSegments=wire.routingPoints!.slice(1).filter((p,i)=>Math.abs(p[2]-wire.routingPoints![i][2])<.01&&p[2]<5&&Math.hypot(p[0]-wire.routingPoints![i][0],p[1]-wire.routingPoints![i][1])>.1);
  expect(floorSegments.filter(p=>p[2]>.05).every(p=>Math.abs(p[2]-.7)<.01)).toBe(true);
 }
 expect(routes.filter(w=>w.routingBlocked).map(w=>w.id)).toEqual([]);
 expect(routes.find(w=>w.id==='wire-1793787377521')?.routingPoints).toBeDefined();
 const ground=routes.find(w=>w.id==='wire-1793808726995');
 expect(ground?.routingPoints).toBeDefined();
 expect(Math.max(...ground!.routingPoints!.map(point=>point[2]))).toBeLessThan(5);
 const groundIds=new Set(['wire-1793787304500','wire-1793808726995','wire-1793817621368','wire-1793819732753']);
 const groundBranches=routes.filter(w=>groundIds.has(w.id)&&w.routingJunction);
 expect(groundBranches.length).toBeGreaterThanOrEqual(1);
 for(const branch of groundBranches)expect(groundIds.has(branch.routingJunction!.wireId)).toBe(true);
 const source=saved.components.find(c=>c.id===ground!.from.componentId)!,target=saved.components.find(c=>c.id===ground!.to.componentId)!;
 const a=source.pins.find(p=>p.id===ground!.from.pinId)!,b=target.pins.find(p=>p.id===ground!.to.pinId)!;
 const returns=routes.filter(w=>groundIds.has(w.id)&&(w.from.componentId===target.id&&w.from.pinId===b.id&&w.routingJunction?.at!=='from'||w.to.componentId===target.id&&w.to.pinId===b.id&&w.routingJunction?.at!=='to'));
 expect(returns).toHaveLength(1);
 const groundCurve=makeWireCurve(ground!,worldPin(a,source),worldPin(b,target),worldPinDirection(a,source),worldPinDirection(b,target),undefined,undefined,saved.components);
 const [width,height]=source.dimensions!;
 expect(groundCurve.getSpacedPoints(400).every(p=>Math.abs(p.x-source.position[0])>=width/2-.02||Math.abs(p.y-source.position[1])>=height/2-.02)).toBe(true);
 expect(routes.map(w=>[w.id,w.from,w.to])).toEqual(saved.wires.map(w=>[w.id,w.from,w.to]));
},120000);
