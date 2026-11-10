import type {Wire} from './model';

const wirePalette=['#f06b65','#efa45a','#e8c95a','#a6d86a','#56c78e','#57c6c5','#6ca8f1','#8e8cec','#bc87e8','#ec82b5','#4bb6a2','#d7aa64','#e58777','#7cbfe3'];
type Endpoint=Wire['from'];
const samePoint=(a:Endpoint,b:Endpoint)=>a.componentId===b.componentId&&a.pinId===b.pinId;

export function colorForNewWire(wires:Wire[],from:Endpoint,to:Endpoint,random=Math.random):string{
 const branch=wires.find(wire=>samePoint(wire.from,from)||samePoint(wire.to,from))
  ??wires.find(wire=>samePoint(wire.from,to)||samePoint(wire.to,to));
 if(branch)return branch.color;
 const used=new Set(wires.map(wire=>wire.color.toLowerCase()));
 const available=wirePalette.filter(color=>!used.has(color));
 const choices=available.length?available:wirePalette;
 return choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
}
