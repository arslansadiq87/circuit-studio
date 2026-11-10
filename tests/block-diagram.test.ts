import {expect,it} from 'vitest';
import fixture from './fixtures/crowded-c6-project.json';
import {ProjectSchema,normalizeProjectNames,type Component,type Project,type Wire} from '../src/model';
import {generateBlockDiagram} from '../src/blockDiagram';

const saved=()=>normalizeProjectNames(ProjectSchema.parse(fixture));
const custom=(id:string):Component=>({id,modelId:`custom:${id}`,name:`Custom ${id}`,position:[0,0,0],rotation:[0,0,0],pins:[{id:'a',label:'A',side:'left',index:0},{id:'b',label:'B',side:'right',index:0}]});
const link=(id:string,a:string,pa:string,b:string,pb:string):Wire=>({id,from:{componentId:a,pinId:pa},to:{componentId:b,pinId:pb},label:'New signal',color:'#40ccbb',diameter:1.05,curvature:19,routeMode:'clean'});
it('groups the real circuit into component blocks and bundled signal links without changing connectivity',()=>{
 const project=saved(),before=JSON.stringify(project),diagram=generateBlockDiagram(project);
 expect(diagram.blocks.filter(b=>b.kind==='component')).toHaveLength(8);expect(diagram.links.filter(l=>l.kind==='signal')).toHaveLength(6);
 expect(diagram.links.filter(l=>l.kind==='signal'&&l.wireIds.length===4)).toHaveLength(4);
 expect(diagram.links.filter(l=>l.kind==='signal'&&l.wireIds.length===4).every(l=>l.direction==='forward'||l.direction==='reverse')).toBe(true);
 expect(diagram.connectionCount).toBe(28);expect(diagram.networks).toHaveLength(20);expect(diagram.issues).toEqual([]);
 expect([...new Set(diagram.networks.flatMap(net=>net.wireIds))].sort()).toEqual(project.wires.map(w=>w.id).sort());
 expect(diagram.references).toHaveLength(1);expect(diagram.references[0].name).toBe('GND');expect(diagram.references[0].blocks).toHaveLength(5);
 expect(diagram.drawing.unrouted).toEqual([]);
 expect(JSON.stringify(project)).toBe(before);
});
it('keeps shared power and ground visible as badges when their links are hidden',()=>{
 const diagram=generateBlockDiagram(saved(),{powerLinks:false});
 expect(diagram.blocks).toHaveLength(8);expect(diagram.links).toHaveLength(6);expect(diagram.links.every(l=>l.kind==='signal')).toBe(true);
 expect(diagram.blocks.filter(b=>b.badges.some(badge=>badge.kind==='ground'))).toHaveLength(5);
 expect(diagram.blocks.filter(b=>b.badges.some(badge=>badge.name==='5V'))).toHaveLength(6);
 expect(diagram.networks).toHaveLength(20);expect(diagram.connectionCount).toBe(28);
 const full=generateBlockDiagram(saved(),{powerLinks:false,referenceLinks:true});expect(full.blocks.filter(b=>b.kind==='reference-bus')).toHaveLength(1);expect(full.links.filter(l=>l.kind==='ground')).toHaveLength(5);
});
it('supports custom parts, cycles and isolated components without inventing roles or arrow directions',()=>{
 const project:Project={...saved(),components:[custom('a'),custom('b'),custom('c'),{...custom('isolated'),pins:[]}],wires:[link('ab','a','a','b','b'),link('bc','b','a','c','b'),link('ca','c','a','a','b')]};
 const diagram=generateBlockDiagram(project);
 expect(diagram.blocks).toHaveLength(4);expect(diagram.blocks.every(b=>b.role==='generic')).toBe(true);expect(diagram.links).toHaveLength(3);expect(diagram.links.every(l=>l.direction==='none')).toBe(true);
 expect(diagram.blocks.find(b=>b.id==='isolated')!.summary).toBe('Not connected');expect(diagram.connectionCount).toBe(3);expect(diagram.drawing.unrouted).toEqual([]);
});
it('shows both directions for a bundle containing known input/output signals in opposite directions',()=>{
 const a=custom('a'),b=custom('b');for(const component of [a,b])component.pins=component.pins.map((p,i)=>({...p,electrical:i===0?'output':'input'}));
 const diagram=generateBlockDiagram({...saved(),components:[a,b],wires:[link('tx','a','a','b','b'),link('rx','b','a','a','b')]});
 expect(diagram.links).toHaveLength(1);expect(diagram.links[0].direction).toBe('both');expect(diagram.links[0].netIds).toHaveLength(2);expect(diagram.links[0].wireIds).toHaveLength(2);
});
it('represents a connection within one component as a loop',()=>{
 const diagram=generateBlockDiagram({...saved(),components:[custom('a')],wires:[link('loop','a','a','a','b')]});
 expect(diagram.links).toHaveLength(1);expect(diagram.links[0].from).toBe(diagram.links[0].to);expect(diagram.drawing.nodes[0].ports).toHaveLength(2);expect(diagram.drawing.unrouted).toEqual([]);
});
it('does not depend on 3D layout, wire appearance or visibility',()=>{
 const project=saved(),a=generateBlockDiagram(project,{powerLinks:false}),b=generateBlockDiagram({...project,components:project.components.map((c,i)=>({...c,position:[i*50,75,-20],rotation:[90,0,180],visible:false})),wires:project.wires.map(w=>({...w,color:'#ff0000',visible:false,routeMode:'manual'}))},{powerLinks:false});
 expect(b.blocks).toEqual(a.blocks);expect(b.links).toEqual(a.links);expect(b.references).toEqual(a.references);
});
it('supports empty projects and reports missing endpoints',()=>{
 const project=saved(),empty=generateBlockDiagram({...project,components:[],wires:[]});expect(empty.blocks).toEqual([]);expect(empty.links).toEqual([]);expect(empty.drawing.routes).toEqual([]);
 const broken=generateBlockDiagram({...project,wires:[link('broken',project.components[0].id,'missing','nonexistent','P')]});expect(broken.issues).toHaveLength(1);expect(broken.connectionCount).toBe(0);expect(broken.links).toEqual([]);
});
