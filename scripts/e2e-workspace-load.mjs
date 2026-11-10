import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1350,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.BASE_URL??'http://localhost:4173');
 await page.waitForFunction(()=>!!window.__circuitExportState);
 await page.evaluate(async()=>{
  const {useEditor}=await import('/src/store.ts'),{makeIcPackage}=await import('/src/icPackage.ts'),{ESP32_C6_COMPONENT,STEPPER_24BYJ_48_COMPONENT}=await import('/src/model.ts');
  const components=[{...STEPPER_24BYJ_48_COMPONENT,id:'motor',position:[-75,0,0]},{...makeIcPackage(10),id:'left',position:[-35,0,0]},{...ESP32_C6_COMPONENT,id:'c6',position:[0,0,0],rotation:[0,0,-180]},{...makeIcPackage(10),id:'right',position:[35,0,0]}];
  const wire=(id,from,fp,to,tp)=>({id,from:{componentId:from,pinId:fp},to:{componentId:to,pinId:tp},diameter:1.05,color:'#6bc8b0',label:id,curvature:19,routeMode:'clean'});
  const wires=Array.from({length:5},(_,i)=>[wire(`motor-${i}`,'motor',`J1-${i+1}`,'left',`P${i+1}`),wire(`left-${i}`,'left',`P${i+6}`,'c6',`J1-${i+1}`),wire(`right-${i}`,'c6',`J2-${i+1}`,'right',`P${i+1}`)]).flat();
  wires.push(...Array.from({length:4},(_,i)=>wire(`cross-${i}`,'left',`P${i+1}`,'right',`P${10-i}`)));
  const editor=useEditor.getState();editor.loadProject({...editor.project,components,wires});editor.select('left');
 });
 const tick=await page.evaluate(()=>new Promise(resolve=>{const start=performance.now();setTimeout(()=>resolve(performance.now()-start),50)}));
 assert.ok(tick<1500,`UI timer stalled for ${tick.toFixed(0)} ms`);
 await page.getByRole('textbox',{name:'IC name',exact:true}).fill('Responsive IC');
 assert.equal(await page.getByRole('textbox',{name:'IC name',exact:true}).inputValue(),'Responsive IC');
 await page.getByRole('status',{name:/Routing 19 connections/}).waitFor({state:'hidden',timeout:30000}).catch(()=>{});
 await page.waitForFunction(()=>!document.body.textContent.includes('Routing 19 connections'),{},{timeout:30000});
 assert.deepEqual(errors,[]);
 console.log('PASS: 19-connection workspace mounts and accepts IC edits while routing runs in a worker.');
}finally{await browser.close()}
