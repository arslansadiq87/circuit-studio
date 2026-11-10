import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import {initialProject,type Component} from '../src/model';
import {placeComponent} from '../src/placement';
import {useEditor} from '../src/store';

function separated(a:Component,b:Component){
 const [aw,ah]=a.dimensions??[28,20], [bw,bh]=b.dimensions??[28,20];
 return Math.abs(a.position[0]-b.position[0])>=(aw+bw)/2+7||Math.abs(a.position[1]-b.position[1])>=(ah+bh)/2+7;
}

describe('automatic component placement',()=>{
 it('finds space around the existing circuit without moving its components',()=>{
  const existing=structuredClone(initialProject.components);
  const incoming:Component={...existing[0],id:'new-board',position:[0,55,0]};
  const placed=placeComponent(existing,incoming);
  expect(placed.position[2]).toBe(0);
  expect(existing).toEqual(initialProject.components);
  expect(existing.every(c=>separated(c,placed))).toBe(true);
 });
 it('keeps repeated additions apart across the library paths',()=>{
  useEditor.getState().loadProject({...initialProject,components:[],wires:[]});
  for(const model of ['ic-sop','ic-sop','generic-pcb','resistor','esp32-c3-zero'])useEditor.getState().addComponent(model);
  const parts=useEditor.getState().project.components;
  expect(parts).toHaveLength(5);
  for(let i=0;i<parts.length;i++)for(let j=0;j<i;j++)expect(separated(parts[i],parts[j])).toBe(true);
  expect(parts.every(c=>c.position[2]===0)).toBe(true);
 });
});
