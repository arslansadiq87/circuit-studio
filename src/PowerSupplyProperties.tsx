import {useEffect,useState} from 'react';
import type {Component} from './model';
import {supplyVoltage,supplyVoltagePatch} from './powerSupply';
import {useEditor} from './store';
export function PowerSupplyProperties({component}:{component:Component}){
 const voltage=supplyVoltage(component),update=useEditor(s=>s.updateComponent);
 const [draft,setDraft]=useState(String(voltage));
 useEffect(()=>setDraft(String(voltage)),[component.id,voltage]);
 const value=Number(draft),valid=draft.trim()!==''&&Number.isFinite(value)&&value>=0;
 const apply=()=>{if(valid&&value!==voltage)update(component.id,supplyVoltagePatch(component,value))};
 return <div className="inspector-section"><div className="section-title">POWER SUPPLY</div><form onSubmit={e=>{e.preventDefault();apply()}}><label className="field-row"><span>Output voltage</span><input aria-label="Output voltage" className="text-input" inputMode="decimal" value={draft} onChange={e=>setDraft(e.target.value)} onBlur={apply}/><small>V</small></label>{!valid&&<p className="resistor-note" role="alert">Enter a finite voltage of zero or greater.</p>}<button type="submit" className="secondary-action" disabled={!valid||value===voltage}>Set voltage</button></form><p className="resistor-note">{voltage} V DC output. Enter a value, then press Enter or leave the field to update the model and output terminal.</p></div>
}
