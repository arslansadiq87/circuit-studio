import type {Component} from './model';
import {breadboardSizes, resizeBreadboard, type BreadboardSize} from './breadboard';
import {useEditor} from './store';

export function BreadboardPinout({component}: {component: Component}) {
 const update = useEditor(s => s.updateComponent);
 const wires = useEditor(s => s.project.wires);
 const terminal = component.pins.filter(pin => pin.group === 'terminal-strip');
 const rails = component.pins.filter(pin => pin.group === 'split-power-rail');
 const ids = new Set(component.pins.map(pin => pin.id));
 const unresolved = wires.filter(wire => [wire.from, wire.to].some(end => end.componentId === component.id && !ids.has(end.pinId)));
 return <div className="inspector-section">
  <div className="section-title">BREADBOARD PINOUT</div>
  <label className="field-row"><span>Breadboard Size</span>
   <select className="text-input" value={component.breadboardSize ?? 'full'}
    onChange={event => update(component.id, resizeBreadboard(component, event.target.value as BreadboardSize))}>
    {breadboardSizes.map(size => <option key={size} value={size}>{size[0].toUpperCase() + size.slice(1)}</option>)}
   </select>
  </label>
  <div className="property-row"><span>Terminal access points</span><strong>{terminal.length}</strong></div>
  <div className="property-row"><span>Power rail access points</span><strong>{rails.length}</strong></div>
  <div className="property-row"><span>Grid pitch</span><strong>2.54 mm</strong></div>
  <div className="property-row"><span>Five-hole strips</span><strong>{new Set(terminal.map(pin => pin.net)).size}</strong></div>
  <div className="property-row"><span>Power rail segments</span><strong>{new Set(rails.map(pin => pin.net)).size}</strong></div>
  {unresolved.length > 0 && <p className="resistor-note" role="alert">{unresolved.length} unresolved connection(s). Selected holes are unavailable on this size.</p>}
 </div>;
}
