import {describe,it,expect} from 'vitest';
import 'fake-indexeddb/auto';
import {ComponentSchema,DVR8825_COMPONENT,STEPPER_24BYJ_48_COMPONENT,SONOFF_CAM_S3W_COMPONENT,LDR_COMPONENT,initialProject,normalizeProjectNames} from '../src/model';
import {useEditor} from '../src/store';
import {makeWireCurve,worldPin,worldPinDirection,worldPinWireEntry} from '../src/geometry';
import * as THREE from 'three';

describe('new STEP components',()=>{
 it('calibrates five stepper contacts to the measured 1.4 mm connector pitch',()=>{
  expect(ComponentSchema.parse(STEPPER_24BYJ_48_COMPONENT)).toEqual(STEPPER_24BYJ_48_COMPONENT);
  expect(STEPPER_24BYJ_48_COMPONENT.pins.map(p=>p.cadPosition)).toEqual([[-2.8,16.128231,20.52],[-1.4,16.128231,20.52],[0,16.128231,20.52],[1.4,16.128231,20.52],[2.8,16.128231,20.52]]);
  expect(STEPPER_24BYJ_48_COMPONENT.geometry?.pinPositionsVerified).toBe(true);
  expect(STEPPER_24BYJ_48_COMPONENT.geometry?.electricalMappingVerified).toBe(false);
  expect(STEPPER_24BYJ_48_COMPONENT.pins.every(pin=>pin.exitDirection?.[1]===-1)).toBe(true);
 });
 it('routes existing stepper wires outward without an automatic tower',()=>{
  const pin=STEPPER_24BYJ_48_COMPONENT.pins[0],motor={...STEPPER_24BYJ_48_COMPONENT,position:[0,0,0] as [number,number,number]};
  const old={...motor,pins:motor.pins.map(p=>({...p,exitDirection:[0,1,0] as [number,number,number]}))};
  const upgraded=normalizeProjectNames({...initialProject,components:[old],wires:[]}).components[0];
  expect(upgraded.pins.every(p=>p.exitDirection?.[1]===-1)).toBe(true);
  expect(worldPinDirection(old.pins[0],old).y).toBe(-1);
  for(const routeMode of ['auto','straight','manual','orthogonal'] as const){
   const wire={id:'stepper-wire',from:{componentId:motor.id,pinId:pin.id},to:{componentId:'target',pinId:'P1'},color:'#ffffff',diameter:1,label:'test',routeMode,autoLane:10,bendPoints:[[0,-35,22]] as [number,number,number][]};
   const contact=worldPin(pin,motor),entry=worldPinWireEntry(pin,motor)!;
   const curve=makeWireCurve(wire,contact,new THREE.Vector3(0,30,2),worldPinDirection(pin,motor),new THREE.Vector3(0,0,1),entry);
   const points=curve.getPoints(50);
   expect(points.some(p=>p.y<contact.y-6)).toBe(true);
   if(routeMode==='auto'){expect(entry.clearanceDirection.y).toBe(-1);expect(Math.max(...points.map(p=>p.z))).toBeLessThan(contact.z+3)}
  }
 });
 it('calibrates the driver two eight-contact rows to 2.54 mm pitch',()=>{
  expect(ComponentSchema.parse(DVR8825_COMPONENT)).toEqual(DVR8825_COMPONENT);
  expect(DVR8825_COMPONENT.pins).toHaveLength(16);
  for(const row of [0,8])for(let i=1;i<8;i++)expect(DVR8825_COMPONENT.pins[row+i].cadPosition![0]-DVR8825_COMPONENT.pins[row+i-1].cadPosition![0]).toBeCloseTo(2.54,5);
  expect(DVR8825_COMPONENT.pins[0].cadPosition?.[1]).toBe(1.27);
  expect(DVR8825_COMPONENT.pins[8].cadPosition?.[1]).toBe(13.73);
  expect(DVR8825_COMPONENT.geometry?.pinPositionsVerified).toBe(false);expect(DVR8825_COMPONENT.pins.every(p=>p.localPosition?.[2]===9.84&&p.exitDirection?.[2]===1)).toBe(true);
  expect(DVR8825_COMPONENT.geometry?.electricalMappingVerified).toBe(false);
  expect(DVR8825_COMPONENT.dimensions?.[0]).toBeCloseTo(20.32,2);
  expect(DVR8825_COMPONENT.dimensions?.[1]).toBeCloseTo(15,2);
  expect(DVR8825_COMPONENT.geometry?.modelUrl).toContain('no-heatsink-1');
 });
 it('places all three built-in models, with no wire pins on the camera',()=>{
  expect(SONOFF_CAM_S3W_COMPONENT.pins).toEqual([]);
  for(const modelId of ['stepper-24byj-48','dvr8825','sonoff-cam-s3w'])useEditor.getState().addComponent(modelId);
  expect(useEditor.getState().project.components.slice(-3).map(c=>c.modelId)).toEqual(['stepper-24byj-48','dvr8825','sonoff-cam-s3w']);
  expect(useEditor.getState().project.components.at(-1)?.pins).toEqual([]);
 });
 it('moves saved driver wires from header tips to the PCB without changing pin IDs',()=>{
  const old={...DVR8825_COMPONENT,id:'old-driver',pins:DVR8825_COMPONENT.pins.map(p=>({...p,localPosition:[p.localPosition![0],p.localPosition![1],.000039] as [number,number,number],exitDirection:[0,0,-1] as [number,number,number]}))};
  const wire={...initialProject.wires[0],id:'driver-wire',from:{componentId:'old-driver',pinId:'J1-1'}};
  const project=normalizeProjectNames({...initialProject,components:[old,...initialProject.components],wires:[wire]});
  expect(project.components[0].pins[0].localPosition?.[2]).toBe(9.84);
  expect(project.components[0].pins[0].exitDirection).toEqual([0,0,1]);
  expect(project.wires[0].from).toEqual({componentId:'old-driver',pinId:'J1-1'});
 });
 it('refreshes previously placed gray models to color-versioned assets',()=>{
  for(const part of [LDR_COMPONENT,STEPPER_24BYJ_48_COMPONENT,DVR8825_COMPONENT,SONOFF_CAM_S3W_COMPONENT]){
   expect(part.geometry?.materialCount).toBeGreaterThan(0);
   const old={...part,id:`old-${part.id}`,position:[3,4,5] as [number,number,number],geometry:{...part.geometry!,modelUrl:`/models/${part.modelId}.glb`}};
   const updated=normalizeProjectNames({...initialProject,components:[old]}).components[0];
   expect(updated.geometry?.modelUrl).toBe(part.geometry?.modelUrl);
   expect(updated.position).toEqual([3,4,5]);
   expect(updated.pins).toEqual(part.pins);
  }
  const previousDriver={...DVR8825_COMPONENT,geometry:{...DVR8825_COMPONENT.geometry!,modelUrl:'/models/dvr8825.glb?v=colors-1'}};
  expect(normalizeProjectNames({...initialProject,components:[previousDriver]}).components[0].geometry?.modelUrl).toBe(DVR8825_COMPONENT.geometry?.modelUrl);
 });
});
