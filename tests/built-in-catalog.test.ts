import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import fixture from './fixtures/crowded-c6-project.json';
import {BUILT_IN_COMPONENTS,builtInComponent,withBuiltInModel} from '../src/catalog';
import {modelUrl} from '../src/modelCache';
import {ProjectSchema,migrateProject,type Component} from '../src/model';

const saved=(modelId:string):Component=>({id:`${modelId}-1`,modelId,name:modelId,position:[0,0,0],rotation:[0,0,0],pins:[],geometry:{kind:'model'}});

describe('built-in part catalog',()=>{
 it('indexes every built-in part by a unique modelId',()=>{const ids=BUILT_IN_COMPONENTS.map(c=>c.modelId);expect(new Set(ids).size).toBe(ids.length);for(const id of ids)expect(builtInComponent(id)?.modelId).toBe(id)});
 it('gives every built-in model part a model reference',()=>{for(const c of BUILT_IN_COMPONENTS.filter(c=>c.geometry?.kind==='model'))expect(modelUrl(c,'medium')??c.geometry?.modelAssetId,c.modelId).toBeTruthy()});
 it('restores model references, centre and orientation for a saved built-in part',()=>{const restored=withBuiltInModel(saved('esp32-c6-supermini')),source=builtInComponent('esp32-c6-supermini')!.geometry!;expect(restored.geometry).toMatchObject({kind:'model',modelUrl:source.modelUrl,modelCenter:source.modelCenter});expect(modelUrl(saved('esp32-c6-supermini'),'medium')).toBe(modelUrl(builtInComponent('esp32-c6-supermini')!,'medium'))});
 it('keeps explicit references and custom parts unchanged',()=>{const custom:Component={...saved('custom:board'),geometry:{kind:'model',modelAssetId:'custom:board'}};expect(withBuiltInModel(custom)).toBe(custom);const explicit:Component={...saved('esp32-c6-supermini'),geometry:{kind:'model',modelUrl:'/models/other.glb'}};expect(withBuiltInModel(explicit)).toBe(explicit);const unknown=saved('not-a-part');expect(withBuiltInModel(unknown)).toBe(unknown)});
 it('resolves a model reference for every model component of the upstream fixture',()=>{const project=migrateProject(ProjectSchema.parse(fixture));const models=project.components.filter(c=>c.geometry?.kind==='model');expect(models.length).toBeGreaterThan(0);for(const c of models)expect(modelUrl(c,'medium'),c.modelId).toMatch(/^\/models\/.+\.glb/)});
});
