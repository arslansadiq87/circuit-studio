# 3 mm LED with selectable lens color

The Parts Bin's 3 mm LED replaces the former 5 mm red LED placeholder with
`Custom Components/LED 3mm.STEP`. Source SHA256:
`9b3c17acbc655a13d4fb19dfac9b68919dee6e0d30adb7c58ccdd92277d6528f`.
The STEP file is unchanged. The runtime GLB retains all 6,044 tessellated triangles
and two materials in 28,200 bytes, preserving the source's body and lead geometry.
The flange is approximately 3.33 x 3.5 mm; the source lens diameter is 3 mm.

Select the component and choose **Lens color** in the inspector. The standard
color picker accepts any RGB color. The original lens is green by default.
Colors are stored per component and persist in JSON and portable ZIP projects,
including undo/redo. Only `LED_LENS` is recolored. Runtime lens materials are
cloned per instance and disposed on replacement/unmount; cached source materials
and metal lead materials are shared without mutation.

The source CAD uses Y as the LED's vertical axis. The runtime transforms
CAD [X,Y,Z] into editor [X,-Z,Y], retaining millimeters and the flange base origin.
Two planar end faces give P0 at [-0.75,0,-2] and P1 at [0.7,0,-2] mm, with
exits [0,0,-1]. Both leads have the same length. Anode/cathode identity is not
verified by this source, so the inspector uses Terminal 1 and Terminal 2.

Old procedural LED instances upgrade on open, preserving IDs, transforms,
visibility and assigned colors. Placeholder left contacts P0/P1 map to P0;
right contacts P2/P3 map to P1. Imported custom components remain intact.

Rebuild with:

```powershell
py -3.14 scripts/prepare-led.py
node scripts/prepare-led.mjs
```

Validation: production build, 42 unit tests, and `node scripts/e2e-led.mjs`.
The browser verifies two independent colors, unchanged metal materials, both
lead tip surfaces, and color persistence through JSON and ZIP round trips.
See `artifacts/led-verification.json` and `artifacts/led-color-editor.png`.
