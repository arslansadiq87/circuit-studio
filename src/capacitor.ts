import type { Component, Pin } from './model';

export const CAPACITOR_MODEL_ID = 'electrolytic-capacitor';
export type CapacitorFinish = 'black' | 'blue';
export type CapacitorPackage = { id: string; pitch: number; diameter: number; height: number };

// Dimensions are taken from the supplied ElCapVT STEP filename convention (mm).
// Black and un-suffixed STEP variants describe the same package sizes.
const packageSource = [
  [1.5,4,5],[1.5,4,7],[2,5,5],[2,5,7],[2,5,11],
  [2.5,6.3,5],[2.5,6.3,7],[2.5,6.3,11],[2.5,6.3,12],
  [3.5,8,12],[3.5,8,14],[3.5,8,16],
  [5,10,12],[5,10,16],[5,10,17],[5,10,20],[5,10,30],[5,13,20],[5,13,25],
  [7.5,16,25],[7.5,16,30],[7.5,16,35],[7.5,18,25],[7.5,18,30],[7.5,18,35],[7.5,18,40]
] as const;
export const CAPACITOR_PACKAGES: CapacitorPackage[] = packageSource.map(([pitch,diameter,height])=>({id:`${diameter}x${height}`,pitch,diameter,height}));
export const CAPACITOR_DEFAULTS = { value:100, unit:'µF' as const, voltage:25, finish:'black' as CapacitorFinish, packageId:'8x12', diameter:8, height:12, pitch:3.5, leadLength:4, customSize:false, showValue:true, showVoltage:true, showPolarity:true };
let capacitorSequence=0;

export function capacitorPins(pitch:number, leadLength:number, bodyHeight:number):Pin[] {
  const x=pitch/2, z=-(bodyHeight+leadLength)/2;
  return [
    {id:'POS',label:'+',side:'left',index:0,electrical:'passive',localPosition:[-x,0,z],exitDirection:[0,0,-1],aliases:['positive','+']},
    {id:'NEG',label:'−',side:'right',index:0,electrical:'passive',localPosition:[x,0,z],exitDirection:[0,0,-1],aliases:['negative','-']}
  ];
}
export function capacitorComponent(id=`${CAPACITOR_MODEL_ID}-${Date.now()}-${++capacitorSequence}`):Component {
  const c={...CAPACITOR_DEFAULTS};
  return {id,modelId:CAPACITOR_MODEL_ID,name:'Electrolytic Capacitor',position:[0,0,0],rotation:[0,0,0],dimensions:[c.diameter,c.diameter,c.height+c.leadLength],pins:capacitorPins(c.pitch,c.leadLength,c.height),capacitor:c,geometry:{kind:'procedural-pcb',quality:'enhanced-procedural',verified:true}};
}
export function packageLabel(p:CapacitorPackage){return `${p.diameter} × ${p.height} mm`}
