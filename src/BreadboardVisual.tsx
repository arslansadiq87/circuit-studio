import {useMemo} from 'react';
import {useLoader} from '@react-three/fiber';
import * as THREE from 'three';
import {resolveAssetUrl} from './assets';
import {breadboardLayouts, top, width, type BreadboardSize} from './breadboard';
import type {Component} from './model';
import {useEditor} from './store';

const materials = new WeakMap<THREE.Texture, THREE.MeshStandardMaterial>();
const cached = new Map<BreadboardSize, THREE.BufferGeometry>();
function boardGeometry(size: BreadboardSize) {
 const existing = cached.get(size);
 if (existing) return existing;
 const {dimensions, rows} = breadboardLayouts[size];
 const half = dimensions[0] / 2;
 const positions: number[] = [], uv: number[] = [], colors: number[] = [], indices: number[] = [];
 type Point = [number, number, number];
 const quad = (points: Point[], tint = 1, artwork = true) => {
  const start = positions.length / 3;
  for (const [x, y, z] of points) {
   positions.push(x, y, z);
   uv.push(artwork ? (50 + (x + half - 4.01) * 31.58 / 2.54) / 2048 : .012,
    artwork ? 1 - (340 - y * 12.43) / 683 : .53);
   colors.push(tint, tint, tint);
  }
  indices.push(start, start+1, start+2, start, start+2, start+3);
 };
 const surface = (x: number, right: number, y: number, upper: number, z = top, tint = 1) =>
  quad([[x,y,z],[right,y,z],[right,upper,z],[x,upper,z]], tint, tint === 1);
 const walls = (x: number, right: number, y: number, upper: number, high: number, low: number, tint: number) => {
  quad([[x,y,low],[right,y,low],[right,y,high],[x,y,high]], tint, false);
  quad([[right,y,low],[right,upper,low],[right,upper,high],[right,y,high]], tint, false);
  quad([[right,upper,low],[x,upper,low],[x,upper,high],[right,upper,high]], tint, false);
  quad([[x,upper,low],[x,y,low],[x,y,high],[x,upper,high]], tint, false);
 };
 const rim = .9;
 for (const [lower, upper] of [[-width/2,-1],[1,width/2]]) {
  let yEdge = lower;
  for (const row of rows.filter(row => row.y > lower && row.y < upper)) {
   surface(-half, half, yEdge, row.y-rim);
   let xEdge = -half;
   for (const pin of row.pins) {
    const [x,y] = pin.localPosition!;
    surface(xEdge, x-rim, y-rim, y+rim);
    const ring = (r: number, z: number): Point[] => [[x-r,y-r,z],[x+r,y-r,z],[x+r,y+r,z],[x-r,y+r,z]];
    const outer = ring(rim, top), inner = ring(.62, top-.65), floor = ring(.62, top-1.65);
    for (let i = 0; i < 4; i++) {
     const next = (i+1)%4;
     quad([outer[i],outer[next],inner[next],inner[i]], .62, false);
     quad([inner[i],inner[next],floor[next],floor[i]], .27, false);
    }
    quad(floor, .13, false);
    xEdge = x+rim;
   }
   surface(xEdge, half, row.y-rim, row.y+rim, top,
    size === 'quarter' && Math.abs(row.y)>20 ? .98 : 1);
   yEdge = row.y+rim;
  }
  surface(-half, half, yEdge, upper);
 }
 const channel = top-1.55;
 walls(-half, half, -width/2, width/2, channel, -top, .81);
 walls(-half, half, -width/2, -1, top, channel, .87);
 walls(-half, half, 1, width/2, top, channel, .87);
 surface(-half,half,-1,1,channel,.56);
 quad([[-half,width/2,-top],[half,width/2,-top],[half,-width/2,-top],[-half,-width/2,-top]],.78,false);
 const geometry = new THREE.BufferGeometry();
 geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
 geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();
 cached.set(size,geometry);
 return geometry;
}

export function BreadboardVisual({component}: {component: Component}) {
 const size = component.breadboardSize ?? 'full';
 const mode = useEditor(s => s.mode);
 const select = useEditor(s => s.select);
 const clickPin = useEditor(s => s.clickPin);
 const texture = useLoader(THREE.TextureLoader, resolveAssetUrl('/models/breadboard-top.jpg'));
 const material = useMemo(() => {
  const existing = materials.get(texture);
  if (existing) return existing;
  texture.colorSpace = THREE.SRGBColorSpace;
  const shared = new THREE.MeshStandardMaterial({map:texture, vertexColors:true, roughness:.95});
  materials.set(texture, shared);
  return shared;
 }, [texture]);
 const geometry = boardGeometry(size);
 const [length] = breadboardLayouts[size].dimensions;
 return <group onClick={event => {event.stopPropagation(); select(component.id)}}>
  <mesh geometry={geometry} material={material} dispose={null} raycast={() => {}}/>
  <mesh position={[0,0,top]} onClick={event => {
   if (mode !== 'wire') return;
   event.stopPropagation();
   const point = event.object.worldToLocal(event.point.clone());
   const row = breadboardLayouts[size].rows.find(row => Math.abs(row.y-point.y)<1.1);
   const pin = row?.pins.find(pin => Math.abs(pin.localPosition![0]-point.x)<1.1);
   if (pin) clickPin(component.id,pin.id);
  }}>
   <planeGeometry args={[length,width]}/><meshBasicMaterial visible={false}/>
  </mesh>
 </group>;
}
