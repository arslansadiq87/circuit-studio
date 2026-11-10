import {describe,it,expect} from 'vitest';
import {USB_A_BREAKOUT_COMPONENT,initialProject,normalizeProjectNames,ProjectSchema,type Component} from '../src/model';
describe('USB-A STEP breakout replacement',()=>{
 it('maps stable signal IDs to the four measured terminal apertures',()=>{
  const c=USB_A_BREAKOUT_COMPONENT;
  expect(c.pins.map(p=>[p.id,p.label])).toEqual([['A1','VBUS'],['A2','D-'],['A3','D+'],['A4','GND']]);
  expect(c.pins.map(p=>p.localPosition)).toEqual([[5.25,-14.05,.275],[1.75,-14.05,.275],[-1.75,-14.05,.275],[-5.25,-14.05,.275]]);
  expect(c.dimensions?.[0]).toBeCloseTo(20.1,2);expect(c.dimensions?.[1]).toBeCloseTo(28.1,2);
  expect(c.pins.some(p=>p.label==='Shield')).toBe(false);
 });
 it('upgrades procedural USB instances while preserving endpoints and transforms',()=>{
  const old:Component={...USB_A_BREAKOUT_COMPONENT,name:'USB-A female socket',position:[8,9,10],rotation:[0,0,90],geometry:{kind:'procedural-pcb'},pins:USB_A_BREAKOUT_COMPONENT.pins.map(p=>({...p,localPosition:[0,-16,1.15]}))};
  const project={...initialProject,components:initialProject.components.map(c=>c.id==='usb-a'?old:c)};
  const upgraded=normalizeProjectNames(project),usb=upgraded.components.find(c=>c.id===old.id)!;
  expect(usb.geometry?.kind).toBe('model');expect(usb.position).toEqual(old.position);expect(usb.rotation).toEqual(old.rotation);
  expect(upgraded.wires).toEqual(project.wires);expect(ProjectSchema.parse(upgraded)).toEqual(upgraded);
  expect(normalizeProjectNames(upgraded)).toBe(upgraded);
 });
 it('also upgrades old P0-P3 wire endpoints on either side of a wire',()=>{
  const old={...USB_A_BREAKOUT_COMPONENT,geometry:{kind:'procedural-pcb' as const}};
  const w={...initialProject.wires[0],from:{componentId:old.id,pinId:'P0'},to:{componentId:old.id,pinId:'P3'}};
  const p=normalizeProjectNames({...initialProject,components:[old],wires:[w]});
  expect(p.wires[0].from.pinId).toBe('A1');expect(p.wires[0].to.pinId).toBe('A4');
 });
});
