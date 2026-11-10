import {describe,it,expect} from 'vitest';
import {animatedWireIds,wireAnimationProgress,wireAnimationDuration,type WireAnimationSession} from '../src/wireAnimation';
import {initialProject} from '../src/model';
describe('source-to-destination wire playback',()=>{
 const session:WireAnimationSession={mode:'all',ids:['a','b','c'],startedAt:100,durationMs:1000};
 it('reveals all wires together from zero to one',()=>{
  for(const id of session.ids){expect(wireAnimationProgress(session,id,100)).toBe(0);expect(wireAnimationProgress(session,id,600)).toBe(.5);expect(wireAnimationProgress(session,id,1200)).toBe(1)}
  expect(wireAnimationDuration(session)).toBe(1000);
 });
 it('draws selected wires while keeping unselected wires complete',()=>{
  const s={...session,mode:'selected' as const,ids:['b']};
  expect(['a','b','c'].map(id=>wireAnimationProgress(s,id,600))).toEqual([1,.5,1]);
  expect(wireAnimationDuration(s)).toBe(1000);
 });
 it('finishes previous wires and keeps later wires empty in sequential order',()=>{
  const s={...session,mode:'sequential' as const};
  expect(s.ids.map(id=>wireAnimationProgress(s,id,600))).toEqual([.5,0,0]);
  expect(s.ids.map(id=>wireAnimationProgress(s,id,1600))).toEqual([1,.5,0]);
  expect(s.ids.map(id=>wireAnimationProgress(s,id,2600))).toEqual([1,1,.5]);
  expect(wireAnimationDuration(s)).toBe(3000);
 });
 it('animates only visible, valid connections in table order without editing the project',()=>{
  const p=structuredClone(initialProject);p.wires[1].visible=false;p.wires[2].from.pinId='missing';const before=JSON.stringify(p);
  expect(animatedWireIds(p)).toEqual([p.wires[0].id,p.wires[3].id,p.wires[4].id]);expect(JSON.stringify(p)).toBe(before);
 });
});
