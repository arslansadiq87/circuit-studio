import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,flatten,join,weld,prune,meshopt,getBounds} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const doc=await io.read('artifacts/esp30-source.glb'),scene=doc.getRoot().listScenes()[0];
// Direct XCAF export writes meters. Retain CAD axes and center on the PCB;
// USB points -Y and the antenna points +Y.
const center=doc.createNode('ESP32 30-pin PCB center').setScale([1000,1000,1000]).setTranslation([-12.065,-23.368,.79770097]);
for(const node of scene.listChildren()){scene.removeChild(node);center.addChild(node)}scene.addChild(center);
const sourceMaterials=new Map(doc.getRoot().listMaterials().map(m=>[m.getName(),m]));
const finishes={0:['Package charcoal',[.025,.03,.032,1],0,.7],1:['FR4 edge green',[.025,.075,.045,1],0,.8],2:['Gold header contacts',[.65,.43,.12,1],.86,.28],3:['Header insulator',[.012,.015,.018,1],0,.72],4:['Molded IC body',[.012,.014,.016,1],0,.66],5:['Ceramic / print',[.83,.85,.81,1],0,.6],6:['Tin component leads',[.62,.65,.64,1],.82,.3],7:['Ceramic capacitor',[.32,.21,.1,1],0,.7],8:['SMD terminations',[.72,.74,.72,1],.85,.28],9:['Switch steel',[.55,.58,.58,1],.8,.34],10:['Resistor ceramic',[.8,.8,.76,1],0,.65],11:['Black epoxy',[.012,.016,.02,1],0,.65],12:['Green indicator lens',[.035,.43,.07,1],0,.32],13:['Small gold contacts',[.72,.5,.16,1],.8,.3],14:['Solder joints',[.65,.68,.68,1],.85,.32],15:['UART IC leads',[.67,.69,.68,1],.8,.3],16:['RF shield brushed steel',[1,1,1,1],1,1],17:['Module FR4',[.027,.064,.04,1],0,.75],18:['USB gold contacts',[.7,.44,.1,1],.88,.24],19:['USB shell steel',[.67,.71,.71,1],.9,.27],20:['USB orientation mark',[.7,.72,.69,1],.3,.5]};
for(const [id,[name,color,metal,rough]] of Object.entries(finishes))sourceMaterials.get(`mat_${id}`).setName(name).setBaseColorFactor(color).setMetallicFactor(metal).setRoughnessFactor(rough);
async function texture(file,name){return doc.createTexture(name).setImage(new Uint8Array(await fs.readFile(`artifacts/esp30-textures/${file}`))).setMimeType('image/png')}
const pcb=sourceMaterials.get('mat_0').clone().setName('PCB black solder mask / selected pin labels').setBaseColorFactor([1,1,1,1]).setRoughnessFactor(.66).setBaseColorTexture(await texture('pcb-color.png','Black PCB and standard-map silkscreen'));
const shield=sourceMaterials.get('mat_16').setBaseColorTexture(await texture('shield-color.png','RF shield label')).setMetallicRoughnessTexture(await texture('shield-finish.png','Fine brushed metal finish'));
const antenna=doc.createMaterial('Antenna FR4 and copper trace').setBaseColorFactor([1,1,1,1]).setMetallicFactor(1).setRoughnessFactor(1).setBaseColorTexture(await texture('antenna-color.png','Antenna copper pattern')).setMetallicRoughnessTexture(await texture('antenna-finish.png','Antenna copper / FR4 finish'));
function worldPoint(n,p,i){const v=[];p.getAttribute('POSITION').getElement(i,v);const m=n.getWorldMatrix();return [m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]]}
const shieldBounds={min:[Infinity,Infinity],max:[-Infinity,-Infinity]};
for(const n of doc.getRoot().listNodes())if(n.getMesh())for(const p of n.getMesh().listPrimitives())if(p.getMaterial()===shield)for(let i=0;i<p.getAttribute('POSITION').getCount();i++){const v=worldPoint(n,p,i);for(let j=0;j<2;j++){shieldBounds.min[j]=Math.min(shieldBounds.min[j],v[j]);shieldBounds.max[j]=Math.max(shieldBounds.max[j],v[j])}}
let antennaFaces=0;
for(const n of doc.getRoot().listNodes())if(n.getMesh())for(const p of n.getMesh().listPrimitives()){
 if(n.getName()==='Open CASCADE STEP translator 7.5 114.1.1:1'&&p.getMaterial()===sourceMaterials.get('mat_0'))p.setMaterial(pcb);
 if(n.getName()==='7508963920:1'&&p.getMaterial()===sourceMaterials.get('mat_11')){let minY=Infinity,maxZ=-Infinity;for(let i=0;i<p.getAttribute('POSITION').getCount();i++){const v=worldPoint(n,p,i);minY=Math.min(minY,v[1]);maxZ=Math.max(maxZ,v[2])}if(minY>19.2&&maxZ>1.4){p.setMaterial(antenna);antennaFaces++}}
 if(p.getMaterial()!==pcb&&p.getMaterial()!==shield&&p.getMaterial()!==antenna)continue;
 const b=p.getMaterial()===pcb?{min:[-14.5,-26],max:[14.5,26]}:p.getMaterial()===antenna?{min:[-9,19.3],max:[9,26]}:shieldBounds,uv=new Float32Array(p.getAttribute('POSITION').getCount()*2);
 for(let i=0;i<p.getAttribute('POSITION').getCount();i++){const v=worldPoint(n,p,i);uv[2*i]=Math.max(0,Math.min(1,(v[0]-b.min[0])/(b.max[0]-b.min[0])));uv[2*i+1]=Math.max(0,Math.min(1,(b.max[1]-v[1])/(b.max[1]-b.min[1])))}
 p.setAttribute('TEXCOORD_0',doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(p.getAttribute('POSITION').getBuffer()));
}
console.log('Textured PCB and shield; copper antenna faces:',antennaFaces);
await doc.transform(dedup(),flatten(),join({keepNamed:false}),weld(),prune(),meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:12}));
await io.write('public/models/esp32-30pin.glb',doc);
const runtime=await io.read('public/models/esp32-30pin.glb'),bounds=getBounds(runtime.getRoot().listScenes()[0]);let triangles=0;
for(const mesh of runtime.getRoot().listMeshes())for(const p of mesh.listPrimitives())triangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3;
const metadata={boundsMm:bounds,dimensions:bounds.max.map((n,i)=>n-bounds.min[i]),triangles,materials:runtime.getRoot().listMaterials().length,bytes:(await fs.stat('public/models/esp32-30pin.glb')).size};
await fs.writeFile('artifacts/esp30-runtime.json',JSON.stringify(metadata,null,2));console.log(metadata);
const cad=JSON.parse(await fs.readFile('artifacts/esp30-cad.json','utf8'));
if(cad.sourceSha256!=='477be34622303be57819480d08a5448d0c9b80476f8dd5f3bd110cc7c9769916')throw new Error('Unreviewed source: check contacts and material assignments');
const shafts=cad.solids.filter(s=>Math.abs(s.size[0]-.64)<.0001&&Math.abs(s.size[1]-.64)<.0001&&Math.abs(s.size[2]-11.54)<.0001);
if(shafts.length!==30)throw new Error('Expected thirty header shafts');
const rows=[shafts.filter(s=>s.min[0]<12),shafts.filter(s=>s.min[0]>12)].map(row=>row.sort((a,b)=>b.min[1]-a.min[1]));
const marks=[['EN','VP','VN','34','35','32','33','25','26','27','14','12','13','GND','VIN'],['23','22','TX0','RX0','21','19','18','5','TX2','RX2','4','2','15','GND','3V3']];
const special={VP:36,VN:39,TX0:1,RX0:3,TX2:17,RX2:16};
const adc={36:'ADC1_CH0',39:'ADC1_CH3',34:'ADC1_CH6',35:'ADC1_CH7',32:'ADC1_CH4',33:'ADC1_CH5',25:'ADC2_CH8',26:'ADC2_CH9',27:'ADC2_CH7',14:'ADC2_CH6',12:'ADC2_CH5',13:'ADC2_CH4',4:'ADC2_CH0',2:'ADC2_CH2',15:'ADC2_CH3'};
const touch={4:0,2:2,15:3,13:4,12:5,14:6,27:7,33:8,32:9};
const pins=[];rows.forEach((row,r)=>{if(row.length!==15)throw new Error('Expected fifteen pins per row');row.forEach((s,i)=>{
 if(i&&Math.abs(row[i-1].min[1]-s.min[1]-2.54)>.0001)throw new Error('Unexpected pitch');
 const mark=marks[r][i],gpio=special[mark]??(/^\d+$/.test(mark)?Number(mark):undefined),functions=[],notes=[],aliases=[mark];let label=mark,electrical='bidirectional',voltage=3.3;
 if(gpio!==undefined){label=mark in special?`${mark} / GPIO${gpio}`:`GPIO${gpio}`;aliases.push(`GPIO${gpio}`,`IO${gpio}`);if(adc[gpio])functions.push(adc[gpio]);if(touch[gpio]!==undefined)functions.push(`TOUCH${touch[gpio]}`);if(gpio===25||gpio===26)functions.push(gpio===25?'DAC1':'DAC2');if([34,35,36,39].includes(gpio)){electrical='input';notes.push('Input only; no internal pull-up or pull-down.')}if([2,5,12,15].includes(gpio))notes.push('Boot strapping pin; external levels affect startup.');if(gpio===1||gpio===3){functions.push(gpio===1?'UART0 TX':'UART0 RX');notes.push('USB-to-UART bridge signals; this classic ESP32 has no native USB GPIO pins.')}if(gpio===16||gpio===17)functions.push(gpio===16?'UART2 RX':'UART2 TX');if(gpio===21)functions.push('Default Arduino I2C SDA');if(gpio===22)functions.push('Default Arduino I2C SCL');if(gpio===18)functions.push('Default Arduino SPI SCK');if(gpio===19)functions.push('Default Arduino SPI MISO');if(gpio===23)functions.push('Default Arduino SPI MOSI');if(gpio===5)functions.push('Default Arduino SPI CS');}
 else if(mark==='GND'){electrical='ground';voltage=0}else if(mark==='EN'){electrical='input';functions.push('CHIP_PU / reset');aliases.push('RESET','CHIP_PU')}else{electrical=mark==='3V3'?'power-out':'power-in';voltage=mark==='3V3'?3.3:5;if(mark==='VIN')aliases.push('5V')}
 const position=[(s.min[0]+s.max[0])/2-12.065,(s.min[1]+s.max[1])/2-23.368,s.min[2]+.79770097].map(n=>Number(n.toFixed(6)));
 pins.push({id:`J${r+1}-${i+1}`,label,silkscreen:mark,side:r?'right':'left',index:i,physicalPosition:i+1,electrical,voltage,functions,aliases,notes:notes.join(' '),localPosition:position,cadPosition:position,exitDirection:[0,0,-1]});
})});
const component={id:'esp32-30pin',modelId:'esp32-30pin',name:'ESP32 WROOM-32 (30 pin)',position:[0,55,0],rotation:[0,0,0],pins,dimensions:metadata.dimensions,geometry:{kind:'model',quality:'detailed',modelFormat:'glb',modelAssetId:'esp32-30pin',modelUrl:'/models/esp32-30pin.glb',modelCenter:[0,0,0],origin:[0,0,0],calibrated:true,verified:false,geometryVerified:true,pinPositionsVerified:true,electricalMappingVerified:false,pinMappingVersion:1,pinToleranceMm:.02,modelSource:'Imported STEP CAD / user-selected standard 30-pin WROOM-32 mapping',sourceFilename:'esp32_30pin.step',sourceSha256:cad.sourceSha256,triangleCount:metadata.triangles,meshCount:1,materialCount:metadata.materials}};
await fs.writeFile('src/data/esp32-30pin.json',JSON.stringify(component,null,2));
await fs.writeFile('public/models/esp32-30pin.manifest.json',JSON.stringify({sourceSha256:cad.sourceSha256,...metadata,component,headerShafts:shafts,textures:runtime.getRoot().listTextures().map(t=>({name:t.getName(),bytes:t.getImage()?.length})),sourceBoundsMm:cad.boundsMm,physicalHardwareVerified:false,mappingBasis:'User explicitly requested standard ESP32 WROOM-32 pinout. Common DOIT-style 30-pin row ordering is assigned; geometry anchors measured from source. Exact electrical order of this unlabelled draft STEP is not independently verified.',appearance:'Original geometry retained. Added procedural PCB/shield/antenna color textures and brushed metal PBR finishes; printed labels illustrate the selected reference mapping, not evidence found in the CAD.',references:['https://github.com/espressif/arduino-esp32/blob/master/variants/doitESP32devkitV1/pins_arduino.h','https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/gpio.html']},null,2));console.log('Mapped',pins.length,'standard reference contacts');
