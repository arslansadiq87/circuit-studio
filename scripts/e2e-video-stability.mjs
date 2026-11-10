import {chromium} from 'playwright';
import sharp from 'sharp';
import {strict as assert} from 'node:assert';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const sampleFrames=[10.9,11.2,11.3,11.7,16.5,16.8,17.7,18.5].map(time=>Math.round(time*30));
const frameTimes=sampleFrames.map(frame=>frame/30);
const mp4Path='artifacts/sprint4-tutorial-1080p30.mp4';
const outputRoot='artifacts/sprint46-after';
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1920,height:1080}});
page.setDefaultTimeout(120000);
let threeUrl;
page.on('request',request=>{if(request.url().includes('/three.js'))threeUrl=request.url()});

try{
 await page.goto('http://localhost:5173/');
 await page.waitForFunction(()=>{let found=false;window.__circuitExportState?.scene.traverse(o=>{if(o.userData.cadVisual)found=true});return found});
 const result=await page.evaluate(async ({times,threeUrl})=>{
  const {useEditor}=await import('/src/store.ts');
  const {CinematicRenderer}=await import('/src/videoExport.ts');
  const {defaultVideoSettings,evaluatePresentationAt}=await import('/src/cinematic.ts');
  const {exportPreparers}=await import('/src/RuntimeModel.tsx');
  const {useGraphics}=await import('/src/graphics.ts');
  const project=useEditor.getState().project,projectBefore=JSON.stringify(project);
  useGraphics.getState().setExporting(true);
  await Promise.all([...exportPreparers].map(prepare=>prepare('high')));
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const settings={...defaultVideoSettings,width:1920,backgroundPresetId:'dark-studio'};
  const renderer=new CinematicRenderer(project,settings,[]);
  const board=renderer.scene.children.find(object=>object.userData.componentId==='esp32');
  const cadMeshes=[];
  board?.traverse(object=>{if(object.isMesh)cadMeshes.push(object)});
  const cadVisuals=[];
  board?.traverse(object=>{if(object.userData.cadVisual)cadVisuals.push({modelId:object.userData.modelId,lod:object.userData.lod})});
  const fingerprint=()=>cadMeshes.flatMap(mesh=>(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(material=>({mesh:mesh.name||mesh.uuid,material:material.name||material.uuid,color:material.color?.getHexString?.()??null,emissive:material.emissive?.getHexString?.()??null,emissiveIntensity:material.emissiveIntensity??null,metalness:material.metalness??null,roughness:material.roughness??null,opacity:material.opacity,transparent:material.transparent,visible:mesh.visible,map:material.map?.uuid??null,mapColorSpace:material.map?.colorSpace??null,normalMap:material.normalMap?.uuid??null,roughnessMap:material.roughnessMap?.uuid??null})));
  const lights=()=>{const values=[];renderer.scene.traverse(object=>{if(object.isLight)values.push({type:object.type,color:object.color?.getHexString?.()??null,intensity:object.intensity,position:object.position.toArray(),castShadow:object.castShadow,shadowBias:object.shadow?.bias??null})});return values};
  const sourceRenderer=window.__circuitExportState.renderer;
  const rendererConfig={outputColorSpace:renderer.renderer.outputColorSpace,toneMapping:renderer.renderer.toneMapping,toneMappingExposure:renderer.renderer.toneMappingExposure,shadowMapEnabled:renderer.renderer.shadowMap.enabled,width:renderer.renderer.domElement.width,height:renderer.renderer.domElement.height};
  const sourceRendererConfig={outputColorSpace:sourceRenderer.outputColorSpace,toneMapping:sourceRenderer.toneMapping,toneMappingExposure:sourceRenderer.toneMappingExposure};
  const three=await import(threeUrl);
  const boardBounds=new three.Box3().setFromObject(board);
  const boardCenter=boardBounds.getCenter(new three.Vector3());
  const pcb= cadMeshes.find(mesh=>mesh.name==='PCB1_1');
  const fixedShot=renderer.sequence.shots.find(shot=>shot.id==='wire-wire-vbus');
  const fixedPose=fixedShot?.cameraEnd;
  if(!pcb||!fixedPose)throw new Error('Expected imported ESP32 PCB mesh and stable video camera pose were not found.');
  renderer.camera.position.set(...fixedPose.position);renderer.camera.lookAt(new three.Vector3(...fixedPose.target));renderer.camera.updateMatrixWorld(true);
  pcb.updateWorldMatrix(true,false);
  const pcbBounds=new three.Box3().setFromObject(pcb),projected=[];
  for(const x of [pcbBounds.min.x,pcbBounds.max.x])for(const y of [pcbBounds.min.y,pcbBounds.max.y])for(const z of [pcbBounds.min.z,pcbBounds.max.z]){const point=new three.Vector3(x,y,z).project(renderer.camera);projected.push({x:(point.x+1)*960,y:(1-point.y)*540})}
  const crop={left:Math.max(0,Math.floor(Math.min(...projected.map(p=>p.x)))),top:Math.max(0,Math.floor(Math.min(...projected.map(p=>p.y)))),right:Math.min(1920,Math.ceil(Math.max(...projected.map(p=>p.x)))),bottom:Math.min(1080,Math.ceil(Math.max(...projected.map(p=>p.y))))};
  const raycaster=new three.Raycaster(),points=[];
  for(let row=1;row<25;row++)for(let col=1;col<35;col++){
   const x=Math.round(crop.left+(crop.right-crop.left)*col/35),y=Math.round(crop.top+(crop.bottom-crop.top)*row/25);
   raycaster.setFromCamera(new three.Vector2(x/960-1,1-y/540),renderer.camera);
   const hit=raycaster.intersectObject(renderer.scene,true)[0];
   if(hit?.object===pcb)points.push([x,y]);
  }
  if(points.length<20)throw new Error(`Only ${points.length} visible PCB surface sample points were found.`);
  const sampler=document.createElement('canvas');sampler.width=1920;sampler.height=1080;const sampleContext=sampler.getContext('2d',{willReadFrequently:true});
  const surfacePixels=()=>{sampleContext.drawImage(renderer.renderer.domElement,0,0);const image=sampleContext.getImageData(0,0,1920,1080).data;return points.map(([x,y])=>{const i=(y*1920+x)*4;return [image[i],image[i+1],image[i+2]]})};
  const meanRgb=pixels=>pixels[0].map((_,channel)=>pixels.reduce((sum,pixel)=>sum+pixel[channel],0)/pixels.length);
  const mae=(a,b)=>a.reduce((sum,pixel,i)=>sum+pixel.reduce((s,value,ch)=>s+Math.abs(value-b[i][ch]),0),0)/(a.length*3);
  const originalMaterials=fingerprint(),originalLights=lights(),initialProject=JSON.stringify(project);
  const materialsByTime=[],pixelRows=[],directFrames=[],fixedFrames=[];
  for(const time of times){
   renderer.render(time);
   const shot=renderer.sequence.shots.find(candidate=>time>=candidate.start&&time<candidate.start+candidate.duration);
   const cameraDistance=renderer.camera.position.distanceTo(boardCenter);
   const actualPng=renderer.canvas.toDataURL('image/png');
   const current=fingerprint();materialsByTime.push({time,shotId:shot?.id,lod:cadVisuals,materials:current,lights:lights(),cameraPosition:renderer.camera.position.toArray(),cameraDistance});
   renderer.camera.position.set(...fixedPose.position);renderer.camera.lookAt(new three.Vector3(...fixedPose.target));renderer.camera.updateMatrixWorld(true);renderer.renderer.render(renderer.scene,renderer.camera);
   pixelRows.push({time,pixels:surfacePixels()});
   directFrames.push({time,data:actualPng});
   fixedFrames.push({time,data:renderer.renderer.domElement.toDataURL('image/png')});
  }
  const sequential=[...pixelRows];
  const order=[18.5,11.3,16.5,10.9];
  const independent=[];
  for(const time of order){renderer.render(time);renderer.camera.position.set(...fixedPose.position);renderer.camera.lookAt(new three.Vector3(...fixedPose.target));renderer.camera.updateMatrixWorld(true);renderer.renderer.render(renderer.scene,renderer.camera);independent.push({time,pixels:surfacePixels()})}
  const independentMae=independent.map(row=>({time:row.time,mae:mae(row.pixels,sequential.find(s=>s.time===row.time).pixels)}));
  const crossTimeMae=sequential.map(row=>({time:row.time,mae:mae(row.pixels,sequential[0].pixels),meanRgb:meanRgb(row.pixels)}));
  const finalShot=renderer.sequence.shots.find(shot=>shot.kind==='final');
  let closing={configuredFinalHold:renderer.sequence.settings.finalHold,actualFinalDuration:finalShot?.duration??0,entranceSeconds:.22,fullOpacitySeconds:0,startOpacity:null,entranceCompleteOpacity:null,endOpacity:null,endProgress:null,diag:null,entranceFrame:null,endFrame:null};
  if(finalShot){
   const enterAt=Math.min(finalShot.duration,.22),endAt=Math.max(0,finalShot.duration-.001);
   renderer.render(finalShot.start);closing.startOpacity=renderer.hudDiagnostics.final?.opacity??0;
   renderer.render(finalShot.start+enterAt);closing.entranceCompleteOpacity=renderer.hudDiagnostics.final?.opacity??0;closing.entranceFrame=renderer.canvas.toDataURL('image/png');
   renderer.render(finalShot.start+endAt);closing.endOpacity=renderer.hudDiagnostics.final?.opacity??0;closing.endProgress=Object.values(evaluatePresentationAt(renderer.sequence,renderer.sequence.duration-.001).progress);closing.diag=renderer.hudDiagnostics.final??null;closing.endFrame=renderer.canvas.toDataURL('image/png');
   closing.fullOpacitySeconds=Math.max(0,finalShot.duration-enterAt);
  }
  const backgrounds=[];
  for(const backgroundPresetId of ['dark-studio','pure-white','neutral-gray']){renderer.updateSettings({...renderer.sequence.settings,backgroundPresetId});renderer.render(times[0]);backgrounds.push({backgroundPresetId,fingerprint:fingerprint()})}
  renderer.updateSettings({...renderer.sequence.settings,backgroundPresetId:'dark-studio'});renderer.render(renderer.sequence.duration-.001);
  const groundWires=['wire-ground','wire-common-ground'].map(id=>{const wire=renderer.wires.get(id),outline=renderer.wireOutlines.get(id);return {id,color:wire?.material.color.getHexString(),emissive:wire?.material.emissive.getHexString(),emissiveIntensity:wire?.material.emissiveIntensity,outlineColor:outline?.material.color.getHexString(),outlineMaterial:outline?.material.type,outlineVisible:outline?.visible,outlineOpacity:outline?.material.opacity}});
  const projectUnchanged=JSON.stringify(useEditor.getState().project)===initialProject;
  const rendererIds=renderer.renderer.uuid;
  const duplicatePairs=[];
  for(let i=0;i<cadMeshes.length;i++)for(let j=i+1;j<cadMeshes.length;j++)if(cadMeshes[i].geometry.uuid===cadMeshes[j].geometry.uuid&&cadMeshes[i].matrixWorld.elements.every((v,index)=>Math.abs(v-cadMeshes[j].matrixWorld.elements[index])<1e-8))duplicatePairs.push([cadMeshes[i].name,cadMeshes[j].name]);
  const result={duration:renderer.sequence.duration,order:renderer.sequence.analysis.connections.map(connection=>connection.wire.id),frameTimes:times,cad:{componentId:'esp32',visuals:cadVisuals,meshCount:cadMeshes.length,pcbMesh:pcb.name,pcbTriangles:(pcb.geometry.index?.count??pcb.geometry.attributes.position.count)/3,exactOverlappingGeometryPairs:duplicatePairs,cameraDistance:renderer.camera.position.distanceTo(boardCenter),visiblePcbSamplePoints:points.length,sampleBounds:crop},rendererConfig,sourceRendererConfig,originalMaterials,originalLights,materialsByTime,pixelRows:crossTimeMae,independentMae,directFrames,fixedFrames,backgrounds,groundWires,closing,projectUnchanged,rendererIds,settings};
  renderer.dispose();result.disposed={canvasSize:[renderer.canvas.width,renderer.canvas.height],contextLost:renderer.renderer.getContext().isContextLost()};
  return result;
 },{times:frameTimes,threeUrl});

 await fs.mkdir(`${outputRoot}/direct`,{recursive:true});await fs.mkdir(`${outputRoot}/fixed-camera`,{recursive:true});await fs.mkdir(`${outputRoot}/decoded-mp4`,{recursive:true});
 for(const frame of result.directFrames)await fs.writeFile(`${outputRoot}/direct/t-${frame.time.toFixed(1).replace('.','-')}.png`,Buffer.from(frame.data.split(',')[1],'base64'));
 for(const frame of result.fixedFrames)await fs.writeFile(`${outputRoot}/fixed-camera/t-${frame.time.toFixed(1).replace('.','-')}.png`,Buffer.from(frame.data.split(',')[1],'base64'));
 if(result.closing.entranceFrame)await fs.writeFile(`${outputRoot}/closing-title-entered.png`,Buffer.from(result.closing.entranceFrame.split(',')[1],'base64'));
 if(result.closing.endFrame)await fs.writeFile(`${outputRoot}/closing-title-final.png`,Buffer.from(result.closing.endFrame.split(',')[1],'base64'));
 delete result.directFrames;delete result.fixedFrames;delete result.closing.entranceFrame;delete result.closing.endFrame;

 const mp4Comparison=[];
 for(const time of frameTimes){
  const index=Math.round(time*30),decodedPath=`${outputRoot}/decoded-mp4/t-${time.toFixed(1).replace('.','-')}.png`,directPath=`${outputRoot}/direct/t-${time.toFixed(1).replace('.','-')}.png`;
  execFileSync('ffmpeg',['-y','-v','error','-ss',String(index/30),'-i',mp4Path,'-frames:v','1',decodedPath],{stdio:'pipe'});
  const direct=await sharp(directPath).removeAlpha().raw().toBuffer(),decoded=await sharp(decodedPath).removeAlpha().raw().toBuffer();
  assert.equal(direct.length,decoded.length,'Decoded MP4 and direct frame must use the same pixel dimensions.');
  let difference=0;for(let i=0;i<direct.length;i++)difference+=Math.abs(direct[i]-decoded[i]);
  const meanAbsoluteError=difference/direct.length;mp4Comparison.push({time,frame:index,meanAbsoluteError,direct:directPath,decoded:decodedPath});
 }
 const finalFrame=Math.ceil(result.duration*30)-1,finalTime=finalFrame/30,finalDecoded=`${outputRoot}/decoded-mp4/final.png`,finalDirect=`${outputRoot}/closing-title-final.png`;
 execFileSync('ffmpeg',['-y','-v','error','-ss',String(finalTime),'-i',mp4Path,'-frames:v','1',finalDecoded],{stdio:'pipe'});
 const finalA=await sharp(finalDirect).removeAlpha().raw().toBuffer(),finalB=await sharp(finalDecoded).removeAlpha().raw().toBuffer();let finalDifference=0;for(let i=0;i<finalA.length;i++)finalDifference+=Math.abs(finalA[i]-finalB[i]);
 mp4Comparison.push({time:finalTime,frame:finalFrame,meanAbsoluteError:finalDifference/finalA.length,direct:finalDirect,decoded:finalDecoded,finalFrame:true});
 result.mp4Comparison=mp4Comparison;
 result.acceptance={
  highLodThroughout:result.cad.visuals.length===1&&result.cad.visuals[0].lod==='high',
  unchangedCadMaterials:result.materialsByTime.every(row=>JSON.stringify(row.materials)===JSON.stringify(result.originalMaterials))&&result.backgrounds.every(row=>JSON.stringify(row.fingerprint)===JSON.stringify(result.originalMaterials)),
  unchangedLighting:result.materialsByTime.every(row=>JSON.stringify(row.lights)===JSON.stringify(result.originalLights)),
  matchingColorManagement:result.rendererConfig.outputColorSpace===result.sourceRendererConfig.outputColorSpace&&result.rendererConfig.toneMapping===result.sourceRendererConfig.toneMapping&&result.rendererConfig.toneMappingExposure===result.sourceRendererConfig.toneMappingExposure,
  pixelStableAcrossTimes:result.pixelRows.every(row=>row.mae<=2),
  pixelStableWhenRenderedOutOfOrder:result.independentMae.every(row=>row.mae<=2),
  titleHeldFullOpacityForTwoSeconds:result.closing.entranceCompleteOpacity>=.99&&result.closing.endOpacity>=.99&&result.closing.fullOpacitySeconds>=2,
  allFiveConnectionsInOrder:JSON.stringify(result.order)===JSON.stringify(['wire-dm','wire-dp','wire-ground','wire-vbus','wire-common-ground']),
  projectUnchanged:result.projectUnchanged,
  rendererDisposed:result.disposed.canvasSize[0]===1&&result.disposed.canvasSize[1]===1&&result.disposed.contextLost,
  directVsEncodedWithinTolerance:mp4Comparison.every(row=>row.meanAbsoluteError<=12),
  completedGroundWireEdgeVisible:result.groundWires.length===2&&result.groundWires.every(wire=>wire.color===wire.emissive&&wire.emissiveIntensity===0&&wire.outlineMaterial==='MeshBasicMaterial'&&wire.outlineVisible&&wire.outlineOpacity>=.3&&wire.outlineOpacity<.6),
 };
 assert.ok(result.cad.visiblePcbSamplePoints>=20,`PCB pixel regression needs at least 20 visible surface samples; got ${result.cad.visiblePcbSamplePoints}`);
 assert.ok(result.acceptance.highLodThroughout,`Offline diagnostic render must use the High CAD LOD: ${JSON.stringify(result.cad.visuals)}`);
 assert.ok(result.acceptance.unchangedCadMaterials,'An animation state or background must not alter any ESP32 CAD material.');
 assert.ok(result.acceptance.unchangedLighting,'Lighting must remain constant between sampled frames.');
 assert.ok(result.acceptance.matchingColorManagement,'Preview and export renderers must use the same color pipeline.');
 assert.ok(result.acceptance.pixelStableAcrossTimes,`Fixed-camera PCB region changed by more than 2 RGB levels: ${JSON.stringify(result.pixelRows)}`);
 assert.ok(result.acceptance.pixelStableWhenRenderedOutOfOrder,`Out-of-order timestamps changed fixed-camera PCB pixels: ${JSON.stringify(result.independentMae)}`);
 assert.ok(result.acceptance.titleHeldFullOpacityForTwoSeconds,`Final HUD must remain fully readable for 2 seconds: ${JSON.stringify(result.closing)}`);
 assert.ok(result.acceptance.allFiveConnectionsInOrder,'All five saved connections must remain in order.');
 assert.ok(result.acceptance.projectUnchanged,'Rendering must not mutate the circuit project.');
 assert.ok(result.acceptance.rendererDisposed,'Temporary renderer resources must be released after diagnostics.');
 assert.ok(result.acceptance.directVsEncodedWithinTolerance,`Direct and H.264 decoded frame error exceeded tolerance: ${JSON.stringify(mp4Comparison)}`);
 assert.ok(result.acceptance.completedGroundWireEdgeVisible,`Completed GND edges must stay visible without recoloring the electrical wire: ${JSON.stringify(result.groundWires)}`);
 await fs.writeFile(`${outputRoot}/diagnostics.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify({duration:result.duration,cad:result.cad,rendererConfig:result.rendererConfig,pixelRows:result.pixelRows,independentMae:result.independentMae,closing:result.closing,groundWires:result.groundWires,mp4Comparison:result.mp4Comparison,acceptance:result.acceptance},null,2));
}finally{await browser.close()}
