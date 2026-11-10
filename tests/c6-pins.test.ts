import {describe,it,expect} from 'vitest';
import {ESP32_C6_COMPONENT,ComponentSchema} from '../src/model';
import cad from '../public/models/esp32-c6-supermini.manifest.json';
describe('Tenstar ESP32-C6 Supermini pinout',()=>{
 const c=ESP32_C6_COMPONENT;
 it('includes every external contact with unique stable IDs',()=>{
  expect(c.pins).toHaveLength(27);expect(new Set(c.pins.map(p=>p.id)).size).toBe(27);
  expect(c.pins.filter(p=>p.id.startsWith('J1')).map(p=>p.silkscreen)).toEqual(['5V','GND','3V3','20','19','18','15','14','9','8']);
  expect(c.pins.filter(p=>p.id.startsWith('J2')).map(p=>p.silkscreen)).toEqual(['TX','RX','0','1','2','3','4','5','6','7']);
  expect(c.pins.filter(p=>p.id.startsWith('PAD')).map(p=>p.silkscreen)).toEqual(['12','13','21','22','23']);
  expect(c.pins.slice(-2).map(p=>p.silkscreen)).toEqual(['B+','B-']);
 });
 it('matches the actual CAD shafts and row pitch rather than rounding to nominal dimensions',()=>{
  c.pins.slice(0,20).forEach((p,i)=>{const s=cad.headerShafts[i],point=[(s.min[0]+s.max[0])/2-9,(s.min[1]+s.max[1])/2-13,s.min[2]-.575];p.localPosition!.slice(0,2).forEach((n,j)=>expect(n).toBeCloseTo(point[j],5));p.cadPosition!.forEach((n,j)=>expect(n).toBeCloseTo(point[j],5));expect(p.localPosition![2]).toBeCloseTo(.65,5);expect(p.exitDirection).toEqual([0,0,1])});
  expect(c.pins[10].localPosition![0]-c.pins[0].localPosition![0]).toBeCloseTo(15.25,5);
  expect(c.pins[1].localPosition![1]-c.pins[0].localPosition![1]).toBeCloseTo(2.54,5);
 });
 it('uses all 22 QFN32 GPIOs and the C6 USB/UART roles',()=>{
  const gpios=c.pins.flatMap(p=>p.aliases??[]).filter(a=>/^GPIO\d+$/.test(a));expect(new Set(gpios).size).toBe(22);
  expect(c.pins.find(p=>p.id==='PAD-GPIO12')?.functions).toContain('USB D-');expect(c.pins.find(p=>p.id==='PAD-GPIO13')?.functions).toContain('USB D+');
  expect(c.pins.find(p=>p.id==='J2-1')?.aliases).toContain('GPIO16');expect(c.pins.find(p=>p.id==='J2-2')?.aliases).toContain('GPIO17');
  expect(c.pins.filter(p=>p.notes?.includes('Strapping')).map(p=>p.silkscreen).sort()).toEqual(['15','4','5','8','9']);
  expect(c.pins.find(p=>p.id==='B+')?.voltage).toBeUndefined();
  expect(ComponentSchema.parse(JSON.parse(JSON.stringify(c)))).toEqual(c);
 });
});
