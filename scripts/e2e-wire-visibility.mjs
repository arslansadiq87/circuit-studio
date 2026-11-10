import {chromium} from 'playwright';
import {strict as assert} from 'node:assert';

const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 await page.goto(process.env.CIRCUIT_STUDIO_URL??'http://localhost:5173/',{waitUntil:'domcontentloaded'});
 const snapshot=()=>page.evaluate(()=>{
  const meshes={};window.__circuitExportState?.scene.traverse(object=>{if(object.userData.wireVisual)meshes[object.userData.wireId]=[object.uuid,object.geometry.uuid]});
  return {meshes,builds:window.__circuitDiagnostics.wireBuilds,routing:document.body.textContent?.includes('Routing 5 connections')};
 });
 await page.waitForFunction(()=>{let count=0;window.__circuitExportState?.scene.traverse(object=>{if(object.userData.wireVisual)count++});return count===5});
 await page.waitForTimeout(3000);
 const before=await snapshot(),target=Object.keys(before.meshes)[0];
 await page.getByRole('button',{name:/Hide connection/}).first().click();
 await page.waitForFunction(id=>{let found=false;window.__circuitExportState?.scene.traverse(object=>{if(object.userData.wireId===id&&object.userData.wireVisual)found=true});return !found},target);
 const hidden=await snapshot();
 assert.equal(hidden.builds,before.builds,'hiding a wire rebuilt geometry');
 assert.equal(hidden.routing,false,'hiding a wire restarted routing');
 for(const [id,uuid] of Object.entries(before.meshes))if(id!==target)assert.deepEqual(hidden.meshes[id],uuid,`wire ${id} was remounted`);
 await page.getByRole('button',{name:/Show connection/}).first().click();
 await page.waitForFunction(id=>{let found=false;window.__circuitExportState?.scene.traverse(object=>{if(object.userData.wireId===id&&object.userData.wireVisual)found=true});return found},target);
 const shown=await snapshot();
 assert.ok(shown.builds>=before.builds+1&&shown.builds<=before.builds+2,'showing a wire rebuilt more than its own geometry');
 assert.equal(shown.routing,false,'showing a wire restarted routing');
 for(const [id,uuid] of Object.entries(before.meshes))if(id!==target)assert.deepEqual(shown.meshes[id],uuid,`wire ${id} was remounted`);
 console.log('Wire visibility changed only the selected net.');
}finally{await browser.close()}
