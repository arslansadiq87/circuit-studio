import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.goto(process.env.BASE_URL??'http://localhost:4173');
 await page.waitForFunction(()=>!!window.__circuitExportState);
 await page.evaluate(async()=>{
  const {useEditor}=await import('/src/store.ts'),{makeIcPackage}=await import('/src/icPackage.ts');
  const components=[{...makeIcPackage(10),id:'a',position:[-25,0,0]},{...makeIcPackage(10),id:'b',position:[25,0,0]}];
  const wires=Array.from({length:5},(_,i)=>({id:`camera-wire-${i}`,from:{componentId:'a',pinId:`P${10-i}`},to:{componentId:'b',pinId:`P${i+1}`},color:'#66ccbb',diameter:1.05,label:`Wire ${i}`,curvature:19,routeMode:i===4?'auto':'clean'}));
  const editor=useEditor.getState();editor.loadProject({...editor.project,components,wires});editor.requestCamera('fit');
 });
 await page.waitForTimeout(700);
 const snapshot=()=>page.evaluate(()=>{
  const state=window.__circuitExportState,wires=[];
  state.scene.traverse(object=>{if(object.userData.wireVisual)wires.push({id:object.userData.wireId,uuid:object.geometry.uuid,positions:Array.from(object.geometry.attributes.position.array)})});
  return {camera:state.camera.position.toArray(),wires,builds:window.__circuitDiagnostics.wireBuilds};
 });
 const before=await snapshot();assert.equal(before.wires.length,5);
 // Exercise the exact constrained-motion state which previously selected 24 segments.
 await page.evaluate(async()=>{const {useGraphics}=await import('/src/graphics.ts');useGraphics.getState().setMoving(true);useGraphics.getState().setConstrained(true)});
 await page.waitForTimeout(100);
 assert.deepEqual((await snapshot()).wires,before.wires,'Constrained motion must retain the same wire geometry');
 await page.mouse.move(650,220);await page.mouse.down();await page.mouse.move(780,300,{steps:18});await page.mouse.up();
 await page.mouse.wheel(0,-600);await page.waitForTimeout(500);
 const zoomed=await snapshot();assert.notDeepEqual(zoomed.camera,before.camera,'The camera must actually move');
 assert.deepEqual(zoomed.wires,before.wires,'Orbit and zoom must not rebuild or deform wires');
 await page.mouse.wheel(0,900);await page.waitForTimeout(800);
 const after=await snapshot();assert.deepEqual(after.wires,before.wires);assert.equal(after.builds,before.builds);
 console.log('PASS: wire vertices and geometry identities remain unchanged during constrained movement, orbit, zoom and settling.');
}finally{await browser.close()}
