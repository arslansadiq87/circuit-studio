import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1920,height:1080},acceptDownloads:true}),page=await context.newPage(),errors=[];
let storeUrl,threeUrl;page.on('request',r=>{if(r.url().includes('/src/store.ts'))storeUrl=r.url();if(r.url().includes('/three.js'))threeUrl=r.url()});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
try{
 await page.goto('http://localhost:5173/');
 await page.waitForFunction(()=>{let ready=false;window.__circuitExportState?.scene.traverse(o=>{if(o.userData.modelId==='usb-a-female')ready=true});return ready});
 const report=await page.evaluate(async({storeUrl,threeUrl})=>{
  const {useEditor}=await import(storeUrl),THREE=await import(threeUrl),{worldPin,worldPinWireEntry}=await import('/src/geometry.ts');
  const s=useEditor.getState(),c=s.project.components.find(c=>c.id==='usb-a'),scene=window.__circuitExportState.scene;scene.updateMatrixWorld(true);
  const meshes=[],wireMeshes=new Map();scene.traverse(o=>{if(o.userData.modelId==='usb-a-female')o.traverse(m=>{if(m.isMesh)meshes.push(m)});if(o.userData.wireVisual)wireMeshes.set(o.userData.wireId,o)});
  const hitsAt=point=>{const ray=new THREE.Raycaster(point.clone().add(new THREE.Vector3(0,-1,0)),new THREE.Vector3(0,1,0),0,9),hits=[];for(const mesh of meshes)THREE.Mesh.prototype.raycast.call(mesh,ray,hits);return hits.sort((a,b)=>a.distance-b.distance)};
  const apertures=c.pins.map(p=>{const anchor=worldPin(p,c),entry=worldPinWireEntry(p,c),center=hitsAt(anchor),rim=hitsAt(anchor.clone().add(new THREE.Vector3(1.3,0,0))),insideRay=new THREE.Raycaster(entry.opening.clone().addScaledVector(entry.insertionDirection,.05),entry.insertionDirection,0,entry.insertionDepth-.05),inside=[];for(const mesh of meshes)THREE.Mesh.prototype.raycast.call(mesh,insideRay,inside);inside.sort((a,b)=>a.distance-b.distance);if(!center.length||!rim.length)throw new Error(`Missing entry ${p.id}`);return {pin:p.id,label:p.label,centerDepthMm:center[0].distance-1,rimPlaneErrorMm:Math.abs(rim[0].distance-1),entryAnchorErrorMm:entry.opening.distanceTo(anchor),insertionDepthMm:entry.insertionDepth,unobstructedInsertionMm:entry.insertionDepth-.05,insertedTipWallHits:inside.length}});
  const wireClearance=['wire-dm','wire-dp'].map(id=>{const mesh=wireMeshes.get(id),points=mesh.geometry.parameters.path.getPoints(200),hits=[];for(let i=1;i<points.length;i++){const delta=points[i].clone().sub(points[i-1]),length=delta.length(),ray=new THREE.Raycaster(points[i-1],delta.normalize(),.02,Math.max(.02,length-.02));for(const model of meshes)THREE.Mesh.prototype.raycast.call(model,ray,hits)}return {id,centerlineHousingHits:hits.length,firstHit:hits[0]?{distance:hits[0].distance,point:hits[0].point.toArray()}:null}});
  s.select(c.id);s.requestCamera('fit-selected');return {pins:c.pins.map(p=>({id:p.id,label:p.label,position:p.localPosition})),apertures,wireClearance,wires:s.project.wires.length,source:c.geometry.sourceFilename};
 },{storeUrl,threeUrl});
 assert.equal(report.wires,5);for(const aperture of report.apertures){assert.ok(aperture.centerDepthMm>aperture.insertionDepthMm+.1);assert.ok(aperture.rimPlaneErrorMm<.02);assert.ok(aperture.entryAnchorErrorMm<.001);assert.equal(aperture.insertedTipWallHits,0,'Insulation insertion must remain inside the measured open bore without hitting CAD walls')}
 for(const route of report.wireClearance)assert.equal(route.centerlineHousingHits,0,`${route.id} centerline must remain outside the USB housing before it reaches the measured terminal entry`);
 await page.getByRole('button',{name:'Top',exact:true}).click();await page.waitForTimeout(700);await page.screenshot({path:'artifacts/usb-breakout-editor.png'});
 for(const [name,path] of [['Save','artifacts/usb-breakout.c3dproj'],['Package','artifacts/usb-breakout.c3dzip']]){
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name,exact:true}).click()]);await download.saveAs(path);
  const fresh=await browser.newContext(),p=await fresh.newPage();await p.route('**/models/**',r=>r.abort());await p.goto('http://localhost:5173/');await p.locator('input[type=file]').setInputFiles(path);
  await p.waitForFunction(()=>{let ready=false;window.__circuitExportState?.scene.traverse(o=>{if(o.userData.modelId==='usb-a-female')ready=true});return ready});assert.equal(await p.locator('.connection-row').count(),5);await fresh.close();
 }
 assert.deepEqual(errors,[]);await fs.writeFile('artifacts/usb-breakout-verification.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close()}
