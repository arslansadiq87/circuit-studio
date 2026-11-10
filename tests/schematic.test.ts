import {expect,it} from 'vitest';
import fixture from './fixtures/crowded-c6-project.json';
import {ProjectSchema,normalizeProjectNames,type Project} from '../src/model';
import {diagramPinKey,generateCircuitDiagram} from '../src/schematic';

const project=()=>normalizeProjectNames(ProjectSchema.parse(fixture));
it('represents all components and every real connection as electrical nets',()=>{
 const saved=project(),before=JSON.stringify(saved),diagram=generateCircuitDiagram(saved);
 expect(diagram.nodes).toHaveLength(8);expect(diagram.nets).toHaveLength(20);expect(diagram.connectionCount).toBe(28);expect(diagram.issues).toEqual([]);
 expect(diagram.nets.flatMap(net=>net.wireIds).sort()).toEqual(saved.wires.map(w=>w.id).sort());
 for(const wire of saved.wires){const net=diagram.nets.find(net=>net.wireIds.includes(wire.id))!;expect(net.ports).toContain(diagramPinKey(wire.from.componentId,wire.from.pinId));expect(net.ports).toContain(diagramPinKey(wire.to.componentId,wire.to.pinId))}
 expect(diagram.nets.filter(net=>net.kind==='ground')).toHaveLength(1);
 expect(diagram.nets.find(net=>net.kind==='ground')!.ports).toHaveLength(5);
 expect(new Set(diagram.nodes.map(node=>node.reference)).size).toBe(8);
 expect(JSON.stringify(saved)).toBe(before);
 expect(diagram.unrouted).toEqual([]);
 for(const route of diagram.routes)for(let i=1;i<route.points.length;i++)expect(route.points[i].x===route.points[i-1].x||route.points[i].y===route.points[i-1].y).toBe(true);
 for(const route of diagram.routes)for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i];
  for(const node of diagram.nodes){const crosses=a.x===b.x?a.x>node.x&&a.x<node.x+node.width&&Math.max(a.y,b.y)>node.y&&Math.min(a.y,b.y)<node.y+node.height:a.y>node.y&&a.y<node.y+node.height&&Math.max(a.x,b.x)>node.x&&Math.min(a.x,b.x)<node.x+node.width;expect(crosses,`${route.netId} over ${node.reference}`).toBe(false)}
 }
});
it('is independent of 3D placement, rotation, routing mode, color and visibility',()=>{
 const saved=project(),a=generateCircuitDiagram(saved,{labelsOnly:true});
 const b=generateCircuitDiagram({...saved,components:saved.components.map((c,i)=>({...c,position:[i*100,-i*50,20],rotation:[0,0,90],visible:false})),wires:saved.wires.map(w=>({...w,visible:false,color:'#ff00ff',routeMode:'manual'}))},{labelsOnly:true});
 expect(b.nodes).toEqual(a.nodes);expect(b.nets.map(({color:_,...net})=>net)).toEqual(a.nets.map(({color:_,...net})=>net));
});
it('keeps resistor terminals separate and does not connect equal labels without wires',()=>{
 const saved=project(),diagram=generateCircuitDiagram(saved,{labelsOnly:true}),resistor=saved.components.find(c=>c.modelId==='resistor')!;
 const a=diagram.nets.find(net=>net.ports.includes(diagramPinKey(resistor.id,'P0')))!,b=diagram.nets.find(net=>net.ports.includes(diagramPinKey(resistor.id,'P1')))!;
 expect(a.id).not.toBe(b.id);expect(b.kind).toBe('ground');
 const disconnected:Project={...saved,wires:[]};expect(generateCircuitDiagram(disconnected).nets).toEqual([]);
});
it('uses live IC names and pin names, and can show every available pin',()=>{
 const saved=project(),controller=saved.components.find(c=>c.modelId==='esp32-c6-supermini')!;
 const changed={...saved,components:saved.components.map(c=>c.id===controller.id?{...c,name:'Main controller',pins:c.pins.map(p=>p.label==='GPIO2'?{...p,label:'MOTOR_STEP'}:p)}:c)};
 const compact=generateCircuitDiagram(changed,{labelsOnly:true}),full=generateCircuitDiagram(changed,{labelsOnly:true,allPins:true});
 expect(compact.nodes.find(n=>n.id===controller.id)!.name).toBe('Main controller');
 expect(compact.nodes.flatMap(n=>n.ports).some(p=>p.label==='MOTOR_STEP')).toBe(true);
 expect(full.nodes.find(n=>n.id===controller.id)!.ports.length).toBe(controller.pins.length);
 expect(compact.nodes.find(n=>n.id===controller.id)!.ports.length).toBeLessThan(controller.pins.length);
 expect(full.nets).toEqual(compact.nets);
});
it('reports invalid endpoints without silently inventing electrical connections',()=>{
 const saved=project(),broken={...saved,wires:[{...saved.wires[0],to:{componentId:'missing',pinId:'P1'}}]};
 const diagram=generateCircuitDiagram(broken);expect(diagram.issues).toHaveLength(1);expect(diagram.connectionCount).toBe(0);expect(diagram.nets).toEqual([]);
});
it('supports an empty project',()=>{
 const saved=project(),diagram=generateCircuitDiagram({...saved,components:[],wires:[]});expect(diagram.nodes).toEqual([]);expect(diagram.nets).toEqual([]);expect(diagram.routes).toEqual([]);expect(diagram.width).toBeGreaterThan(0);expect(diagram.height).toBeGreaterThan(0);
});
it('gives disconnected grounds distinct net labels and never merges nets by text',()=>{
 const saved=project(),components=Array.from({length:6},(_,i)=>({id:`ground-${i}`,modelId:'test',name:'Ground terminal',position:[0,0,0] as [number,number,number],rotation:[0,0,0] as [number,number,number],pins:[{id:'P',label:'GND',side:'left' as const,index:0}]}));
 const wires=Array.from({length:3},(_,i)=>({...saved.wires[0],id:`g${i}`,from:{componentId:`ground-${i*2}`,pinId:'P'},to:{componentId:`ground-${i*2+1}`,pinId:'P'}}));
 const diagram=generateCircuitDiagram({...saved,components,wires},{labelsOnly:true});
 expect(diagram.nets).toHaveLength(3);expect(new Set(diagram.nets.map(n=>n.name)).size).toBe(3);expect(diagram.nets.every(n=>n.ports.length===2&&n.kind==='ground')).toBe(true);
 const signals={...saved,components:components.map(c=>({...c,pins:c.pins.map(p=>({...p,label:'IO'}))})),wires:wires.map((w,i)=>({...w,label:['SAME','SAME','SAME_2'][i]}))};
 expect(new Set(generateCircuitDiagram(signals,{labelsOnly:true}).nets.map(n=>n.name)).size).toBe(3);
});
it('reports a supply-to-ground connection instead of hiding it behind a power symbol',()=>{
 const saved=project(),controller=saved.components.find(c=>c.modelId==='esp32-c6-supermini')!;
 const short={...saved.wires[0],from:{componentId:controller.id,pinId:'J1-1'},to:{componentId:controller.id,pinId:'J1-2'}};
 const diagram=generateCircuitDiagram({...saved,wires:[short]},{labelsOnly:true});
 expect(diagram.issues.some(issue=>issue.includes('supply and ground'))).toBe(true);expect(diagram.nets[0].kind).toBe('signal');expect(diagram.connectionCount).toBe(1);
});
it('can draw power connections explicitly and preserves source polarity regardless of pin order',()=>{
 const saved=project(),supply=saved.components.find(c=>c.modelId==='external-5v-supply')!;
 const diagram=generateCircuitDiagram({...saved,components:saved.components.map(c=>c.id===supply.id?{...c,pins:[...c.pins].reverse()}:c)},{powerSymbols:false,allPins:true});
 expect(diagram.unrouted).toEqual([]);expect(new Set(diagram.routes.map(r=>r.netId)).size).toBe(diagram.nets.length);
 const node=diagram.nodes.find(n=>n.id===supply.id)!;
 expect(node.ports.find(p=>p.label.includes('GND'))!.side).toBe('bottom');expect(node.ports.find(p=>p.label.includes('5V'))!.side).toBe('top');
});
