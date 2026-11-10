import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1400,height:950}});
 await page.addInitScript(()=>{
  window.__routingRequests=0;
  const NativeWorker=window.Worker;
  window.Worker=class extends NativeWorker{
   constructor(url,options){super(url,options);this.isRouting=String(url).includes('routing.worker')}
   postMessage(...args){if(this.isRouting)window.__routingRequests++;return super.postMessage(...args)}
  };
 });
 await page.goto(process.env.BASE_URL??'http://localhost:5173');
 await page.waitForFunction(()=>!!window.__circuitExportState);
 await page.evaluate(async()=>{
  const {useEditor}=await import('/src/store.ts'),{makeIcPackage}=await import('/src/icPackage.ts');
  const components=[{...makeIcPackage(8),id:'a',position:[-20,0,0]},{...makeIcPackage(8),id:'b',position:[20,0,0]}];
  const wire={id:'test-wire',from:{componentId:'a',pinId:'P8'},to:{componentId:'b',pinId:'P1'},color:'#66ccbb',diameter:1.05,label:'Test',curvature:19,routeMode:'clean'};
  useEditor.getState().loadProject({...useEditor.getState().project,components,wires:[wire]});
 });
 await page.waitForFunction(()=>{let count=0;window.__circuitExportState.scene.traverse(o=>{if(o.userData.wireVisual)count++});return count===1});
 const snapshot=()=>page.evaluate(()=>{
  const geometries=[];window.__circuitExportState.scene.traverse(o=>{if(o.userData.wireVisual)geometries.push(o.geometry.uuid)});
  return {requests:window.__routingRequests,builds:window.__circuitDiagnostics.wireBuilds,geometries};
 });
 const before=await snapshot();
 await page.evaluate(async()=>{const {useEditor}=await import('/src/store.ts');useEditor.getState().addComponent('ic-sop')});
 await page.waitForTimeout(200);
 assert.deepEqual(await snapshot(),before,'Adding an unwired part must preserve routing and wire meshes');
 await page.evaluate(async()=>{
  const {useEditor}=await import('/src/store.ts');const state=useEditor.getState(),id=state.selectedId;
  state.beginMove(id);
  for(let i=0;i<30;i++)useEditor.getState().previewMove(id,[70+i,50+i,0]);
  useEditor.getState().finishMove(true);
 });
 await page.waitForTimeout(200);
 assert.deepEqual(await snapshot(),before,'Dragging an unwired part must preserve routing and wire meshes');
 await page.evaluate(async()=>{const {useEditor}=await import('/src/store.ts');useEditor.getState().updateComponent('a',{position:[-22,0,0]})});
 await page.waitForFunction(count=>window.__routingRequests>count,before.requests);
 await page.waitForFunction(builds=>window.__circuitDiagnostics.wireBuilds>builds,before.builds);
 const afterMove=await snapshot();
 await page.evaluate(async()=>{const {useEditor}=await import('/src/store.ts');const s=useEditor.getState();s.addWire({componentId:'b',pinId:'P2'},{componentId:s.project.components.at(-1).id,pinId:'P1'})});
 await page.waitForFunction(count=>window.__routingRequests>count,afterMove.requests);
 console.log('PASS: adding and dragging an unwired part starts no routing workers and rebuilds no wire meshes; connected moves and new connections still reroute.');
}finally{await browser.close()}
