import {openDB} from 'idb';
const assetBaseUrl=(import.meta as ImportMeta & {env:{BASE_URL:string}}).env.BASE_URL;
// Resolve bundled public assets against Vite's deployment base at request time.
// Keep the source URLs unchanged so saved project references stay portable.
export function resolveAssetUrl(url:string){
 if(!url.startsWith('/models/')&&!url.startsWith('/fonts/'))return url;
 return `${assetBaseUrl}${url.slice(1)}`;
}
const database=openDB('circuit-studio-assets',1,{upgrade(db){db.createObjectStore('blobs');db.createObjectStore('urls')}});
export async function putAsset(blob:Blob){const bytes=await blob.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');const db=await database;if(!await db.getKey('blobs',hash))await db.put('blobs',blob,hash);return hash}
export async function readAsset(hash:string):Promise<Blob|undefined>{return (await database).get('blobs',hash)}
export async function linkAssetUrl(url:string,hash:string){await (await database).put('urls',hash,url);requests.delete(url)}
const requests=new Map<string,Promise<{blob:Blob;hash:string}>>();
export async function assetFromUrl(url:string,expectedHash?:string){const requestUrl=resolveAssetUrl(url),cacheKey=expectedHash?`${requestUrl}#${expectedHash}`:requestUrl;let request=requests.get(cacheKey);if(!request){request=(async()=>{const db=await database,known=await db.get('urls',requestUrl);if(known&&(!expectedHash||known===expectedHash)){const blob=await readAsset(known);if(blob)return {blob,hash:known}}const response=await fetch(requestUrl,expectedHash?{cache:'reload'}:undefined);if(!response.ok)throw new Error(`Model request failed (${response.status}): ${requestUrl}`);const blob=await response.blob();const hash=await putAsset(blob);if(expectedHash&&hash!==expectedHash)throw new Error(`Asset integrity mismatch: ${requestUrl}`);await linkAssetUrl(requestUrl,hash);return {blob,hash}})();requests.set(cacheKey,request);request.catch(()=>requests.delete(cacheKey))}return request}
export function fromBase64(value:string){const raw=atob(value),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Blob([bytes])}
export async function toBase64(blob:Blob):Promise<string>{if(typeof FileReader==='undefined'){const bytes=new Uint8Array(await blob.arrayBuffer()),chunks:string[]=[];for(let offset=0;offset<bytes.length;offset+=32768)chunks.push(String.fromCharCode(...bytes.subarray(offset,offset+32768)));return btoa(chunks.join(''))}return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})}
