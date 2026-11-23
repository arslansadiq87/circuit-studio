import type {Component,Pin} from './model';
import {rebaseXRotation} from './componentOrientation';
export const DIODE_MODEL_ID='diode';
export const DIODE_MODELS=['1N4001','1N4002','1N4003','1N4004','1N4005','1N4006','1N4007','1N4148','1N5817','1N5818','1N5819','1N5400','1N5408','1N4733A','1N4742A','Custom'] as const;
export type DiodeModel=typeof DIODE_MODELS[number];
export type DiodeConfig={model:DiodeModel;packageId:'DO-35'|'DO-41'|'DO-201AD'|'Custom';mounting:'horizontal'|'vertical';bodyLength:number;bodyDiameter:number;leadLength:number;leadSpacing:number;leadDiameter:number;bendRadius:number;bodyColor:string;markingColor:string;stripeColor:string;showMarking:boolean;custom:boolean};
// Typical illustrative axial package sizes; manufacturer variants differ. The supplied STEP files were not parsed.
export const DIODE_PRESETS:Record<string,{packageId:DiodeConfig['packageId'];bodyLength:number;bodyDiameter:number;leadSpacing:number}>={DO35:{packageId:'DO-35',bodyLength:4.0,bodyDiameter:2.0,leadSpacing:7.62},DO41:{packageId:'DO-41',bodyLength:5.2,bodyDiameter:2.7,leadSpacing:10.16},DO201AD:{packageId:'DO-201AD',bodyLength:9.5,bodyDiameter:5.3,leadSpacing:15.24}};
export const DIODE_DEFAULTS:DiodeConfig={model:'1N4004',packageId:'DO-41',mounting:'horizontal',bodyLength:5.2,bodyDiameter:2.7,leadLength:8,leadSpacing:10.16,leadDiameter:.55,bendRadius:2,bodyColor:'#171719',markingColor:'#f2cb32',stripeColor:'#d8dcdf',showMarking:true,custom:false};
export function diodeEndpoint(c:DiodeConfig,side:-1|1):[number,number,number]{return c.mounting==='horizontal'?[side*(c.bodyLength/2+c.leadLength),0,0]:[side<0?0:c.leadSpacing,0,-c.bodyLength/2-c.leadLength]}
export function diodePins(c:DiodeConfig):Pin[]{return ([-1,1] as const).map((side,index)=>({id:side<0?'ANODE':'CATHODE',label:side<0?'Anode (+)':'Cathode (-)',side:side<0?'left':'right',index,electrical:side<0?'anode':'cathode',localPosition:diodeEndpoint(c,side).map((value,axis)=>axis===0?value:-value) as [number,number,number],exitDirection:[0,0,1],aliases:[side<0?'A':'K']}))}
export function diodeComponent(id=`diode-${Date.now()}`):Component{const c={...DIODE_DEFAULTS};return {id,modelId:DIODE_MODEL_ID,name:'Diode',position:[0,0,0],rotation:[0,0,0],dimensions:[c.leadSpacing,c.bodyDiameter,c.bodyDiameter+c.leadLength],pins:diodePins(c),diode:c,geometry:{kind:'procedural-pcb',quality:'detailed',verified:true,pinMappingVersion:1}}}

export function upgradeDiodeOrientation(component:Component):Component{
 if(component.modelId!==DIODE_MODEL_ID||component.geometry?.pinMappingVersion===1)return component;
 const flip=([x,y,z]:[number,number,number]):[number,number,number]=>[x,-y,-z];
 return {
  ...component,rotation:rebaseXRotation(component.rotation,-180),
  geometry:{kind:'procedural-pcb',...component.geometry,pinMappingVersion:1},
  pins:component.pins.map(pin=>({
   ...pin,localPosition:pin.localPosition&&flip(pin.localPosition),
   exitDirection:pin.exitDirection&&flip(pin.exitDirection)
  }))
 };
}
