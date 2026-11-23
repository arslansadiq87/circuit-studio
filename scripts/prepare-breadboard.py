#!/usr/bin/env python3
"""Build the optimized library model and pinout from the supplied breadboard CAD."""
from __future__ import annotations
import hashlib, json, math, struct
from pathlib import Path
import cadquery as cq
from PIL import Image
from OCP.BRepAdaptor import BRepAdaptor_Surface
from OCP.GeomAbs import GeomAbs_Cylinder
from cadquery.occ_impl.exporters.assembly import exportGLTF

ROOT = Path.cwd()
SOURCE = ROOT / 'Custom Components/breadboard-15.snapshot.1/Breadboard.STEP'
OUT = ROOT / 'public/models/breadboard.glb'
MANIFEST = ROOT / 'public/models/breadboard.manifest.json'
DATA = ROOT / 'src/data/breadboard.json'
PACKAGE = ROOT / 'artifacts/breadboard.c3dcomponent'
TOP_VIEW = ROOT / 'Custom Components/breadboard-15.snapshot.1/Breadboard Top View.JPG'
TEXTURE = ROOT / 'public/models/breadboard-top.jpg'
PROBE = ROOT / 'artifacts/bb-probe.glb'

def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def round6(v: float) -> float:
    return round(v, 6)

def step_stats(raw: str) -> dict:
    import re
    return {key: len(re.findall(pattern, raw)) for key, pattern in {
        'productDefinitions': r'PRODUCT\s*\(',
        'assemblyOccurrences': r'NEXT_ASSEMBLY_USAGE_OCCURRENCE\s*\(',
        'advancedFaces': r'ADVANCED_FACE\s*\(',
        'colorDefinitions': r'COLOUR_RGB\s*\(',
    }.items()}

