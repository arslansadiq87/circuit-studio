import type {Component, Pin} from './model';

export const breadboardSizes = ['full', 'half', 'quarter'] as const;
export type BreadboardSize = typeof breadboardSizes[number];
export const pitch = 2.54;
export const top = 4.755;
export const width = 56.25;
const columns = {full: 63, half: 31, quarter: 15};
const length = (count: number) => 165.5 - (63 - count) * pitch;

type Row = {y: number; pins: Pin[]};
function makeLayout(size: BreadboardSize) {
 const count = columns[size];
 const dimensions: [number, number, number] = [length(count), width, top * 2];
 const rows: Row[] = [];
 const addRow = (name: string, y: number, rail: boolean) => {
  const pins: Pin[] = [];
  for (let column = 1; column <= count; column++) {
   if (rail && (column < 3 || column > 61 || (column - 3) % 6 === 5 || column - (column - 3) % 6 + 4 > count)) continue;
   const section = column <= 32 ? 'L' : 'R';
   const id = rail ? name + '-' + section + '-' + column : name + column;
   const opening: [number, number, number] = [(column - (count + 1) / 2) * pitch, y, top];
   pins.push({id, label: rail ? name + ' ' + column : id, index: column - 1, physicalPosition: column,
    side: 'top', electrical: 'passive', localPosition: opening, exitDirection: [0, 0, 1],
    net: rail ? name + '-' + section : (name <= 'E' ? 'AE-' : 'FJ-') + column,
    group: rail ? 'split-power-rail' : 'terminal-strip',
    wireEntry: {entryPosition: opening, insertionDirection: [0, 0, -1], insertionDepth: 1.2,
     approachLength: 3, clearanceDirection: [0, 0, 1], clearanceOffset: .2}});
  }
  rows.push({y, pins});
 };
 addRow('BOTTOM+', -24.13, true);
 addRow('BOTTOM-', -21.59, true);
 for (const [i, name] of [...'ABCDEFGHIJ'].entries()) addRow(name, (i - (i < 5 ? 6 : 3)) * pitch, false);
 addRow('TOP+', 21.59, true);
 addRow('TOP-', 24.13, true);
 return {dimensions, rows, pins: rows.flatMap(row => row.pins)};
}
export const breadboardLayouts = {full: makeLayout('full'), half: makeLayout('half'), quarter: makeLayout('quarter')};

export function resizeBreadboard(component: Component, size: BreadboardSize): Component {
 const {dimensions, pins} = breadboardLayouts[size];
 return {...component, name: 'BreadBoard', breadboardSize: size, dimensions, pins,
  geometry: {kind: 'procedural-pcb', quality: 'detailed', category: 'Prototyping',
   modelSource: 'Breadboard STEP and top snapshot', pinPositionsVerified: true}};
}
