import type {Component,Pin} from './model';

export const DRIVER_PAD_Z=9.84;
export function driverPcbContacts(component:Component):Component{
 if(component.modelId!=='dvr8825')return component;
 let changed=false;
 const pins=component.pins.map((pin):Pin=>{
  const position=pin.localPosition;
  if(!position||Math.abs(position[2])>.05)return pin;
  changed=true;
  return {...pin,localPosition:[position[0],position[1],DRIVER_PAD_Z],exitDirection:[0,0,1],notes:'PCB solder contact at the former header position. Signal name is not established by this CAD file.'};
 });
 return changed?{...component,pins,geometry:component.geometry?{...component.geometry,pinPositionsVerified:false}:undefined}:component;
}
