import {expect,it} from 'vitest';
import * as THREE from 'three';
import {makeWireCurve} from '../src/geometry';
import type {Wire} from '../src/model';

it('rounds planar and vertical bends with continuous tangents and fixed contacts',()=>{
 const points:[number,number,number][]=[[0,0,0],[5,0,0],[5,5,0],[5,5,2],[10,5,2]];
 const wire:Wire={id:'rounded',from:{componentId:'a',pinId:'1'},to:{componentId:'b',pinId:'1'},diameter:1.05,color:'#fff',label:'Rounded',curvature:19,routeMode:'clean',routingPoints:points};
 const curve=makeWireCurve(wire,new THREE.Vector3(...points[0]),new THREE.Vector3(...points.at(-1)!),new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),undefined,undefined,[]) as THREE.CurvePath<THREE.Vector3>;
 expect(curve.getPoint(0).toArray()).toEqual(points[0]);
 expect(curve.getPoint(1).toArray()).toEqual(points.at(-1));
 expect(curve.curves.filter(segment=>segment instanceof THREE.CubicBezierCurve3)).toHaveLength(3);
 for(let i=1;i<curve.curves.length;i++)expect(curve.curves[i-1].getTangent(1).dot(curve.curves[i].getTangent(0))).toBeGreaterThan(.999);
 for(const corner of points.slice(1,-1))expect(Math.min(...curve.getSpacedPoints(300).map(point=>point.distanceTo(new THREE.Vector3(...corner))))).toBeGreaterThan(.2);
});

it('removes a pin lead that doubles back before changing routing plane',()=>{
 const points:[number,number,number][]=[[0,0,0],[2,0,0],[2,0,.7],[2,0,-.95],[2,3,-.95]];
 const wire:Wire={id:'pin-bend',from:{componentId:'a',pinId:'1'},to:{componentId:'b',pinId:'1'},diameter:1.05,color:'#fff',label:'Pin bend',curvature:19,routeMode:'clean',routingPoints:points};
 const curve=makeWireCurve(wire,new THREE.Vector3(...points[0]),new THREE.Vector3(...points.at(-1)!),new THREE.Vector3(1,0,0),new THREE.Vector3(0,-1,0),undefined,undefined,[]) as THREE.CurvePath<THREE.Vector3>;
 expect(Math.max(...curve.getSpacedPoints(200).map(point=>point.z))).toBeLessThanOrEqual(0);
 for(let i=1;i<curve.curves.length;i++)expect(curve.curves[i-1].getTangent(1).dot(curve.curves[i].getTangent(0))).toBeGreaterThan(.999);
});
