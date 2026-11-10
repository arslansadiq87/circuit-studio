import {create} from 'zustand';
export type Detail='auto'|'low'|'medium'|'high';
export type Graphics={preset:'Low'|'Balanced'|'High'|'Ultra';pixelRatio:number;shadows:'off'|'low'|'high';antialias:boolean;geometry:Detail;wireDetail:'low'|'medium'|'high';grid:boolean;maxTextureSize:number;uiScale:number;exportDetail:'medium'|'high'};
const presets:Record<Graphics['preset'],Omit<Graphics,'preset'|'uiScale'|'exportDetail'>>={
 Low:{pixelRatio:1,shadows:'off',antialias:false,geometry:'low',wireDetail:'low',grid:true,maxTextureSize:512},
 Balanced:{pixelRatio:1,shadows:'off',antialias:true,geometry:'auto',wireDetail:'medium',grid:true,maxTextureSize:1024},
 High:{pixelRatio:1.5,shadows:'low',antialias:true,geometry:'auto',wireDetail:'high',grid:true,maxTextureSize:2048},
 Ultra:{pixelRatio:2,shadows:'high',antialias:true,geometry:'high',wireDetail:'high',grid:true,maxTextureSize:4096},
};
const defaults:Graphics={preset:'Balanced',...presets.Balanced,uiScale:1,exportDetail:'high'};
let saved:Partial<Graphics>={};try{saved=JSON.parse(localStorage.getItem('c3d-graphics')??'{}')}catch{/* storage unavailable */}
export const useGraphics=create<{settings:Graphics;monitor:boolean;exporting:boolean;moving:boolean;constrained:boolean;set:(patch:Partial<Graphics>)=>void;setPreset:(preset:Graphics['preset'])=>void;toggleMonitor:()=>void;setExporting:(v:boolean)=>void;setMoving:(v:boolean)=>void;setConstrained:(v:boolean)=>void}>((set,get)=>({settings:{...defaults,...saved},monitor:false,exporting:false,moving:false,constrained:false,set:patch=>{const settings={...get().settings,...patch};set({settings});try{localStorage.setItem('c3d-graphics',JSON.stringify(settings))}catch{/* quota */}},setPreset:preset=>get().set({preset,...presets[preset]}),toggleMonitor:()=>set(s=>({monitor:!s.monitor})),setExporting:exporting=>set({exporting}),setMoving:moving=>set({moving}),setConstrained:constrained=>set({constrained})}));
// Sampled by the monitor/harness; no React updates per animation frame.
export const diagnostics={frames:0,frameIntervals:[] as number[],wireBuilds:0,workspaceRenders:0,partRenders:0,parses:0,cacheHits:0,modelTimings:[] as {key:string;fetchMs:number;parseMs:number}[],snapshot:{fps:0,averageMs:0,p95Ms:0,calls:0,triangles:0,meshes:0,models:0,textures:0,width:0,height:0,heap:undefined as number|undefined,geometryBytes:0}};
declare global{interface Window{__circuitDiagnostics?:typeof diagnostics}}
if(typeof window!=='undefined')window.__circuitDiagnostics=diagnostics;
