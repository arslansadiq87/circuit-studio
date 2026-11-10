import type {Pose,Sequence} from './cinematic';
export type SavedCameraScene={id:string;name:string;pose:Pose};
const key=(name:string)=>`c3d-camera-scenes-v1:${name}`;
export function readCameraScenes(name:string):SavedCameraScene[]{try{const data=JSON.parse(localStorage.getItem(key(name))??'[]');return Array.isArray(data)?data.filter(v=>v&&typeof v.id==='string'&&typeof v.name==='string'&&[v.pose?.position,v.pose?.target].every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite))):[]}catch{return []}}
export function appendCameraScenes(name:string,scenes:SavedCameraScene[]){const existing=readCameraScenes(name);localStorage.setItem(key(name),JSON.stringify([...existing,...scenes]));window.dispatchEvent(new Event('c3d-camera-scenes'))}
export function saveGeneratedScenes(sequence:Sequence){const run=Date.now();appendCameraScenes(sequence.analysis.name,sequence.shots.filter(s=>s.kind!=='move').map((s,index)=>({id:`auto-${run}-${index}`,name:`Auto Video · ${s.id}`,pose:s.cameraEnd})))}
