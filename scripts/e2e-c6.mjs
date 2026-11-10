import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1920,height:1080},acceptDownloads:true}),errors=[];
let storeUrl,threeUrl;page.on('request',r=>{if(r.url().includes('/src/store.ts'))storeUrl=r.url();if(r.url().includes('/three.js'))threeUrl=r.url()});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
try{
 await page.goto('http://localhost:5173/');await page.locator('.asset-card').filter({has:page.locator('.asset-name').getByText('ESP32-C6 Supermini',{exact:true})}).click();
 await page.waitForFunction(()=>{let ready=false;window.__circuitExportState?.scene.traverse(o=>{if(o.userData.modelId==='esp32-c6-supermini')ready=true});return ready});assert.equal(await page.locator('[data-c6-pin]').count(),27);
 await page.getByRole('textbox',{name:'Find C6 pin'}).fill('USB D+');assert.equal(await page.locator('[data-c6-pin]').count(),1);assert.equal(await page.locator('[data-c6-pin]').getAttribute('data-c6-pin'),'PAD-GPIO13');await page.getByRole('textbox',{name:'Find C6 pin'}).fill('');
 const report=await page.evaluate(async({storeUrl,threeUrl})=>{
  const {useEditor}=await import(storeUrl),THREE=await import(threeUrl),{worldPin,worldPinDirection}=await import('/src/geometry.ts');const s=useEditor.getState(),c=s.project.components.find(c=>c.modelId==='esp32-c6-supermini'),scene=window.__circuitExportState.scene;scene.updateMatrixWorld(true);
  const meshes=[];scene.traverse(o=>{if(o.userData.modelId==='esp32-c6-supermini')o.traverse(m=>{if(m.isMesh)meshes.push(m)})});
  const contacts=c.pins.map(p=>{const anchor=worldPin(p,c),dir=worldPinDirection(p,c),ray=new THREE.Raycaster(anchor.clone().add(dir),dir.clone().negate(),0,2),hits=[];for(const mesh of meshes)THREE.Mesh.prototype.raycast.call(mesh,ray,hits);hits.sort((a,b)=>a.distance-b.distance);if(!hits.length)throw new Error(`Missing physical contact ${p.id}`);return {id:p.id,label:p.label,surfaceErrorMm:hits[0].point.distanceTo(anchor)}});return {contacts,triangles:c.geometry.triangleCount};
 },{storeUrl,threeUrl});
 for(const c of report.contacts)assert.ok(c.surfaceErrorMm<.02,`${c.id}: ${c.surfaceErrorMm}`);
 await page.getByRole('button',{name:'Calibrate pins',exact:true}).click();assert.equal(await page.locator('.pinout-calibration input').count(),81);await page.getByRole('button',{name:'Exit calibration',exact:true}).click();
 await page.getByRole('button',{name:'Connect C6 J1-2',exact:true}).click();await page.locator("button[data-component-id='external-5v'][data-pin-id='GND']").evaluate(el=>el.click());
 await page.getByRole('button',{name:'Connect C6 J1-1',exact:true}).click();await page.locator("button[data-component-id='external-5v'][data-pin-id='OUT+']").evaluate(el=>el.click());assert.equal(await page.locator('.connection-row').count(),7);
 await page.evaluate(async url=>{const {useEditor}=await import(url),s=useEditor.getState(),c=s.project.components.find(c=>c.modelId==='esp32-c6-supermini');s.select(c.id);const state=window.__circuitExportState,root=state.scene.__r3f.root.getState();root.controls.target.set(0,55,0);state.camera.position.set(0,55,55);root.controls.update();root.invalidate()},storeUrl);await page.waitForTimeout(500);await page.screenshot({path:'artifacts/c6-editor-top.png'});
 await page.getByRole('button',{name:'Rotate X +90 degrees',exact:true}).click();
 report.transformed=await page.evaluate(async({storeUrl,threeUrl})=>{const {useEditor}=await import(storeUrl),THREE=await import(threeUrl),{worldPin}=await import('/src/geometry.ts');const s=useEditor.getState(),c=s.project.components.find(c=>c.modelId==='esp32-c6-supermini');window.__circuitExportState.scene.updateMatrixWorld(true);let maxError=0;window.__circuitExportState.scene.traverse(o=>{if(o.userData.componentId===c.id&&o.userData.pinId){const p=c.pins.find(p=>p.id===o.userData.pinId);maxError=Math.max(maxError,o.getWorldPosition(new THREE.Vector3()).distanceTo(worldPin(p,c)))}});return {rotation:c.rotation,maxMarkerErrorMm:maxError}}, {storeUrl,threeUrl});assert.ok(report.transformed.maxMarkerErrorMm<.0001);
 for(const [name,path] of [['Save','artifacts/c6.c3dproj'],['Package','artifacts/c6.c3dzip']]){
  const [file]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name,exact:true}).click()]);await file.saveAs(path);const fresh=await browser.newContext(),p=await fresh.newPage();await p.route('**/models/**',r=>r.abort());await p.goto('http://localhost:5173/');await p.locator('input[type=file]').setInputFiles(path);await p.waitForFunction(()=>{let ready=false;window.__circuitExportState?.scene.traverse(o=>{if(o.userData.modelId==='esp32-c6-supermini')ready=true});return ready});assert.equal(await p.locator('.connection-row').count(),7);await fresh.close();
 }
 assert.deepEqual(errors,[]);await fs.writeFile('artifacts/c6-pin-verification.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close()}
