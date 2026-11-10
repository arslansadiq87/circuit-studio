import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1400,height:950}});
 await page.goto(process.env.BASE_URL??'http://localhost:4173');
 await page.waitForFunction(()=>!!window.__circuitExportState);
 await page.evaluate(async()=>{
  const {useEditor}=await import('/src/store.ts'),{makeIcPackage}=await import('/src/icPackage.ts'),{ESP32_C6_COMPONENT,STEPPER_24BYJ_48_COMPONENT}=await import('/src/model.ts');
  const components=[{...makeIcPackage(10),id:'ic-a',position:[-25,15,0]},{...makeIcPackage(10),id:'ic-b',position:[-25,-15,0]},{...ESP32_C6_COMPONENT,id:'c6',position:[25,0,0]},{...STEPPER_24BYJ_48_COMPONENT,id:'motor',position:[-65,0,0]}];
  const connection=(id,a,pa,b,pb)=>({id,from:{componentId:a,pinId:pa},to:{componentId:b,pinId:pb},diameter:1.05,color:'#66ccbb',label:id,curvature:19,routeMode:'clean'});
  const wires=Array.from({length:5},(_,i)=>[connection(`m${i}`,'motor',`J1-${i+1}`,'ic-a',`P${i+1}`),connection(`a${i}`,'ic-a',`P${i+6}`,'c6',`J2-${i+1}`),connection(`b${i}`,'ic-b',`P${i+6}`,'c6',`J1-${i+1}`)]).flat();
  const s=useEditor.getState();s.loadProject({...s.project,components,wires});s.select('ic-a');s.requestCamera('fit');
 });
 await page.waitForFunction(()=>{let count=0;window.__circuitExportState.scene.traverse(object=>{if(object.userData.wireVisual)count++});return count===15},{},{timeout:60000});
 const snapshot=()=>page.evaluate(()=>{
  const geometries=[];window.__circuitExportState.scene.traverse(object=>{if(object.userData.wireVisual)geometries.push(object.geometry.uuid)});
  return {builds:window.__circuitDiagnostics.wireBuilds,geometries};
 });
 const before=await snapshot();assert.equal(before.geometries.length,15);
 const name=page.getByRole('textbox',{name:'IC name',exact:true}),pin=page.getByRole('textbox',{name:'Pin 1 name',exact:true});
 await name.fill('');await name.pressSequentially('Motor Controller',{delay:15});
 await pin.fill('');await pin.pressSequentially('STEP OUTPUT',{delay:15});
 await page.waitForTimeout(150);
 assert.deepEqual(await snapshot(),before,'Typing names must not reroute or rebuild any wire');
 const values=await page.evaluate(async()=>{const {useEditor}=await import('/src/store.ts');const c=useEditor.getState().project.components.find(c=>c.id==='ic-a');return {name:c.name,pin:c.pins[0].label}});
 assert.deepEqual(values,{name:'Motor Controller',pin:'STEP OUTPUT'});
 await page.evaluate(async()=>{const {useEditor}=await import('/src/store.ts');useEditor.getState().updateComponent('ic-a',{position:[-24,15,0]})});
 await page.waitForTimeout(200);
 assert.ok((await snapshot()).builds>before.builds,'Physical moves must still recalculate wires');
 console.log('PASS: IC and pin names update while all 15 wire meshes remain cached; moving an IC still reroutes.');
}finally{await browser.close()}
