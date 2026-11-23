import type {Component,Pin} from './model';

import {rebaseXRotation} from './componentOrientation';

export const TO92_MODEL_ID='to-92';
export const TO220_MODEL_ID='to-220';

export function isTransistorPackage(id:string):id is typeof TO92_MODEL_ID|typeof TO220_MODEL_ID{
 return id===TO92_MODEL_ID||id===TO220_MODEL_ID;
}

export function makeTransistorPackage(modelId:typeof TO92_MODEL_ID|typeof TO220_MODEL_ID):Component{
 const to92=modelId===TO92_MODEL_ID;
 // The TO-92 GLB uses authoring units. Scale its measured 0.6-unit pitch to 1.27 mm.
 const scale=to92?1.27/.6:1;
 const dimensions:[number,number,number]=to92?[2*scale,1.45*scale,8*scale]:[10,5,25.5];
 const pitch=to92?1.27:2.5;
 const pins:Pin[]=['E','B','C'].map((label,i)=>({
  id:`P${i+1}`,label,side:'bottom',index:i,physicalPosition:i+1,electrical:'passive',
  localPosition:[(i-1)*pitch,to92?-1.0625*scale:-2.75,-dimensions[2]/2],
  exitDirection:[0,0,-1]
 }));
 return {
  id:`${modelId}-${Date.now()}`,modelId,name:to92?'TO-92 Transistor':'TO-220 Transistor',
  position:[0,0,0],rotation:[0,0,0],dimensions,pins,
  geometry:{
   kind:'model',quality:'detailed',modelFormat:'glb',modelUrl:`/models/${modelId}.glb`,
   sourceFilename:to92?'TO-92.glb':'TO-220.step',modelScale:scale,
   modelCenter:to92?[0,-2,1]:[5,15.5,7.25],
   modelOrientation:[Math.PI/2,to92?Math.PI:0,0],
   pinMappingVersion:1,calibrated:true,pinPositionsVerified:true,category:'Transistor package'
  }
 };
}

export function upgradeTransistorPackage(component:Component):Component{
 if(!isTransistorPackage(component.modelId)||component.geometry?.pinMappingVersion===1)return component;
 const {geometry,dimensions,pins}=makeTransistorPackage(component.modelId);
 return {...component,rotation:rebaseXRotation(component.rotation,90),geometry,dimensions,pins:pins.map(pin=>({
  ...pin,label:component.pins.find(previous=>previous.id===pin.id)?.label??pin.label
 }))};
}
