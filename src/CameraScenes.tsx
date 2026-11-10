import {useEffect,useState} from 'react';
import {Vector3} from 'three';
import {useEditor} from './store';
import {readCameraScenes,appendCameraScenes} from './savedCameraScenes';
import type {Pose} from './cinematic';
export function CameraScenes(){const name=useEditor(s=>s.project.name),[scenes,setScenes]=useState(()=>readCameraScenes(name)),[message,setMessage]=useState('');useEffect(()=>{const refresh=()=>setScenes(readCameraScenes(name));refresh();window.addEventListener('c3d-camera-scenes',refresh);return()=>window.removeEventListener('c3d-camera-scenes',refresh)},[name]);
 const save=async()=>{try{const {cameraSnapshot}=await import('./projectFiles');appendCameraScenes(name,[{id:`manual-${Date.now()}`,name:`View ${scenes.length+1}`,pose:cameraSnapshot(useEditor.getState().project).camera}])}catch(e){setMessage((e as Error).message)}};
 const apply=(pose:Pose)=>{const state=window.__circuitExportState;if(!state)return;const root=(state.scene as unknown as {__r3f?:{root:{getState:()=>{controls?:{target:Vector3;enableDamping:boolean;update:()=>void};invalidate:()=>void}}}}).__r3f?.root.getState();const controls=root?.controls;if(!controls)return;const damping=controls.enableDamping;controls.enableDamping=false;controls.update();state.camera.position.set(...pose.position);controls.target.set(...pose.target);state.camera.lookAt(controls.target);controls.update();controls.enableDamping=damping;root?.invalidate()};
 return <div className="empty-tab"><span>Reusable local camera scenes</span><button onClick={()=>void save()}>Save view</button>{scenes.map(s=><button key={s.id} onClick={()=>apply(s.pose)}>{s.name}</button>)}{message&&<span>{message}</span>}</div>}
