import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1600,height:900},acceptDownloads:true});
const page=await context.newPage();page.setDefaultTimeout(90000);const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('WebGL'))errors.push(m.text())});
try{
 await page.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
 const response=await page.request.get('http://localhost:5173/models/yd-esp32-s3-v34.glb');assert.equal(response.status(),200);const asset=await response.body();assert.equal(asset.subarray(0,4).toString(),'glTF');assert.ok(asset.length>10_000_000);
 await page.getByRole('button',{name:/ESP32-S3/}).first().click();
 await page.getByText('CAD MODEL INSPECTION',{exact:true}).waitFor();
 await page.getByRole('button',{name:/Calibrate physical pins/}).click();
 await page.getByRole('button',{name:/Exit pin calibration/}).waitFor();
 await page.getByRole('button',{name:/Wire/}).first().click();
 await page.locator("button[data-component-id^='yd-'][data-pin-id='J3-19']").waitFor();
 await page.locator("button[data-component-id^='yd-'][data-pin-id='J3-20']").waitFor();
 await page.locator("button[data-component-id^='yd-'][data-pin-id='J3-20']").evaluate(el=>el.click());await page.locator("button[data-component-id='usb-a'][data-pin-id='A2']").evaluate(el=>el.click());await page.locator('.connection-row').filter({hasText:'GPIO19 / USB D-'}).last().waitFor();
 await page.getByRole('button',{name:/Wire/}).first().click();await page.locator("button[data-component-id^='yd-'][data-pin-id='J3-19']").evaluate(el=>el.click());await page.locator("button[data-component-id='usb-a'][data-pin-id='A3']").evaluate(el=>el.click());await page.locator('.connection-row').filter({hasText:'GPIO20 / USB D+'}).last().waitFor();assert.ok(await page.locator('.connection-row').filter({hasText:'GPIO19 / USB D-'}).count()>=1);assert.ok(await page.locator('.connection-row').filter({hasText:'GPIO20 / USB D+'}).count()>=1);
 const comp=page.locator('.asset-card').filter({has:page.getByText('ESP32-S3',{exact:true})});assert.equal(await comp.count(),1);
 await page.getByRole('button',{name:'Auto Arrange'}).click();await page.locator('.inspector .field-row').filter({hasText:'Position X'}).locator('input').fill('-40');await page.locator('.inspector .field-row').filter({hasText:'Rotation Z'}).locator('input').fill('10');await page.getByRole('button',{name:'Fit camera to circuit'}).click();await page.waitForTimeout(600);await page.screenshot({path:'artifacts/sprint35-yd-cad-editor.png'});
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/Save/}).first().click()]);const projectPath='artifacts/sprint35-roundtrip.c3dproj';await download.saveAs(projectPath);const saved=JSON.parse(await fs.readFile(projectPath,'utf8'));const yd=saved.components.find(c=>c.modelId==='yd-esp32-s3-v34');assert.ok(yd);assert.equal(yd.pins.length,44);assert.equal(yd.geometry.modelUrl,'/models/yd-esp32-s3-v34.glb');assert.equal(yd.pins.find(p=>p.id==='J3-20').label,'GPIO19 / USB D-');assert.ok(saved.wires.some(w=>w.from.componentId===yd.id&&w.from.pinId==='J3-20'&&w.to.pinId==='A2'));assert.ok(saved.wires.some(w=>w.from.componentId===yd.id&&w.from.pinId==='J3-19'&&w.to.pinId==='A3'));assert.equal(yd.rotation[2],10);
 await page.getByRole('button',{name:/Export/}).first().click();await page.locator('.export-dialog select').selectOption('3840x2160');const [png]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.getByRole('button',{name:'Export PNG'}).click()]);await png.saveAs('artifacts/sprint35-yd-cad-4k.png');const fourk=await fs.readFile('artifacts/sprint35-yd-cad-4k.png');assert.equal(fourk.readUInt32BE(16),3840);assert.equal(fourk.readUInt32BE(20),2160);assert.ok(fourk.length>100_000);
 await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.deleteDatabase('circuit-studio-library');r.onsuccess=()=>resolve(true);r.onerror=()=>resolve(true);r.onblocked=()=>resolve(true)}));await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Open/}).first().click();await page.locator('input[accept*=".c3dproj"]').setInputFiles(projectPath);await page.getByText('Project opened').waitFor();const restored=await page.request.get('http://localhost:5173/models/yd-esp32-s3-v34.glb');assert.equal(restored.status(),200);await page.waitForTimeout(12000);assert.equal(await page.getByText('MODEL MISSING',{exact:true}).count(),0);
 const pngBytes=await fs.readFile('artifacts/sprint35-yd-cad-editor.png');assert.ok(pngBytes.length>100_000);assert.deepEqual(errors,[]);
 console.log(`PASS supplied ${asset.length} byte STEP-derived GLB served and rendered in editor, CAD inspector/calibration and 44 header anchors available, physical signal IDs verified, portable project metadata saved; screenshot ${pngBytes.length} bytes`);
}finally{await browser.close()}
