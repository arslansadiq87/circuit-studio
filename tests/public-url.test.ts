import {describe,expect,it} from 'vitest';
import {publicUrl} from '../src/publicUrl';

describe('public asset URLs',()=>{
 it('keeps root-absolute paths unchanged at the root base',()=>{expect(publicUrl('/models/led-3mm.glb','/')).toBe('/models/led-3mm.glb')});
 it('prefixes root-absolute paths with a project-site base',()=>{expect(publicUrl('/models/esp32-c6-supermini.glb','/circuit-studio/')).toBe('/circuit-studio/models/esp32-c6-supermini.glb');expect(publicUrl('/fonts/IBMPlexMono-Regular.ttf','/circuit-studio')).toBe('/circuit-studio/fonts/IBMPlexMono-Regular.ttf')});
 it('keeps query strings used for cache busting',()=>{expect(publicUrl('/models/ldr.glb?v=colors-1','/circuit-studio/')).toBe('/circuit-studio/models/ldr.glb?v=colors-1')});
 it('leaves absolute, protocol-relative, blob and data URLs alone',()=>{for(const url of ['https://example.com/a.glb','//cdn.example.com/a.glb','blob:http://localhost/abc','data:model/gltf-binary;base64,AA'])expect(publicUrl(url,'/circuit-studio/')).toBe(url)});
});
