import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import {ESP32_WROOM_COMPONENT,ESP32_WROOM_PINS,initialProject,ProjectSchema,normalizeProjectNames} from '../src/model';
import measured from '../src/data/esp32-wroom-anchors.json';
import {worldPin,worldPinDirection} from '../src/geometry';
import {proposeReplacement} from '../src/replacement';
import {useEditor} from '../src/store';

describe('NodeMCU ESP-32S V1.1 contact verification',()=>{
 it('has every physical pin from P1 to P38 in the modeled silkscreen order',()=>{
  expect(ESP32_WROOM_PINS.map(p=>p.id)).toEqual(Array.from({length:38},(_,i)=>`P${i+1}`));
  expect(ESP32_WROOM_PINS.map(p=>p.silkscreen)).toEqual(['3V3','EN','SVP','SVN','P34','P35','P32','P33','P25','P26','P27','P14','P12','GND','P13','SD2','SD3','CMD','5V','CLK','SD0','SD1','P15','P2','P0','P4','P16','P17','P5','P18','P19','GND','P21','RX','TX','P22','P23','GND']);
  expect(new Set(ESP32_WROOM_PINS.map(p=>p.id)).size).toBe(38);
 });
 it('puts every anchor at its independently extracted metal-shaft tip, with 19 contacts per row',()=>{
  for(const pin of ESP32_WROOM_PINS){const reference=measured.pins.find(p=>p.id===pin.id)!;expect(pin.localPosition).toEqual(reference.localPosition);expect(pin.cadPosition).toEqual(reference.localPosition);expect(pin.localPosition![2]).toBe(reference.shaftBounds.min[2]);for(const axis of [0,1])expect(pin.localPosition![axis]).toBeCloseTo((reference.shaftBounds.min[axis]+reference.shaftBounds.max[axis])/2,5);expect(pin.exitDirection).toEqual([0,0,-1])}
  for(const side of ['left','right']){const row=ESP32_WROOM_PINS.filter(p=>p.side===side).sort((a,b)=>a.index-b.index);expect(row).toHaveLength(19);for(let i=1;i<19;i++)expect(Math.abs(row[i].localPosition![0]-row[i-1].localPosition![0])).toBeCloseTo(2.54,4)}
  expect(measured.rowSpacingMm).toBeCloseTo(22.9,4);
 });
 it('distinguishes ground, power, reset, input-only GPIO and the six flash contacts',()=>{
  expect(ESP32_WROOM_PINS.filter(p=>p.electrical==='ground').map(p=>p.id)).toEqual(['P14','P32','P38']);expect(ESP32_WROOM_PINS[0].voltage).toBe(3.3);expect(ESP32_WROOM_PINS[18].voltage).toBe(5);expect(ESP32_WROOM_PINS[1].silkscreen).toBe('EN');
  expect(ESP32_WROOM_PINS.filter(p=>p.notes?.includes('Input only')).map(p=>p.id)).toEqual(['P3','P4','P5','P6']);
  expect(ESP32_WROOM_PINS.filter(p=>p.notes?.includes('Flash-reserved')).map(p=>p.id)).toEqual(['P16','P17','P18','P20','P21','P22']);
  expect(ESP32_WROOM_PINS.find(p=>p.id==='P35')!.label).toBe('TX / GPIO1');expect(ESP32_WROOM_PINS.find(p=>p.id==='P34')!.label).toBe('RX / GPIO3');
  expect(ESP32_WROOM_PINS.some(p=>p.aliases?.includes('GPIO20'))).toBe(false);
 });
 it('routes all WROOM wire anchors to the top PCB pads',()=>{
  expect(ESP32_WROOM_COMPONENT.pins).toHaveLength(38);
  for(const pin of ESP32_WROOM_COMPONENT.pins){expect(pin.localPosition?.[2]).toBe(3.6);expect(pin.exitDirection).toEqual([0,0,1]);expect(pin.id).toMatch(/^P([1-9]|[12][0-9]|3[0-8])$/)}
 });
 it('preserves calibration/reference coordinates and electrical notes through project schema roundtrips',()=>{
  const project=ProjectSchema.parse(JSON.parse(JSON.stringify({...initialProject,components:[ESP32_WROOM_COMPONENT],wires:[]})));expect(project.components[0].pins).toEqual(ESP32_WROOM_COMPONENT.pins);
 });
 it('upgrades older zero-pin WROOM instances without overwriting existing calibrated mappings',()=>{
  const old={...ESP32_WROOM_COMPONENT,id:'older-wroom',position:[12,9,3] as [number,number,number],pins:[],geometry:{...ESP32_WROOM_COMPONENT.geometry!,verified:false}};const upgraded=normalizeProjectNames({...initialProject,components:[old],wires:[]});expect(upgraded.components[0].pins).toHaveLength(38);expect(upgraded.components[0].position).toEqual(old.position);expect(upgraded.components[0].geometry?.electricalMappingVerified).toBe(true);
  const custom={...ESP32_WROOM_COMPONENT,pins:ESP32_WROOM_PINS.map(p=>p.id==='P1'?{...p,localPosition:[1,2,3] as [number,number,number]}:p)};expect(normalizeProjectNames({...initialProject,components:[custom],wires:[]}).components[0].pins[0].localPosition).toEqual([1,2,3]);
 });
 it('keeps connected IDs stable under 3D transforms and rotates the underside exit direction',()=>{
  useEditor.getState().loadProject({...initialProject,components:[ESP32_WROOM_COMPONENT],wires:[]});useEditor.getState().addWire({componentId:'esp32-wroom',pinId:'P14'},{componentId:'esp32-wroom',pinId:'P38'});const before=worldPin(ESP32_WROOM_PINS[37],ESP32_WROOM_COMPONENT);useEditor.getState().updateComponent('esp32-wroom',{position:[10,20,30],rotation:[180,0,90]});const c=useEditor.getState().project.components[0];expect(worldPin(c.pins[37],c).distanceTo(before)).toBeGreaterThan(1);expect(worldPinDirection(c.pins[37],c).z).toBeCloseTo(-1,8);expect(useEditor.getState().project.wires[0].to.pinId).toBe('P38');
 });
 it('does not invent a GPIO20/native-USB mapping when replacing ESP32-S3',()=>{const rows=proposeReplacement(initialProject,initialProject.components[0],ESP32_WROOM_COMPONENT);expect(rows.find(p=>p.source==='J3-20')?.proposed).toBe('P31');expect(rows.find(p=>p.source==='J3-19')?.candidates).toHaveLength(0);expect(rows.find(p=>p.source==='J1-22')?.candidates).toHaveLength(3)});
});
