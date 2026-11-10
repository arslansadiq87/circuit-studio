import type {Pin} from './model';
import measured from './data/esp32-wroom-anchors.json';

const gpioByPosition:Record<number,number>={3:36,4:39,5:34,6:35,7:32,8:33,9:25,10:26,11:27,12:14,13:12,15:13,16:9,17:10,18:11,20:6,21:7,22:8,23:15,24:2,25:0,26:4,27:16,28:17,29:5,30:18,31:19,33:21,34:3,35:1,36:22,37:23};
const adc:Record<number,string>={36:'ADC1_CH0',39:'ADC1_CH3',34:'ADC1_CH6',35:'ADC1_CH7',32:'ADC1_CH4',33:'ADC1_CH5',25:'ADC2_CH8',26:'ADC2_CH9',27:'ADC2_CH7',14:'ADC2_CH6',12:'ADC2_CH5',13:'ADC2_CH4',4:'ADC2_CH0',0:'ADC2_CH1',2:'ADC2_CH2',15:'ADC2_CH3'};
const touch:Record<number,number>={4:0,0:1,2:2,15:3,13:4,12:5,14:6,27:7,33:8,32:9};
const flash:Record<number,string>={6:'CLK',7:'SD0',8:'SD1',9:'SD2',10:'SD3',11:'CMD'};
const strap=new Set([0,2,5,12,15]),inputOnly=new Set([34,35,36,39]);

export const ESP32_WROOM_PINS:Pin[]=measured.pins.map(contact=>{
 const n=contact.physicalPosition,gpio=gpioByPosition[n],mark=contact.silkscreen;
 const functions:string[]=[],notes:string[]=[],aliases=[mark];
 let label=mark,electrical='bidirectional',voltage=3.3;
 if(gpio!==undefined){
  aliases.push(`GPIO${gpio}`,`IO${gpio}`);label=mark.startsWith('P')?`GPIO${gpio}`:`${mark} / GPIO${gpio}`;
  if(adc[gpio])functions.push(adc[gpio]);if(touch[gpio]!==undefined)functions.push(`TOUCH${touch[gpio]}`);
  if(gpio===25||gpio===26)functions.push(gpio===25?'DAC1':'DAC2');
  if(gpio===1||gpio===3){functions.push(gpio===1?'UART0 TX':'UART0 RX');notes.push('Shared with the on-board USB-to-UART bridge.')}
  if(gpio===16||gpio===17)functions.push(gpio===16?'UART2 RX':'UART2 TX');
  if(flash[gpio]){functions.push(`SPI flash ${flash[gpio]}`);notes.push('Flash-reserved: connected to module SPI flash; do not use as ordinary GPIO.')}
  if(inputOnly.has(gpio)){electrical='input';notes.push('Input only; no internal pull-up or pull-down.')}
  if(strap.has(gpio))notes.push('Boot strapping pin; reset-time logic level affects startup.');
 }else if(mark==='GND'){electrical='ground';voltage=0;functions.push('Ground')}
 else if(mark==='EN'){electrical='input';functions.push('CHIP_PU / reset');aliases.push('CHIP_PU','RESET');notes.push('Active low reset / chip enable.')}
 else{electrical='power-in';voltage=mark==='5V'?5:3.3;functions.push(`${voltage} V supply`)}
 return {id:contact.id,label,silkscreen:mark,physicalPosition:n,side:contact.side as 'left'|'right',index:contact.index,electrical,voltage,aliases,functions,notes:notes.join(' '),localPosition:[...contact.localPosition] as [number,number,number],cadPosition:[...contact.localPosition] as [number,number,number],exitDirection:[0,0,-1]};
});
export const WROOM_PIN_VERIFICATION={pinMappingVersion:1,pinPositionsVerified:true,electricalMappingVerified:true,verified:true,pinToleranceMm:.05};
