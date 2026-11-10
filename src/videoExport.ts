import * as THREE from 'three';
import {Output,BufferTarget,StreamTarget,Mp4OutputFormat,WebMOutputFormat,CanvasSource,canEncodeVideo} from 'mediabunny';
import {Zip,ZipPassThrough} from 'fflate';
import type {Project} from './model';
import {useGraphics} from './graphics';
import {exportPreparers} from './RuntimeModel';
import {analyzeCircuit,backgroundSolidColor,backgroundStops,buildSequence,cameraFor,evaluatePresentationAt,videoFilename,type Sequence,type VideoSettings} from './cinematic';
import {wireDrawCount} from './wireAnimation';
export type Progress={stage:string;frame:number;total:number;percent:number};
export type VideoFile={write:(data:{type:'write';position:number;data:Uint8Array<ArrayBuffer>})=>Promise<void>;close:()=>Promise<void>;abort:()=>Promise<void>};
const MAX_BUFFER=512*1024*1024;
let running=false;
const cornersForBox=(box:THREE.Box3)=>{const points:THREE.Vector3[]=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z));return points};
export async function videoCapabilities(settings:VideoSettings){const options={width:settings.width,height:settings.width*9/16,frameRate:settings.fps,bitrate:settings.width>=3840?40_000_000:12_000_000};return {mp4:await canEncodeVideo('avc',options),webm:await canEncodeVideo('vp9',options)}}
const nextPaint=()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));
const canceled=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Video export canceled','AbortError')};
function captionPalette(settings:VideoSettings){
 const gradient=backgroundStops(settings),solid=backgroundSolidColor(settings),colors=gradient??[solid??'#171B22',solid??'#171B22'];
 const luminance=(hex:string)=>{const c=new THREE.Color(hex);return .2126*c.r+.7152*c.g+.0722*c.b};
 const light=settings.labels==='white'||settings.labels==='minimal'&&colors.reduce((n,c)=>n+luminance(c),0)/colors.length>.34&&settings.backgroundPresetId!=='green-screen';
 return light?{panel:'rgba(250,252,253,.98)',ink:'#15212b',secondary:'#435663',line:'#b8c6ce',surface:'#F5F8FA',surfaceTop:'#FFFFFF',frame:'#8396A4',edge:'#167C7A'}:{panel:'rgba(20,27,34,.98)',ink:'#f5f8fa',secondary:'#c1cdd3',line:'#54616b',surface:'#141C27',surfaceTop:'#202C3B',frame:'#52667B',edge:'#49D6D0'};
}
function cleanClone(object:THREE.Object3D){
 const clone=object.clone(true);const remove:THREE.Object3D[]=[];
 clone.traverse(o=>{if(o instanceof THREE.Mesh){const materials=Array.isArray(o.material)?o.material:[o.material];if(materials.every(m=>m.opacity===0||m.wireframe===true))remove.push(o)}});
 remove.forEach(o=>o.removeFromParent());return clone;
}
export type CameraDiagnostic={shotId:string;kind:string;connectionId:string|null;position:[number,number,number];target:[number,number,number];fov:number;score:number|null;source:[number,number]|null;destination:[number,number]|null;routeBounds:{left:number;top:number;right:number;bottom:number}|null;clippingWarnings:string[];cameraTravel:number;overlay:{x:number;y:number;width:number;height:number}|null;overlayRouteHits:number|null};
export class CinematicRenderer{
 scene=new THREE.Scene();camera=cameraFor({position:[0,100,150],target:[0,0,0]});renderer:THREE.WebGLRenderer;canvas=document.createElement('canvas');ctx:CanvasRenderingContext2D;
 sequence:Sequence;cameraDiagnostics:CameraDiagnostic[]=[];readonly overlayRects:Record<string,{x:number;y:number;width:number;height:number}>={};readonly overlayRouteHits:Record<string,number>={};readonly hudDiagnostics:Record<string,{style:string;theme:'dark'|'light';x:number;y:number;width:number;height:number;header:string;counter:string;main:string;subtitle:string;opacity:number;status:{x:number;y:number;width:number;height:number}|null;headerRect:{x:number;y:number;width:number;height:number}|null}>={};readonly pinCallouts:Record<string,{role:string;x:number;y:number;width:number;height:number;anchor:[number,number];pinId:string}>={};private overlayLayoutCache=new Map<string,{x:number;y:number;width:number;height:number}>();private owned:THREE.BufferGeometry[]=[];private materials:THREE.Material[]=[];private wires=new Map<string,THREE.Mesh<THREE.TubeGeometry,THREE.MeshStandardMaterial>>();readonly wireOutlines=new Map<string,THREE.Mesh<THREE.TubeGeometry,THREE.MeshBasicMaterial>>();private markers:THREE.Mesh[]=[];private componentMaterials=new Map<string,THREE.MeshStandardMaterial[]>();private backgroundTexture?:THREE.CanvasTexture;private floor?:THREE.Mesh;private grid?:THREE.GridHelper;private fillLight?:THREE.HemisphereLight;private rimLight?:THREE.DirectionalLight;
 constructor(project:Project,settings:VideoSettings,selected:string[]){
  const source=window.__circuitExportState;if(!source)throw new Error('The 3D viewport is not ready.');
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
   this.renderer.setPixelRatio(1);this.renderer.setSize(settings.width,settings.width*9/16,false);this.renderer.outputColorSpace=source.renderer.outputColorSpace;this.renderer.toneMapping=source.renderer.toneMapping;this.renderer.toneMappingExposure=source.renderer.toneMappingExposure;
  if(settings.width>this.renderer.capabilities.maxTextureSize){this.renderer.dispose();throw new Error('Selected video resolution exceeds this device GPU texture limit.')}
   this.canvas.width=settings.width;this.canvas.height=settings.width*9/16;const ctx=this.canvas.getContext('2d');if(!ctx){this.renderer.dispose();throw new Error('Video overlay canvas is unavailable.')}this.ctx=ctx;
   this.renderer.shadowMap.enabled=settings.groundShadows;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.scene.environment=source.scene.environment;this.scene.environmentIntensity=source.scene.environmentIntensity;
  const bounds=new Map<string,THREE.Box3>();
  try{
    const focusTintComponents=new Set(project.components.filter(component=>component.geometry?.kind!=='model').map(component=>component.id));
    let shadowLightAdded=false;for(const child of source.scene.children){if(child.userData.componentId){const clone=cleanClone(child);const materials:THREE.MeshStandardMaterial[]=[];const copies=new Map<THREE.Material,THREE.Material>();clone.traverse(o=>{if(o instanceof THREE.Mesh){if(settings.groundShadows)o.castShadow=true;const copy=(m:THREE.Material)=>{if(!(m instanceof THREE.MeshStandardMaterial))return m;let result=copies.get(m);if(!result){result=m.clone();result.userData.videoOriginalEmission=m.emissive.getHex();result.userData.videoOriginalEmissionIntensity=m.emissiveIntensity;copies.set(m,result);materials.push(result as THREE.MeshStandardMaterial);this.materials.push(result)}return result};o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material)}});if(focusTintComponents.has(child.userData.componentId))this.componentMaterials.set(child.userData.componentId,materials);this.scene.add(clone);clone.updateWorldMatrix(true,true);bounds.set(child.userData.componentId,new THREE.Box3().setFromObject(clone))}else if(child instanceof THREE.Light){const light=child.clone();if(settings.groundShadows&&light instanceof THREE.DirectionalLight&&!shadowLightAdded){light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.camera.left=-450;light.shadow.camera.right=450;light.shadow.camera.top=450;light.shadow.camera.bottom=-450;light.shadow.bias=-.0002;light.shadow.radius=5;shadowLightAdded=true}this.scene.add(light)}}
    this.fillLight=new THREE.HemisphereLight('#dce9f5','#26303b',settings.fillLightIntensity);this.fillLight.name='Video Presentation Fill';this.scene.add(this.fillLight);
    this.rimLight=new THREE.DirectionalLight('#d7e5f2',settings.rimLightIntensity);this.rimLight.name='Video Presentation Rim';this.rimLight.position.set(75,58,82);this.rimLight.target.position.set(0,0,0);this.scene.add(this.rimLight,this.rimLight.target);
    this.sequence=buildSequence(analyzeCircuit(project,settings,selected,bounds),settings);this.cameraDiagnostics=this.buildCameraDiagnostics();this.updateSettings(settings);
   const eligible=new Set(this.sequence.analysis.connections.map(c=>c.wire.id));
   source.scene.traverse(o=>{if(!(o instanceof THREE.Mesh)||!o.userData.wireVisual||!eligible.has(o.userData.wireId))return;
    const mesh=o.clone() as THREE.Mesh<THREE.TubeGeometry,THREE.MeshStandardMaterial>;mesh.geometry=o.geometry.clone();mesh.material=(o.material as THREE.MeshStandardMaterial).clone();mesh.material.emissive.set('#000');mesh.material.transparent=false;mesh.material.opacity=1;mesh.geometry.setDrawRange(0,Infinity);this.owned.push(mesh.geometry);this.materials.push(mesh.material);this.wires.set(o.userData.wireId,mesh);this.scene.add(mesh);
   });
   this.refreshWireOutlines(settings);
   for(let i=0;i<3;i++){const geo=new THREE.SphereGeometry(i===2?.22:.45,16,10),material=new THREE.MeshBasicMaterial({color:i===0?'#ffcc76':i===1?'#7ce7ca':'#eff8ff',depthTest:i===2,transparent:i===2,opacity:.96});const marker=new THREE.Mesh(geo,material);marker.renderOrder=100;marker.visible=false;this.owned.push(geo);this.materials.push(material);this.scene.add(marker);this.markers.push(marker)}
  }catch(error){this.dispose();throw error}
 }
 private refreshWireOutlines(settings:VideoSettings){
  for(const outline of this.wireOutlines.values()){outline.removeFromParent();outline.geometry.dispose();outline.material.dispose()}
  this.wireOutlines.clear();
  const backgrounds=settings.backgroundPresetId==='transparent'?[]:backgroundStops(settings)??[backgroundSolidColor(settings)??'#171B22'];
  if(!backgrounds.length)return;
  const luminance=(color:THREE.Color)=>.2126*color.r+.7152*color.g+.0722*color.b;
  for(const [id,wire] of this.wires){
   const wireColor=new THREE.Color(wire.material.color),wireLuminance=luminance(wireColor);
   const contrast=Math.min(...backgrounds.map(hex=>{const bg=luminance(new THREE.Color(hex));return (Math.max(bg,wireLuminance)+.05)/(Math.min(bg,wireLuminance)+.05)}));
   if(contrast>=3)continue;
   const bgLuminance=backgrounds.reduce((sum,hex)=>sum+luminance(new THREE.Color(hex)),0)/backgrounds.length;
   const outlineColor=bgLuminance>.42?'#202832':'#e0e6eb';
   const params=wire.geometry.parameters,geometry=new THREE.TubeGeometry(params.path,params.tubularSegments,params.radius+Math.max(.07,params.radius*.12),params.radialSegments,params.closed);
   const material=new THREE.MeshBasicMaterial({color:outlineColor,side:THREE.BackSide,transparent:true,opacity:.7,depthTest:true,depthWrite:false,toneMapped:false});
   const outline=new THREE.Mesh(geometry,material);outline.position.copy(wire.position);outline.quaternion.copy(wire.quaternion);outline.scale.copy(wire.scale);outline.renderOrder=wire.renderOrder-1;outline.geometry.setDrawRange(0,0);this.scene.add(outline);this.wireOutlines.set(id,outline);
  }
 }
 updateSettings(settings:VideoSettings){
  this.sequence.settings=settings;this.fillLight&&(this.fillLight.intensity=settings.fillLightIntensity);this.rimLight&&(this.rimLight.intensity=settings.rimLightIntensity);this.renderer.shadowMap.enabled=settings.groundShadows;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;let shadowLight=false;this.scene.traverse(o=>{if(o instanceof THREE.Mesh&&o!==this.floor)o.castShadow=settings.groundShadows;if(o instanceof THREE.DirectionalLight&&o!==this.rimLight){o.castShadow=settings.groundShadows&&!shadowLight;if(o.castShadow){o.shadow.mapSize.set(512,512);o.shadow.camera.left=-450;o.shadow.camera.right=450;o.shadow.camera.top=450;o.shadow.camera.bottom=-450;o.shadow.bias=-.0002;o.shadow.radius=5;shadowLight=true}}});
  this.scene.background=null;this.backgroundTexture?.dispose();this.backgroundTexture=undefined;
  if(this.wires.size)this.refreshWireOutlines(settings);
  if(settings.backgroundPresetId==='transparent')this.scene.background=null;
  else{const solid=backgroundSolidColor(settings);if(solid)this.scene.background=new THREE.Color(solid);else{const stops=backgroundStops(settings)??['#171B22','#172A44'],canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Background gradient is unavailable.');const p=settings.gradientPosition/100;const [x0,y0,x1,y1]=settings.gradientDirection==='vertical'?[0,0,0,128]:settings.gradientDirection==='horizontal'?[0,0,128,0]:[0,0,128,128],gradient=ctx.createLinearGradient(x0,y0,x1,y1);gradient.addColorStop(Math.max(0,p-.08),stops[0]);gradient.addColorStop(Math.min(1,p+.08),stops[1]);ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;this.backgroundTexture=texture;this.scene.background=texture}}
  this.floor?.geometry.dispose();(this.floor?.material as THREE.Material|undefined)?.dispose();if(this.floor)this.scene.remove(this.floor);this.floor=undefined;
  this.grid?.geometry.dispose();if(this.grid){const materials=Array.isArray(this.grid.material)?this.grid.material:[this.grid.material];materials.forEach(m=>m.dispose());this.scene.remove(this.grid)}this.grid=undefined;
  const z=this.sequence.analysis.bounds.min.z-.2,span=this.sequence.analysis.bounds.getSize(new THREE.Vector3()),size=Math.max(240,span.x*5,span.y*5);
  if(settings.showFloor||settings.groundShadows){const material=settings.showFloor?new THREE.MeshStandardMaterial({color:settings.floorColor,roughness:.92,metalness:0}):new THREE.ShadowMaterial({color:'#000000',opacity:.2});const plane=new THREE.Mesh(new THREE.PlaneGeometry(size,size),material);plane.position.z=z;plane.receiveShadow=settings.groundShadows;plane.renderOrder=-1;this.scene.add(plane);this.floor=plane}
  if(settings.showGrid){const grid=new THREE.GridHelper(Math.max(240,span.x*3,span.y*3),24,settings.backgroundPresetId==='pure-white'||settings.backgroundPresetId==='light-gray'?'#7c838d':'#777f88','#4e5661');grid.rotation.x=Math.PI/2;grid.position.z=z+.025;this.scene.add(grid);this.grid=grid}
 }
 private buildCameraDiagnostics():CameraDiagnostic[]{
  const {shots,analysis}=this.sequence;const rows:CameraDiagnostic[]=shots.map(shot=>{
   const id=shot.connectionIds[0]??(/^(move|pair|wire|inspect)-(.+)$/.exec(shot.id)?.[2]??null),connection=analysis.connections.find(c=>c.wire.id===id),camera=cameraFor(shot.cameraEnd);
   const pixels=(points:THREE.Vector3[])=>points.map(p=>p.clone().project(camera)).filter(p=>p.z<1).map(p=>({x:(p.x+1)*960,y:(1-p.y)*540}));
   const route=connection?pixels(connection.points):[],ends=connection?[pixels([connection.a])[0],pixels([connection.b])[0]]:[];
   const rect=route.length?{left:Math.min(...route.map(p=>p.x)),top:Math.min(...route.map(p=>p.y)),right:Math.max(...route.map(p=>p.x)),bottom:Math.max(...route.map(p=>p.y))}:null;
   const warnings:string[]=[];if(shot.kind==='wire'&&rect&&(rect.left<154||rect.right>1766||rect.top<108||rect.bottom>950))warnings.push('Connection route exceeds the configured safe frame.');
   const coord=(p:typeof ends[number])=>p?[p.x,p.y] as [number,number]:null;
   return {shotId:shot.id,kind:shot.kind,connectionId:connection?.wire.id??null,position:shot.cameraEnd.position,target:shot.cameraEnd.target,fov:38,score:shot.quality?.score??null,source:coord(ends[0]),destination:coord(ends[1]),routeBounds:rect,clippingWarnings:warnings,cameraTravel:new THREE.Vector3(...shot.cameraStart.position).distanceTo(new THREE.Vector3(...shot.cameraEnd.position)),overlay:null,overlayRouteHits:null};
  });
  try{if(localStorage.getItem('circuit.videoCameraDebug')==='1')console.debug('[AutoVideo camera plan]',rows)}catch{/* diagnostics remain available on the renderer */}
  return rows;
 }
 render(time:number){
  if(this.renderer.getContext().isContextLost())throw new Error('The GPU context was lost during video rendering. Lower the resolution or free device memory and retry.');
  const state=evaluatePresentationAt(this.sequence,time);this.camera.position.set(...state.camera.position);this.camera.lookAt(new THREE.Vector3(...state.camera.target));this.camera.updateMatrixWorld(true);
  for(const [id,mesh] of this.wires){const active=state.active.some(c=>c.wire.id===id),inClosing=state.kind==='closing'||state.kind==='final';const progress=!this.sequence.settings.keepCompleted&&!active&&!inClosing?0:state.progress[id]??0,segments=mesh.geometry.parameters.tubularSegments,total=mesh.geometry.index!.count,drawCount=wireDrawCount(progress,segments,total);mesh.geometry.setDrawRange(0,drawCount);mesh.material.transparent=this.sequence.settings.fadeUnrelated&&!!state.active.length&&!active;mesh.material.opacity=mesh.material.transparent?.28:1;const hsl={h:0,s:0,l:0};mesh.material.color.getHSL(hsl);if(active&&hsl.l<.24){mesh.material.emissive.set('#8fa5b5');mesh.material.emissiveIntensity=.27}else{mesh.material.emissive.copy(mesh.material.color);mesh.material.emissiveIntensity=active?.32:0}const outline=this.wireOutlines.get(id);if(outline){outline.geometry.setDrawRange(0,drawCount);outline.material.opacity=active?.7:mesh.material.transparent?.38:.52;outline.visible=progress>0}}
  this.markers.forEach(m=>m.visible=false);
  for(const [id,materials] of this.componentMaterials){const focused=state.active.some(c=>c.wire.from.componentId===id||((state.progress[c.wire.id]??0)>=.98&&c.wire.to.componentId===id));materials.forEach(m=>{m.emissive.setHex(focused?0x5c3b13:m.userData.videoOriginalEmission);m.emissiveIntensity=focused?.2:m.userData.videoOriginalEmissionIntensity})}
   const connection=state.active[0];if(connection){const progress=state.progress[connection.wire.id]??0;this.markers[0].visible=state.kind==='inspect'&&progress<1||state.kind==='move';this.markers[0].position.copy(connection.a);this.markers[1].visible=progress>=1;this.markers[1].position.copy(connection.b);if(this.sequence.settings.tipGlow&&state.kind==='wire'&&progress>0&&progress<1){const index=progress*(connection.points.length-1),lower=Math.floor(index),tipMaterial=this.markers[2].material as THREE.MeshBasicMaterial;tipMaterial.color.set(connection.wire.color);const hsl={h:0,s:0,l:0};tipMaterial.color.getHSL(hsl);if(hsl.l<.4)tipMaterial.color.lerp(new THREE.Color('#b7c9d2'),.58);this.markers[2].visible=true;this.markers[2].position.copy(connection.points[lower]).lerp(connection.points[Math.min(connection.points.length-1,lower+1)],index-lower)}}
  this.renderer.render(this.scene,this.camera);this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);this.ctx.drawImage(this.renderer.domElement,0,0);
  this.overlay(state);if(state.kind==='inspect'&&state.active[0]&&this.sequence.settings.labels!=='none')this.pinCallout(state.shotId,state.active[0],(state.progress[state.active[0].wire.id]??0)>=1?'destination':'source');return this.canvas;
 }
 private pinCallout(shotId:string,connection:Sequence['analysis']['connections'][number],role:'source'|'destination'){
  const ctx=this.ctx,scale=this.canvas.width/1920,raw=role==='source'?connection.sourcePin:connection.destinationPin,aliases=raw.split(' [')[0].split(' / '),primary=aliases.find(p=>/GPIO|VBUS|GND|5V/i.test(p))??aliases[0],pinId=role==='source'?connection.sourcePinId:connection.destinationPinId;ctx.save();ctx.scale(scale,scale);const anchor=role==='source'?connection.a:connection.b,q=anchor.clone().project(this.camera),px=(q.x+1)*960,py=(1-q.y)*540,pin=`${primary} · ${pinId}`;ctx.font='600 17px "DM Mono", monospace';const width=ctx.measureText(pin).width+28,height=34;let x=px+14,y=py-height-12;if(x+width>1766)x=px-width-14;if(y<108)y=py+16;if(x<154)x=154;if(x+width>1766)x=1766-width;if(y+height>950)y=950-height;const attachX=Math.max(x,Math.min(px,x+width)),attachY=Math.max(y,Math.min(py,y+height));this.pinCallouts[shotId]={role,x,y,width,height,anchor:[px,py],pinId};ctx.strokeStyle=role==='source'?'#ffd17c':'#85efd0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(attachX,attachY);ctx.stroke();ctx.fillStyle='rgba(17,24,31,.98)';ctx.beginPath();ctx.roundRect(x,y,width,height,8);ctx.fill();ctx.strokeStyle=role==='source'?'#ffd17c':'#85efd0';ctx.lineWidth=1.4;ctx.stroke();ctx.fillStyle=role==='source'?'#ffd17c':'#85efd0';ctx.font='600 11px "DM Mono", monospace';ctx.fillText(role.toUpperCase(),x+10,y+12);ctx.fillStyle='#f3f7f5';ctx.font='600 16px "DM Mono", monospace';ctx.fillText(pin,x+10,y+29);ctx.restore();
 }
 private resolveOverlayRect(state:ReturnType<typeof evaluatePresentationAt>,shot:Sequence['shots'][number]|undefined,connection:Sequence['analysis']['connections'][number]|undefined,width:number,height:number){
  const layoutId=connection?`connection-${connection.wire.id}`:shot?.id??state.shotId,key=`${layoutId}:${this.sequence.settings.hudStyle}:${this.sequence.settings.labels}:${width}:${height}`;
  const cached=this.overlayLayoutCache.get(key);if(cached)return cached;
  const analysis=this.sequence.analysis,solids=connection?analysis.solids.filter(s=>s.id===connection.sourceComponentId||s.id===connection.destinationComponentId):analysis.solids;
  const important=connection?connection.points:analysis.connections.flatMap(c=>c.points.filter((_,i)=>i%8===0)),critical=connection?[connection.a,connection.b]:[];
  const layoutCamera=cameraFor(shot?.cameraEnd??state.camera);layoutCamera.updateMatrixWorld(true);
  const projected=(p:THREE.Vector3)=>{const q=p.clone().project(layoutCamera);return {x:(q.x+1)*960,y:(1-q.y)*540,z:q.z}};
  const boxes=solids.map(s=>cornersForBox(s.box).map(projected)).filter(points=>points.some(p=>p.z<1)),route=important.map(projected).filter(p=>p.z<1),ends=critical.map(projected).filter(p=>p.z<1);
  const marginX=50,marginY=42,candidates=[{x:marginX,y:marginY},{x:1920-marginX-width,y:marginY},{x:marginX,y:1038-marginY-height},{x:1920-marginX-width,y:1038-marginY-height}];
  const score=(r:{x:number;y:number})=>{let value=0;for(const box of boxes){const xs=box.map(p=>p.x),ys=box.map(p=>p.y),x1=Math.max(r.x,Math.min(...xs)),x2=Math.min(r.x+width,Math.max(...xs)),y1=Math.max(r.y,Math.min(...ys)),y2=Math.min(r.y+height,Math.max(...ys));if(x2>x1&&y2>y1)value+=(x2-x1)*(y2-y1)/(width*height)*18}for(const p of route)if(p.x>=r.x&&p.x<=r.x+width&&p.y>=r.y&&p.y<=r.y+height)value+=4;for(const p of ends)if(p.x>=r.x-22&&p.x<=r.x+width+22&&p.y>=r.y-22&&p.y<=r.y+height+22)value+=24;return value};
  const rect={...candidates.sort((a,b)=>score(a)-score(b))[0],width,height};this.overlayLayoutCache.set(key,rect);return rect;
 }
 private connectionCaptionOpacity(state:ReturnType<typeof evaluatePresentationAt>,connection:Sequence['analysis']['connections'][number]|undefined){
  if(!connection)return state.labelOpacity;
  const shots=this.sequence.shots.filter(s=>s.connectionIds.includes(connection.wire.id)&&(s.kind==='move'||s.kind==='wire'||s.kind==='inspect'));
  if(!shots.length)return state.labelOpacity;
  const start=Math.min(...shots.map(s=>s.start)),end=Math.max(...shots.map(s=>s.start+s.duration)),fade=.18;
  return Math.max(0,Math.min(1,(state.time-start)/fade,(end-state.time)/fade));
 }
 private paintFuturisticFrame(x:number,y:number,width:number,height:number,palette:ReturnType<typeof captionPalette>){
  const ctx=this.ctx;
  ctx.shadowColor='rgba(0,0,0,.54)';ctx.shadowBlur=26;ctx.shadowOffsetX=0;ctx.shadowOffsetY=11;ctx.fillStyle='rgba(6,11,17,.76)';ctx.beginPath();ctx.roundRect(x+4,y+5,width,height,16);ctx.fill();
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.fillStyle=palette.frame;ctx.beginPath();ctx.roundRect(x,y,width,height,16);ctx.fill();
  const top=ctx.createLinearGradient(x,y,x,y+height);top.addColorStop(0,palette.surfaceTop);top.addColorStop(.14,palette.surface);top.addColorStop(1,palette.surface);ctx.fillStyle=top;ctx.beginPath();ctx.roundRect(x+1.5,y+1.5,width-3,height-3,14);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x+4,y+4,width-8,height-8,11);ctx.stroke();
  ctx.save();ctx.lineCap='round';ctx.strokeStyle=palette.edge;ctx.lineWidth=2;ctx.shadowColor=palette.edge;ctx.shadowBlur=7;ctx.beginPath();ctx.moveTo(x+22,y+2);ctx.lineTo(x+Math.min(width*.44,250),y+2);ctx.stroke();ctx.restore();
  ctx.strokeStyle='rgba(255,255,255,.24)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+18,y+height-2);ctx.lineTo(x+width-24,y+height-2);ctx.stroke();
 }
 private drawModernOverlay(state:ReturnType<typeof evaluatePresentationAt>,shot:Sequence['shots'][number]|undefined,connection:Sequence['analysis']['connections'][number]|undefined,opacity:number,palette:ReturnType<typeof captionPalette>,accent:string){
  const ctx=this.ctx,settings=this.sequence.settings,analysis=this.sequence.analysis,scale=this.canvas.width/1920,isFinal=state.kind==='final',isAll=shot?.id==='all',simple=settings.hudStyle==='minimal',compact=settings.labels==='minimal';
  const width=isFinal?510:isAll?760:simple?600:compact?620:680,height=isFinal?88:isAll?Math.min(320,132+Math.ceil(Math.min(analysis.connections.length,8)/2)*32):simple?88:compact?140:202;
  const rect=this.resolveOverlayRect(state,shot,connection,width,height),cacheStart=connection?Math.min(...this.sequence.shots.filter(s=>s.connectionIds.includes(connection.wire.id)&&['move','wire','inspect'].includes(s.kind)).map(s=>s.start)):shot?.start??0,enter=Math.max(0,Math.min(1,(state.time-cacheStart)/.22)),settle=enter*enter*(3-2*enter),y=rect.y+(1-settle)*9;
  const drawText=(text:string,atX:number,baseline:number,maxWidth:number,size:number,minSize:number,family='Arial, sans-serif')=>{let font=size;do{ctx.font=`600 ${font}px ${family}`;if(ctx.measureText(text).width<=maxWidth)break;font--}while(font>=minSize);let result=text;if(ctx.measureText(result).width>maxWidth){while(result.length>1&&ctx.measureText(`${result}…`).width>maxWidth)result=result.slice(0,-1);result+='…'}ctx.fillText(result,atX,baseline);return result};
  const pinLabel=(value:string)=>{const aliases=value.split(' [')[0].split(' / ');return aliases.find(p=>/GPIO|VBUS|GND|5V/i.test(p))??aliases[0]};
  let header='',counter='',main='',subtitle='',status:{x:number;y:number;width:number;height:number}|null=null,headerRect:{x:number;y:number;width:number;height:number}|null=null;
  if(simple&&connection){header='';counter='';const from=`${connection.sourceComponent} · ${pinLabel(connection.sourcePin)}`,to=`${connection.destinationComponent} · ${pinLabel(connection.destinationPin)}`;main=`${from}  →  ${to}`;subtitle=''}
  else if(isFinal){header=settings.closingLabel==='connection-summary'?'CIRCUIT SUMMARY':'PROJECT COMPLETE';counter=`${String(analysis.connections.length).padStart(2,'0')} NETS`;main=settings.closingLabel==='connection-summary'?`${analysis.connections.length} CONNECTIONS COMPLETE`:`${analysis.name} — Complete`;subtitle=settings.closingLabel==='connection-summary'?analysis.name:`${analysis.connections.length} saved connections`}
  else if(connection){header='CONNECTION';const index=analysis.connections.findIndex(c=>c.wire.id===connection.wire.id)+1;counter=`${String(index).padStart(2,'0')} / ${String(analysis.connections.length).padStart(2,'0')}`;main=compact?`${pinLabel(connection.sourcePin)}  →  ${pinLabel(connection.destinationPin)}`:connection.wire.label;subtitle=compact?`${connection.sourceComponent}  →  ${connection.destinationComponent}`:`${connection.sourceComponent} · ${connection.sourcePin}  →  ${connection.destinationComponent} · ${connection.destinationPin}`}
  else if(isAll){header='CONNECTIONS';counter=`${analysis.connections.length} NETS`;main='All connections';subtitle='Saved electrical routes'}
  else{header='PROJECT';counter='AUTO VIDEO';main=analysis.name;subtitle='Electrical connection overview'}
  const inset=scale;ctx.save();ctx.scale(inset,inset);ctx.globalAlpha=opacity;ctx.translate(0,y-rect.y);
  if(simple){ctx.shadowColor='rgba(0,0,0,.3)';ctx.shadowBlur=16;ctx.shadowOffsetY=5;ctx.fillStyle=palette.panel;ctx.beginPath();ctx.roundRect(rect.x,rect.y,width,height,10);ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle=palette.line;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=palette.ink;main=drawText(main,rect.x+22,rect.y+53,width-44,23,15);this.hudDiagnostics[state.shotId]={style:settings.hudStyle,theme:palette.surfaceTop==='#FFFFFF'?'light':'dark',x:rect.x,y:rect.y,width,height,header,counter,main,subtitle,opacity,status:null,headerRect:null};ctx.restore();this.overlayRects[state.shotId]={x:rect.x,y:rect.y,width,height};this.overlayRouteHits[state.shotId]=0;return}
  this.paintFuturisticFrame(rect.x,rect.y,width,height,palette);
  ctx.fillStyle=accent;ctx.shadowColor=accent;ctx.shadowBlur=6;ctx.beginPath();ctx.arc(rect.x+26,rect.y+27,4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;status={x:rect.x+22,y:rect.y+23,width:8,height:8};
  ctx.fillStyle=palette.secondary;ctx.font='600 15px "IBM Plex Mono", monospace';const headerWidth=ctx.measureText(header).width;ctx.fillText(header,rect.x+42,rect.y+32);headerRect={x:rect.x+42,y:rect.y+18,width:headerWidth,height:18};ctx.textAlign='right';ctx.fillText(counter,rect.x+width-24,rect.y+32);ctx.textAlign='left';
  ctx.fillStyle=palette.ink;
  if(isFinal){drawText(main,rect.x+24,rect.y+58,width-48,27,17);ctx.fillStyle=palette.secondary;drawText(subtitle,rect.x+24,rect.y+77,width-48,13,11,'"IBM Plex Mono", monospace')}
  else if(simple){drawText(main,rect.x+22,rect.y+55,width-44,22,14)}
  else if(isAll){drawText(main,rect.x+24,rect.y+69,width-48,29,18);ctx.fillStyle=palette.secondary;drawText(subtitle,rect.x+24,rect.y+94,width-48,14,11,'"IBM Plex Mono", monospace');analysis.connections.slice(0,8).forEach((c,i)=>{const col=i%2,row=Math.floor(i/2),cx=rect.x+28+col*350,cy=rect.y+132+row*34,color=new THREE.Color(c.wire.color),hsl={h:0,s:0,l:0};color.getHSL(hsl);if(hsl.l<.4)color.lerp(new THREE.Color('#b8c6ce'),.55);ctx.fillStyle=`#${color.getHexString()}`;ctx.beginPath();ctx.arc(cx,cy-5,4,0,Math.PI*2);ctx.fill();ctx.fillStyle=palette.ink;drawText(c.wire.label,cx+14,cy,320,17,13)});if(analysis.connections.length>8){ctx.fillStyle=palette.secondary;drawText(`+ ${analysis.connections.length-8} more connections`,rect.x+28,rect.y+height-15,width-56,13,11)}}
  else{drawText(main,rect.x+24,rect.y+77,width-48,compact?31:27,17);ctx.fillStyle=palette.secondary;drawText(subtitle,rect.x+24,rect.y+(compact?111:119),width-48,compact?16:14,11,'"IBM Plex Mono", monospace')}
  this.hudDiagnostics[state.shotId]={style:settings.hudStyle,theme:palette.surfaceTop==='#FFFFFF'?'light':'dark',x:rect.x,y:rect.y,width,height,header,counter,main,subtitle,opacity,status,headerRect};this.overlayRects[state.shotId]={x:rect.x,y:rect.y,width,height};
  const connectionRoute=connection?.points??analysis.connections.flatMap(c=>c.points.filter((_,i)=>i%8===0)),projectedRoute=connectionRoute.map(p=>{const q=p.clone().project(this.camera);return {x:(q.x+1)*960,y:(1-q.y)*540}});const routeHits=projectedRoute.filter(p=>p.x>=rect.x&&p.x<=rect.x+width&&p.y>=rect.y&&p.y<=rect.y+height).length;this.overlayRouteHits[state.shotId]=routeHits;const diagnostic=this.cameraDiagnostics.find(d=>d.shotId===state.shotId);if(diagnostic){diagnostic.overlay={x:rect.x,y:rect.y,width,height};diagnostic.overlayRouteHits=routeHits}ctx.restore();
 }
 private overlay(state:ReturnType<typeof evaluatePresentationAt>){
  const {settings,analysis,shots}=this.sequence;
  if(settings.labels==='none'||settings.hudStyle==='none'||state.kind==='final'&&settings.closingLabel==='none')return;
  const ctx=this.ctx,scale=this.canvas.width/1920;
  const {panel,ink,secondary,line}=captionPalette(settings);
  const shot=shots.find(s=>s.id===state.shotId);
  const movingId=shot?.id.startsWith('move-')?shot.id.slice(5):shot?.id.startsWith('pair-')?shot.id.slice(5):null;
  const connection=state.active[0]??(movingId?analysis.connections.find(c=>c.wire.id===movingId):undefined);
  const showTitle=state.kind==='opening'||!!connection||shot?.id==='all'||state.kind==='final';
  const captionOpacity=this.connectionCaptionOpacity(state,connection);
  if(!showTitle||captionOpacity<=0)return;
  const accentColor=new THREE.Color(connection?.wire.color??'#63c4a2');
  const hsl={h:0,s:0,l:0};accentColor.getHSL(hsl);
  if(hsl.l<.4)accentColor.lerp(new THREE.Color('#b8c6ce'),.55);
  const accent=`#${accentColor.getHexString()}`;
  if(settings.hudStyle==='futuristic'||settings.hudStyle==='minimal'){this.drawModernOverlay(state,shot,connection,captionOpacity,captionPalette(settings),accent);return}
  ctx.save();ctx.scale(scale,scale);ctx.globalAlpha=Math.max(0,Math.min(1,captionOpacity));
  const compact=settings.labels==='minimal';
  const isFinal=state.kind==='final';
  const width=isFinal?520:connection?(compact?540:760):shot?.id==='all'?760:520;
  const height=isFinal?92:connection?(compact?112:196):shot?.id==='all'?Math.min(330,126+Math.ceil(Math.min(analysis.connections.length,8)/2)*34):104;
  const {x,y}=this.resolveOverlayRect(state,shot,connection,width,height);this.overlayRects[state.shotId]={x,y,width,height};
  const route=connection?.points??analysis.connections.flatMap(c=>c.points.filter((_,i)=>i%8===0));const routePixels=route.map(p=>{const q=p.clone().project(this.camera);return {x:(q.x+1)*960,y:(1-q.y)*540}});const routeHits=routePixels.filter(p=>p.x>=x&&p.x<=x+width&&p.y>=y&&p.y<=y+height).length;this.overlayRouteHits[state.shotId]=routeHits;const diagnostic=this.cameraDiagnostics.find(d=>d.shotId===state.shotId);if(diagnostic){diagnostic.overlay={x,y,width,height};diagnostic.overlayRouteHits=routeHits}
  ctx.shadowColor='rgba(0,0,0,.46)';ctx.shadowBlur=30;ctx.shadowOffsetY=12;
  ctx.fillStyle=panel;ctx.beginPath();ctx.roundRect(x,y,width,height,13);ctx.fill();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle=line;ctx.lineWidth=1.3;ctx.stroke();
  ctx.save();ctx.beginPath();ctx.roundRect(x,y,width,height,13);ctx.clip();ctx.fillStyle=accent;ctx.fillRect(x,y,width,4);ctx.restore();
  ctx.fillStyle=accent;ctx.beginPath();ctx.arc(x+26,y+27,4,0,Math.PI*2);ctx.fill();
  const header=connection?'CONNECTION':shot?.id==='all'?'CONNECTIONS':isFinal?settings.closingLabel==='connection-summary'?'CIRCUIT SUMMARY':'PROJECT COMPLETE':'PROJECT';
  ctx.fillStyle=secondary;ctx.font='600 15px "IBM Plex Mono", monospace';ctx.fillText(header,x+42,y+32);
  const counter=connection?`${String(analysis.connections.findIndex(c=>c.wire.id===connection.wire.id)+1).padStart(2,'0')} / ${String(analysis.connections.length).padStart(2,'0')}`:isFinal?`${analysis.connections.length} NETS`:'';if(counter){ctx.textAlign='right';ctx.fillText(counter,x+width-24,y+32);ctx.textAlign='left'}
  const headerWidth=ctx.measureText(header).width;this.hudDiagnostics[state.shotId]={style:settings.hudStyle,theme:captionPalette(settings).surfaceTop==='#FFFFFF'?'light':'dark',x,y,width,height,header,counter,main:'',subtitle:'',opacity:captionOpacity,status:{x:x+22,y:y+23,width:8,height:8},headerRect:{x:x+42,y:y+18,width:headerWidth,height:18}};
  const fitted=(value:string,atX:number,atY:number,maxWidth:number,size:number,minSize=15)=>{
   let fontSize=size;do{ctx.font=`600 ${fontSize}px Arial, sans-serif`;if(ctx.measureText(value).width<=maxWidth)break;fontSize--}while(fontSize>=minSize);
   if(ctx.measureText(value).width>maxWidth){while(value.length>1&&ctx.measureText(`${value}\u2026`).width>maxWidth)value=value.slice(0,-1);value+='\u2026'}
   ctx.fillText(value,atX,atY);
  };
  ctx.fillStyle=ink;
  if(!connection){
   if(isFinal){const title=settings.closingLabel==='connection-summary'?`${analysis.connections.length} CONNECTIONS COMPLETE`:`${analysis.name} — Complete`,subtitle=settings.closingLabel==='connection-summary'?analysis.name:`${analysis.connections.length} saved connections`;fitted(title,x+30,y+64,width-60,25,16);ctx.fillStyle=secondary;fitted(subtitle,x+30,y+84,width-60,14,11);ctx.restore();return}
   fitted(state.kind==='opening'?analysis.name:'All connections',x+30,y+72,width-60,31,19);
   if(shot?.id==='all'){ctx.fillStyle=line;ctx.fillRect(x+30,y+90,width-60,1);analysis.connections.slice(0,8).forEach((c,i)=>{const col=i%2,row=Math.floor(i/2),atX=x+34+col*350,atY=y+120+row*34;const color=new THREE.Color(c.wire.color);if(color.getHSL({h:0,s:0,l:0}).l<.4)color.lerp(new THREE.Color('#b8c6ce'),.55);ctx.fillStyle=`#${color.getHexString()}`;ctx.beginPath();ctx.arc(atX,atY-5,5,0,Math.PI*2);ctx.fill();ctx.fillStyle=ink;fitted(c.wire.label,atX+16,atY,320,19,15)});if(analysis.connections.length>8){ctx.fillStyle=secondary;ctx.font='500 17px Arial';ctx.fillText(`+ ${analysis.connections.length-8} more connections`,x+34,y+height-18)}}
   ctx.restore();return;
  }
  if(compact){
   const pinLabel=(value:string)=>{const aliases=value.split(' [')[0].split(' / ');return aliases.find(p=>/GPIO|VBUS|GND|5V/i.test(p))??aliases[0]};
   const from=pinLabel(connection.sourcePin),rawDestination=pinLabel(connection.destinationPin),to=/^D[+-]$/.test(rawDestination)?`USB ${rawDestination}`:rawDestination;
   fitted(`${from}  →  ${to}`,x+28,y+70,width-56,32,18);
   ctx.fillStyle=secondary;fitted(`${connection.sourceComponent}  →  ${connection.destinationComponent}`,x+28,y+96,width-56,18,13);
   ctx.restore();return;
  }
  fitted(connection.wire.label,x+30,y+68,width-60,28,17);
  ctx.strokeStyle=line;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+30,y+82);ctx.lineTo(x+width-30,y+82);ctx.stroke();
  const endpoints=[{role:'FROM',component:connection.sourceComponent,pin:connection.sourcePin},{role:'TO',component:connection.destinationComponent,pin:connection.destinationPin}];
  endpoints.forEach((e,i)=>{const atX=x+30+i*449;
   ctx.fillStyle=secondary;ctx.font='600 16px "DM Mono", monospace';ctx.fillText(e.role,atX,y+111);
   ctx.fillStyle=ink;fitted(e.component,atX,y+140,330,23,15);
   ctx.fillStyle=secondary;fitted(e.pin,atX,y+168,330,20,13);
  });
  ctx.fillStyle=accent;ctx.font='600 27px Arial, sans-serif';ctx.fillText('\u2192',x+364,y+142);
  ctx.restore();
 }

 dispose(){this.owned.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());for(const outline of this.wireOutlines.values()){outline.geometry.dispose();outline.material.dispose()}this.wireOutlines.clear();this.floor?.geometry.dispose();(this.floor?.material as THREE.Material|undefined)?.dispose();this.grid?.geometry.dispose();if(this.grid){const materials=Array.isArray(this.grid.material)?this.grid.material:[this.grid.material];materials.forEach(m=>m.dispose())}this.backgroundTexture?.dispose();this.scene.clear();this.renderer.dispose();this.renderer.forceContextLoss();this.canvas.width=1;this.canvas.height=1}
}
export async function prepareCinematic(project:Project,settings:VideoSettings,selected:string[]){
 const previous=useGraphics.getState().exporting;useGraphics.getState().setExporting(true);
 try{await Promise.all([...exportPreparers].map(fn=>fn('medium')));await nextPaint();return new CinematicRenderer(project,{...settings,width:1280},selected)}finally{useGraphics.getState().setExporting(previous)}
}
export async function validateVideo(blob:Blob){
 const url=URL.createObjectURL(blob),video=document.createElement('video');video.preload='auto';video.muted=true;
 try{return await new Promise<{width:number;height:number;duration:number}>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Exported video could not be decoded for validation.')),30000);video.onloadeddata=()=>{clearTimeout(timer);resolve({width:video.videoWidth,height:video.videoHeight,duration:video.duration})};video.onerror=()=>{clearTimeout(timer);reject(new Error('The finalized video could not be decoded.'))};video.src=url})}finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url)}
}
export async function exportCinematic(project:Project,settings:VideoSettings,selected:string[],onProgress:(p:Progress)=>void,signal?:AbortSignal,file?:VideoFile){
 if(running)throw new Error('A video export is already running.');running=true;
 let renderer:CinematicRenderer|undefined,output:Output|undefined,source:CanvasSource|undefined;const previous=useGraphics.getState().exporting;
 const progress=(stage:string,frame=0,total=0)=>onProgress({stage,frame,total,percent:total?100*frame/total:0});
 try{
  canceled(signal);analyzeCircuit(project,settings,selected);progress('Checking encoder support');
  if(settings.backgroundPresetId==='transparent'&&settings.format!=='png')throw new Error('Transparent output has alpha only as numbered RGBA PNG frames. Choose PNG frame sequence; MP4/H.264 and WebM export opaque video.');
  const caps=settings.format==='png'?null:await videoCapabilities(settings);
  if(caps&&!caps[settings.format as 'mp4'|'webm'])throw new Error(`${settings.format.toUpperCase()} encoding is unavailable at this resolution/FPS. Choose ${caps.webm?'WebM or ':''}PNG frame sequence in Video settings.`);
  canceled(signal);progress('Preparing original high-detail CAD');useGraphics.getState().setExporting(true);
  await Promise.all([...exportPreparers].map(fn=>fn('high')));await nextPaint();canceled(signal);
  renderer=new CinematicRenderer(project,settings,selected);const sequence=renderer.sequence,total=Math.ceil(sequence.duration*settings.fps);if(!total)throw new Error('The video timeline is empty. Increase a duration.');
  const chunks:Uint8Array<ArrayBuffer>[]=[];let bytes=0,zip:Zip|undefined;
  if(settings.format==='png')zip=new Zip((err,data)=>{if(err)throw err;bytes+=data.byteLength;if(bytes>MAX_BUFFER)throw new Error('PNG ZIP exceeds the 512 MB download limit. Shorten the sequence.');chunks.push(new Uint8Array(data) as Uint8Array<ArrayBuffer>)});
  const buffer=new BufferTarget();
  if(settings.format!=='png'){
   const target=file?new StreamTarget(new WritableStream({write:chunk=>file.write(chunk)}),{chunked:true,chunkSize:4*1024*1024}):buffer;
   target.onwrite=(_start,end)=>{if(!file&&end>MAX_BUFFER)throw new Error('Video exceeds the 512 MB download memory limit. Enable Save directly to file or shorten the video.');canceled(signal)};
   output=new Output({format:settings.format==='mp4'?new Mp4OutputFormat({fastStart:'fragmented'}):new WebMOutputFormat(),target});
   source=new CanvasSource(renderer.canvas,{codec:settings.format==='mp4'?'avc':'vp9',bitrate:settings.width>=3840?40_000_000:12_000_000});
   output.addVideoTrack(source,{frameRate:settings.fps});await output.start();
  }
  const start=performance.now();let peakHeap=0;
  for(let frame=0;frame<total;frame++){
   canceled(signal);renderer.render(frame/settings.fps);
   if(source)await source.add(frame/settings.fps,1/settings.fps,{keyFrame:frame%(settings.fps*2)===0});
   else{const blob=await new Promise<Blob>((resolve,reject)=>renderer!.canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG frame allocation failed.')),'image/png'));const entry=new ZipPassThrough(`frame-${String(frame).padStart(6,'0')}.png`);zip!.add(entry);entry.push(new Uint8Array(await blob.arrayBuffer()),true)}
   peakHeap=Math.max(peakHeap,(performance as Performance&{memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize??0);
   progress('Rendering and encoding',frame+1,total);if(frame%4===0)await new Promise(r=>setTimeout(r,0));
  }
  canceled(signal);progress('Finalizing container',total,total);source?.close();await output?.finalize();zip?.end();canceled(signal);
  const blob=file?undefined:new Blob(settings.format==='png'?chunks:[buffer.buffer!],{type:settings.format==='mp4'?'video/mp4':settings.format==='webm'?'video/webm':'application/zip'});
  if(blob&&settings.format!=='png'){progress('Validating playable video',total,total);const validation=await validateVideo(blob);if(validation.width!==settings.width||validation.height!==settings.width*9/16||!(validation.duration>0))throw new Error('Video validation failed: unexpected dimensions or duration.');}
  if(file)await file.close();
  progress('Complete',total,total);return {blob,filename:videoFilename(project.name,settings),sequence,frames:total,renderSeconds:(performance.now()-start)/1000,peakHeap};
 }catch(error){try{await output?.cancel()}catch{/* already finalized */}if(file)try{await file.abort()}catch{/* closed */}throw error}finally{source?.close();renderer?.dispose();useGraphics.getState().setExporting(previous);running=false}
}
export function downloadVideo(blob:Blob,filename:string){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
