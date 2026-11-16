import {YD_ESP32_S3_V34_COMPONENT,ESP32_WROOM_COMPONENT,RESISTOR_COMPONENT,LDR_COMPONENT,STEPPER_24BYJ_48_COMPONENT,DVR8825_COMPONENT,SONOFF_CAM_S3W_COMPONENT,LED_COMPONENT,ESP32_C6_COMPONENT,ESP32_C3_COMPONENT,ESP32_30PIN_COMPONENT,type Component} from './model';
// Built-in parts shipped with the app, keyed by modelId.
export const BUILT_IN_COMPONENTS:readonly Component[]=[YD_ESP32_S3_V34_COMPONENT,ESP32_WROOM_COMPONENT,RESISTOR_COMPONENT,LDR_COMPONENT,STEPPER_24BYJ_48_COMPONENT,DVR8825_COMPONENT,SONOFF_CAM_S3W_COMPONENT,LED_COMPONENT,ESP32_C6_COMPONENT,ESP32_C3_COMPONENT,ESP32_30PIN_COMPONENT];
const byModelId=new Map(BUILT_IN_COMPONENTS.map(c=>[c.modelId,c]));
export function builtInComponent(modelId:string){return byModelId.get(modelId)}
// Saved projects may keep only {kind:'model'} for a built-in part; restore its model references, centre and orientation.
export function withBuiltInModel(component:Component):Component{const g=component.geometry;if(g?.kind!=='model'||g.modelUrl||g.lodUrls||g.modelAssetId)return component;const source=builtInComponent(component.modelId)?.geometry;return source?.kind==='model'?{...component,geometry:{...source,...g}}:component}
