import {describe,it,expect} from 'vitest';
import {ESP32_30PIN_COMPONENT,ComponentSchema} from '../src/model';
import manifest from '../public/models/esp32-30pin.manifest.json';
describe('30-pin ESP32 WROOM standard reference',()=>{
 const c=ESP32_30PIN_COMPONENT;
 it('assigns the selected 15-per-side reference without claiming draft PCB verification',()=>{
  expect(c.pins).toHaveLength(30);expect(new Set(c.pins.map(p=>p.id)).size).toBe(30);
  expect(c.pins.slice(0,15).map(p=>p.silkscreen)).toEqual(['EN','VP','VN','34','35','32','33','25','26','27','14','12','13','GND','VIN']);
  expect(c.pins.slice(15).map(p=>p.silkscreen)).toEqual(['23','22','TX0','RX0','21','19','18','5','TX2','RX2','4','2','15','GND','3V3']);
  expect(c.geometry?.pinPositionsVerified).toBe(false);expect(c.geometry?.electricalMappingVerified).toBe(false);
 });
 it('matches the measured shaft tips and actual CAD spacing',()=>{
  const shafts=manifest.headerShafts;
  for(const p of c.pins){expect(shafts.some(s=>Math.abs(p.localPosition![0]-((s.min[0]+s.max[0])/2-12.065))<.00001&&Math.abs(p.localPosition![1]-((s.min[1]+s.max[1])/2-23.368))<.00001)).toBe(true);expect(p.localPosition![2]).toBeCloseTo(.85,5);expect(p.exitDirection).toEqual([0,0,1])}
  expect(c.pins[15].localPosition![0]-c.pins[0].localPosition![0]).toBeCloseTo(25.4,5);
  expect(c.pins[0].localPosition![1]-c.pins[1].localPosition![1]).toBeCloseTo(2.54,5);
 });
 it('distinguishes classic ESP32 restrictions and communication roles',()=>{
  expect(c.pins.filter(p=>p.electrical==='input'&&p.label!=='EN').map(p=>p.aliases!.find(a=>/^GPIO/.test(a)))).toEqual(['GPIO36','GPIO39','GPIO34','GPIO35']);
  expect(c.pins.find(p=>p.id==='J2-3')?.functions).toContain('UART0 TX');
  expect(c.pins.find(p=>p.id==='J2-4')?.functions).toContain('UART0 RX');
  expect(c.pins.some(p=>p.functions?.some(f=>f.startsWith('USB D')))).toBe(false);
  expect(c.pins.some(p=>p.aliases?.includes('GPIO20'))).toBe(false);
  expect(c.pins.filter(p=>p.electrical==='ground')).toHaveLength(2);
  expect(ComponentSchema.parse(JSON.parse(JSON.stringify(c)))).toEqual(c);
 });
});
