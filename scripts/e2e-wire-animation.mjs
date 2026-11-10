import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
let storeUrl;page.on('request',r=>{if(r.url().includes('/src/store.ts'))storeUrl=r.url()});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
const snapshot=()=>page.evaluate(()=>{const wires=[];window.__circuitExportState?.scene.traverse(o=>{if(o.userData.wireVisual)wires.push({id:o.userData.wireId,progress:o.userData.wireProgress,count:o.geometry.drawRange.count,total:o.geometry.index.count,geometry:o.geometry.uuid})});return wires});
try{
 await page.goto('http://localhost:5173/');await page.waitForFunction(()=>!!window.__circuitExportState);
 const before=await page.evaluate(async url=>{const {useEditor,projectFingerprint}=await import(url);const s=useEditor.getState();return {fingerprint:projectFingerprint(s.project),undo:s.undoStack.length}},storeUrl);
 await page.getByRole('button',{name:'Animate all',exact:true}).click();
 await page.waitForFunction(()=>{const a=[];window.__circuitExportState.scene.traverse(o=>{if(o.userData.wireVisual)a.push(o.userData.wireProgress)});return a.length===5&&a.every(p=>p>0&&p<.8)});
 const together=await snapshot();assert.ok(Math.max(...together.map(w=>w.progress))-Math.min(...together.map(w=>w.progress))<.02);assert.ok(together.every(w=>w.count>0&&w.count<w.total));
 const directions=await page.evaluate(async url=>{const {useEditor}=await import(url),{worldPin}=await import('/src/geometry.ts');const s=useEditor.getState();let max=0;window.__circuitExportState.scene.traverse(o=>{if(o.userData.wireVisual){const w=s.project.wires.find(w=>w.id===o.userData.wireId),c=s.project.components.find(c=>c.id===w.from.componentId),p=c.pins.find(p=>p.id===w.from.pinId);max=Math.max(max,o.geometry.parameters.path.getPoint(0).distanceTo(worldPin(p,c)))}});return max},storeUrl);assert.ok(directions<.000001);
 await page.getByRole('button',{name:'Stop wire animation'}).waitFor({state:'hidden'});assert.ok((await snapshot()).every(w=>w.progress===1&&w.count===w.total));
 await page.getByRole('button',{name:'Animate one by one',exact:true}).click();
 await page.waitForFunction(()=>{const a=[];window.__circuitExportState.scene.traverse(o=>{if(o.userData.wireVisual)a.push(o.userData.wireProgress)});return a[0]>.1&&a[0]<.9&&a.slice(1).every(p=>p===0)});
 const first=await snapshot();assert.ok(first.slice(1).every(w=>w.count===0));
 await page.waitForFunction(()=>{const a=[];window.__circuitExportState.scene.traverse(o=>{if(o.userData.wireVisual)a.push(o.userData.wireProgress)});return a[0]===1&&a[1]>.1&&a[1]<.9&&a.slice(2).every(p=>p===0)});
 const second=await snapshot();assert.deepEqual(first.map(w=>w.geometry),second.map(w=>w.geometry));
 await page.screenshot({path:'artifacts/wire-animation-sequential.png'});
 await page.getByRole('button',{name:'Stop wire animation'}).waitFor({state:'hidden'});assert.ok((await snapshot()).every(w=>w.progress===1));
 const after=await page.evaluate(async url=>{const {useEditor,projectFingerprint}=await import(url);const s=useEditor.getState();return {fingerprint:projectFingerprint(s.project),undo:s.undoStack.length}},storeUrl);assert.deepEqual(after,before);
 await page.locator('.net-visibility').last().click();await page.getByRole('button',{name:'Animate all',exact:true}).click();assert.equal((await snapshot()).length,4);await page.getByRole('button',{name:'Stop wire animation'}).click();assert.equal((await snapshot()).length,4);assert.ok((await snapshot()).every(w=>w.progress===1));
 assert.deepEqual(errors,[]);console.log('Parallel and sequential drawing, source direction, empty later wires, completion, stop, hidden nets, stable geometry and unchanged project history passed.');
}finally{await browser.close()}
