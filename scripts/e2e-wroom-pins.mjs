import {chromium} from 'playwright';
import {strict as assert} from 'node:assert';
import fs from 'node:fs/promises';

const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1920,height:1080},acceptDownloads:true}),page=await context.newPage(),modules={},errors=[];
page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(90000);
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{for(const [key,path] of Object.entries({store:'/src/store.ts',three:'/three.js',geometry:'/src/geometry.ts'}))if(r.url().includes(path))modules[key]=r.url()});
const pin=(component,pin)=>page.locator(`button[data-component-id^='${component}'][data-pin-id='${pin}']`);
const report={};
try{
 await page.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
 await page.locator('.asset-card').filter({has:page.locator('.asset-name').getByText('ESP32 WROOM',{exact:true})}).click();
 await page.getByText('38 pins verified',{exact:true}).waitFor();assert.equal(await page.locator('[data-wroom-pin]').count(),38);
 await page.getByRole('textbox',{name:'Find WROOM pin'}).fill('GPIO22');assert.equal(await page.locator('[data-wroom-pin]').count(),1);assert.equal(await page.locator('[data-wroom-pin]').getAttribute('data-wroom-pin'),'P36');await page.getByRole('textbox',{name:'Find WROOM pin'}).fill('');
 await page.waitForFunction(()=>{let ready=false;window.__circuitExportState?.scene.traverse(o=>{if(o.userData.modelId==='esp32-wroom')ready=true});return ready});
 await page.getByRole('button',{name:'Wire',exact:true}).click();assert.equal(await page.locator("button[data-component-id^='esp32-wroom'][data-pin-id]").count(),38);
 report.physical=await page.evaluate(async modules=>{
  const THREE=await import(modules.three),{useEditor}=await import(modules.store),{worldPin}=await import(modules.geometry);
  const c=useEditor.getState().project.components.find(c=>c.modelId==='esp32-wroom'),state=window.__circuitExportState,root=state.scene.__r3f.root.getState(),controls=root.controls;
  state.scene.updateMatrixWorld(true);const meshes=[];state.scene.traverse(o=>{if(o.userData.modelId==='esp32-wroom')o.traverse(m=>{if(m.isMesh)meshes.push(m)})});
  let maxSurfaceError=0;for(const p of c.pins){const point=worldPin(p,c),ray=new THREE.Raycaster(point.clone().add(new THREE.Vector3(0,0,-2)),new THREE.Vector3(0,0,1),0,3),hits=[];for(const mesh of meshes)THREE.Mesh.prototype.raycast.call(mesh,ray,hits);hits.sort((a,b)=>a.distance-b.distance);if(!hits.length)throw new Error(`No metal surface at ${p.id}`);maxSurfaceError=Math.max(maxSurfaceError,hits[0].point.distanceTo(point))}
  const picked=[];controls.enableDamping=false;controls.update();for(const pose of [[0,55,-90],[35,80,-90],[-35,35,-90]]){controls.target.set(0,55,0);state.camera.position.set(...pose);state.camera.lookAt(controls.target);controls.update();state.camera.updateMatrixWorld();state.scene.updateMatrixWorld(true);let correct=0;for(const p of c.pins){const point=worldPin(p,c).project(state.camera),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(point.x,point.y),state.camera);const hits=ray.intersectObjects(state.scene.children,true);let object=hits[0]?.object;while(object){if(object.userData.pinId===p.id&&object.userData.componentId===c.id){correct++;break}object=object.parent}}picked.push(correct)}root.invalidate();
  return {pins:c.pins.length,maxSurfaceErrorMm:maxSurfaceError,pickedAtThreeAngles:picked};
 },modules);
 assert.ok(report.physical.maxSurfaceErrorMm<.005);assert.deepEqual(report.physical.pickedAtThreeAngles,[38,38,38]);console.log('All physical tip surfaces and picking verified',report.physical);
 await page.getByRole('button',{name:'Wire',exact:true}).click();await page.getByRole('button',{name:'View underside',exact:true}).click();await page.getByRole('button',{name:'Calibrate pins',exact:true}).click();assert.equal(await page.locator('.pinout-calibration input').count(),114);await page.screenshot({path:'artifacts/esp32-wroom-38-pins.png'});await page.getByRole('button',{name:'Exit calibration',exact:true}).click();
 // Ground and a general-purpose signal are created through real pin controls.
 await page.getByRole('button',{name:'Connect WROOM P38',exact:true}).click();await pin('external-5v','GND').evaluate(el=>el.click());
 await page.locator('.asset-card').filter({has:page.locator('.asset-name').getByText('Generic 4-pin module',{exact:true})}).click();await page.getByRole('button',{name:'Wire',exact:true}).click();await pin('esp32-wroom','P36').evaluate(el=>el.click());await pin('generic-module','P0').evaluate(el=>el.click());assert.equal(await page.locator('.connection-row').count(),7);
 await page.evaluate(async modules=>{const {useEditor}=await import(modules.store);const s=useEditor.getState();s.select(s.project.components.find(c=>c.modelId==='esp32-wroom').id)},modules);
 await page.locator('.inspector .field-row').filter({hasText:'Position X'}).locator('input').fill('8');await page.locator('.inspector .field-row').filter({hasText:'Rotation X'}).locator('input').fill('180');await page.locator('.inspector .field-row').filter({hasText:'Rotation Z'}).locator('input').fill('75');
 report.transformed=await page.evaluate(async modules=>{const {useEditor}=await import(modules.store),THREE=await import(modules.three),{worldPin,worldPinDirection}=await import(modules.geometry);const s=useEditor.getState(),c=s.project.components.find(c=>c.modelId==='esp32-wroom');window.__circuitExportState.scene.updateMatrixWorld(true);let maxError=0;window.__circuitExportState.scene.traverse(o=>{if(o.userData.componentId===c.id&&o.userData.pinId){const p=c.pins.find(p=>p.id===o.userData.pinId);maxError=Math.max(maxError,o.getWorldPosition(new THREE.Vector3()).distanceTo(worldPin(p,c)))}});return {maxError,pinIds:s.project.wires.filter(w=>w.from.componentId===c.id).map(w=>w.from.pinId).sort(),exitZ:worldPinDirection(c.pins[0],c).z}},modules);
 assert.ok(report.transformed.maxError<1e-6);assert.deepEqual(report.transformed.pinIds,['P36','P38']);assert.ok(report.transformed.exitZ>.99);
 for(const [name,path] of [['Save','artifacts/esp32-wroom-pins.c3dproj'],['Package','artifacts/esp32-wroom-pins.c3dzip']]){const [file]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name,exact:true}).click()]);await file.saveAs(path)}
 const saved=JSON.parse(await fs.readFile('artifacts/esp32-wroom-pins.c3dproj','utf8')),wroom=saved.components.find(c=>c.modelId==='esp32-wroom');assert.equal(wroom.pins.length,38);assert.equal(wroom.geometry.electricalMappingVerified,true);assert.ok(wroom.pins.find(p=>p.id==='P20').notes.includes('Flash-reserved'));
 for(const file of ['artifacts/esp32-wroom-pins.c3dproj','artifacts/esp32-wroom-pins.c3dzip']){
  const fresh=await browser.newContext({viewport:{width:1600,height:900}}),p=await fresh.newPage();p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));await p.route('**/models/esp32-wroom.glb',r=>r.abort());await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'Open',exact:true}).click();await p.locator('input[accept*=".c3dproj"]').setInputFiles(file);await p.getByText('Project opened',{exact:true}).waitFor();assert.equal(await p.locator('.connection-row').count(),7);await p.locator('.connection-row').filter({hasText:'GPIO22'}).last().waitFor();await fresh.close()
 }
 assert.deepEqual(errors,[]);report.errors=errors;await fs.writeFile('artifacts/esp32-wroom-pin-verification.json',JSON.stringify(report,null,2));console.log('PASS all 38 WROOM pins, electrical labels/types, 114 calibration fields, 3-angle picking, wiring, 3D transforms and portable roundtrips',JSON.stringify(report));
}finally{await browser.close()}
