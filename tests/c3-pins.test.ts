import {describe,it,expect} from 'vitest';
import {ESP32_C3_COMPONENT,ComponentSchema} from '../src/model';
describe('Waveshare ESP32-C3 Zero pinout',()=>{
 const c=ESP32_C3_COMPONENT;
 it('matches all eighteen published physical pin numbers and signals',()=>{
  expect(c.pins.map(p=>p.id)).toEqual(Array.from({length:18},(_,i)=>`P${i+1}`));
  expect(c.pins.map(p=>p.label)).toEqual(['5V','GND','3V3','GPIO0','GPIO1','GPIO2','GPIO3','GPIO4','GPIO5','GPIO6','GPIO7','GPIO8','GPIO9','GPIO10','GPIO18','GPIO19','RX / GPIO20','TX / GPIO21']);
  expect(c.pins.filter(p=>p.electrical==='bidirectional')).toHaveLength(15);
  expect(c.pins.some(p=>/GPIO1[2-7]\b/.test(p.label))).toBe(false);
 });
 it('uses top metal annuli at measured pitch and the manufacturer top-view orientation',()=>{
  expect(c.pins[0].localPosition).toEqual([-6.995,10.16,.8]);
  expect(c.pins[8].localPosition).toEqual([-6.995,-10.16,.8]);
  expect(c.pins[9].localPosition).toEqual([6.995,-10.16,.8]);
  expect(c.pins[17].localPosition).toEqual([6.995,10.16,.8]);
  expect(c.pins.every(p=>p.exitDirection?.[2]===1)).toBe(true);
  expect(c.dimensions?.[0]).toBeCloseTo(18,2);expect(c.dimensions?.[1]).toBeCloseTo(24.75,2);
 });
 it('retains C3-specific functions, power roles and restrictions',()=>{
  expect(c.pins[14].functions).toContain('USB D-');expect(c.pins[15].functions).toContain('USB D+');
  expect(c.pins[16].functions).toContain('UART0 RX');expect(c.pins[17].functions).toContain('UART0 TX');
  expect(c.pins.filter(p=>p.notes?.includes('Strapping')).map(p=>p.label)).toEqual(['GPIO2','GPIO8','GPIO9']);
  expect(c.pins[13].notes).toContain('WS2812');expect(c.pins[2].electrical).toBe('power-out');
  expect(ComponentSchema.parse(JSON.parse(JSON.stringify(c)))).toEqual(c);
 });
});
