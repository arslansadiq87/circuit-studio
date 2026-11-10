import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
let storeUrl,threeUrl;page.on('request',r=>{if(r.url().includes('/src/store.ts'))storeUrl=r.url();if(r.url().includes('/three.js'))threeUrl=r.url()});
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
try{
 await page.goto('http://localhost:5173/');
 await page.locator('.asset-card').filter({has:page.locator('.asset-name').getByText('Resistor',{exact:true})}).click();
 await page.waitForFunction(()=>{let ready=false;window.__circuitExportState?.scene.traverse(o=>{if(o.userData.modelId==='resistor')ready=true});return ready});
 await page.getByRole('textbox',{name:'Resistance value',exact:true}).fill('4.7');
 await page.getByRole('button',{name:'Set resistance',exact:true}).click();
 await page.getByRole('combobox',{name:'Resistance unit'}).selectOption('1000');
 await page.getByRole('textbox',{name:'Resistance value',exact:true}).fill('4.7');
 await page.getByRole('button',{name:'Set resistance',exact:true}).click();
 const report=await page.evaluate(async({storeUrl,threeUrl})=>{
  const {useEditor}=await import(storeUrl),{worldPin,worldPinDirection}=await import('/src/geometry.ts'),THREE=await import(threeUrl);
  const s=useEditor.getState(),r=s.project.components.find(c=>c.modelId==='resistor');
  if(r.resistanceOhms!==4700)throw new Error('Resistance editor failed');
  const scene=window.__circuitExportState.scene;scene.updateMatrixWorld(true);
  const meshes=[];scene.traverse(o=>{if(o.userData.modelId==='resistor')o.traverse(m=>{if(m.isMesh)meshes.push(m)})});
  const surfaces=r.pins.map(p=>{const anchor=worldPin(p,r),direction=worldPinDirection(p,r),ray=new THREE.Raycaster(anchor.clone().add(direction),direction.clone().negate(),0,2),hits=[];for(const m of meshes)THREE.Mesh.prototype.raycast.call(m,ray,hits);hits.sort((a,b)=>a.distance-b.distance);if(!hits.length)throw new Error(`No end face at ${p.id}`);return {pin:p.id,errorMm:hits[0].point.distanceTo(anchor),normalDot:hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld).dot(direction)}});
  s.addWire({componentId:r.id,pinId:'P0'},{componentId:'external-5v',pinId:'OUT+'});
  s.addWire({componentId:r.id,pinId:'P1'},{componentId:'external-5v',pinId:'GND'});
  const {saveLegacy,importLegacy,savePortable,openProject}=await import('/src/projectFiles.ts');
  const saved=await saveLegacy(useEditor.getState().project),restored=await importLegacy(JSON.parse(await saved.text()));
  s.loadProject(restored);s.select(r.id);s.requestCamera('fit-selected');
  const restoredR=restored.components.find(c=>c.id===r.id);
  const packed=await savePortable(restored),unpacked=await openProject(new File([packed],'resistor.c3dzip'));
  return {pins:r.pins.length,surfaces,resistanceOhms:restoredR.resistanceOhms,portableOhms:unpacked.components.find(c=>c.id===r.id).resistanceOhms,dimensions:r.dimensions,wireCount:restored.wires.length,asset:!!r.geometry.modelContentHash||!!restoredR.geometry.modelContentHash,anchors:r.pins.map(p=>worldPin(p,r).toArray())};
 },{storeUrl,threeUrl});
 assert.equal(report.pins,2);assert.equal(report.wireCount,7);assert.equal(report.asset,true);
 assert.equal(report.resistanceOhms,4700);assert.equal(report.portableOhms,4700);for(const contact of report.surfaces){assert.ok(contact.errorMm<.02);assert.ok(contact.normalDot>.99)}
 // Exercise zero, scientific notation, validation and undo through the inspector.
 await page.getByRole('textbox',{name:'Resistance value',exact:true}).fill('-1');assert.equal(await page.getByRole('button',{name:'Set resistance',exact:true}).isEnabled(),false);
 await page.getByRole('textbox',{name:'Resistance value',exact:true}).fill('0');await page.getByRole('button',{name:'Set resistance',exact:true}).click();
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await page.getByRole('textbox',{name:'Resistance value',exact:true}).fill('1.234e6');await page.getByRole('button',{name:'Set resistance',exact:true}).click();
 report.scientificOhms=await page.evaluate(async url=>{const {useEditor}=await import(url);return useEditor.getState().project.components.find(c=>c.modelId==='resistor').resistanceOhms},storeUrl);assert.equal(report.scientificOhms,1.234e9);
 await page.waitForTimeout(1500);await page.screenshot({path:'artifacts/resistor-editor.png'});
 assert.deepEqual(errors,[]);await fs.writeFile('artifacts/resistor-pin-verification.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close()}
