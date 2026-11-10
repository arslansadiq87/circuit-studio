import type {Component,Pin} from './model';

const contactZ:Record<string,number>={
 'esp32-30pin':0.85,
 'esp32-c6-supermini':0.65,
 'esp32-wroom':3.6,
 'yd-esp32-s3-v34':0.6,
 'esp32-s3-devkitc-1-v1.1':0.9,
};
const headerTipZ:Record<string,number>={
 'esp32-30pin':-9.368,
 'esp32-c6-supermini':-9.175,
 'esp32-wroom':-6.5,
 'yd-esp32-s3-v34':3.05,
 'esp32-s3-devkitc-1-v1.1':2.35,
};

export function pcbContactPins(component:Component):Component{
 const z=contactZ[component.modelId];
 if(z===undefined)return component;
 let changed=false;
 const pins=component.pins.map((pin):Pin=>{
  const old=pin.localPosition;
  if(!old)return pin;
  // Keep custom-calibrated pins and the C6's independent solder pads intact.
  if(Math.abs(old[2]-headerTipZ[component.modelId])>.05)return pin;
  if(Math.abs(old[2]-z)<.001&&pin.exitDirection?.[2]===1)return pin;
  changed=true;
  return {...pin,localPosition:[old[0],old[1],z],exitDirection:[0,0,1]};
 });
 return changed?{...component,pins,geometry:component.geometry?{...component.geometry,pinPositionsVerified:false}:undefined}:component;
}
