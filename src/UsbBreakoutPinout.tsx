import type {Component} from './model';
import {useEditor} from './store';
export function UsbBreakoutPinout({component}:{component:Component}){
 const setMode=useEditor(s=>s.setMode),clickPin=useEditor(s=>s.clickPin);
 return <div className="inspector-section"><div className="section-title">USB BREAKOUT <span className="verified-pill">CAD CONTACTS</span></div>
 <p className="resistor-note">Imported STEP model. Four screw-terminal entry centers measured from the housing apertures. Signal order follows the model's VBUS / D− / D+ / GND markings.</p>
 {component.pins.map(p=><div className="property-row" key={p.id}><button className="secondary-action" aria-label={`Connect USB ${p.label}`} onClick={()=>{setMode('wire');clickPin(component.id,p.id)}}>{p.label}</button><strong>{p.id} · {p.localPosition?.[0]} mm X</strong></div>)}
 <p className="resistor-note">Wire entries face −Y; USB opening faces +Y. The metal shield is not assigned a signal pin. Dimensions follow the supplied CAD; physical hardware has not been measured.</p>
 </div>
}