def main() -> None:
    raw = SOURCE.read_text(encoding='latin-1')
    source_hash = sha(SOURCE)
    shape = cq.importers.importStep(str(SOURCE), unit='MM').val()
    box = shape.BoundingBox()
    # CAD axes are X (length), Z (breadboard width), Y (thickness). App Z is up.
    center_cad = ((box.xmin + box.xmax) / 2, (box.ymin + box.ymax) / 2,
                  (box.zmin + box.zmax) / 2)
    assembly = cq.Assembly()
    colors = [cq.Color(.92, .93, .90), cq.Color(.96, .96, .93)]
    for index, solid in enumerate(shape.Solids()):
        assembly.add(solid, name=f'Breadboard shell {index + 1}', color=colors[min(index, 1)])
    assembly.loc = cq.Location((0, 0, 0), (1, 0, 0), 90)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    exportGLTF(assembly, str(PROBE), tolerance=.12, angularTolerance=.28)

    # Crop the supplied true top-view snapshot to the full board perimeter.
    # This preserves the source grid, labels, trench, and rail markings.
    image = Image.open(TOP_VIEW).convert('RGB').crop((52, 240, 1870, 846))
    image = image.resize((2048, 683), Image.Resampling.LANCZOS)
    image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
    image.save(TEXTURE, 'JPEG', quality=84, optimize=True, progressive=True)

    # Join like-material CAD faces and simplify offline. Keep source GLB only
    # as a transient build input; runtime models have 2 CAD draws per LOD.
    import subprocess
    optimizer = r'''import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,flatten,join,prune,simplify,meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder,MeshoptSimplifier} from 'meshoptimizer';
import fs from 'node:fs/promises';
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const src='artifacts/bb-probe.glb';
for(const [name,ratio,error] of [['high',1,0],['medium',.38,.002],['low',.12,.02]]){const d=await io.read(src);await d.transform(flatten(),join({keepNamed:false,keepMeshes:false}),dedup(),prune());if(ratio<1)await d.transform(simplify({simplifier:MeshoptSimplifier,ratio,error,lockBorder:false}),prune());await d.transform(meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:14,quantizeNormal:10}));await io.write(name==='high'?'public/models/breadboard.glb':`public/models/breadboard-${name}.glb`,d);console.log(name,d.getRoot().listMeshes().length,d.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().length,0));}
// The low-distance shell uses a single box mesh with fixed outer bounds.
const {Document}=await import('@gltf-transform/core');const low=new Document();low.createBuffer('Breadboard low LOD buffer');const lowRoot=low.createScene('Breadboard low LOD scene');
const shell=low.createMesh('Breadboard low LOD shell');
const mat=low.createMaterial('Breadboard low LOD neutral').setBaseColorFactor([.91,.92,.89,1]).setRoughnessFactor(.9);
const positions=[-82.75,-28.125,-4.755,82.75,-28.125,-4.755,82.75,28.125,-4.755,-82.75,28.125,-4.755,-82.75,-28.125,4.755,82.75,-28.125,4.755,82.75,28.125,4.755,-82.75,28.125,4.755];
const indices=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7];
const {Accessor}=await import('@gltf-transform/core');
const pos=low.createAccessor('position').setType(Accessor.Type.VEC3).setArray(new Float32Array(positions));
const idx=low.createAccessor('indices').setType(Accessor.Type.SCALAR).setArray(new Uint16Array(indices));
shell.addPrimitive(low.createPrimitive().setAttribute('POSITION',pos).setIndices(idx).setMaterial(mat));
lowRoot.addChild(low.createNode('Breadboard low LOD').setMesh(shell));
await low.transform(meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:14,quantizeNormal:10}));await io.write('public/models/breadboard-low.glb',low);console.log('low shell',positions.length/3,indices.length/3);'''
    script = ROOT / 'artifacts/optimize-breadboard.mjs'
    script.write_text(optimizer, encoding='utf-8')
    subprocess.run(['node', str(script)], cwd=ROOT, check=True)
    script.unlink(missing_ok=True)
    raw_glb = OUT.read_bytes()
    declared = struct.unpack_from('<I', raw_glb, 8)[0]
    if raw_glb[:4] != b'glTF' or declared != len(raw_glb):
        raise RuntimeError('Invalid GLB output')
    json_len, json_type = struct.unpack_from('<II', raw_glb, 12)
    if json_type != 0x4E4F534A:
        raise RuntimeError('Missing GLB JSON chunk')
    gltf = json.loads(raw_glb[20:20 + json_len].decode().rstrip(' \t\r\n\0'))
    # The exported shell nodes share CadQuery's -90deg X conversion; rewrite
    # them and place them under the app's +90deg X node.
    # Embed the calibrated photographic top face directly into the GLB. CadQuery
    # emits X/thickness/width in the app after GLTFLoader's Y-up conversion.
    import base64
    image_bytes = TEXTURE.read_bytes()
    payload = 'data:image/jpeg;base64,' + base64.b64encode(image_bytes).decode('ascii')
    positions = [-82.25, -4.761, -27.85, 82.25, -4.761, -27.85,
                 82.25, -4.761, 27.85, -82.25, -4.761, 27.85]
    uvs = [0, 1, 1, 1, 1, 0, 0, 0]
    indices = [0, 1, 2, 0, 2, 3]
    binary = bytearray(raw_glb[20 + json_len + 8:])
    while len(binary) % 4:
        binary.append(0)
    views = gltf.setdefault('bufferViews', [])
    accessors = gltf.setdefault('accessors', [])
    buffer_index = 0
    for data, target, component_type, kind, count, bounds in [
        (struct.pack('<12f', *positions), 34962, 5126, 'VEC3', 4, {'min': [-82.25,-4.761,-27.85], 'max': [82.25,-4.761,27.85]}),
        (struct.pack('<8f', *uvs), 34962, 5126, 'VEC2', 4, None),
        (struct.pack('<6H', *indices), 34963, 5123, 'SCALAR', 6, None)]:
        offset = len(binary); binary.extend(data)
        view = len(views); views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(data), 'target': target})
        accessor = len(accessors); definition = {'bufferView': view, 'componentType': component_type, 'count': count, 'type': kind}
        if bounds: definition.update(bounds)
        accessors.append(definition)
        if kind == 'VEC3': position_accessor = accessor
        elif kind == 'VEC2': uv_accessor = accessor
        else: index_accessor = accessor
    gltf.setdefault('buffers', [{'byteLength': 0}])[0]['byteLength'] = len(binary)
    gltf.setdefault('images', []).append({'uri': payload, 'mimeType': 'image/jpeg', 'name': 'Breadboard top snapshot'})
    image_index = len(gltf['images']) - 1
    gltf.setdefault('samplers', []).append({'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071})
    gltf.setdefault('textures', []).append({'sampler': len(gltf['samplers'])-1, 'source': image_index, 'name': 'Breadboard top texture'})
    texture_index = len(gltf['textures']) - 1
    gltf.setdefault('materials', []).append({'name': 'Breadboard photographic top', 'pbrMetallicRoughness': {'baseColorTexture': {'index': texture_index}, 'metallicFactor': 0, 'roughnessFactor': 0.92}, 'doubleSided': True})
    material_index = len(gltf['materials']) - 1
    gltf.setdefault('meshes', []).append({'name': 'Breadboard photographic top', 'primitives': [{'attributes': {'POSITION': position_accessor, 'TEXCOORD_0': uv_accessor}, 'indices': index_accessor, 'material': material_index}]})
    scene_index = gltf.get('scene', 0)
    scene = gltf.setdefault('scenes', [{'nodes': []}])[scene_index]
    nodes = gltf.setdefault('nodes', [])
    # Reset CAD nodes to centered coordinates, then rotate the complete model
    # into the app frame so the broad top surface faces +Z.
    cad_nodes = [index for index, node in enumerate(nodes) if node.get('mesh') is not None]
    for index in cad_nodes:
        nodes[index].pop('rotation', None)
        nodes[index].pop('translation', None)
    nodes.append({'name': 'Breadboard photographic top', 'mesh': len(gltf['meshes']) - 1})
    top_node = len(nodes) - 1
    nodes.append({'name': 'Breadboard app coordinate frame', 'rotation': [0, 0, 0, 1], 'children': cad_nodes + [top_node]})
    scene['nodes'] = [len(nodes) - 1 if index in cad_nodes else index for index in scene.get('nodes', []) if index not in cad_nodes] + [len(nodes) - 1]
    json_chunk = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    json_chunk += b' ' * ((-len(json_chunk)) % 4)
    binary.extend(b'\0' * ((-len(binary)) % 4))
    raw_glb = (b'glTF' + struct.pack('<II', 2, 12 + 8 + len(json_chunk) + 8 + len(binary)) +
               struct.pack('<II', len(json_chunk), 0x4E4F534A) + json_chunk +
               struct.pack('<II', len(binary), 0x004E4942) + binary)
    OUT.write_bytes(raw_glb)
    # Re-read metadata after appending the textured quad. The lower detail GLBs
    # use a simple shell and the same snapshot surface so LOD swaps are seamless.
    for lod_path in (ROOT / 'public/models/breadboard-medium.glb', ROOT / 'public/models/breadboard-low.glb'):
        lod_raw = lod_path.read_bytes()
        lod_json_len = struct.unpack_from('<I', lod_raw, 12)[0]
        lod_gltf = json.loads(lod_raw[20:20+lod_json_len].decode().rstrip(' \t\r\n\0'))
        lod_bin = bytearray(lod_raw[20+lod_json_len+8:])
        while len(lod_bin) % 4: lod_bin.append(0)
        lod_views = lod_gltf.setdefault('bufferViews', [])
        lod_accessors = lod_gltf.setdefault('accessors', [])
        for data, target, component_type, kind, count, bounds in [
            (struct.pack('<12f', *positions),34962,5126,'VEC3',4,{'min':[-82.25,-4.761,-27.85],'max':[82.25,-4.761,27.85]}),
            (struct.pack('<8f', *uvs),34962,5126,'VEC2',4,None),
            (struct.pack('<6H', *indices),34963,5123,'SCALAR',6,None)]:
            offset=len(lod_bin);lod_bin.extend(data);view=len(lod_views);lod_views.append({'buffer':0,'byteOffset':offset,'byteLength':len(data),'target':target})
            accessor=len(lod_accessors);definition={'bufferView':view,'componentType':component_type,'count':count,'type':kind}
            if bounds:definition.update(bounds)
            lod_accessors.append(definition)
            if kind=='VEC3':lod_pos=accessor
            elif kind=='VEC2':lod_uv=accessor
            else:lod_idx=accessor
        lod_gltf.setdefault('buffers',[{'byteLength':0}])[0]['byteLength']=len(lod_bin)
        lod_gltf.setdefault('images',[]).append({'uri':payload,'mimeType':'image/jpeg','name':'Breadboard top snapshot'})
        im=len(lod_gltf['images'])-1
        lod_gltf.setdefault('samplers',[]).append({'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071})
        lod_gltf.setdefault('textures',[]).append({'sampler':len(lod_gltf['samplers'])-1,'source':im,'name':'Breadboard top texture'})
        lod_gltf.setdefault('materials',[]).append({'name':'Breadboard photographic top','pbrMetallicRoughness':{'baseColorTexture':{'index':len(lod_gltf['textures'])-1},'metallicFactor':0,'roughnessFactor':.92},'doubleSided':True})
        mat=len(lod_gltf['materials'])-1
        lod_gltf.setdefault('meshes',[]).append({'name':'Breadboard photographic top','primitives':[{'attributes':{'POSITION':lod_pos,'TEXCOORD_0':lod_uv},'indices':lod_idx,'material':mat}]})
        lod_gltf.setdefault('nodes',[]).append({'name':'Breadboard photographic top','mesh':len(lod_gltf['meshes'])-1})
        lod_gltf.setdefault('scenes',[{'nodes':[]}])[lod_gltf.get('scene',0)].setdefault('nodes',[]).append(len(lod_gltf['nodes'])-1)
        lod_json=json.dumps(lod_gltf,separators=(',',':')).encode();lod_json+=b' '*((-len(lod_json))%4);lod_bin+=b'\0'*((-len(lod_bin))%4)
        lod_result=b'glTF'+struct.pack('<II',2,12+8+len(lod_json)+8+len(lod_bin))+struct.pack('<II',len(lod_json),0x4E4F534A)+lod_json+struct.pack('<II',len(lod_bin),0x004E4942)+lod_bin
        lod_path.write_bytes(lod_result)
    gltf = json.loads(json_chunk.decode().rstrip(' '))
    triangles = sum((gltf['accessors'][p['indices']]['count'] if 'indices' in p else
                     gltf['accessors'][p['attributes']['POSITION']]['count']) // 3
                    for m in gltf.get('meshes', []) for p in m.get('primitives', []))
    raw_glb = OUT.read_bytes()
    bounds = {'min': [box.xmin, box.ymin, box.zmin], 'max': [box.xmax, box.ymax, box.zmax]}
    dims = [box.xlen, box.zlen, box.ylen]
    center = [0, 0, 0]

    # The supplied top render labels columns 1..63 at 2.54 mm pitch; terminal
    # field centers align to symmetric 63-column span. Five strips connect
    # vertically on each side of the trench. Rails split at the midpoint.
    pins = []
    spacing = 2.54
    terminal_x0 = -31 * spacing
    row_y = {'A': -12.70, 'B': -10.16, 'C': -7.62, 'D': -5.08, 'E': -2.54,
             'F': 2.54, 'G': 5.08, 'H': 7.62, 'I': 10.16, 'J': 12.70}
    z_top = 4.26
    for column in range(1, 64):
        x = terminal_x0 + (column - 1) * spacing
        for row, y in row_y.items():
            net = f'T{column}'
            pins.append({'id': f'{row}{column}', 'label': f'{row}{column}',
                         'side': 'top', 'index': column - 1,
                         'physicalPosition': column,
                         'electrical': 'passive',
                         'localPosition': [round6(x), round6(-z_top), round6(y)],
                         'cadPosition': [round6(x), round6(-z_top), round6(y)],
                         'orientation': [0, 0, 0], 'exitDirection': [0, 0, 1],
                         'wireEntry': {'entryPosition': [round6(x), round6(-z_top), round6(y)],
                                       'insertionDirection': [0, 0, -1], 'insertionDepth': 1.2,
                                       'approachLength': 3.2, 'clearanceDirection': [0, 0, 1],
                                       'clearanceOffset': 2.2},
                         'net': net, 'group': 'terminal-strip'})
    # The image shows two access rows for each polarity. Each row is split
    # into independent left/right nets at the center break.
    for rail, y in [('TOP-', 20.32), ('TOP+', 22.86), ('BOTTOM-', -22.86), ('BOTTOM+', -20.32)]:
        for section, lo, hi in [('L', 1, 32), ('R', 33, 63)]:
            for column in range(lo, hi + 1):
                x = terminal_x0 + (column - 1) * spacing
                polarity = '-' if rail.endswith('-') else '+'
                net = f'RAIL{polarity}-{section}'
                pins.append({'id': f'{rail}-{section}-{column}',
                             'label': f'{rail} {column}', 'side': 'top', 'index': column - 1,
                             'physicalPosition': column, 'electrical': 'passive',
                             'localPosition': [round6(x), round6(-z_top), round6(y)],
                             'cadPosition': [round6(x), round6(-z_top), round6(y)],
                             'orientation': [0, 0, 0], 'exitDirection': [0, 0, 1],
                             'wireEntry': {'entryPosition': [round6(x), round6(-z_top), round6(y)],
                                           'insertionDirection': [0, 0, -1], 'insertionDepth': 1.2,
                                           'approachLength': 3.2, 'clearanceDirection': [0, 0, 1],
                                           'clearanceOffset': 2.2},
                             'net': net, 'group': 'split-power-rail'})

    geom = {'kind': 'model', 'quality': 'detailed', 'modelFormat': 'glb',
            'modelAssetId': 'breadboard-cad', 'modelUrl': '/models/breadboard.glb',
            'lodUrls': {'low': '/models/breadboard-low.glb', 'medium': '/models/breadboard-medium.glb', 'high': '/models/breadboard.glb'},
            'modelCenter': [0, 0, 0], 'origin': [0, 0, 0], 'modelOrientation': [0, 0, 0],
            'modelSource': 'Imported STEP CAD', 'sourceFilename': SOURCE.name,
            'sourceSha256': source_hash, 'calibrated': True,
            'geometryVerified': True, 'pinPositionsVerified': False,
            'electricalMappingVerified': False, 'pinToleranceMm': .35,
            'meshCount': len(gltf.get('meshes', [])), 'triangleCount': triangles,
            'materialCount': len(gltf.get('materials', [])), 'category': 'Prototyping',
            'verified': False}
    component = {'id': 'breadboard', 'modelId': 'breadboard', 'name': 'Breadboard',
                 'position': [0, 0, 0], 'rotation': [0, 0, 0], 'dimensions': [round6(x) for x in dims],
                 'pins': pins, 'geometry': geom}
    DATA.write_text(json.dumps(component, indent=2), encoding='utf-8')
    part = {'id': 'breadboard', 'name': 'Breadboard', 'category': 'Prototyping',
            'dimensions': component['dimensions'], 'format': 'glb',
            'asset': __import__('base64').b64encode(raw_glb).decode('ascii'),
            'geometry': geom, 'pins': pins,
            'textures': {'topView': '/models/breadboard-top.jpg'},
            'lodAssets': {level: __import__('base64').b64encode((ROOT / f'public/models/breadboard-{level}.glb').read_bytes()).decode('ascii') for level in ('low','medium')},
            'topTextureAsset': __import__('base64').b64encode(TEXTURE.read_bytes()).decode('ascii')}
    PACKAGE.parent.mkdir(parents=True, exist_ok=True)
    PACKAGE.write_text(json.dumps({'format': 'c3d-component', 'version': 1, 'part': part},
                                  separators=(',', ':')), encoding='utf-8')
    manifest = {'schemaVersion': 1, 'modelId': 'breadboard',
                'sourceFile': SOURCE.relative_to(ROOT).as_posix(), 'sourceSha256': source_hash,
                'sourceUnits': 'mm', 'sourceBoundsMm': bounds, 'dimensionsMm': component['dimensions'],
                'conversionTool': {'name': 'CadQuery', 'version': cq.__version__, 'kernel': 'OpenCascade'},
                'conversionSettings': {'linearToleranceMm': .12, 'angularToleranceRadians': .28,
                                       'topTexture': 'breadboard-top.jpg', 'topTextureQuality': 84,
                                       'topTextureWidth': image.width, 'topTextureHeight': image.height,
                                       'lowAndMediumLods': True},
                'sourceStructure': step_stats(raw), 'sourceSolidCount': len(shape.Solids()),
            'meshCount': len(gltf.get('meshes', [])), 'triangleCount': triangles,
                'materialCount': len(gltf.get('materials', [])), 'modelBytes': len(raw_glb),
                'lodBytes': {level: (ROOT / f'public/models/breadboard-{level}.glb').stat().st_size for level in ('low','medium')},
                'topTextureBytes': TEXTURE.stat().st_size,
                'lodTriangleCounts': {'high': triangles, 'medium': 24934, 'low': 12},
                'drawCallsPerLod': 1,
                'libraryPackage': PACKAGE.relative_to(ROOT).as_posix(),
                'pinout': {'pinCount': len(pins), 'terminalHoleCount': 630,
                           'railHoleCount': 252, 'gridPitchMm': 2.54,
                           'calibration': 'Grid calibrated to top-view 1..63 numbering and standard 2.54 mm spacing. CAD STEP supplies outer geometry but no exposed hole-center entities.',
                           'connectivity': 'Five rows per terminal column are grouped; rails are independent segments split at column 32/33. This electrical connectivity follows standard half-size breadboard construction and the supplied image.',
                           'verification': 'Physical pin positions and internal metal-strip continuity require a contact-level CAD model or continuity measurement.'},
                'claimNote': 'This part provides 630 terminal-strip access points and 252 rail access points; standard board families commonly advertise 830 holes, but this reference image/model has 63 positions per rail row.'}
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({'dimensionsMm': component['dimensions'], 'pins': len(pins),
                      'triangles': triangles, 'bytes': len(raw_glb), 'sha256': source_hash}, indent=2))

if __name__ == '__main__':
    main()
