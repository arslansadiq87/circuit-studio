import {describe,it,expect} from 'vitest';
import 'fake-indexeddb/auto';
import {LDR_COMPONENT,ComponentSchema} from '../src/model';
import {useEditor} from '../src/store';

describe('imported LDR',()=>{
 it('places two passive wire anchors at the measured STEP lead tips',()=>{
  expect(ComponentSchema.parse(LDR_COMPONENT)).toEqual(LDR_COMPONENT);
  expect(LDR_COMPONENT.pins.map(p=>p.localPosition)).toEqual([[-4.5,0,0],[4.5,0,0]]);
  expect(LDR_COMPONENT.pins.map(p=>p.cadPosition)).toEqual([[-4.5,0,-10],[4.5,0,-10]]);
  expect(LDR_COMPONENT.pins.map(p=>p.electrical)).toEqual(['passive','passive']);
  expect(LDR_COMPONENT.geometry?.pinPositionsVerified).toBe(true);
  expect(LDR_COMPONENT.geometry?.sourceFilename).toBe('LDR12.step');
 });
 it('can be placed from the built-in library',()=>{
  const before=useEditor.getState().project.components.length;
  useEditor.getState().addComponent('ldr');
  const added=useEditor.getState().project.components.at(-1)!;
  expect(useEditor.getState().project.components).toHaveLength(before+1);
  expect(added.modelId).toBe('ldr');
  expect(added.pins).toHaveLength(2);
 });
});
