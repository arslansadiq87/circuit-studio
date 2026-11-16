import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import fixture from './fixtures/crowded-c6-project.json';
import {ProjectSchema,type Project} from '../src/model';
import {defaultVideoSettings} from '../src/cinematic';
import {projectCameraScenes,projectVideoSettings,withPresentation} from '../src/presentation';
import {useEditor} from '../src/store';

const scene={id:'manual-1',name:'View 1',pose:{position:[10,-80,60] as [number,number,number],target:[0,0,0] as [number,number,number]}};
const base=():Project=>ProjectSchema.parse(fixture);

describe('presentation stored in the project',()=>{
 it('leaves projects without the block unchanged',()=>{const project=base();expect(project.presentation).toBeUndefined();expect(projectVideoSettings(project)).toBeNull();expect(projectCameraScenes(project)).toEqual([])});
 it('round-trips video settings, shot overrides and camera scenes through the project schema',()=>{const video={...defaultVideoSettings,fps:60 as const,backgroundPresetId:'pure-white' as const,overrides:{'shot-1':{position:[1,2,3] as [number,number,number],target:[0,0,0] as [number,number,number]}}};const project={...base(),presentation:withPresentation(base(),video,[scene])};const reopened=ProjectSchema.parse(JSON.parse(JSON.stringify(project)));expect(projectVideoSettings(reopened)).toEqual(video);expect(projectCameraScenes(reopened)).toEqual([scene])});
 it('sanitizes stored settings like browser presets',()=>{const project={...base(),presentation:{video:{...defaultVideoSettings,width:123,fps:7,mode:'bogus'}}};expect(projectVideoSettings(project)).toMatchObject({width:1920,fps:30,mode:'tutorial'})});
 it('copies settings and scenes instead of sharing references',()=>{const video={...defaultVideoSettings};const stored=withPresentation(base(),video,[scene])!;expect(stored.video).not.toBe(video);expect(stored.cameraScenes![0].pose.position).not.toBe(scene.pose.position)});
 it('stores the block as an undoable project edit',()=>{useEditor.getState().loadProject(base());useEditor.getState().setPresentation(withPresentation(base(),defaultVideoSettings,[scene]));expect(useEditor.getState().project.presentation?.cameraScenes).toHaveLength(1);expect(useEditor.getState().dirty).toBe(true);useEditor.getState().undo();expect(useEditor.getState().project.presentation).toBeUndefined()});
});
