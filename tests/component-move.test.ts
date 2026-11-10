import 'fake-indexeddb/auto';
import {describe,it,expect,beforeEach} from 'vitest';
import {initialProject} from '../src/model';
import {useEditor,projectFingerprint} from '../src/store';
describe('XY component drag transactions',()=>{
 beforeEach(()=>useEditor.getState().loadProject(structuredClone(initialProject)));
 it('previews live movement with fixed Z and one undo entry per completed drag',()=>{
  const s=useEditor.getState(),original=structuredClone(s.project),c=original.components[0];s.beginMove(c.id);
  for(let i=1;i<=20;i++)s.previewMove(c.id,[i,i*2,999]);
  expect(useEditor.getState().project.components[0].position).toEqual([20,40,c.position[2]]);expect(useEditor.getState().undoStack).toHaveLength(0);
  s.finishMove(true);expect(useEditor.getState().undoStack).toHaveLength(1);expect(useEditor.getState().project.wires).toEqual(original.wires);
  s.undo();expect(useEditor.getState().project).toEqual(original);s.redo();expect(useEditor.getState().project.components[0].position).toEqual([20,40,c.position[2]]);
 });
 it('cancels to the original position and dirty state without changing history',()=>{
  const s=useEditor.getState(),before=projectFingerprint(s.project);s.beginMove('esp32');s.previewMove('esp32',[17,23,1]);expect(useEditor.getState().dirty).toBe(true);s.finishMove(false);
  expect(projectFingerprint(useEditor.getState().project)).toBe(before);expect(useEditor.getState().dirty).toBe(false);expect(useEditor.getState().undoStack).toHaveLength(0);
 });
 it('does not create history for clicks and ignores invalid or stale previews',()=>{
  const s=useEditor.getState(),before=s.project;s.beginMove('esp32');s.previewMove('esp32',[NaN,0,0]);s.finishMove(true);expect(useEditor.getState().undoStack).toHaveLength(0);expect(useEditor.getState().project).toBe(before);
  s.beginMove('esp32');s.loadProject(structuredClone(initialProject));s.previewMove('esp32',[100,100,0]);s.finishMove(false);expect(useEditor.getState().project.components[0].position).toEqual(initialProject.components[0].position);
 });
});
