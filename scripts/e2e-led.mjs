import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
let storeUrl,threeUrl;page.on('request',r=>{if(r.url().includes('/src/store.ts'))storeUrl=r.url();if(r.url().includes('/three.js'))threeUrl=r.url()});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
try{
 await page.goto('http://localhost:5173/');const card=page.locator('.asset-card').filter({has:page.locator('.asset-name').getByText('3 mm LED',{exact:true})});await card.click();await page.getByLabel('LED lens color',{exact:true}).fill('#ff22aa');
 await page.waitForFunction(()=>{let ready=false;window.__circuitExportState?.scene.traverse(o=>{if(o.userData.modelId==='led')ready=true});return ready});
 await card.click();
 await page.evaluate(async url=>{const {useEditor}=await import(url),s=useEditor.getState(),leds=s.project.components.filter(c=>c.modelId==='led');s.updateComponent(leds[0].id,{position:[-5,55,0]});s.updateComponent(leds[1].id,{position:[5,55,0]});s.requestCamera('fit')},storeUrl);
 await page.waitForFunction(()=>{let n=0;window.__circuitExportState?.scene.traverse(o=>{if(o.userData.modelId==='led')n++});return n===2});
 const report=await page.evaluate(async({storeUrl,threeUrl})=>{
  const {useEditor}=await import(storeUrl),THREE=await import(threeUrl),{worldPin}=await import('/src/geometry.ts');const s=useEditor.getState(),leds=s.project.components.filter(c=>c.modelId==='led'),scene=window.__circuitExportState.scene;scene.updateMatrixWorld(true);
  const instances=leds.map(c=>{const meshes=[];scene.traverse(o=>{if(o.userData.componentId===c.id&&!o.userData.pinId)o.traverse(m=>{if(m.isMesh&&!meshes.includes(m))meshes.push(m)})});const materials=meshes.flatMap(m=>Array.isArray(m.material)?m.material:[m.material]);const lens=materials.find(m=>m.name==='LED_LENS'),metal=materials.find(m=>m.name==='mat_1');if(!lens||!metal)throw new Error('Missing lens or metal material');const errors=c.pins.map(p=>{const anchor=worldPin(p,c),ray=new THREE.Raycaster(anchor.clone().add(new THREE.Vector3(0,0,-1)),new THREE.Vector3(0,0,1),0,2),hits=[];for(const m of meshes)THREE.Mesh.prototype.raycast.call(m,ray,hits);hits.sort((a,b)=>a.distance-b.distance);if(!hits.length)throw new Error('Missing tip surface');return hits[0].point.distanceTo(anchor)});return {color:c.color,lens:lens.color.getHexString(),metal:metal.color.getHexString(),maxTipErrorMm:Math.max(...errors)}});
  const {saveLegacy,importLegacy,savePortable,openProject}=await import('/src/projectFiles.ts');const json=await importLegacy(JSON.parse(await(await saveLegacy(s.project)).text())),zip=await openProject(new File([await savePortable(s.project)],'led.c3dzip'));
  return {instances,json:json.components.filter(c=>c.modelId==='led').map(c=>c.color),zip:zip.components.filter(c=>c.modelId==='led').map(c=>c.color)};
 },{storeUrl,threeUrl});
 assert.deepEqual(report.instances.map(c=>c.lens),['ff22aa','00ff00']);assert.equal(report.instances[0].metal,report.instances[1].metal);for(const c of report.instances)assert.ok(c.maxTipErrorMm<.02);assert.deepEqual(report.json,['#ff22aa','#00ff00']);assert.deepEqual(report.zip,report.json);
 await page.evaluate(()=>{const state=window.__circuitExportState,root=state.scene.__r3f.root.getState();root.controls.target.set(0,55,1);state.camera.position.set(9,34,17);root.controls.update();root.invalidate()});await page.waitForTimeout(500);await page.screenshot({path:'artifacts/led-color-editor.png'});assert.deepEqual(errors,[]);await fs.writeFile('artifacts/led-verification.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close()}
