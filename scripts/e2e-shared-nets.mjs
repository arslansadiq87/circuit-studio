import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const project=JSON.parse(await readFile(new URL('../tests/fixtures/crowded-c6-project.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1400,height:950}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const NativeWorker=window.Worker;
  window.Worker=class extends NativeWorker{
   constructor(url,options){super(url,options);if(String(url).includes('routing.worker'))this.addEventListener('message',event=>{window.__routedWireSnapshot=event.data.wires})}
  };
 });
 await page.goto(process.env.BASE_URL??'http://localhost:5173');
 await page.waitForFunction(()=>!!window.__circuitExportState);
 await page.evaluate(async project=>{
  const editorUrl=performance.getEntriesByType('resource').find(entry=>new URL(entry.name).pathname==='/src/store.ts')?.name??'/src/store.ts';
  const {useEditor}=await import(editorUrl),models=await import('/src/model.ts');
  window.__testEditor=useEditor;
  project.components=project.components.map(component=>{
   const template=Object.values(models).find(value=>value&&typeof value==='object'&&value.modelId===component.modelId);
   return {...component,geometry:template?.geometry??component.geometry};
  });
  useEditor.getState().loadProject(project);useEditor.getState().requestCamera('fit');
 },project);
 await page.waitForFunction(()=>{
  let count=0;window.__circuitExportState.scene.traverse(o=>{if(o.userData.wireVisual)count++});
  return window.__routedWireSnapshot?.length===28&&count===28;
 },{},{timeout:90000}).catch(async error=>{
  const state=await page.evaluate(()=>{let count=0;window.__circuitExportState?.scene.traverse(o=>{if(o.userData.wireVisual)count++});return {count,routes:window.__routedWireSnapshot?.length,blocked:window.__routedWireSnapshot?.filter(w=>w.routingBlocked).map(w=>w.id),text:document.querySelector('canvas')?.parentElement?.textContent?.slice(-1000)}});
  throw new Error(`${error.message}; ${JSON.stringify({state,errors})}`);
 });
 const result=await page.evaluate(async()=>{
  const useEditor=window.__testEditor;
  const routes=window.__routedWireSnapshot,meshes=new Map();
  window.__circuitExportState.scene.traverse(o=>{if(o.userData.wireVisual)meshes.set(o.userData.wireId,o)});
  const branches=routes.filter(w=>w.routingJunction).map(w=>{
   const junction=w.routingJunction,point=meshes.get(w.id).geometry.parameters.path.getPoint(junction.at==='from'?0:1);
   const trunk=meshes.get(junction.wireId).geometry.parameters.path,trunkError=Math.min(...trunk.getSpacedPoints(Math.ceil(trunk.getLength()/.2)).map(p=>p.distanceTo(point)));
   return {id:w.id,target:junction.wireId,error:Math.hypot(...point.toArray().map((v,i)=>v-junction.position[i])),trunkError};
  });
  const ground=routes.find(w=>w.id==='wire-1793808726995'),ic=useEditor.getState().project.components.find(c=>c.id===ground.from.componentId);
  const groundOverBody=meshes.get(ground.id).geometry.parameters.path.getSpacedPoints(400).some(p=>Math.abs(p.x-ic.position[0])<ic.dimensions[0]/2-.02&&Math.abs(p.y-ic.position[1])<ic.dimensions[1]/2-.02);
  const returns=routes.flatMap(w=>['from','to'].filter(at=>w[at].componentId===ground.to.componentId&&w[at].pinId===ground.to.pinId&&w.routingJunction?.at!==at).map(at=>({id:w.id,at})));
  const pin=meshes.get(returns[0].id).geometry.parameters.path.getPoint(returns[0].at==='from'?0:1);
  const groundLocal=!ground.routingJunction||Math.hypot(...ground.routingJunction.position.map((v,i)=>v-pin.toArray()[i]))<12;
  const outputs=new Set(['wire-1793787440013','wire-1793787444911','wire-1793787451051','wire-1793787454572']);
  const motorPlanes=routes.filter(w=>outputs.has(w.id)).flatMap(w=>w.routingPoints.slice(1).filter((p,i)=>Math.abs(p[2]-w.routingPoints[i][2])<.01&&p[2]>.05&&p[2]<5&&Math.hypot(p[0]-w.routingPoints[i][0],p[1]-w.routingPoints[i][1])>.1).map(p=>p[2]));
  const shortRoutes=['wire-1793787353214','wire-1793808695580','wire-1793817601030'].map(id=>meshes.get(id).geometry.parameters.path.getLength());
  return {branches,groundOverBody,groundLocal,motorPlanes,shortRoutes,groundReturns:returns.length,blocked:routes.filter(w=>w.routingBlocked).map(w=>w.id),saved:useEditor.getState().project.wires.map(w=>({id:w.id,from:w.from,to:w.to,junction:w.routingJunction}))};
 });
 assert.equal(result.blocked.length,0);
 const groundIds=new Set(['wire-1793787304500','wire-1793808726995','wire-1793817621368','wire-1793819732753']);
 assert.ok(result.branches.filter(w=>groundIds.has(w.id)&&groundIds.has(w.target)).length>=1);
 assert.equal(result.groundLocal,true,'IC ground must retain its short route and merge locally near the pin');
 assert.equal(result.groundReturns,1,'Only one GND trunk should enter the shared pin');
 assert.ok(result.motorPlanes.length>=4&&result.motorPlanes.every(z=>Math.abs(z-.7)<.01),'The IC-to-motor bundle must stay on one common low plane');
 assert.equal(result.groundOverBody,false,'The SOP-16 ground branch must stay outside its body');
 assert.ok(result.branches.every(w=>w.error<.001),'Rendered branches must meet their junctions');
 assert.ok(result.branches.every(w=>w.trunkError<.15),'Shortening a trunk must preserve every existing branch junction');
 assert.ok(result.shortRoutes.every((length,i)=>length<[40,40,80][i]),'The identified signal detours must use shorter crossings');
 assert.deepEqual(result.saved,project.wires.map(w=>({id:w.id,from:w.from,to:w.to,junction:undefined})),'Shared routing must preserve the saved electrical circuit');
 console.log(`PASS: all 28 wires render; ${result.branches.length} shorter same-net branches meet their junctions, with saved pin connections preserved.`);
}finally{await browser.close()}
