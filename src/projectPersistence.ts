import {openDB} from 'idb';
import {ProjectSchema, type Project} from './model';
import {cameraSnapshot} from './cameraSnapshot';
import {projectFingerprint,useEditor} from './store';

const key='circuit-studio-current-project';
type Snapshot={updatedAt:number;project:Project};
const database=openDB('circuit-studio-workspace',1,{upgrade(db){db.createObjectStore('projects')}});
let writes=Promise.resolve();

function valid(value:unknown):Snapshot|undefined{
 if(!value||typeof value!=='object')return;
 const record=value as Partial<Snapshot>;
 const parsed=ProjectSchema.safeParse(record.project);
 return parsed.success&&typeof record.updatedAt==='number'?{updatedAt:record.updatedAt,project:parsed.data}:undefined;
}

export async function restoreLocalProject():Promise<Project|undefined>{
 let browserCopy:Snapshot|undefined,dbCopy:Snapshot|undefined;
 try{browserCopy=valid(JSON.parse(localStorage.getItem(key)??'null'))}catch{/* storage unavailable */}
 try{dbCopy=valid(await (await database).get('projects','current'))}catch{/* IndexedDB unavailable */}
 return (browserCopy&&(!dbCopy||browserCopy.updatedAt>=dbCopy.updatedAt)?browserCopy:dbCopy)?.project;
}

export async function saveLocalProject(project:Project):Promise<void>{
 const record:Snapshot={updatedAt:Date.now(),project:{...project,assets:undefined}};
 let localSaved=false,dbSaved=false;
 try{localStorage.setItem(key,JSON.stringify(record));localSaved=true}catch{/* quota or private mode */}
 writes=writes.catch(()=>{}).then(async()=>{await (await database).put('projects',record,'current')});
 try{await writes;dbSaved=true}catch{/* IndexedDB unavailable */}
 if(!localSaved&&!dbSaved)throw new Error('Local project storage is unavailable');
}

export function startProjectAutosave(){
 let timer:ReturnType<typeof setTimeout>|undefined;
 let lastFingerprint=useEditor.getState().dirty?'':projectFingerprint(cameraSnapshot(useEditor.getState().project));
 const flush=()=>{
  if(timer)clearTimeout(timer);
  timer=undefined;
  const project=useEditor.getState().project;
  const snapshot=cameraSnapshot(project),fingerprint=projectFingerprint(snapshot);
  if(fingerprint===lastFingerprint)return;
  lastFingerprint=fingerprint;
  // The browser copy is written before the first await, including on pagehide.
  void saveLocalProject(snapshot).then(()=>useEditor.getState().markSaved(project)).catch(()=>{lastFingerprint='';window.dispatchEvent(new Event('c3d-local-save-error'))});
 };
 const schedule=()=>{if(timer)clearTimeout(timer);timer=setTimeout(flush,350)};
 const unsubscribe=useEditor.subscribe((state,previous)=>{if(state.project!==previous.project)schedule()});
 const interval=setInterval(flush,1500);
 if(useEditor.getState().dirty)schedule();
 const visibility=()=>{if(document.visibilityState==='hidden')flush()};
 window.addEventListener('pagehide',flush);
 document.addEventListener('visibilitychange',visibility);
 return ()=>{if(timer)clearTimeout(timer);clearInterval(interval);unsubscribe();window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',visibility)};
}
