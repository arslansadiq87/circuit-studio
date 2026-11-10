import {Box3,Vector3,PerspectiveCamera,Ray,MathUtils} from 'three';
import type {Project,Wire} from './model';
import {orderedWires} from './model';
import {worldPin,worldPinDirection,worldPinWireEntry,makeWireCurve} from './geometry';
import {planAutoWires} from './autoRouting';
import {wireAnimationProgress} from './wireAnimation';
export type Vec=[number,number,number];
export type Pose={position:Vec;target:Vec};
export type BackgroundPresetId='dark-studio'|'pure-black'|'pure-white'|'light-gray'|'neutral-gray'|'studio-blue'|'green-screen'|'custom-solid'|'dark-gradient'|'light-gradient'|'custom-gradient'|'transparent';
export type GradientDirection='vertical'|'horizontal'|'diagonal';
export type HudStyle='futuristic'|'classic'|'minimal'|'none';
export type ClosingLabel='project-name'|'connection-summary'|'none';
export type VideoSettings={version:2;mode:'tutorial'|'all'|'sequential'|'selected'|'orbit';width:number;fps:24|30|60;format:'mp4'|'webm'|'png';cameraStyle:'balanced'|'elevated';reveal:number;hold:number;opening:number;closing:number;finalHold:number;labels:'minimal'|'dark'|'white'|'none';hudStyle:HudStyle;closingLabel:ClosingLabel;backgroundPresetId:BackgroundPresetId;customSolidColor:string;gradientStartColor:string;gradientEndColor:string;gradientDirection:GradientDirection;gradientPosition:number;showFloor:boolean;floorColor:string;showGrid:boolean;groundShadows:boolean;fillLightIntensity:number;rimLightIntensity:number;selectedOnly:boolean;keepCompleted:boolean;fadeUnrelated:boolean;tipGlow:boolean;overrides:Record<string,Pose>};
export const defaultVideoSettings:VideoSettings={version:2,mode:'tutorial',width:1920,fps:30,format:'mp4',cameraStyle:'balanced',reveal:1.6,hold:.7,opening:2,closing:2,finalHold:2,labels:'minimal',hudStyle:'futuristic',closingLabel:'project-name',backgroundPresetId:'dark-studio',customSolidColor:'#182B45',gradientStartColor:'#171B22',gradientEndColor:'#172A44',gradientDirection:'vertical',gradientPosition:50,showFloor:false,floorColor:'#343B45',showGrid:false,groundShadows:false,fillLightIntensity:.55,rimLightIntensity:.55,selectedOnly:false,keepCompleted:true,fadeUnrelated:true,tipGlow:true,overrides:{}};
export const videoPresets={
 'Default Tutorial':defaultVideoSettings,
 'Fast Wiring Demonstration':{...defaultVideoSettings,hudStyle:'classic' as const,reveal:.8,hold:.3,opening:1,closing:1},
 'Detailed Technical Explanation':{...defaultVideoSettings,hudStyle:'classic' as const,reveal:2.5,hold:1.5,opening:3},
 'Final Circuit Showcase':{...defaultVideoSettings,hudStyle:'classic' as const,mode:'orbit' as const,closing:5,finalHold:2},
};
export const VIDEO_BACKGROUND_PRESETS:{id:BackgroundPresetId;label:string;color?:string;gradient?:[string,string]}[]=[
 {id:'dark-studio',label:'Dark Studio',color:'#171B22'},{id:'pure-white',label:'Pure White',color:'#FFFFFF'},{id:'neutral-gray',label:'Neutral Gray Studio',color:'#777B82'},{id:'custom-solid',label:'Custom Solid Color'},{id:'pure-black',label:'Pure Black',color:'#000000'},{id:'light-gray',label:'Light Gray',color:'#D9DCE1'},{id:'studio-blue',label:'Studio Blue',color:'#172A44'},{id:'green-screen',label:'Green Screen',color:'#00FF00'},{id:'dark-gradient',label:'Dark Gradient',gradient:['#171B22','#172A44']},{id:'light-gradient',label:'Light Gradient',gradient:['#F7F8F8','#D9DCE1']},{id:'custom-gradient',label:'Custom Gradient'},{id:'transparent',label:'Transparent'}
];
export const isHexColor=(value:unknown):boolean=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value);
export function normalizeHex(value:unknown,fallback:string){return isHexColor(value)?(value as string).toUpperCase():fallback}
export function backgroundStops(settings:VideoSettings):[string,string]|null{
 if(settings.backgroundPresetId==='dark-gradient')return ['#171B22','#172A44'];
 if(settings.backgroundPresetId==='light-gradient')return ['#F7F8F8','#D9DCE1'];
 if(settings.backgroundPresetId==='custom-gradient')return [settings.gradientStartColor,settings.gradientEndColor];
 return null;
}
export function backgroundSolidColor(settings:VideoSettings):string|null{
 const preset=VIDEO_BACKGROUND_PRESETS.find(p=>p.id===settings.backgroundPresetId);
 return settings.backgroundPresetId==='custom-solid'?settings.customSolidColor:preset?.color??null;
}
export function backgroundCss(settings:VideoSettings):string{
 if(settings.backgroundPresetId==='transparent')return 'conic-gradient(#ffffff 25%,#e4e7eb 0 50%,#ffffff 0 75%,#e4e7eb 0) 0 0/16px 16px';
 const solid=backgroundSolidColor(settings);if(solid)return solid;
 const [first,second]=backgroundStops(settings)??['#171B22','#172A44'],position=settings.gradientPosition;
 const direction=settings.gradientDirection==='vertical'?'to bottom':settings.gradientDirection==='horizontal'?'to right':'to bottom right';
 return `linear-gradient(${direction}, ${first} 0%, ${first} ${Math.max(0,position-8)}%, ${second} ${Math.min(100,position+8)}%, ${second} 100%)`;
}
export function validSettings(value:unknown):VideoSettings{
 const raw=value&&typeof value==='object'?value as Record<string,unknown>:{};
 const hasSavedSettings=!!value&&typeof value==='object';
 const migrated=raw.version===1?{...raw,version:2,backgroundPresetId:raw.background==='white'?'pure-white':raw.background==='transparent'&&raw.format==='png'?'transparent':'dark-studio'}:raw;
 const s={...defaultVideoSettings,...migrated} as VideoSettings;
 if(s.version!==2)return {...defaultVideoSettings};
 if(!['tutorial','all','sequential','selected','orbit'].includes(s.mode))s.mode='tutorial';
 if(![1920,2560,3840].includes(s.width))s.width=1920;
 if(![24,30,60].includes(s.fps))s.fps=30;
 if(!['mp4','webm','png'].includes(s.format))s.format='mp4';
 if(!['minimal','dark','white','none'].includes(s.labels))s.labels='minimal';
 if(raw.hudStyle===undefined)s.hudStyle=hasSavedSettings?'classic':defaultVideoSettings.hudStyle;else if(!['futuristic','classic','minimal','none'].includes(s.hudStyle))s.hudStyle=defaultVideoSettings.hudStyle;
 if(!['project-name','connection-summary','none'].includes(s.closingLabel))s.closingLabel=defaultVideoSettings.closingLabel;
 if(!VIDEO_BACKGROUND_PRESETS.some(p=>p.id===s.backgroundPresetId))s.backgroundPresetId='dark-studio';
 if(s.backgroundPresetId==='transparent'&&s.format!=='png')s.backgroundPresetId='dark-studio';
 s.customSolidColor=normalizeHex(s.customSolidColor,defaultVideoSettings.customSolidColor);s.gradientStartColor=normalizeHex(s.gradientStartColor,defaultVideoSettings.gradientStartColor);s.gradientEndColor=normalizeHex(s.gradientEndColor,defaultVideoSettings.gradientEndColor);s.floorColor=normalizeHex(s.floorColor,defaultVideoSettings.floorColor);
 if(!['vertical','horizontal','diagonal'].includes(s.gradientDirection))s.gradientDirection='vertical';
 s.gradientPosition=Number.isFinite(s.gradientPosition)?Math.max(5,Math.min(95,s.gradientPosition)):50;
 s.showFloor=!!s.showFloor;s.showGrid=!!s.showGrid;s.groundShadows=!!s.groundShadows;
 for(const k of ['fillLightIntensity','rimLightIntensity'] as const)s[k]=Number.isFinite(s[k])?Math.max(0,Math.min(1.5,s[k])):defaultVideoSettings[k];
 if(!['balanced','elevated'].includes(s.cameraStyle))s.cameraStyle='balanced';
 for(const k of ['reveal','hold','opening','closing','finalHold'] as const)s[k]=Number.isFinite(s[k])?Math.max(k==='reveal'?.1:0,Math.min(30,s[k])):defaultVideoSettings[k];
 s.selectedOnly=!!s.selectedOnly;s.keepCompleted=s.keepCompleted!==false;s.fadeUnrelated=!!s.fadeUnrelated;s.tipGlow=!!s.tipGlow;s.overrides=s.overrides&&typeof s.overrides==='object'?s.overrides:{};
 return s;
}
export type Connection={wire:Wire;a:Vector3;b:Vector3;routeStart:Vector3;routeEnd:Vector3;sourceEntry?:ReturnType<typeof worldPinWireEntry>;destinationEntry?:ReturnType<typeof worldPinWireEntry>;points:Vector3[];label:string;source:string;destination:string;sourceComponent:string;sourceComponentId:string;sourcePin:string;sourcePinId:string;sourceElectrical?:string;destinationComponent:string;destinationComponentId:string;destinationPin:string;destinationPinId:string;destinationElectrical?:string;length:number};
export type Solid={id:string;box:Box3};
export type Analysis={connections:Connection[];solids:Solid[];bounds:Box3;name:string};
export function analyzeCircuit(project:Project,settings:VideoSettings,selected:string[]=[],actualBounds?:Map<string,Box3>):Analysis{
 const parts=new Map(project.components.filter(c=>c.visible!==false).map(c=>[c.id,c]));
 const solids=[...parts.values()].map(c=>{
  const box=actualBounds?.get(c.id)?.clone()??new Box3();
  if(box.isEmpty()){const half=new Vector3(...(c.dimensions??[28,20,8])).multiplyScalar(.5);for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const p=new Vector3(half.x*x,half.y*y,half.z*z).sub(new Vector3(...(c.geometry?.origin??[0,0,0])));const anchor={...c,pins:[]};box.expandByPoint(worldPin({id:'bounds',label:'',side:'left',index:0,localPosition:p.toArray() as Vec},anchor))}}
  return {id:c.id,box};
 });
 const connections:Connection[]=[];
 for(const wire of orderedWires({...project,wires:planAutoWires(project.wires,project.components)})){
  if(wire.visible===false||((settings.selectedOnly||settings.mode==='selected')&&!selected.includes(wire.id)))continue;
  if(wire.routingBlocked)throw new Error(`Connection "${wire.label}" could not be routed without overlap. Check its pin placement before generating a video.`);
  const ca=parts.get(wire.from.componentId),cb=parts.get(wire.to.componentId),pa=ca?.pins.find(p=>p.id===wire.from.pinId),pb=cb?.pins.find(p=>p.id===wire.to.pinId);
  if(!ca||!cb||!pa||!pb)continue;
  const a=worldPin(pa,ca),b=worldPin(pb,cb),sourceEntry=worldPinWireEntry(pa,ca),destinationEntry=worldPinWireEntry(pb,cb),curve=makeWireCurve(wire,a,b,worldPinDirection(pa,ca),worldPinDirection(pb,cb),sourceEntry,destinationEntry,project.components),routeStart=sourceEntry?sourceEntry.opening.clone().addScaledVector(sourceEntry.insertionDirection,sourceEntry.insertionDepth):a.clone(),routeEnd=destinationEntry?destinationEntry.opening.clone().addScaledVector(destinationEntry.insertionDirection,destinationEntry.insertionDepth):b.clone();
  const source=`${ca.name} Â· ${pa.label} [${pa.id}]`,destination=`${cb.name} Â· ${pb.label} [${pb.id}]`;
  connections.push({wire,a,b,routeStart,routeEnd,sourceEntry,destinationEntry,points:curve.getSpacedPoints(40),label:`${source} â†’ ${destination}`,source,destination,sourceComponent:ca.name,sourceComponentId:ca.id,sourcePin:`${pa.label} [${pa.id}]`,sourcePinId:pa.id,sourceElectrical:pa.electrical,destinationComponent:cb.name,destinationComponentId:cb.id,destinationPin:`${pb.label} [${pb.id}]`,destinationPinId:pb.id,destinationElectrical:pb.electrical,length:curve.getLength()});
 }
 const bounds=new Box3();solids.forEach(s=>bounds.union(s.box));connections.forEach(c=>c.points.forEach(p=>bounds.expandByPoint(p)));
 if(bounds.isEmpty())throw new Error('Add visible components before generating a video.');
 if(!connections.length&&settings.mode!=='orbit')throw new Error('No visible valid connections match this video selection. Select connections or choose Final Circuit Orbit.');
 return {connections,solids,bounds,name:project.name};
}
export type CameraScore={score:number;sourceVisible:boolean;destinationVisible:boolean;routeVisibility:number;margin:number;direction:Vec};
export type PlannedView={pose:Pose;quality:CameraScore};
const corners=(box:Box3)=>{const result:Vector3[]=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])result.push(new Vector3(x,y,z));return result};
export function cameraFor(pose:Pose){const c=new PerspectiveCamera(38,16/9,.1,10000);c.position.set(...pose.position);c.up.set(0,1,0);c.lookAt(new Vector3(...pose.target));c.updateMatrixWorld(true);return c}
function frame(points:Vector3[],direction:Vector3):Pose{
 const bounds=new Box3().setFromPoints(points),target=bounds.getCenter(new Vector3()),camera=cameraFor({position:target.clone().add(direction).toArray() as Vec,target:target.toArray() as Vec});
 const inverse=camera.quaternion.clone().invert();let distance=8;
 // Reserve the requested export safe frame: 8% sides, 10% top, 12% bottom.
 for(const p of points){const v=p.clone().sub(target).applyQuaternion(inverse);distance=Math.max(distance,v.z+Math.abs(v.x)/(Math.tan(MathUtils.degToRad(19))*16/9*.84),v.z+Math.abs(v.y)/(Math.tan(MathUtils.degToRad(19))*.78))}
 return {position:target.clone().addScaledVector(direction,distance*1.025).toArray() as Vec,target:target.toArray() as Vec};
}
function reframePoseToFit(pose:Pose,points:Vector3[]):Pose{
 const direction=new Vector3(...pose.position).sub(new Vector3(...pose.target)).normalize();return frame(points,direction);
}
function widenPose(pose:Pose,factor:number):Pose{const target=new Vector3(...pose.target),position=new Vector3(...pose.position);return {...pose,position:target.addScaledVector(position.sub(target),factor).toArray() as Vec}}
function visible(point:Vector3,position:Vector3,solids:Solid[],ignore:string[]=[]){const direction=point.clone().sub(position),distance=direction.length(),ray=new Ray(position,direction.normalize());return !solids.some(s=>{if(ignore.includes(s.id))return false;const hit=ray.intersectBox(s.box,new Vector3());return hit&&hit.distanceTo(position)<distance-1.4})}
/** Coarse boxes first, then refine the best eight views with route samples. No CAD triangle traversal. */
export function planView(analysis:Analysis,connection:Connection|undefined,previous:Pose|undefined,style:VideoSettings['cameraStyle']='balanced',focus?:'source'|'destination',overview:'full'|'components'='full'):PlannedView{
 const componentBounds=new Map(analysis.solids.map(s=>[s.id,s.box]));
 const componentUnion=new Box3();analysis.solids.forEach(s=>componentUnion.union(s.box));
 const endpoint=focus==='source'?connection?.a:focus==='destination'?connection?.b:undefined;
 const connectedBounds=connection?[componentBounds.get(connection.sourceComponentId),componentBounds.get(connection.destinationComponentId)].filter((b):b is Box3=>!!b):[];
 // Frame the complete route and both real connected parts. A route-only view
 // produces the severe board/connector crops seen in the reviewed export.
 const points=connection?[...connection.points,...connectedBounds.flatMap(corners)]:corners(overview==='components'?componentUnion:analysis.bounds);
 const focusBounds=focus==='source'?componentBounds.get(connection?.sourceComponentId??''):focus==='destination'?componentBounds.get(connection?.destinationComponentId??''):undefined;
 const focusSubject=endpoint&&focusBounds?focusBounds.clone().intersect(new Box3(endpoint.clone().addScalar(-7),endpoint.clone().addScalar(7))):undefined;
 const subject=endpoint&&focusBounds?corners(focusSubject&&!focusSubject.isEmpty()?focusSubject:focusBounds):points;
 // Match the editor's upright workbench orientation for opening and closing views.
 const oldDirection=previous?new Vector3(...previous.position).sub(new Vector3(...previous.target)).normalize():new Vector3(0,-115,144).normalize();
 const directions:Vector3[]=[oldDirection];
 // Golden-angle sampling gives continuous azimuths and non-coplanar candidates, including underside views.
 for(let i=0;i<64;i++){const z=-.35+1.3*(i+.5)/64,azimuth=i*2.399963229728653;directions.push(new Vector3(Math.cos(azimuth)*Math.sqrt(1-z*z),Math.sin(azimuth)*Math.sqrt(1-z*z),z))}
 const candidates=(connection?directions.filter(direction=>direction.dot(oldDirection)>.55&&direction.y<-.15&&direction.z>.2):directions.filter(direction=>direction.y<-.25&&direction.z>.45)).map(direction=>{
  const pose=frame(subject,direction),camera=cameraFor(pose),projected=subject.map(p=>p.clone().project(camera));
  const margin=Math.min(...projected.map(p=>Math.min(1-Math.abs(p.x),1-Math.abs(p.y))));
  const a=connection?visible(connection.a,camera.position,analysis.solids,[connection.sourceComponentId]):true,b=connection?visible(connection.b,camera.position,analysis.solids,[connection.destinationComponentId]):true;
  const continuity=direction.dot(oldDirection),elevation=direction.z;
  const separation=connection?connection.a.clone().project(camera).distanceTo(connection.b.clone().project(camera)):1;
  const size=new Box3().setFromPoints(projected).getSize(new Vector3());
  const recognizability=analysis.solids.reduce((n,s)=>{const center=s.box.getCenter(new Vector3()).project(camera);return n+(Math.abs(center.x)<.9&&Math.abs(center.y)<.8?1:0)},0)/Math.max(1,analysis.solids.length);
  const score=(focus?(focus==='source'?+a:+b)*20:(+a + +b)*10)+margin*3+Math.min(1,separation)*2+continuity*10+recognizability+Math.min(1,size.x*size.y)+elevation*(style==='elevated'?4:1)-Math.max(0,Math.log10(camera.position.distanceTo(new Vector3(...pose.target))/500));
  return {pose,quality:{score,sourceVisible:a,destinationVisible:b,routeVisibility:1,margin,direction:direction.toArray() as Vec}};
 }).sort((a,b)=>b.quality.score-a.quality.score).slice(0,8);
 for(const candidate of candidates){if(connection&&!focus){const position=new Vector3(...candidate.pose.position);candidate.quality.routeVisibility=connection.points.filter((_,i)=>i%4===0).filter(p=>visible(p,position,analysis.solids,[connection.sourceComponentId,connection.destinationComponentId])).length/11;candidate.quality.score+=candidate.quality.routeVisibility*4}}
 return candidates.sort((a,b)=>b.quality.score-a.quality.score)[0];
}
export type Shot={id:string;kind:'opening'|'move'|'wire'|'inspect'|'closing'|'final';start:number;duration:number;cameraStart:Pose;cameraEnd:Pose;connectionIds:string[];label:string;quality?:CameraScore};
export type Sequence={shots:Shot[];duration:number;analysis:Analysis;settings:VideoSettings;warnings:string[]};
export function buildSequence(analysis:Analysis,settings:VideoSettings):Sequence{
 const shots:Shot[]=[],warnings:string[]=[];let time=0;const opening=planView(analysis,undefined,undefined,settings.cameraStyle,undefined,'components').pose,overview=widenPose(planView(analysis,undefined,opening,settings.cameraStyle).pose,1.03);let previous=opening;
 const add=(id:string,kind:Shot['kind'],duration:number,pose:Pose,ids:string[]=[],label='',quality?:CameraScore)=>{
  const override=settings.overrides[id];if(override){if([override.position,override.target].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))&&new Vector3(...override.position).distanceTo(new Vector3(...override.target))>1)pose=override;else warnings.push(`Invalid camera override for ${id}; automatic view restored.`)}
  if(duration>0){shots.push({id,kind,start:time,duration,cameraStart:previous,cameraEnd:pose,connectionIds:ids,label,quality});time+=duration}previous=pose;
 };
 const ids=analysis.connections.map(c=>c.wire.id);
 add('opening','opening',settings.opening,opening,[],analysis.name);
 if(settings.mode==='orbit'){
  const angle=.22,offset=new Vector3(...overview.position).sub(new Vector3(...overview.target));offset.applyAxisAngle(new Vector3(0,0,1),angle);
  add('orbit','closing',Math.max(1,settings.closing),{...overview,position:offset.add(new Vector3(...overview.target)).toArray() as Vec},ids);
 }else if(settings.mode==='all')add('all','wire',settings.reveal+settings.hold,overview,ids,'All connections');
 else for(const connection of analysis.connections){
  let view=planView(analysis,connection,previous,settings.cameraStyle);
  if([connection.sourceElectrical,connection.destinationElectrical].some(kind=>kind==='ground'||kind==='power-in'||kind==='power-out'))view={...view,pose:reframePoseToFit(view.pose,[...connection.points,...analysis.solids.flatMap(s=>corners(s.box))])};
  if(!view.quality.sourceVisible||!view.quality.destinationVisible)warnings.push(`${connection.label}: one endpoint may be occluded in the connection overview. Inspect preview or adjust the saved camera scene.`);
  // A single paired view keeps both connected parts and the saved route together.
  add(`move-${connection.wire.id}`,'move',.8,view.pose,[connection.wire.id],connection.label,view.quality);
  const duration=settings.reveal*Math.min(1.5,Math.max(1,connection.length/180));
  add(`wire-${connection.wire.id}`,'wire',duration+settings.hold,view.pose,[connection.wire.id],connection.label,view.quality);
 }
 if(settings.mode!=='orbit')add('closing','closing',settings.closing,overview,ids);
 const hasFinalLabel=settings.labels!=='none'&&settings.hudStyle!=='none'&&settings.closingLabel!=='none';
 const finalEntrance=hasFinalLabel&&settings.finalHold>0?0.22:0;
 const readableFinalHold=hasFinalLabel&&settings.finalHold>0?Math.max(2,settings.finalHold):settings.finalHold;
 add('final','final',readableFinalHold+finalEntrance,previous,ids);
 for(const id of Object.keys(settings.overrides))if(!shots.some(s=>s.id===id))warnings.push(`Camera override ${id} has no matching shot; regenerate after circuit changes.`);
 return {shots,duration:time,analysis,settings,warnings};
}
const smooth=(x:number)=>x*x*(3-2*x);
export function evaluatePresentationAt(sequence:Sequence,timeSeconds:number){
 const time=Math.max(0,Math.min(sequence.duration,timeSeconds)),shot=sequence.shots.find(s=>time<s.start+s.duration)??sequence.shots.at(-1)!;
 const local=Math.max(0,time-shot.start),u=smooth(Math.min(1,local/(shot.kind==='inspect'?Math.min(.8,shot.duration):shot.duration)));
 // Interpolate on an exterior sphere: no straight chord through component bodies.
 const ta=new Vector3(...shot.cameraStart.target),tb=new Vector3(...shot.cameraEnd.target),target=ta.clone().lerp(tb,u);
 const va=new Vector3(...shot.cameraStart.position).sub(ta),vb=new Vector3(...shot.cameraEnd.position).sub(tb),direction=va.clone().normalize().lerp(vb.clone().normalize(),u).normalize();
 const radius=MathUtils.lerp(va.length(),vb.length(),u);
 const position=target.clone().addScaledVector(direction,radius);
 // Keep movement outside the full bounding sphere; stable reveal shots retain their close framing.
 if(shot.kind==='move'||shot.kind==='closing'||shot.kind==='inspect'){
  const center=sequence.analysis.bounds.getCenter(new Vector3()),safe=sequence.analysis.bounds.getSize(new Vector3()).length()*.55;
  const dist=position.distanceTo(center);if(u>0&&u<1&&dist<safe)position.copy(center).addScaledVector(position.clone().sub(center).normalize(),safe);
 }
 const progress:Record<string,number>=Object.fromEntries(sequence.analysis.connections.map(c=>[c.wire.id,sequence.settings.mode==='orbit'?1:0]));
 for(const s of sequence.shots){if(s.start>time)break;if(s.kind==='wire'){
  const duration=s.duration-sequence.settings.hold;
  for(const id of s.connectionIds)progress[id]=wireAnimationProgress({mode:'all',ids:s.connectionIds,startedAt:s.start*1000,durationMs:duration*1000},id,time*1000);
 }}
 const active=shot.kind==='wire'||shot.kind==='inspect'||shot.kind==='move'?sequence.analysis.connections.filter(c=>shot.connectionIds.includes(c.wire.id)):[];
 const labelOpacity=shot.kind==='final'?Math.min(1,local/.18):Math.min(1,local/.18,(shot.duration-local)/.18);
 return {shotId:shot.id,kind:shot.kind,camera:{position:position.toArray() as Vec,target:target.toArray() as Vec},progress,active,label:shot.label,labelOpacity,time};
}
export function videoFilename(name:string,settings:VideoSettings){return `${name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').trim().slice(0,110)||'Circuit'}_Wiring_${Math.round(settings.width*9/16)}p${settings.fps}.${settings.format==='png'?'zip':settings.format}`}
