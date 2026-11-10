import {create} from 'zustand';
import {orderedWires,type Project} from './model';
export type WireAnimationSession={mode:'all'|'sequential'|'selected'|'signals';ids:string[];startedAt:number;durationMs:number};
export function animatedWireIds(project:Project){const parts=new Map(project.components.map(c=>[c.id,c]));return orderedWires(project).filter(w=>w.visible!==false&&parts.get(w.from.componentId)?.pins.some(p=>p.id===w.from.pinId)&&parts.get(w.to.componentId)?.pins.some(p=>p.id===w.to.pinId)).map(w=>w.id)}
export function wireAnimationProgress(session:WireAnimationSession,id:string,now:number){const index=session.ids.indexOf(id);if(index<0)return 1;const elapsed=(now-session.startedAt)/session.durationMs-(session.mode==='sequential'?index:0);return Math.max(0,Math.min(1,elapsed))}
export function signalAnimationProgress(session:WireAnimationSession,id:string,now:number){if(session.mode!=='signals'||!session.ids.includes(id))return null;const phase=((now-session.startedAt)%session.durationMs)/session.durationMs;return phase}
/** Shared arc-length tube reveal used by interactive playback and offline frames. */
export function wireDrawCount(progress:number,segments:number,total:number){return progress>=1?total:Math.floor(Math.max(0,progress)*segments)*(total/segments)}
export function wireAnimationDuration(session:WireAnimationSession){return session.durationMs*(session.mode==='sequential'?session.ids.length:1)}
export const useWireAnimation=create<{session:WireAnimationSession|null;start:(mode:WireAnimationSession['mode'],ids:string[])=>void;stop:()=>void}>((set)=>({session:null,start:(mode,ids)=>set({session:ids.length?{mode,ids:[...ids],startedAt:performance.now(),durationMs:mode==='signals'?1800:1600}:null}),stop:()=>set({session:null})}));
export const useNetSelection=create<{ids:string[];toggle:(id:string)=>void;set:(ids:string[])=>void}>(set=>({ids:[],toggle:id=>set(s=>({ids:s.ids.includes(id)?s.ids.filter(v=>v!==id):[...s.ids,id]})),set:ids=>set({ids})}));
