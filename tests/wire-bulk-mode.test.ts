import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {initialProject,ProjectSchema} from '../src/model';
import {useEditor} from '../src/store';

describe('bulk wire route mode',()=>{
 it('applies one route mode to every wire and restores the previous modes with one undo',()=>{
  useEditor.getState().loadProject({...initialProject,wires:initialProject.wires.map((wire,index)=>({...wire,routeMode:index%2?'orthogonal' as const:'auto' as const}))});
  const before=useEditor.getState().project.wires.map(wire=>wire.routeMode);
  const undoCount=useEditor.getState().undoStack.length;
  useEditor.getState().updateAllWireRoutes('clean');
  expect(useEditor.getState().project.wires.every(wire=>wire.routeMode==='clean')).toBe(true);
  expect(useEditor.getState().undoStack).toHaveLength(undoCount+1);
  expect(ProjectSchema.parse(useEditor.getState().project).wires.every(wire=>wire.routeMode==='clean')).toBe(true);
  useEditor.getState().undo();
  expect(useEditor.getState().project.wires.map(wire=>wire.routeMode)).toEqual(before);
 });
 it('does not create an undo step when the selected mode already applies to all wires',()=>{
  useEditor.getState().loadProject({...initialProject,wires:initialProject.wires.map(wire=>({...wire,routeMode:'straight' as const}))});
  const before=useEditor.getState().project;
  useEditor.getState().updateAllWireRoutes('straight');
  expect(useEditor.getState().project).toBe(before);
  expect(useEditor.getState().undoStack).toHaveLength(0);
 });
});
