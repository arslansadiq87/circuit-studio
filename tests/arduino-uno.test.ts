import 'fake-indexeddb/auto';
﻿import {describe,it,expect} from 'vitest';
import {ARDUINO_UNO_R3_COMPONENT as uno} from '../src/arduinoUno';
import {BUILT_IN_MODEL_COMPONENTS,initialProject,ProjectSchema} from '../src/model';
import {useEditor} from '../src/store';

describe('Arduino Uno R3',()=>{
 it('is registered once as a built-in model with all physical header positions',()=>{
  expect(BUILT_IN_MODEL_COMPONENTS.get('arduino-uno-r3')?.name).toBe('Arduino Uno R3');
  expect(uno.pins).toHaveLength(44);
  expect(new Set(uno.pins.map(p=>p.id)).size).toBe(44);
  for(const label of [...Array.from({length:14},(_,i)=>`D${i}`),...Array.from({length:6},(_,i)=>`A${i}`),'3.3V','5V','GND','VIN','RESET','IOREF','AREF'])
   expect(uno.pins.some(p=>p.label.startsWith(label))).toBe(true);
  expect(uno.pins.some(p=>p.label.includes('SDA'))).toBe(true);
  expect(uno.pins.some(p=>p.label.includes('SCL'))).toBe(true);
  expect(uno.pins.filter(p=>p.id.startsWith('J_ICSP'))).toHaveLength(12);
  expect(uno.pins.find(p=>p.id==='J_ICSP_MCU_1')?.aliases).toContain('D12');
  expect(uno.pins.find(p=>p.id==='J_ICSP_MCU_3')?.aliases).toContain('D13');
 });
 it('uses source-calibrated dimensions and contact positions within the PCB outline',()=>{
  expect(uno.dimensions).toEqual([53,75.45,14.28]);
  expect(uno.geometry?.modelUrl).toBe('/models/arduino-uno-r3.glb');
  expect(uno.geometry?.triangleCount).toBe(51026);
  expect(uno.geometry?.modelCenter).toEqual([0.0000823,0.0008,0.0000644]);
  expect(uno.pins[0].localPosition?.[2]).toBe(8.8);
  for(const pin of uno.pins){expect(pin.localPosition?.[0]).toBeGreaterThanOrEqual(-26.6);expect(pin.localPosition?.[0]).toBeLessThanOrEqual(26.6);expect(pin.localPosition?.[1]).toBeGreaterThanOrEqual(-37.7);expect(pin.localPosition?.[1]).toBeLessThanOrEqual(37.7)}
 });
 it('duplicates and serializes stable pin ids and wire endpoints through undo/redo',()=>{
  const editor=useEditor.getState();editor.loadProject(initialProject);editor.addComponent('arduino-uno-r3');
  const first=useEditor.getState().project.components[0];expect(first.pins).toHaveLength(44);
  useEditor.getState().duplicateComponent(first.id);const second=useEditor.getState().project.components[1];
  useEditor.getState().addWire({componentId:first.id,pinId:'J_DIG_A_1'},{componentId:second.id,pinId:'J_POWER_5'});
  const saved=ProjectSchema.parse(JSON.parse(JSON.stringify(useEditor.getState().project)));
  expect(saved.components).toHaveLength(2);expect(saved.wires).toHaveLength(1);
  expect(saved.components[1].pins.map(p=>p.id)).toEqual(first.pins.map(p=>p.id));
  useEditor.getState().undo();expect(useEditor.getState().project.wires).toHaveLength(0);
  useEditor.getState().redo();expect(useEditor.getState().project.wires).toHaveLength(1);
  useEditor.getState().loadProject(initialProject);
 });
});
