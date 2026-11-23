import {Euler,MathUtils,Quaternion} from 'three';

export function rebaseXRotation(rotation:[number,number,number],baseDegrees:number):[number,number,number]{
 const [x,y,z]=rotation;
 if(y===0&&z===0){
  const relative=x-baseDegrees;
  return [((relative+180)%360+360)%360-180,0,0];
 }
 const old=new Quaternion().setFromEuler(new Euler(...rotation.map(MathUtils.degToRad) as [number,number,number]));
 const inverseBase=new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(-baseDegrees),0,0));
 const relative=new Euler().setFromQuaternion(old.multiply(inverseBase));
 return [relative.x,relative.y,relative.z].map(MathUtils.radToDeg) as [number,number,number];
}
