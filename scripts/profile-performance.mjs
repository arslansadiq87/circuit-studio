import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
const label=process.argv[2]??'current';
if(label==='baseline'){try{await fs.access('artifacts/performance-baseline.json');throw new Error('The pre-optimization baseline is archived. Use a different label for current measurements.')}catch(error){if(error.code!=='ENOENT')throw error}}
const hardware=process.argv.includes('--hardware');
const browser=await chromium.launch({headless:true,...hardware?{channel:'chrome'}:{},args:hardware?['--enable-webgl','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=d3d11']:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1920,height:1080}});
page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const modules={};page.on('request',r=>{for(const [key,part] of Object.entries({store:'/src/store.ts',model:'/src/model.ts',stdlib:'/three-stdlib.js',three:'/three.js'})){if(r.url().includes(part))modules[key]=r.url()}});
let releaseModels;const modelGate=new Promise(resolve=>{releaseModels=resolve});
if(label!=='baseline')await page.route('**/models/*.glb',async route=>{await modelGate;await route.continue()});
page.on('pageerror',e=>console.log('browser error:',e.message));
page.on('requestfailed',r=>console.log('request failed:',r.url()));
// The original city preset is remote and unreachable in this sandbox. Keep the
// same neutral lighting fixture for both measurements, without editing baseline code.
await page.route('**/*potsdamer_platz*',route=>route.fulfill({contentType:'application/octet-stream',body:Buffer.concat([Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 1\n'),Buffer.from([128,128,128,129])])}));
await page.addInitScript(()=>{window.__reactCommits=0;const renderers=new Map();window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,renderers,inject:r=>{const id=renderers.size+1;renderers.set(id,r);return id},onCommitFiberRoot:()=>window.__reactCommits++,onCommitFiberUnmount:()=>{}}});
try{
 await page.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
 console.log('page loaded');
 await page.waitForFunction(()=>window.__circuitExportState);
 console.log('viewport mounted');
 if(process.argv.includes('--full-canvas')){await page.addStyleTag({content:'.canvas-wrap{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:100}'});await page.waitForFunction(()=>{const c=window.__circuitExportState.renderer.domElement;return c.width===1920&&c.height===1080})}
 await page.evaluate(async modules=>{
  const {GLTFLoader}=await import(modules.stdlib);
  const parse=GLTFLoader.prototype.parse;
  window.__parseTimes=[];
  GLTFLoader.prototype.parse=function(data,path,done,fail){const t=performance.now();return parse.call(this,data,path,g=>{window.__parseTimes.push(performance.now()-t);done(g)},fail)};
  const {useEditor}=await import(modules.store);const {initialProject,YD_ESP32_S3_V34_COMPONENT}=await import(modules.model);
  window.__modelStart=performance.now();
  useEditor.getState().loadProject({...initialProject,components:[{...YD_ESP32_S3_V34_COMPONENT,id:'esp32',position:[-42,0,0]},...initialProject.components.filter(c=>c.id!=='esp32')]});
 },modules);
 releaseModels();
 await page.waitForFunction(()=>{let found=false;window.__circuitExportState.scene.traverse(o=>{if(o.isMesh&&o.geometry.attributes.position.count>10000)found=true});return found},{},{timeout:45000}).catch(async e=>{console.log(await page.evaluate(()=>({text:document.body.innerText.slice(-1600),parse:window.__parseTimes})));throw e});
 const loadMs=await page.evaluate(()=>performance.now()-window.__modelStart);
 console.log('CAD mounted',loadMs);
 await page.waitForTimeout(3000);
 const setup=await page.evaluate(async()=>{
  const {renderer:r,scene,camera}=window.__circuitExportState;const THREE=await import('/node_modules/.vite/deps/three.js');
  const ctx=r.getContext(),ext=ctx.getExtension('WEBGL_debug_renderer_info');const gpu=ext?ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL):ctx.getParameter(ctx.RENDERER);
  const geometries=new Set(),materials=new Set();let meshes=0,lights=0,shadowLights=0,vertices=0,triangles=0,geometryBytes=0;
  scene.traverse(o=>{if(o.isLight){lights++;if(o.castShadow)shadowLights++}if(o.isMesh){meshes++;const g=o.geometry;vertices+=g.attributes.position?.count??0;triangles+=(g.index?.count??g.attributes.position?.count??0)/3;geometries.add(g);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)}});
  for(const g of geometries){const arrays=new Set(Object.values(g.attributes).map(a=>a.isInterleavedBufferAttribute?a.data.array:a.array));if(g.index)arrays.add(g.index.array);for(const a of arrays)geometryBytes+=a.byteLength}
  const original=r.render.bind(r);window.__renderCount=0;window.__renderCpu=[];
  r.render=(s,c)=>{const t=performance.now();const result=original(s,c);if(s===scene){window.__renderCount++;window.__renderCpu.push(performance.now()-t)}return result};
  const raycaster=new THREE.Raycaster();const rayTimes=[];for(let i=0;i<100;i++){raycaster.setFromCamera(new THREE.Vector2(-.5+(i%10)*.05,.1),camera);const t=performance.now();raycaster.intersectObjects(scene.children,true);rayTimes.push(performance.now()-t)}
  window.__renderCount=0;window.__reactStart=window.__reactCommits;
  return {gpu,meshes,vertices,triangles,materials:materials.size,lights,shadowLights,geometryBytes,raycastAverageMs:rayTimes.reduce((a,b)=>a+b,0)/rayTimes.length,heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null,render:{...r.info.render},memory:{...r.info.memory},resolution:[r.domElement.width,r.domElement.height],parseMs:window.__parseTimes,diagnostics:window.__circuitDiagnostics};
 });
 await page.waitForTimeout(2000);
 const idle=await page.evaluate(()=>({frames:window.__renderCount,reactCommits:window.__reactCommits-window.__reactStart}));
 const orbit=await page.evaluate(async()=>{
  const {renderer,scene,camera}=window.__circuitExportState;const root=scene.__r3f?.root.getState();const controls=root?.controls;const intervals=[];window.__renderCpu=[];let previous=performance.now();const start=previous;
  await new Promise(resolve=>{function tick(now){intervals.push(now-previous);previous=now;const angle=(now-start)/3000;camera.position.set(Math.sin(angle)*150,85,Math.cos(angle)*150);camera.lookAt(0,0,0);if(controls){controls.target.set(0,0,0);controls.update()}root?.invalidate();if(now-start<6000)requestAnimationFrame(tick);else resolve()}requestAnimationFrame(tick)});
  const sorted=intervals.slice(2).sort((a,b)=>a-b),avg=sorted.reduce((a,b)=>a+b,0)/sorted.length;return {frames:sorted.length,averageFrameMs:avg,fps:1000/avg,p95FrameMs:sorted[Math.floor(sorted.length*.95)],averageRenderSubmitMs:window.__renderCpu.reduce((a,b)=>a+b,0)/window.__renderCpu.length,reactCommits:window.__reactCommits-window.__reactStart,render:{...renderer.info.render},heap:performance.memory?.usedJSHeapSize};
 });
 await page.evaluate(()=>{const {scene,camera}=window.__circuitExportState;const root=scene.__r3f?.root.getState();camera.position.set(0,115,144);root?.controls?.target.set(0,0,0);camera.lookAt(0,0,0);root?.controls?.update();root?.invalidate()});
 await page.waitForTimeout(800);await page.screenshot({path:`artifacts/sprint36-${label}.png`});
 const glb=await fs.readFile('public/models/yd-esp32-s3-v34.glb');const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
 const source=await fs.stat('Custom Components/YD-ESP32-S3 v34.step');
 const result={label,date:new Date().toISOString(),environment:{os:`${os.platform()} ${os.release()}`,cpu:os.cpus()[0].model,logicalCores:os.cpus().length,ram:os.totalmem(),chromium:browser.version(),viewport:[1920,1080],mode:hardware?'installed Chrome, ANGLE D3D11 requested; Vite development, React StrictMode':'headless ANGLE SwiftShader software WebGL; Vite development, React StrictMode'},sourceBytes:source.size,masterGlbBytes:glb.length,masterMeshes:json.meshes.length,masterMaterials:json.materials.length,masterTextures:json.textures?.length??0,loadToMountedMs:loadMs,setup,idle,orbit,errors};
 await fs.writeFile(`artifacts/performance-${label}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close()}
