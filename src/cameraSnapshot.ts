import type {Project} from './model';

export function cameraSnapshot(project:Project):Project{
 const state=window.__circuitExportState;
 if(!state)return project;
 const camera=state.camera;
 const controls=(state.scene as unknown as {__r3f?:{root:{getState:()=>{controls?:{target:{toArray:()=>number[]}}}}}}).__r3f?.root.getState().controls;
 return {...project,camera:{position:camera.position.toArray() as [number,number,number],target:(controls?.target.toArray()??project.camera.target) as [number,number,number]}};
}
