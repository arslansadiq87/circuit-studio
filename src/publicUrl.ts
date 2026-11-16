// Files in public/ are referenced by root-absolute paths ('/models/x.glb'). Saved projects keep that stable form;
// requests resolve it against the deployment base (e.g. '/circuit-studio/' on GitHub Pages).
const deploymentBase=(import.meta as {env?:{BASE_URL?:string}}).env?.BASE_URL??'/';
export function publicUrl(path:string,base:string=deploymentBase){return path.startsWith('/')&&!path.startsWith('//')?base.replace(/\/+$/,'')+path:path}
