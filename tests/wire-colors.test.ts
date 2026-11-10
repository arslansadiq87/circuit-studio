import {describe,expect,it,vi} from 'vitest';
import 'fake-indexeddb/auto';
import {colorForNewWire} from '../src/wireColors';
import {initialProject,type Wire} from '../src/model';
import {useEditor} from '../src/store';

const point=(componentId:string,pinId:string)=>({componentId,pinId});
const existing:Wire={id:'first',from:point('a','P1'),to:point('b','P1'),color:'#6ca8f1',diameter:1,label:'first',curvature:19};

describe('new wire colors',()=>{
 it('chooses a fresh palette color for an independent connection',()=>{
  const color=colorForNewWire([existing],point('c','P1'),point('d','P1'),()=>0);
  expect(color).toMatch(/^#[0-9a-f]{6}$/);
  expect(color).not.toBe(existing.color);
 });
 it('reuses an edited color from either end of an existing junction',()=>{
  const edited={...existing,color:'#123456'};
  expect(colorForNewWire([edited],point('a','P1'),point('c','P1'),()=>.9)).toBe('#123456');
  expect(colorForNewWire([edited],point('c','P1'),point('b','P1'),()=>.1)).toBe('#123456');
  expect(colorForNewWire([edited],point('a','P2'),point('c','P1'),()=>0)).not.toBe('#123456');
 });
 it('uses the selected junction color when adding a branch in the editor',()=>{
  const random=vi.spyOn(Math,'random').mockReturnValue(0);
  try{
   useEditor.getState().loadProject({...initialProject,components:[],wires:[]});
   useEditor.getState().addWire(point('a','P1'),point('b','P1'));
   const first=useEditor.getState().project.wires[0].color;
   useEditor.getState().addWire(point('a','P1'),point('c','P1'));
   useEditor.getState().addWire(point('d','P1'),point('e','P1'));
   expect(useEditor.getState().project.wires[1].color).toBe(first);
   expect(useEditor.getState().project.wires[2].color).not.toBe(first);
  }finally{random.mockRestore()}
 });
});
