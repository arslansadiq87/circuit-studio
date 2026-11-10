import 'fake-indexeddb/auto';
import {describe,it,expect,vi} from 'vitest';
import {initialProject} from '../src/model';
import {restoreLocalProject,saveLocalProject} from '../src/projectPersistence';

describe('local project persistence',()=>{
 it('restores edited components, pin names, wires, and camera',async()=>{
  const values=new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}});
  const project=structuredClone(initialProject);
  project.name='Saved circuit';
  project.components[0].position=[24,12,0];
  project.components[0].pins[0].label='RESET';
  project.wires[0].color='#123456';
  project.camera={position:[12,30,90],target:[4,5,0]};
  await saveLocalProject(project);
  const restored=await restoreLocalProject();
  expect(restored).toEqual(project);
  vi.unstubAllGlobals();
 });
});
