import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {describe,it,expect} from 'vitest';
const root=join(__dirname,'..');
const files=(dir:string):string[]=>readdirSync(join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):/\.(tsx?|css|html|json|md)$/.test(e.name)?[join(dir,e.name)]:[]);
// UTF-8 text read as Windows-1252 turns × into Ã—, · into Â·, — into â€” and → into â†’: a lead character of a
// UTF-8 sequence followed by what Windows-1252 shows for a continuation byte.
const misDecoded=/[Â-ô][\u0080-¿ŒœŠšŸŽžƒˆ˜–—‘-„†-•…‰‹›€™]/;
describe('text encoding',()=>{for(const file of [...files('src'),...files('docs'),'README.md'])it(`${file} is valid UTF-8 without mis-decoded characters`,()=>{const text=new TextDecoder('utf-8',{fatal:true}).decode(readFileSync(join(root,file)));expect(text.match(misDecoded)?.[0]).toBeUndefined()})});
