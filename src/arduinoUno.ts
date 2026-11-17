import type {Component,Pin} from './model';

const pin=(id:string,label:string,position:number,x:number,y:number,electrical:string,aliases:string[]=[]):Pin=>({id,label,side:x<0?'right':'left',index:position-1,physicalPosition:position,localPosition:[-x,-y,8.8],cadPosition:[-x,-y,8.8],orientation:[0,0,1],exitDirection:[0,0,1],electrical,aliases:aliases.length?aliases:undefined});
const digitalLeft=['D0 / RX','D1 / TX','D2','D3 / PWM','D4','D5 / PWM','D6 / PWM','D7'];
const digitalRight=['D8','D9 / PWM','D10 / PWM / SS','D11 / PWM / MOSI','D12 / MISO','D13 / SCK / LED','GND','AREF','SDA / A4','SCL / A5'];
const power=['NC','IOREF','RESET','3.3V','5V','GND','GND','VIN'];
const analog=['A0','A1','A2','A3','A4 / SDA','A5 / SCL'];
const pins:Pin[]=[];
// Header socket coordinates come from the source GLB. Local X follows the
// short board axis and local Y follows the long axis after the X rotation.
for(let i=0;i<8;i++)pins.push(pin(`J_DIG_A_${i+1}`,digitalLeft[i],i+1,24.0177,-28.59+i*2.49,'digital-inout'));
for(let i=0;i<10;i++)pins.push(pin(`J_DIG_B_${i+1}`,digitalRight[i],i+1,24.0177,-7.30+i*2.49,digitalRight[i]==='GND'?'ground':digitalRight[i]==='AREF'?'analog-reference':digitalRight[i].includes('SDA')||digitalRight[i].includes('SCL')?'i2c':'digital-inout',digitalRight[i].includes('SDA')?['A4']:digitalRight[i].includes('SCL')?['A5']:[]));
for(let i=0;i<8;i++)pins.push(pin(`J_POWER_${i+1}`,power[i],i+1,-24.0123,6.16-i*2.49,power[i]==='GND'?'ground':power[i]==='5V'||power[i]==='3.3V'?'power-out':power[i]==='VIN'?'power-in':power[i]==='RESET'?'digital-in':'passive'));
for(let i=0;i<6;i++)pins.push(pin(`J_ANALOG_${i+1}`,analog[i],i+1,-24.0123,-16.13-i*2.49,'analog-in',i===4?['SDA']:i===5?['SCL']:[]));
const icspAliases=(label:string)=>label==='MISO'?['D12']:label==='MOSI'?['D11']:label==='SCK'?['D13']:label==='5V'?['POWER_5V']:label==='RESET'?['POWER_RESET']:label==='GND'?['POWER_GND']:[];
const icsp=(prefix:string,xs:number[],ys:number[],labels:string[])=>{let n=0;for(let row=0;row<2;row++)for(let col=0;col<3;col++){const label=labels[row*3+col];pins.push(pin(`${prefix}_${++n}`,label,n,xs[col],ys[row],label==='GND'?'ground':label==='5V'?'power-out':label==='RESET'?'digital-in':'digital-inout',icspAliases(label)))}};
icsp('J_ICSP_MCU',[-1.3723,1.1177,3.5977],[-28.84,-31.34],['MISO','5V','SCK','MOSI','RESET','GND']);
const icspUsbX=[18.0977,20.6077],icspUsbY=[18.23,15.74,13.24],icspUsbLabels=['MISO','5V','SCK','MOSI','RESET','GND'];
for(let row=0;row<3;row++)for(let col=0;col<2;col++){const n=row*2+col+1,label=icspUsbLabels[row*2+col];pins.push(pin(`J_ICSP_USB_${n}`,label,n,icspUsbX[col],icspUsbY[row],label==='GND'?'ground':label==='5V'?'power-out':label==='RESET'?'digital-in':'digital-inout',(label==='5V'?['POWER_5V']:label==='GND'?['POWER_GND']:[`USB_${label}`])))}
export const ARDUINO_UNO_R3_COMPONENT:Component={id:'arduino-uno-r3',modelId:'arduino-uno-r3',name:'Arduino Uno R3',position:[0,55,0],rotation:[0,0,0],pins,dimensions:[53,75.45,14.28],geometry:{kind:'model',quality:'detailed',modelFormat:'glb',modelAssetId:'arduino-uno-r3',modelContentHash:'fc24d029bc12c126203f5b5f89c40d62de3b75532bcfb267e33dabe9d189f8a2',modelUrl:'/models/arduino-uno-r3.glb',modelCenter:[0.0000823,0.0008,0.0000644],modelScale:1000,modelOrientation:[Math.PI/2,0,0],modelSource:'User-supplied Arduino Uno Sketchfab GLB',sourceFilename:'Arduino UNO sketchfab.glb',calibrated:true,geometryVerified:true,pinPositionsVerified:true,electricalMappingVerified:true,pinToleranceMm:0.2,pinMappingVersion:2,meshCount:7,triangleCount:51026,materialCount:10,category:'Microcontrollers / Development Boards'}};
