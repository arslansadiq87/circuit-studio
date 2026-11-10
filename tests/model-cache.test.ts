import 'fake-indexeddb/auto';
import {it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {capTextures} from '../src/modelCache';
it('caps interactive textures without changing the shared original and restores them for export',()=>{
 vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>({drawImage:()=>{}})})});
 try{const image={width:2048,height:1024};const texture=new THREE.Texture(image);const material=new THREE.MeshStandardMaterial({map:texture});const group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);group.add(mesh);const restore=capTextures(group,512);const capped=mesh.material as THREE.MeshStandardMaterial;expect(capped).not.toBe(material);expect(capped.map!.image.width).toBe(512);expect(capped.map!.image.height).toBe(256);expect(texture.image).toBe(image);expect(texture.image.width).toBe(2048);restore();expect(mesh.material).toBe(material);expect((mesh.material as THREE.MeshStandardMaterial).map!.image.width).toBe(2048);const high=capTextures(group,4096);expect(mesh.material).toBe(material);high();mesh.geometry.dispose();material.dispose();texture.dispose()}finally{vi.unstubAllGlobals()}
});
