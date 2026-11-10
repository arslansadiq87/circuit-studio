import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const project=JSON.parse(await readFile(new URL('../tests/fixtures/crowded-c6-project.json',import.meta.url),'utf8'));
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1760,height:1080}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{window.__blockRoutingRequests=0;const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{constructor(url,options){super(url,options);this.isRouting=String(url).includes('routing.worker')}postMessage(...args){if(this.isRouting)window.__blockRoutingRequests++;return super.postMessage(...args)}}});
 await page.goto(process.env.BASE_URL??'http://localhost:5173');await page.waitForFunction(()=>!!window.__circuitExportState);
 await page.evaluate(async project=>{
  const url=performance.getEntriesByType('resource').find(entry=>new URL(entry.name).pathname==='/src/store.ts')?.name??'/src/store.ts';const {useEditor}=await import(url),models=await import('/src/model.ts');window.__blockEditor=useEditor;
  project.components=project.components.map(c=>({...c,geometry:Object.values(models).find(value=>value&&typeof value==='object'&&value.modelId===c.modelId)?.geometry??c.geometry}));useEditor.getState().loadProject(project);useEditor.getState().requestCamera('fit');
 },project);
 await page.waitForFunction(()=>{let count=0;window.__circuitExportState.scene.traverse(o=>{if(o.userData.wireVisual)count++});return count===28},{},{timeout:90000});await page.waitForTimeout(250);
 const snapshot=()=>page.evaluate(()=>{const wires=[];window.__circuitExportState.scene.traverse(o=>{if(o.userData.wireVisual)wires.push({id:o.userData.wireId,geometry:o.geometry.uuid})});return {wires,builds:window.__circuitDiagnostics.wireBuilds,requests:window.__blockRoutingRequests,project:JSON.stringify(window.__blockEditor.getState().project),camera:window.__circuitExportState.camera.position.toArray()}});
 const before=await snapshot();
 await page.getByRole('button',{name:'Generate block diagram',exact:true}).click();const modal=page.getByRole('dialog',{name:'Block diagram',exact:true});await modal.waitFor();
 assert.equal(await page.locator('[data-block-kind="component"]').count(),8);assert.equal(await page.locator('[data-block-kind="power-bus"]').count(),2);
 await page.screenshot({path:'artifacts/block-diagram-view.png'});
 await page.getByRole('button',{name:/^Links/}).click();assert.equal(await page.locator('.schematic-net-row').filter({hasText:'4 signals'}).count(),4);
 await page.locator('.schematic-net-row strong').filter({hasText:/^U1.*U2$/}).click();assert.equal(await page.locator('.block-connection').count(),4);
 await page.getByRole('button',{name:'Clear block diagram selection'}).click();
 await page.getByRole('checkbox',{name:'Power links',exact:true}).uncheck();assert.equal(await page.locator('[data-block-kind="power-bus"]').count(),0);assert.equal(await page.locator('.schematic-net-row').count(),6);
 await page.getByRole('checkbox',{name:'Reference links',exact:true}).check();assert.equal(await page.locator('[data-block-kind="reference-bus"]').count(),1);
 await page.getByRole('checkbox',{name:'Reference links',exact:true}).uncheck();await page.getByRole('checkbox',{name:'Power links',exact:true}).check();
 await page.getByRole('checkbox',{name:'Signal names',exact:true}).check();assert.ok(await page.locator('.bd-detail').count()>0);await page.getByRole('checkbox',{name:'Signal names',exact:true}).uncheck();
 const oldZoom=await page.locator('.schematic-zoom-value').textContent();await page.getByRole('button',{name:'Zoom in block diagram'}).click();assert.notEqual(await page.locator('.schematic-zoom-value').textContent(),oldZoom);await page.getByRole('button',{name:'Fit block diagram',exact:true}).click();
 const canvas=await page.locator('.block-canvas').boundingBox(),oldTransform=await page.locator('.block-canvas>svg>g').getAttribute('transform');await page.mouse.move(canvas.x+15,canvas.y+15);await page.mouse.down();await page.mouse.move(canvas.x+70,canvas.y+50,{steps:6});await page.mouse.up();assert.notEqual(await page.locator('.block-canvas>svg>g').getAttribute('transform'),oldTransform);await page.getByRole('button',{name:'Fit block diagram',exact:true}).click();
 const [svgFile]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'SVG',exact:true}).click()]);await svgFile.saveAs('artifacts/generated-block-diagram.svg');
 const svg=await readFile('artifacts/generated-block-diagram.svg','utf8');assert.equal((svg.match(/data-block-kind="component"/g)??[]).length,8);assert.ok(svg.includes('4 signals'));assert.ok(svg.includes('ULN2003'));assert.ok(svg.includes('bd-arrow-signal'));
 const [pngFile]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'PNG',exact:true}).click()]);await pngFile.saveAs('artifacts/generated-block-diagram.png');const png=await readFile('artifacts/generated-block-diagram.png');assert.equal(png.subarray(1,4).toString(),'PNG');assert.ok(png.readUInt32BE(16)>1000);
 const [popup]=await Promise.all([page.waitForEvent('popup'),page.getByRole('button',{name:'Print / PDF',exact:true}).click()]);await popup.waitForFunction(()=>document.querySelectorAll('[data-block-kind="component"]').length===8);await popup.close();
 await page.getByRole('button',{name:'Back to 3D',exact:true}).click();await modal.waitFor({state:'detached'});assert.deepEqual(await snapshot(),before,'The block diagram must not change the project, camera, routing jobs or wire geometries');
 await page.getByRole('button',{name:'Generate block diagram',exact:true}).click();await page.getByRole('button',{name:'Detailed schematic',exact:true}).click();await page.getByRole('dialog',{name:'Circuit schematic',exact:true}).waitFor();await page.getByRole('button',{name:'Back to 3D',exact:true}).click();assert.deepEqual(await snapshot(),before);
 await page.getByRole('button',{name:'Generate block diagram',exact:true}).click();await page.locator('.schematic-part-row').filter({hasText:'ESP32-C6 Supermini'}).click();await page.getByRole('button',{name:'Select in 3D'}).click();assert.equal(await page.evaluate(()=>window.__blockEditor.getState().selectedId),project.components.find(c=>c.modelId==='esp32-c6-supermini').id);assert.deepEqual((await snapshot()).wires,before.wires);
 await page.evaluate(()=>window.__blockEditor.getState().setMode('move'));await page.getByRole('button',{name:'Generate block diagram',exact:true}).click();await modal.waitFor();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__blockEditor.getState().mode),'move');
 await page.evaluate(()=>{
  const s=window.__blockEditor.getState(),component=id=>({id,modelId:`custom:${id}`,name:`Custom feedback ${id}`,position:[0,0,0],rotation:[0,0,0],dimensions:[12,8,2],pins:[{id:'a',label:'A',side:'left',index:0,localPosition:[-6,0,1]},{id:'b',label:'B',side:'right',index:0,localPosition:[6,0,1]}]}),wire=(id,a,b)=>({id,from:{componentId:a,pinId:'b'},to:{componentId:b,pinId:'a'},label:id,color:'#40ccbb',diameter:1.05,curvature:19,routeMode:'straight'});
  s.loadProject({...s.project,components:['a','b','c','isolated'].map(component),wires:[wire('ab','a','b'),wire('bc','b','c'),wire('ca','c','a')]});
 });
 await page.getByRole('button',{name:'Generate block diagram',exact:true}).click();await modal.waitFor();assert.equal(await page.locator('[data-block-kind="component"]').count(),4);assert.equal(await page.locator('.bd-sheet line[marker-end]').count(),0,'Unknown pin directions must not invent arrows');await page.keyboard.press('Escape');
 await page.evaluate(()=>{const s=window.__blockEditor.getState();s.loadProject({...s.project,components:[],wires:[]})});await page.getByRole('button',{name:'Generate block diagram',exact:true}).click();await page.getByRole('heading',{name:'Your circuit, at a glance'}).waitFor();assert.equal(await page.getByRole('button',{name:'SVG',exact:true}).isDisabled(),true);await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);
 console.log('PASS: component grouping, known-direction arrows, power/reference toggles, SVG/PNG/PDF exports, schematic/3D navigation, custom feedback circuits and empty projects; original 3D routes and camera remain cached.');
}finally{await browser.close()}
