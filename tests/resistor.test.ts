import {describe,it,expect} from 'vitest';
import {RESISTOR_COMPONENT,initialProject,normalizeProjectNames,ProjectSchema,ComponentSchema,type Component} from '../src/model';
describe('STEP resistor replacement',()=>{
 it('retains arbitrary finite nonnegative resistance per instance and rejects invalid files',()=>{
  for(const resistanceOhms of [0,0.000001,4.7,4700,1.234e12]){
   expect(ComponentSchema.parse(JSON.parse(JSON.stringify({...RESISTOR_COMPONENT,resistanceOhms}))).resistanceOhms).toBe(resistanceOhms);
  }
  for(const resistanceOhms of [-1,Infinity,NaN])expect(ComponentSchema.safeParse({...RESISTOR_COMPONENT,resistanceOhms}).success).toBe(false);
  expect(ComponentSchema.parse(RESISTOR_COMPONENT).resistanceOhms).toBeUndefined();
 });
 it('has two passive contacts on the measured lead ends',()=>{
  expect(RESISTOR_COMPONENT.pins.map(p=>p.id)).toEqual(['P0','P1']);
  expect(RESISTOR_COMPONENT.pins.map(p=>p.electrical)).toEqual(['passive','passive']);
  expect(RESISTOR_COMPONENT.pins[0].localPosition?.[0]).toBe(-4.7);
  expect(RESISTOR_COMPONENT.pins[1].localPosition?.[0]).toBe(4.7);
  expect(RESISTOR_COMPONENT.geometry?.sourceFilename).toBe('Resistor.step');
  expect(RESISTOR_COMPONENT.dimensions?.[0]).toBeCloseTo(9.4,3);
 });
 it('upgrades four-pin placeholders and preserves every wire by physical side',()=>{
  const old:Component={id:'r1',modelId:'resistor',name:'Axial resistor',position:[3,4,5],rotation:[0,90,30],pins:['P0','P1','P2','P3'].map((id,index)=>({id,label:String(index+1),side:index<2?'left':'right',index:index%2})),geometry:{kind:'procedural-pcb'}};
  const project={...initialProject,components:[...initialProject.components,old],wires:old.pins.map(p=>({...initialProject.wires[0],id:p.id,from:{componentId:old.id,pinId:p.id}}))};
  const result=normalizeProjectNames(project),r=result.components.at(-1)!;
  expect(r.position).toEqual(old.position);expect(r.rotation).toEqual(old.rotation);
  expect(r.pins).toHaveLength(2);expect(r.geometry?.kind).toBe('model');
  expect(result.wires.map(w=>w.from.pinId)).toEqual(['P0','P0','P1','P1']);
  expect(ProjectSchema.parse(result)).toEqual(result);
  expect(normalizeProjectNames(result)).toBe(result);
 });
});
