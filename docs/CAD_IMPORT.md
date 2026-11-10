# CAD import: YD-ESP32-S3 v34

## Supplied source

The source is `Custom Components/YD-ESP32-S3 v34.step` (20,631,414 bytes). Its SHA-256 is `edc0685479a0c1a91abd1adf4516ec2784258a58095663b3f4272a125d5cf624`. The four supplied PNG views show the same board variant, including its WROOM-1 shield, two Type-C receptacles, buttons, silkscreen and two 22-contact headers. This is the YD-ESP32-S3 v34 (2022-VL3) and is kept separate from the official ESP32-S3-DevKitC-1 definition.

The STEP declares AP214 `AUTOMOTIVE_DESIGN`, millimeters, 109 product definitions, 227 assembly occurrences, 251 BREP solids, 8,971 advanced faces and 45 color definitions. The measured assembly bounds are 64.023780861 × 11.91 × 27.95 mm in source CAD XYZ. The PCB bounds are 57.15 × 1.10 × 27.94 mm. The app uses X, Y, Z dimensions 64.023780861 × 27.95 × 11.91 mm after a +90° X axis rotation.

The STEP source file is never edited. Duplicate assembly labels are renamed only in a temporary copy because OpenCascade/CadQuery requires unique assembly names.

## Conversion

The repeatable pipeline is `scripts/convert_step_to_glb.py`. It uses CadQuery 2.8.0 and its OpenCascade kernel to load the STEP assembly and export GLB with the assembly hierarchy, placements, names and source colors. Tessellation settings are 0.03 mm linear and 0.1 radians angular tolerance. The generated master is `public/models/yd-esp32-s3-v34.glb`; its manifest is next to it. The GLB has 182 mesh definitions, 12,062 face primitives, 228 nodes, 37 materials and 736,345 triangles (19,774,332 bytes). The script verifies the GLB 2.0 header and renderable mesh primitives and skips conversion when source checksum/settings match.

Sprint 3.6 derives separate runtime LOD files with `npm run optimize:cad` (`scripts/optimize-cad.mjs`). The master remains unchanged. Medium is 1,404,616 bytes / 289,338 triangles; High is 2,933,312 bytes / 736,345 triangles. Each has 34 material-compatible primitives. All use the fixed master origin/scale and independent electrical anchors. See `PERFORMANCE_RESULTS.md` and `GRAPHICS_AND_LOD.md` for measured fidelity/performance and quantization limits.

To reproduce on Windows with Python 3.14:

```powershell
py -3.14 -m venv .cad-venv
.cad-venv\Scripts\python.exe -m pip install -r scripts\requirements-cad.txt
.cad-venv\Scripts\python.exe scripts\convert_step_to_glb.py
```

CadQuery and its OpenCascade Python bindings are the only external conversion dependencies; FreeCAD is not required. Use `--input`, `--output`, `--manifest`, `--tolerance`, or `--angular-tolerance` to override defaults. The current script is purpose-built to validate this YD board’s PCB and two 22-way headers. For other STEP models, convert through CadQuery/FreeCAD and use the existing Component Workshop to import the resulting GLB, set dimensions/origin and define or calibrate pins before wiring.

## Attribution and limits

The model and PNGs were provided by the user. The STEP author and license fields are blank, so no license or manufacturer attribution is asserted. The original assembly has Type-C connector housings and simplified connector contacts, but no confirmed electrical mapping for those USB-C contacts. No USB-C electrical pins are assigned. The STEP is the source of 3D geometry; PNGs are only visual cross-checks.
