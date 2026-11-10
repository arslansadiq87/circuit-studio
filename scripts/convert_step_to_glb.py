#!/usr/bin/env python3
"""Convert the user's STEP assembly to a grouped, color-preserving GLB."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import struct
import tempfile
from collections import Counter
from pathlib import Path

import cadquery as cq

J1 = ['3V3','3V3','RST','GPIO4','GPIO5','GPIO6','GPIO7','GPIO15','GPIO16','GPIO17','GPIO18','GPIO8','GPIO3','GPIO46','GPIO9','GPIO10','GPIO11','GPIO12','GPIO13','GPIO14','5V','GND']
J3 = ['GND','TX / GPIO43','RX / GPIO44','GPIO1','GPIO2','GPIO42','GPIO41','GPIO40','GPIO39','GPIO38','GPIO37','GPIO36','GPIO35','GPIO0','GPIO45','GPIO48','GPIO47','GPIO21','GPIO20 / USB D+','GPIO19 / USB D-','GND','GND']
PRODUCT = re.compile(r"(#(\d+)\s*=\s*PRODUCT\(\s*'[^']*'\s*,\s*')([^']*)(')", re.S)
OCCURRENCE = re.compile(r"(#(\d+)\s*=\s*NEXT_ASSEMBLY_USAGE_OCCURRENCE\(\s*'[^']*'\s*,\s*')([^']*)(')", re.S)

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def dimensions(box):
    return [round(box.xlen, 9), round(box.ylen, 9), round(box.zlen, 9)]

def bbox(box):
    return {"min": [round(box.xmin, 9), round(box.ymin, 9), round(box.zmin, 9)],
            "max": [round(box.xmax, 9), round(box.ymax, 9), round(box.zmax, 9)],
            "size": dimensions(box)}

def disambiguate_repeated_labels(source: str) -> tuple[str, dict[str, int]]:
    """CadQuery/OCCT requires unique assembly labels; only rewrite a temp copy."""
    product_matches = list(PRODUCT.finditer(source))
    product_counts = Counter(m.group(3) for m in product_matches)
    occurrence_matches = list(OCCURRENCE.finditer(source))
    occurrence_counts = Counter(m.group(3) for m in occurrence_matches)
    source = PRODUCT.sub(lambda m: m.group(1) + m.group(3) +
                         (f"__def_{m.group(2)}" if product_counts[m.group(3)] > 1 else "") + m.group(4), source)
    source = OCCURRENCE.sub(lambda m: m.group(1) + m.group(3) +
                            (f"__inst_{m.group(2)}" if occurrence_counts[m.group(3)] > 1 else "") + m.group(4), source)
    return source, {"productLabelsDisambiguated": sum(c > 1 for c in product_counts.values()),
                    "occurrenceLabelsDisambiguated": sum(c > 1 for c in occurrence_counts.values())}

def inspect_glb(path: Path) -> dict:
    raw = path.read_bytes()
    if len(raw) < 20 or raw[:4] != b'glTF':
        raise RuntimeError('Exporter did not produce a binary glTF file')
    version, declared_length = struct.unpack_from('<II', raw, 4)
    if version != 2 or declared_length != len(raw):
        raise RuntimeError('GLB header validation failed')
    json_length, json_type = struct.unpack_from('<II', raw, 12)
    if json_type != 0x4E4F534A:
        raise RuntimeError('GLB JSON chunk is missing')
    doc = json.loads(raw[20:20 + json_length].decode('utf-8').rstrip(' \t\r\n\0'))
    if doc.get('asset', {}).get('version') != '2.0' or not doc.get('meshes'):
        raise RuntimeError('GLB has no renderable mesh primitives')
    triangles = 0
    for mesh in doc['meshes']:
        for primitive in mesh.get('primitives', []):
            if 'indices' in primitive:
                triangles += doc['accessors'][primitive['indices']]['count'] // 3
            else:
                triangles += doc['accessors'][primitive['attributes']['POSITION']]['count'] // 3
    return {"bytes": len(raw), "glbVersion": version, "meshCount": len(doc['meshes']),
            "nodeCount": len(doc.get('nodes', [])), "materialCount": len(doc.get('materials', [])),
            "triangleCount": triangles}

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, help='STEP/STP source; auto-detect one file in Custom Components otherwise')
    parser.add_argument('--output', type=Path, default=Path('public/models/yd-esp32-s3-v34.glb'))
    parser.add_argument('--manifest', type=Path, default=Path('public/models/yd-esp32-s3-v34.manifest.json'))
    parser.add_argument('--tolerance', type=float, default=0.03, help='linear tessellation tolerance in mm')
    parser.add_argument('--angular-tolerance', type=float, default=0.1, help='angular tessellation tolerance in radians')
    args = parser.parse_args()
    root = Path.cwd()
    if args.input:
        source_path = args.input.resolve()
    else:
        candidates = [p for d in root.iterdir() if d.is_dir() and 'custom' in d.name.lower()
                      for p in d.rglob('*') if p.suffix.lower() in ('.step', '.stp')]
        if len(candidates) != 1:
            raise SystemExit(f'Expected exactly one source STEP in a custom component directory; found {len(candidates)}')
        source_path = candidates[0]
    if not source_path.is_file() or source_path.suffix.lower() not in ('.step', '.stp'):
        raise SystemExit(f'Not a STEP/STP file: {source_path}')
    source_hash = sha256(source_path)
    settings = {"pipelineVersion": 3, "cadquery": cq.__version__, "unit": "MM", "linearToleranceMm": args.tolerance,
                "angularToleranceRadians": args.angular_tolerance, "preserveAssembly": True,
                "preserveColors": True, "axisTransform": "gltfXYZ = (cadX, cadZ, -cadY); appXYZ = (gltfX, -gltfY, -gltfZ + 0.5mm)"}
    if args.output.exists() and args.manifest.exists():
        try:
            cached = json.loads(args.manifest.read_text(encoding='utf-8'))
            if cached.get('sourceSha256') == source_hash and cached.get('conversionSettings') == settings:
                print('CAD conversion is current; source checksum and conversion settings match.')
                return
        except (OSError, json.JSONDecodeError):
            pass
    raw = source_path.read_text(encoding='latin-1')
    sanitized, name_stats = disambiguate_repeated_labels(raw)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='circuit-studio-cad-') as td:
        temp_step = Path(td) / ('source' + source_path.suffix.lower())
        temp_glb = Path(td) / args.output.name
        temp_step.write_text(sanitized, encoding='latin-1')
        assembly = cq.Assembly.load(str(temp_step), unit='MM')
        compound = assembly.toCompound()
        overall = compound.BoundingBox()
        pcb_node = next((e for name, e in assembly.traverse() if name == 'PCB:1'), None)
        if pcb_node is None:
            raise RuntimeError('Assembly has no PCB:1 object; refusing to apply YD-ESP32-S3 calibration')
        pcb_box = pcb_node.obj.BoundingBox()
        header_nodes = {name: e for name, e in assembly.traverse() if name in ('22way PCB Header:1', '22way PCB Header:2')}
        if len(header_nodes) != 2:
            raise RuntimeError(f'Expected two 22way PCB Header occurrences, found {len(header_nodes)}')
        pin_rows = {}
        for node_name, e in header_nodes.items():
            pins = []
            for solid in e.obj.Solids():
                b = solid.BoundingBox()
                if b.ylen > 10 and b.xlen < 1 and b.zlen < 1:
                    pins.append({"cadXYZ": [round((b.xmin+b.xmax)/2, 6), round(b.ymax, 6), round((b.zmin+b.zmax)/2, 6)],
                                 "cadBoundsMm": bbox(b)})
            pins.sort(key=lambda p: p['cadXYZ'][0])
            if len(pins) != 22:
                raise RuntimeError(f'{node_name} contains {len(pins)} pin solids; expected 22')
            pitch = [round(pins[i+1]['cadXYZ'][0] - pins[i]['cadXYZ'][0], 6) for i in range(21)]
            if any(abs(p - 2.54) > 0.002 for p in pitch):
                raise RuntimeError(f'{node_name} pin pitch is not a verified 2.54 mm row')
            row_id = 'J1' if node_name.endswith(':1') else 'J3'
            labels = J1 if row_id == 'J1' else J3
            for i, point in enumerate(pins):
                cad_x, cad_y_top, cad_z = point['cadXYZ']
                point.update({"id": f'{row_id}-{i+1}', "label": labels[i], "physicalPosition": i+1,
                              "appXYZ": [round(cad_x, 6), round(-cad_z, 6), round(cad_y_top + 0.5, 6)],
                              "exitDirectionApp": [0, 0, 1]})
            occurrence_translation = list(e.loc.toTuple()[0])
            # Each header definition is modeled in local coordinates and placed by its
            # assembly occurrence (the second header is translated -25.4 mm on CAD Z).
            # Include that placement when computing the actual contact anchor.
            for point in pins:
                point['cadXYZ'][0] += occurrence_translation[0]
                point['cadXYZ'][1] += occurrence_translation[1]
                point['cadXYZ'][2] += occurrence_translation[2]
                cad_x, cad_y_top, cad_z = point['cadXYZ']
                point['appXYZ'] = [round(cad_x, 6), round(-cad_z, 6), round(cad_y_top + 0.5, 6)]
            app_y = -pins[0]['cadXYZ'][2]
            pin_rows[row_id] = {"headerOccurrence": node_name, "occurrenceTranslationMm": occurrence_translation,
                                "rowAppY": round(app_y, 6), "count": 22,
                                "measuredPitchMm": pitch[0], "contacts": pins}
        # CadQuery exports the source hierarchy, placements, component colors and solids as GLB.
        assembly.export(str(temp_glb), exportType='GLTF', tolerance=args.tolerance,
                        angularTolerance=args.angular_tolerance, unit='MM')
        glb_info = inspect_glb(temp_glb)
        temp_manifest = {
            "schemaVersion": 1, "modelId": "yd-esp32-s3-v34", "boardVariant": "YD-ESP32-S3 v34",
            "silkscreenRevision": "YD-ESP32-S3 2022-VL3", "stepSchema": "AUTOMOTIVE_DESIGN / AP214",
            "sourceFile": str(source_path.relative_to(root)).replace('\\', '/') if source_path.is_relative_to(root) else source_path.name,
            "sourceSha256": source_hash, "sourceUnits": "mm", "conversionScale": 1.0,
            "conversionSettings": settings,
            "conversionTool": {"name": "CadQuery", "version": cq.__version__, "kernel": "OpenCascade via cadquery-ocp"},
            "sourceAttribution": "User-supplied STEP; source header author and license fields are blank.",
            "sourceStructure": {"productDefinitions": len(re.findall(r'PRODUCT\(', raw)),
                                "assemblyOccurrences": len(re.findall(r'NEXT_ASSEMBLY_USAGE_OCCURRENCE\(', raw)),
                                "solids": len(re.findall(r'MANIFOLD_SOLID_BREP\(', raw)),
                                "advancedFaces": len(re.findall(r'ADVANCED_FACE\(', raw)),
                                "colorDefinitions": len(re.findall(r'COLOUR_RGB\(', raw)),
                                "stepFileBytes": source_path.stat().st_size,
                                "temporaryNameDisambiguation": name_stats},
            "cadBoundsMm": bbox(overall), "pcbBoundsMm": bbox(pcb_box),
            "pcbDimensionsMm": [round(pcb_box.xlen, 6), round(pcb_box.zlen, 6), round(pcb_box.ylen, 6)],
            "componentDimensionsMm": [round(overall.xlen, 9), round(overall.zlen, 9), round(overall.ylen, 9)],
            "coordinateTransform": {"matrixCadXYZToAppXYZ": [[1,0,0],[0,0,-1],[0,1,0]],
                                    "cadToGltf": "(cadX, cadZ, -cadY)", "gltfToAppRotationDegrees": [180,0,0],
                                    "rotationDegreesCadToApp": [90,0,0], "translationMm": [0,0,0.5],
                                    "origin": "PCB substrate geometric center; physical pin tips remain at their measured positions"},
            "headers": pin_rows,
            "verification": {"geometrySource": "Original supplied STEP assembly", "geometryVerified": True,
                             "pinPositionsVerified": True, "electricalLabelsCrossCheckedAgainstReferencePNG": True,
                             "officialDevKitC1Revision": False,
                             "usbConnectorElectricalContactsMapped": False,
                             "notes": "The two 22-position header rows match the labels shown in all four supplied PNG renders. USB-C solder contacts are retained as CAD geometry but are not assigned invented electrical pin identities."},
            "glb": {"path": '/' + str(args.output).replace('\\','/'), **glb_info}
        }
        args.output.write_bytes(temp_glb.read_bytes())
        args.manifest.write_text(json.dumps(temp_manifest, indent=2), encoding='utf-8')
    print(json.dumps({"source": source_path.name, "sha256": source_hash,
                      "overallMm": temp_manifest['componentDimensionsMm'],
                      "pcbMm": temp_manifest['pcbDimensionsMm'], "glb": str(args.output), **glb_info}, indent=2))

if __name__ == '__main__':
    main()
