import type {Component, Pin} from './model';

export const IC_MODEL_ID='ic-sop';
export function icPins(count:number, previous:Pin[]=[]):Pin[]{
 const total=Math.max(4,Math.min(30,Math.round(count/2)*2));
 const perSide=total/2;
 const length=Math.max(6,(perSide-1)*1.27+3);
 return Array.from({length:total},(_,i)=>{
  const number=i+1, left=i<perSide, row=left?i:total-i-1;
  const existing=previous.find(p=>p.id===`P${number}`);
  return {...existing,id:`P${number}`,label:existing?.label??String(number),side:left?'left' as const:'right' as const,index:row,physicalPosition:number,electrical:existing?.electrical??'passive',localPosition:[left?-4.6:4.6,length/2-1.5-row*1.27,0],exitDirection:[left?-1:1,0,0]};
 });
}
export function makeIcPackage(count=8):Component{
 const pins=icPins(count),length=Math.max(6,(pins.length/2-1)*1.27+3);
 return {id:`${IC_MODEL_ID}-${Date.now()}`,modelId:IC_MODEL_ID,name:`SOP-${pins.length} IC`,position:[0,0,0],rotation:[0,0,0],dimensions:[9.2,length,2],geometry:{kind:'procedural-pcb',quality:'enhanced-procedural',pcbColor:'#202329',category:'IC package'},pins};
}
export function resizeIcPackage(component:Component,count:number):Component{
 const pins=icPins(count,component.pins),length=Math.max(6,(pins.length/2-1)*1.27+3);
 return {...component,pins,dimensions:[9.2,length,2],name:/^SOP-\d+ IC$/.test(component.name)?`SOP-${pins.length} IC`:component.name};
}
