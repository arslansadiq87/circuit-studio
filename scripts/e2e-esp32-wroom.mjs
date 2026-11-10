import {chromium} from 'playwright';
import {strict as assert} from 'node:assert';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:900},acceptDownloads:true}),page=await context.newPage(),errors=[];
const modules={};page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(90000);
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{for(const [key,path] of Object.entries({store:'/src/store.ts',three:'/three.js'}))if(r.url().includes(path))modules[key]=r.url()});
try{
 await page.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
 const card=page.locator('.asset-card').filter({has:page.locator('.asset-name').getByText('ESP32 WROOM',{exact:true})});await card.click();
 await page.waitForFunction(()=>{let found=false;window.__circuitExportState?.scene.traverse(o=>{if(o.userData.modelId==='esp32-wroom')found=true});return found});
 assert.equal(await page.locator('.selected-object strong').innerText(),'ESP32 WROOM');await page.getByText('38 pins verified',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Fit selected component',exact:true}).click();await page.waitForTimeout(350);await page.screenshot({path:'artifacts/esp32-wroom-editor.png'});
 const model=await page.evaluate(async modules=>{const {useEditor}=await import(modules.store),THREE=await import(modules.three);const c=useEditor.getState().project.components.find(c=>c.modelId==='esp32-wroom');let dimensions,triangles=0;window.__circuitExportState.scene.traverse(o=>{if(o.userData.modelId==='esp32-wroom'){dimensions=new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).toArray();o.traverse(mesh=>{if(mesh.isMesh)triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3})}});return {name:c.name,dimensions,triangles,pins:c.pins.length,wires:useEditor.getState().project.wires.length}},modules);
 assert.equal(model.triangles,65200);assert.equal(model.pins,38);assert.equal(model.wires,5);assert.ok(model.dimensions.every((v,i)=>Math.abs(v-[49.0463078,25.3999829,13.0000114][i])<.01));
 for(const [name,file] of [['Save','artifacts/esp32-wroom-roundtrip.c3dproj'],['Package','artifacts/esp32-wroom-roundtrip.c3dzip']]){const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name,exact:true}).click()]);await download.saveAs(file)}
 const json=JSON.parse(await fs.readFile('artifacts/esp32-wroom-roundtrip.c3dproj','utf8'));assert.ok(json.assets['url:/models/esp32-wroom.glb']);
 for(const file of ['artifacts/esp32-wroom-roundtrip.c3dproj','artifacts/esp32-wroom-roundtrip.c3dzip']){
  const fresh=await browser.newContext({viewport:{width:1600,height:900}}),restored=await fresh.newPage();restored.setDefaultTimeout(60000);restored.on('pageerror',e=>errors.push(e.message));await restored.route('**/models/esp32-wroom.glb',route=>route.abort());await restored.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});await restored.getByRole('button',{name:'Open',exact:true}).click();await restored.locator('input[accept*=".c3dproj"]').setInputFiles(file);await restored.getByText('Project opened',{exact:true}).waitFor();await restored.waitForFunction(()=>{let found=false;window.__circuitExportState?.scene.traverse(o=>{if(o.userData.modelId==='esp32-wroom')found=true});return found});assert.equal(await restored.locator('.connection-row').count(),5);await fresh.close()
 }
 assert.deepEqual(errors,[]);console.log('PASS ESP32 WROOM placement, dimensions, all 65,200 triangles, verified 38-pin status, legacy JSON and ZIP roundtrips with asset HTTP blocked',JSON.stringify(model));
}finally{await browser.close()}
