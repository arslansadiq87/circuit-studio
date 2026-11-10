import {Activity,ArrowRight,X} from 'lucide-react';
import {useEffect,useMemo,useRef} from 'react';
import {useEditor} from './store';
import {animatedWireIds,useWireAnimation,useNetSelection,type WireAnimationSession} from './wireAnimation';
export function NetAnimationCheckbox({id,label,disabled=false}:{id:string;label:string;disabled?:boolean}){
 const checked=useNetSelection(s=>s.ids.includes(id)),toggle=useNetSelection(s=>s.toggle);
 return <input className="net-select" type="checkbox" aria-label={`Select net ${label} for animation`} checked={checked} disabled={disabled} onClick={e=>e.stopPropagation()} onChange={()=>toggle(id)}/>;
}
export function SelectAllAnimationNets(){
 const project=useEditor(s=>s.project),selected=useNetSelection(s=>s.ids),set=useNetSelection(s=>s.set),ref=useRef<HTMLInputElement>(null);
 const ids=useMemo(()=>animatedWireIds(project),[project]),count=ids.filter(id=>selected.includes(id)).length;
 useEffect(()=>{if(ref.current)ref.current.indeterminate=count>0&&count<ids.length},[count,ids.length]);
 return <input ref={ref} className="net-select" type="checkbox" aria-label="Select all visible nets for animation" disabled={!ids.length} checked={ids.length>0&&count===ids.length} onChange={()=>set(count===ids.length?[]:ids)}/>;
}
export function WireAnimationControls(){
 const project=useEditor(s=>s.project),setAllRoutes=useEditor(s=>s.updateAllWireRoutes),session=useWireAnimation(s=>s.session),start=useWireAnimation(s=>s.start),stop=useWireAnimation(s=>s.stop);
 const ids=useMemo(()=>animatedWireIds(project),[project]),selection=useNetSelection(s=>s.ids),selected=ids.filter(id=>selection.includes(id)),routeModes=new Set(project.wires.map(w=>w.routeMode??'auto')),routeMode=routeModes.size===1?[...routeModes][0]:'';
 useEffect(()=>{const present=new Set(project.wires.map(w=>w.id));const s=useNetSelection.getState();if(s.ids.some(id=>!present.has(id)))s.set(s.ids.filter(id=>present.has(id)))},[project.wires]);
 const play=(mode:WireAnimationSession['mode'])=>{useEditor.getState().setHoveredWire(null);start(mode,mode==='selected'||mode==='signals'?selected:ids)};
 return <div className="wire-animation-controls" aria-label="Connection animation"><button disabled={!ids.length} className={session?.mode==='all'?'playing':''} onClick={()=>play('all')}><Activity size={13}/> Animate all</button><button disabled={!ids.length} className={session?.mode==='sequential'?'playing':''} onClick={()=>play('sequential')}><ArrowRight size={13}/> Animate one by one</button><button aria-label="Animate selected" disabled={!selected.length} className={session?.mode==='selected'?'playing':''} onClick={()=>play('selected')}><Activity size={13}/> Animate selected <span aria-hidden="true">({selected.length})</span></button><label className="bulk-route-control"><span>All wire routes</span><select aria-label="Route mode for all wires" value={routeMode} disabled={!project.wires.length} onChange={e=>setAllRoutes(e.target.value as NonNullable<typeof project.wires[number]['routeMode']>)}><option value="" disabled>{project.wires.length?'Mixed routes':'No wires'}</option><option value="auto">Automatic</option><option value="clean">Automatic Clean</option><option value="manual">Manual curve</option><option value="straight">Straight</option><option value="orthogonal">Orthogonal</option></select></label><button disabled={!selected.length} className={session?.mode==='signals'?'playing':''} onClick={()=>play('signals')}><Activity size={13}/> Animate signals</button>{session&&<button onClick={stop} aria-label="Stop wire animation"><X size={13}/> Stop</button>}<span role="status">{session?.mode==='signals'?'Signals travelling along selected nets':session?'Drawing source → destination':selected.length?`${selected.length} nets selected`:'Select nets using the checkboxes'}</span></div>
}
