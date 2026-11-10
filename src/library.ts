import { openDB, type IDBPDatabase } from 'idb';
import { z } from 'zod';
import { ComponentSchema, type Component } from './model';
import {putAsset,readAsset,fromBase64,toBase64} from './assets';
export const CustomPinSchema=ComponentSchema.shape.pins.element.extend({orientation:ComponentSchema.shape.pins.element.shape.orientation.default([0,0,0]),electrical:ComponentSchema.shape.pins.element.shape.electrical.default('passive'),voltage:ComponentSchema.shape.pins.element.shape.voltage.optional(),exitDirection:ComponentSchema.shape.pins.element.shape.exitDirection.default([0,0,1]),localPosition:ComponentSchema.shape.pins.element.shape.localPosition.default([0,0,0])});
export const LibraryPartSchema=z.object({id:z.string(),name:z.string().min(1),category:z.string(),dimensions:z.tuple([z.number().positive(),z.number().positive(),z.number().positive()]),format:z.enum(['glb','gltf','obj','stl','procedural-pcb']),asset: z.string().optional(),assetHash:z.string().optional(),geometry:ComponentSchema.shape.geometry, pins:z.array(CustomPinSchema)});
export type LibraryPart=z.infer<typeof LibraryPartSchema>;
export type StoredLibraryPart=LibraryPart & {modelId:string};
let dbPromise:Promise<IDBPDatabase>|undefined;
function db(){if(!dbPromise)dbPromise=openDB('circuit-studio-library',1,{upgrade(d){d.createObjectStore('parts',{keyPath:'id'})}});return dbPromise;}
export async function savePart(part:LibraryPart){const valid=LibraryPartSchema.parse(part);const assetHash=valid.asset?await putAsset(fromBase64(valid.asset)):valid.assetHash;const stored={...valid,asset:undefined,assetHash};await (await db()).put('parts',stored);return {...stored,asset:valid.asset};}
export async function listParts():Promise<StoredLibraryPart[]>{return (await (await db()).getAll('parts')).map((p:LibraryPart)=>({...LibraryPartSchema.parse({...p,asset:undefined}),modelId:`custom:${p.id}`}));}
export async function getPart(id:string,includeLegacyBytes=true):Promise<LibraryPart|undefined>{const p=await (await db()).get('parts',id);if(!p)return;const valid=LibraryPartSchema.parse(p);if(!includeLegacyBytes)return valid;if(!valid.asset&&valid.assetHash){const blob=await readAsset(valid.assetHash);if(blob)valid.asset=await toBase64(blob)}return valid;}
export async function getPartBlob(id:string){const part=await getPart(id,false);if(!part)throw new Error('Model asset is unavailable');if(part.assetHash){const blob=await readAsset(part.assetHash);if(blob)return {blob,hash:part.assetHash}}if(part.asset){const blob=fromBase64(part.asset),hash=await putAsset(blob);await savePart({...part,asset:undefined,assetHash:hash});return {blob,hash}}throw new Error('Model asset is unavailable');}
export async function deletePart(id:string){await (await db()).delete('parts',id);}
export function asComponent(part:LibraryPart,id=`${part.id}-${Date.now()}`):Component{return {id,modelId:`custom:${part.id}`,name:part.name,position:[0,0,18],rotation:[0,0,0],pins:part.pins,dimensions:part.dimensions,geometry:part.geometry};}
export function exportPart(part:LibraryPart){const data=LibraryPartSchema.parse(part);return new Blob([JSON.stringify({format:'c3d-component',version:1,part:data},null,2)],{type:'application/vnd.circuit-studio.component+json'});}
export async function importPart(file:File){if(file.size>100*1024*1024)throw new Error('Component packages must be smaller than 100 MB');const parsed=JSON.parse(await file.text());return savePart(LibraryPartSchema.parse(parsed.part));}
