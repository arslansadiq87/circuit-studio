import type {Component} from './model';
export function supplyVoltage(component:Component){return component.outputVoltage??component.pins.find(p=>p.id==='OUT+')?.voltage??5}
export function supplyVoltagePatch(component:Component,voltage:number):Partial<Component>{
 if(!Number.isFinite(voltage)||voltage<0)throw new Error('Voltage must be finite and nonnegative');
 return {outputVoltage:voltage,pins:component.pins.map(p=>p.id==='OUT+'?{...p,label:`${voltage}V OUT`,voltage}:p.id==='GND'?{...p,voltage:0}:p)};
}
