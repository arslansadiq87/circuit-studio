import { useEffect, useState, type ReactNode } from 'react';
import type { Component } from './model';
import { useEditor } from './store';
import { CAPACITOR_DEFAULTS, CAPACITOR_PACKAGES, capacitorPins, packageLabel } from './capacitor';

const units=['µF','nF','mF'] as const;
function Field({label,children}:{label:string;children:ReactNode}){return <label className="field-row"><span>{label}</span>{children}</label>}
export function CapacitorProperties({component}:{component:Component}){
 const update=useEditor(s=>s.updateComponent),setMode=useEditor(s=>s.setMode),clickPin=useEditor(s=>s.clickPin);
 const c=component.capacitor??CAPACITOR_DEFAULTS;
 const [value,setValue]=useState(String(c.value)),[diameter,setDiameter]=useState(String(c.diameter)),[height,setHeight]=useState(String(c.height)),[pitch,setPitch]=useState(String(c.pitch)),[leadLength,setLeadLength]=useState(String(c.leadLength)),[voltage,setVoltage]=useState(String(c.voltage));
 useEffect(()=>{setValue(String(c.value));setDiameter(String(c.diameter));setHeight(String(c.height));setPitch(String(c.pitch));setLeadLength(String(c.leadLength));setVoltage(String(c.voltage))},[component.id,c.value,c.diameter,c.height,c.pitch,c.leadLength,c.voltage]);
 const commit=(next:typeof c)=>update(component.id,{capacitor:next,dimensions:[next.diameter,next.diameter,next.height+next.leadLength],pins:capacitorPins(next.pitch,next.leadLength,next.height)});
 const numeric=(text:string,min:number,max:number)=>{const n=Number(text);return Number.isFinite(n)&&n>=min&&n<=max?n:undefined};
 const setNumber=(text:string,set:(v:string)=>void)=>set(text);
 const blurNumber=(key:'value'|'voltage'|'diameter'|'height'|'pitch'|'leadLength',text:string,min:number,max:number)=>{const n=numeric(text,min,max);if(n!==undefined)commit({...c,[key]:n,...(key==='diameter'||key==='height'||key==='pitch'?{customSize:true,packageId:'custom'}:{})})};
 const selectedPackage=CAPACITOR_PACKAGES.find(p=>p.id===c.packageId);
 const sizeValid=['diameter','height','pitch','leadLength'].every(key=>numeric(({diameter,height,pitch,leadLength} as Record<string,string>)[key],.5,100)!==undefined);
 const verified=component.pins.length===2&&component.pins.some(p=>p.id==='POS')&&component.pins.some(p=>p.id==='NEG');
 return <div className="inspector-section">
  <div className="section-title">ELECTROLYTIC CAPACITOR</div>
  <div className="section-title">ELECTRICAL PROPERTIES</div>
  <Field label="Capacitance"><input aria-label="Capacitance value" className="text-input" type="number" min="0.001" step="any" value={value} onChange={e=>setNumber(e.target.value,setValue)} onBlur={e=>blurNumber('value',e.target.value,.001,1000000)}/><select aria-label="Capacitance unit" className="text-input" style={{width:62}} value={c.unit} onChange={e=>commit({...c,unit:e.target.value as typeof c.unit})}>{units.map(u=><option key={u}>{u}</option>)}</select></Field>
  <Field label="Rated voltage"><select aria-label="Rated voltage" className="text-input" value={String([6.3,10,16,25,35,50].includes(c.voltage)?c.voltage:'custom')} onChange={e=>{if(e.target.value!=='custom'){const n=Number(e.target.value);setVoltage(String(n));commit({...c,voltage:n})}}}><option value="6.3">6.3 V</option><option value="10">10 V</option><option value="16">16 V</option><option value="25">25 V</option><option value="35">35 V</option><option value="50">50 V</option><option value="custom">Custom</option></select><input aria-label="Custom voltage value" className="text-input" type="number" min="0.1" step="any" value={voltage} onChange={e=>setNumber(e.target.value,setVoltage)} onBlur={e=>blurNumber('voltage',e.target.value,.1,10000)}/></Field>
  <div className="section-title">PHYSICAL PROPERTIES</div>
  <Field label="Package"><select aria-label="Capacitor package" className="text-input" value={c.customSize?'custom':c.packageId} onChange={e=>{if(e.target.value==='custom'){commit({...c,customSize:true,packageId:'custom'})}else{const p=CAPACITOR_PACKAGES.find(x=>x.id===e.target.value);if(p){setDiameter(String(p.diameter));setHeight(String(p.height));setPitch(String(p.pitch));commit({...c,packageId:p.id,diameter:p.diameter,height:p.height,pitch:p.pitch,customSize:false})}}}}><option value="">Choose package</option>{CAPACITOR_PACKAGES.map(p=><option key={p.id} value={p.id}>{packageLabel(p)} · {p.pitch} mm pitch</option>)}<option value="custom">Custom size</option></select></Field>
  {selectedPackage&&!c.customSize&&<p className="resistor-note">Source preset: {selectedPackage.pitch} mm lead pitch, {selectedPackage.diameter} mm body diameter, {selectedPackage.height} mm body height.</p>}
  {(c.customSize||!selectedPackage)&&<><Field label="Body diameter (mm)"><input aria-label="Body diameter" className="text-input" type="number" min="0.5" max="100" step="any" value={diameter} onChange={e=>setNumber(e.target.value,setDiameter)} onBlur={e=>blurNumber('diameter',e.target.value,.5,100)}/></Field><Field label="Body height (mm)"><input aria-label="Body height" className="text-input" type="number" min="0.5" max="100" step="any" value={height} onChange={e=>setNumber(e.target.value,setHeight)} onBlur={e=>blurNumber('height',e.target.value,.5,100)}/></Field><Field label="Lead pitch (mm)"><input aria-label="Lead pitch" className="text-input" type="number" min="0.5" max="100" step="any" value={pitch} onChange={e=>setNumber(e.target.value,setPitch)} onBlur={e=>blurNumber('pitch',e.target.value,.5,100)}/></Field></>}
  <Field label="Lead length (mm)"><input aria-label="Lead length" className="text-input" type="number" min="0.5" max="100" step="any" value={leadLength} onChange={e=>setNumber(e.target.value,setLeadLength)} onBlur={e=>blurNumber('leadLength',e.target.value,.5,100)}/></Field>
  {!sizeValid&&<p className="resistor-note" role="alert">Dimensions must be finite and between 0.5 and 100 mm.</p>}
  <div className="section-title">APPEARANCE</div>
  <Field label="Finish"><select aria-label="Capacitor finish" className="text-input" value={c.finish} onChange={e=>commit({...c,finish:e.target.value as typeof c.finish})}><option value="black">Black</option><option value="blue">Blue</option></select></Field>
  {([['showValue','Show value'],['showVoltage','Show voltage'],['showPolarity','Show polarity']] as const).map(([key,label])=><label className="field-row" key={key}><span>{label}</span><input aria-label={label} type="checkbox" checked={c[key]} onChange={e=>commit({...c,[key]:e.target.checked})}/></label>)}
  <div className="section-title">PINOUT <span className={verified?'verified-pill':'unverified-pill'}>{verified?'2 POLARIZED PINS':'INVALID'}</span></div>
  {component.pins.map(p=><div className="property-row" key={p.id}><button className="secondary-action" onClick={()=>{setMode('wire');clickPin(component.id,p.id)}}>Connect {p.id==='POS'?'positive (+)':'negative (−)'}</button><strong>{p.id}</strong></div>)}
  <p className="resistor-note">Pin IDs remain fixed when package dimensions change; anchors sit at the physical lead tips.</p>
 </div>
}
