import {describe,it,expect} from 'vitest';
import {initialProject,normalizeProjectNames,ComponentSchema} from '../src/model';
import {supplyVoltage,supplyVoltagePatch} from '../src/powerSupply';
const supply=initialProject.components.find(c=>c.modelId==='external-5v-supply')!;
describe('variable power supply',()=>{
 it('updates voltage and positive terminal together, preserving contacts',()=>{
  for(const voltage of [0,.125,3.3,12,24,1000]){
   const c={...supply,...supplyVoltagePatch(supply,voltage)};
   expect(supplyVoltage(c)).toBe(voltage);expect(c.pins[0].voltage).toBe(voltage);
   expect(c.pins[0].label).toBe(`${voltage}V OUT`);expect(c.pins[1].voltage).toBe(0);
   expect(c.pins.map(p=>p.localPosition)).toEqual(supply.pins.map(p=>p.localPosition));
   expect(ComponentSchema.parse(JSON.parse(JSON.stringify(c))).outputVoltage).toBe(voltage);
  }
 });
 it('rejects invalid voltages',()=>{for(const voltage of [-1,Infinity,NaN])expect(()=>supplyVoltagePatch(supply,voltage)).toThrow()});
 it('upgrades old fixed supplies without losing a configured voltage or wires',()=>{
  const old={...supply,name:'Regulated 5V bench supply',outputVoltage:undefined,pins:supply.pins.map(p=>p.id==='OUT+'?{...p,voltage:12}:p)};
  const p=normalizeProjectNames({...initialProject,components:[old]});
  expect(p.components[0].name).toBe('Power Supply');expect(supplyVoltage(p.components[0])).toBe(12);
  expect(p.wires).toEqual(initialProject.wires);expect(normalizeProjectNames(p)).toBe(p);
 });
});
