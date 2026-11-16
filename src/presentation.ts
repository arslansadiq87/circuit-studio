import {validSettings,type VideoSettings} from './cinematic';
import type {Project} from './model';
import type {SavedCameraScene} from './savedCameraScenes';
// Project-stored presentation wins over browser presets; projects without the block behave as before.
export function projectVideoSettings(project:Project):VideoSettings|null{const video=project.presentation?.video;return video?validSettings(video):null}
export function projectCameraScenes(project:Project):SavedCameraScene[]{return project.presentation?.cameraScenes??[]}
export function withPresentation(project:Project,video:VideoSettings,cameraScenes:SavedCameraScene[]):Project['presentation']{return {...project.presentation,video:{...video},cameraScenes:cameraScenes.map(s=>({...s,pose:{position:[...s.pose.position],target:[...s.pose.target]}}))}}
