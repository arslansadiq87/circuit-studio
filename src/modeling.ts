import * as THREE from 'three';

/** Shared millimetre based primitive factories for procedural component models. */
export const pcbPlateGeometry=(width:number,length:number,thickness:number)=>new THREE.BoxGeometry(width,length,thickness);
export const headerHousingGeometry=(width=2.5,pitch=2.54,height=2.05)=>new THREE.BoxGeometry(width,pitch,height);
export const headerPinGeometry=(width=.72,pitch=.72,height=3.2)=>new THREE.BoxGeometry(width,pitch,height);
export const screwTerminalGeometry=(diameter=1.5,length=5)=>new THREE.CylinderGeometry(diameter/2,diameter/2,length,12);
export const icPackageGeometry=(width:number,length:number,height:number)=>new THREE.BoxGeometry(width,length,height);
export const buttonCapGeometry=(diameter=2.3,height=.16)=>new THREE.CylinderGeometry(diameter/2,diameter/2,height,16);
export const ledLensGeometry=(diameter=5)=>new THREE.SphereGeometry(diameter/2,18,12,0,Math.PI*2,0,Math.PI/2);
export function mountingRimGeometry(outer=2.05,inner=1.35,thickness=.16,segments=24){const shape=new THREE.Shape();shape.absarc(0,0,outer,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole);return new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,curveSegments:segments})}
