import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import {ComponentSchema,ProjectSchema,initialProject} from '../src/model';
import {CAPACITOR_DEFAULTS,CAPACITOR_MODEL_ID,CAPACITOR_PACKAGES,capacitorComponent,capacitorPins} from '../src/capacitor';
import {useEditor} from '../src/store';

describe('built-in electrolytic capacitor',()=>{
 it('uses one library model with the supplied package variants and default properties',()=>{
  expect(CAPACITOR_PACKAGES).toHaveLength(26);
  expect(CAPACITOR_PACKAGES.find(p=>p.id==='8x12')).toMatchObject({pitch:3.5,diameter:8,height:12});
  expect(CAPACITOR_PACKAGES.find(p=>p.id==='18x40')).toMatchObject({pitch:7.5,diameter:18,height:40});
  const part=capacitorComponent();
  expect(part.modelId).toBe(CAPACITOR_MODEL_ID);expect(part.capacitor).toEqual(CAPACITOR_DEFAULTS);
  expect(ComponentSchema.parse(part)).toEqual(part);
 });
 it('keeps polarized pin IDs stable at lead tips as pitch and length change',()=>{
  const pins=capacitorPins(7.5,6,40);
  expect(pins.map(p=>p.id)).toEqual(['POS','NEG']);
  expect(pins.map(p=>p.localPosition)).toEqual([[-3.75,0,-23],[3.75,0,-23]]);
  expect(pins.map(p=>p.label)).toEqual(['+','−']);
  expect(ComponentSchema.safeParse({...capacitorComponent(),capacitor:{...CAPACITOR_DEFAULTS,diameter:0}}).success).toBe(false);
 });
 it('adds, edits, undoes, redoes, serializes, and preserves connected terminal IDs',()=>{
  const editor=useEditor.getState();editor.loadProject({...initialProject,components:[],wires:[]});editor.addComponent(CAPACITOR_MODEL_ID);
  const added=useEditor.getState().project.components[0];expect(added.modelId).toBe(CAPACITOR_MODEL_ID);
  const oldPins=added.pins.map(p=>p.id);
  useEditor.getState().updateComponent(added.id,{capacitor:{...added.capacitor!,value:470,packageId:'18x40',diameter:18,height:40,pitch:7.5,leadLength:6,customSize:false},dimensions:[18,18,46],pins:capacitorPins(7.5,6,40)});
  const changed=useEditor.getState().project.components[0];expect(changed.capacitor?.value).toBe(470);expect(changed.pins.map(p=>p.id)).toEqual(oldPins);
  expect(ProjectSchema.parse(useEditor.getState().project)).toEqual(useEditor.getState().project);
  useEditor.getState().undo();expect(useEditor.getState().project.components[0].capacitor?.value).toBe(100);
  useEditor.getState().redo();expect(useEditor.getState().project.components[0].capacitor?.diameter).toBe(18);
 });
 it('assigns unique IDs to repeated instances',()=>{
  useEditor.getState().loadProject({...initialProject,components:[],wires:[]});
  for(let i=0;i<50;i++)useEditor.getState().addComponent(CAPACITOR_MODEL_ID);
  const parts=useEditor.getState().project.components.filter(c=>c.modelId===CAPACITOR_MODEL_ID);
  expect(parts).toHaveLength(50);expect(new Set(parts.map(c=>c.id)).size).toBe(50);
 });
 it('duplicates capacitor properties independently and without copying wire attachments',()=>{
  useEditor.getState().loadProject({...initialProject,components:[],wires:[]});useEditor.getState().addComponent(CAPACITOR_MODEL_ID);
  const original=useEditor.getState().project.components[0];useEditor.getState().updateComponent(original.id,{capacitor:{...original.capacitor!,value:470}});useEditor.getState().duplicateComponent(original.id);
  const parts=useEditor.getState().project.components;expect(parts).toHaveLength(2);expect(parts[1].capacitor?.value).toBe(470);expect(parts[1].id).not.toBe(original.id);
  useEditor.getState().updateComponent(parts[1].id,{capacitor:{...parts[1].capacitor!,value:1000}});
  expect(useEditor.getState().project.components[0].capacitor?.value).toBe(470);expect(useEditor.getState().project.wires).toHaveLength(0);
 });
});
