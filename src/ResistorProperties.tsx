import {useEffect,useState} from 'react';
import type {Component} from './model';
import {useEditor} from './store';
export const resistanceUnits=[{label:'Ω',scale:1},{label:'kΩ',scale:1e3},{label:'MΩ',scale:1e6},{label:'GΩ',scale:1e9}];
export function parseResistance(value:string,scale:number):number|undefined{
 if(!value.trim())return undefined;
 const amount=Number(value),ohms=amount*scale;
 return Number.isFinite(amount)&&amount>=0&&Number.isFinite(ohms)&&(amount===0||ohms>0)?ohms:undefined;
}
export function ResistorProperties({component}:{component:Component}){
 const update=useEditor(s=>s.updateComponent),setMode=useEditor(s=>s.setMode),clickPin=useEditor(s=>s.clickPin);
 const [value,setValue]=useState(''),[scale,setScale]=useState(1);
 useEffect(()=>{setValue(component.resistanceOhms===undefined?'':String(component.resistanceOhms/scale))},[component.id,component.resistanceOhms]);
 const ohms=parseResistance(value,scale),valid=ohms!==undefined;
 const verified=component.geometry?.pinPositionsVerified&&component.geometry?.electricalMappingVerified;
 return <div className="inspector-section"><div className="section-title">RESISTOR</div>
  <form onSubmit={e=>{e.preventDefault();if(valid)update(component.id,{resistanceOhms:ohms})}}>
   <label className="field-row"><span>Resistance</span><input aria-label="Resistance value" className="text-input" inputMode="decimal" placeholder="Not set" value={value} onChange={e=>setValue(e.target.value)}/><select aria-label="Resistance unit" className="text-input" style={{width:55}} value={scale} onChange={e=>{const next=Number(e.target.value);if(valid)setValue(String(ohms/next));setScale(next)}}>{resistanceUnits.map(unit=><option key={unit.scale} value={unit.scale}>{unit.label}</option>)}</select></label>
   {value.trim()&&!valid&&<p className="resistor-note" role="alert">Enter a finite resistance of zero or greater.</p>}
   <div className="resistor-actions"><button className="secondary-action" type="submit" disabled={!valid||ohms===component.resistanceOhms}>Set resistance</button><button className="secondary-action" type="button" disabled={component.resistanceOhms===undefined&&!value} onClick={()=>{setValue('');if(component.resistanceOhms!==undefined)update(component.id,{resistanceOhms:undefined})}}>Clear</button></div>
  </form>
  <p className="resistor-note">{component.resistanceOhms===undefined?'Resistance not set.':`${component.resistanceOhms} Ω saved.`} Decimal and scientific notation are supported. The imported CAD bands keep their original colors.</p>
  <div className="section-title">PINOUT <span className={verified?'verified-pill':'unverified-pill'}>{verified?'VERIFIED CONTACTS':'UNVERIFIED'}</span></div>
  <p className="resistor-note">Two passive, nonpolar terminals. Either direction can be used.</p>
  {component.pins.map(p=><div className="property-row" key={p.id}><button className="secondary-action" onClick={()=>{setMode('wire');clickPin(component.id,p.id)}} aria-label={`Connect resistor terminal ${p.label}`}>Terminal {p.label}</button><strong>{p.side} · {p.id}</strong></div>)}
  <p className="resistor-note">Contacts are at the metal lead end faces, 9.4 mm apart in the supplied STEP model.</p>
 </div>
}
