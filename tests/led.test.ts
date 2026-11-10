import {describe,it,expect} from 'vitest';
import {LED_COMPONENT,initialProject,normalizeProjectNames,ComponentSchema} from '../src/model';
describe('3 mm CAD LED',()=>{
 it('has two measured contacts and no invented polarity',()=>{
  expect(LED_COMPONENT.pins.map(p=>p.localPosition)).toEqual([[-.75,0,-2],[.7,0,-2]]);
  expect(LED_COMPONENT.pins.map(p=>p.exitDirection)).toEqual([[0,0,-1],[0,0,-1]]);
  expect(LED_COMPONENT.geometry?.pinPositionsVerified).toBe(true);expect(LED_COMPONENT.geometry?.electricalMappingVerified).toBe(false);
  expect(ComponentSchema.parse({...LED_COMPONENT,color:'#aabbcc'}).color).toBe('#aabbcc');
 });
 it('upgrades old LED placeholders preserving instance color, transform and wired sides',()=>{
  const old={...LED_COMPONENT,id:'old-led',name:'5 mm LED',color:'#ff0000',position:[1,2,3] as [number,number,number],geometry:{kind:'procedural-pcb' as const}};
  const w={...initialProject.wires[0],from:{componentId:old.id,pinId:'P1'},to:{componentId:old.id,pinId:'P3'}};
  const p=normalizeProjectNames({...initialProject,components:[old],wires:[w]}),c=p.components[0];
  expect(c.name).toBe('3 mm LED');expect(c.color).toBe('#ff0000');expect(c.position).toEqual(old.position);expect(c.pins).toHaveLength(2);expect(p.wires[0].from.pinId).toBe('P0');expect(p.wires[0].to.pinId).toBe('P1');expect(normalizeProjectNames(p)).toBe(p);
 });
});
