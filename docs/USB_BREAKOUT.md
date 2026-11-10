# USB-A female breakout board

The supplied `Custom Components/USB Type A Female Breakout Board.step` replaces
the procedural USB-A socket in the Parts Bin and default circuit. Source SHA256:
`2081af6c93cbd58084f6904f88e3ac4ecc308d930a2442225f3df0aae51e8122`.
The original STEP is unchanged.

The runtime model keeps the original assembly geometry and colors: red PCB,
metal USB shell, green four-position terminal block and screws. Dimensions from
CAD are approximately 20.1 x 28.1 x 12.2 mm. All 118,268 tessellated triangles
are retained; grouping by material and Meshopt compression produce a 591,012-byte
GLB with seven materials. Hardware dimensions have not been independently measured.

The assembly bounds center, CAD [13.244408565,16.6690758195,7.1] mm, becomes
the local origin. CAD Z remains up; a 180-degree Z rotation places the USB mouth
toward local +Y and the terminal entries toward local -Y.

| Stable pin ID | Model marking | Local X (mm) | Local Y (mm) | Local Z (mm) |
| --- | --- | ---: | ---: | ---: |
| A1 | VBUS | 5.25 | -14.05 | 0.275 |
| A2 | D- | 1.75 | -14.05 | 0.275 |
| A3 | D+ | -1.75 | -14.05 | 0.275 |
| A4 | GND | -5.25 | -14.05 | 0.275 |

Signal identities are read from the supplied CAD text, visible in
`artifacts/usb-breakout-top.png`. The terminal pitch is measured as 3.5 mm,
despite a 3.81 mm phrase in an internal assembly name. No guessed pitch is used.
The converter measures the four 2.4 x 3.45 mm inner apertures in the terminal
housing's front planar face. Anchors are at their centers with exits [0,-1,0].
These are wire-entry centers, not surfaces of the screws or USB shield. The shell
is not assigned an invented signal pin. PCB connectivity has not been established
by a continuity test; electrical identities follow the CAD markings.

Existing procedural `usb-a-female` instances upgrade on load, preserving IDs,
position, rotation, visibility, custom names and A1-A4 wire endpoints. Older P0-P3
endpoints migrate by signal order. Already imported custom models are preserved.
The default circuit retains all five connections, including external VBUS power
and common ground. Terminal buttons in the inspector start wiring each signal.

Rebuild:

```powershell
py -3.14 scripts/prepare-usb-breakout.py
node scripts/prepare-usb-breakout.mjs
```

Python dependencies are in `scripts/requirements-cad.txt`. Component data is
`src/data/usb-a-breakout.json`; full measurements and provenance are in
`public/models/usb-a-breakout.manifest.json`.

Validation: production build and 37 unit tests. Run
`node scripts/e2e-usb-breakout.mjs` for browser verification. Rays through all four
entry centers reach the interior metal approximately 6 mm behind the entry plane;
rays beside the entries hit the housing front plane within 0.00009 mm of the CAD
coordinate. This verifies runtime alignment, not real hardware tolerance.
JSON and ZIP project files reopen with all five connections in fresh browser
contexts while all `/models/` network requests are blocked.

Artifacts: `usb-breakout-verification.json`, `usb-breakout-editor.png`,
`usb-breakout.c3dproj`, `usb-breakout.c3dzip` under `artifacts/`.
