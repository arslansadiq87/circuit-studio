# ESP32 WROOM-32 (30 pin)

The Parts Bin includes the supplied `Custom Components/esp32_30pin.step`, with
realistic material finishes, embedded textures and all 30 header contacts.
The original STEP remains unchanged, SHA256
`477be34622303be57819480d08a5448d0c9b80476f8dd5f3bd110cc7c9769916`.

## Mapping basis

The file identifies itself as `esp32-30pin_3dmodel_draft v1.step`. It contains
mechanical geometry but no electrical pin labels, schematic or exact maker ID.
The user explicitly selected the standard ESP32-WROOM-32 pinout. The assigned
layout is the common DOIT-style 30-pin reference below, with GPIO functions
cross-checked against Espressif's
[DOIT Arduino variant](https://github.com/espressif/arduino-esp32/blob/master/variants/doitESP32devkitV1/pins_arduino.h)
and [ESP32 GPIO documentation](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/gpio.html).
This does not establish the unlabeled draft board's actual PCB connectivity.

The inspector marks the assignment **STANDARD MAP**, separates this from the
CAD-measured contact positions, and provides calibration and wire-start controls.
`pinPositionsVerified` is true; `electricalMappingVerified` and overall `verified`
remain false. Model replacement therefore requires explicit endpoint mapping.

Viewed from above with antenna at +Y and USB at -Y, both rows count from antenna
to USB:

| Position | J1 / left | J2 / right |
| ---: | --- | --- |
| 1 | EN | GPIO23 |
| 2 | VP / GPIO36 | GPIO22 |
| 3 | VN / GPIO39 | TX0 / GPIO1 |
| 4 | GPIO34 | RX0 / GPIO3 |
| 5 | GPIO35 | GPIO21 |
| 6 | GPIO32 | GPIO19 |
| 7 | GPIO33 | GPIO18 |
| 8 | GPIO25 | GPIO5 |
| 9 | GPIO26 | TX2 / GPIO17 |
| 10 | GPIO27 | RX2 / GPIO16 |
| 11 | GPIO14 | GPIO4 |
| 12 | GPIO12 | GPIO2 |
| 13 | GPIO13 | GPIO15 |
| 14 | GND | GND |
| 15 | VIN | 3V3 |

There are 25 GPIOs, EN, two grounds, VIN and 3V3. GPIO34/35/36/39 are input only
without internal pulls. Exposed GPIO2/5/12/15 have startup strapping roles.
GPIO6-11 and GPIO0 are not exposed in this reference header layout. UART0 is
GPIO1/3; UART2 is GPIO17/16. Classic ESP32 has no native USB GPIOs. Header search
includes aliases, ADC, DAC, touch, UART and configurable Arduino I2C/SPI defaults.
VIN's displayed 5 V is nominal, not a verified supply limit for the draft PCB.

## Geometry and materials

The source board is 29 x 52 x 1.5954 mm. Overall dimensions, including connector
and headers, are approximately 29 x 52.964 x 13.528 mm. The local origin is the
PCB center at CAD [12.065,23.368,-0.79770097] mm; CAD axes remain unchanged.
Direct XCAF export writes meters, converted to millimeters by the runtime builder.

All 181,098 tessellated source triangles are retained. Thirty separate shaft
solids measure approximately 0.64 x 0.64 x 11.54 mm. Each anchor is the underside
tip face center, with exit [0,0,-1]. Measured pitch is 2.54 mm and row spacing
25.4 mm; the source's tiny placement tilts are retained. Hardware dimensions
have not been independently measured.

The runtime GLB is 2,168,252 bytes, with 23 materials and five embedded textures:

- Black solder-mask color with fine surface variation and selected-map labels.
- Steel shield color with an illustrative ESP32/WROOM-32 label.
- Packed brushed-shield metallic/roughness finish.
- Dark antenna substrate with decorative copper meander color.
- Packed antenna copper/substrate metallic/roughness finish.

Gold headers, connector contacts, steel shell, solder joints, switch metal,
ceramic components, green indicator lenses and black packages have distinct PBR
colors and finishes. Source geometry is preserved. Added antenna artwork and
printed labels are visual treatments, not measured RF artwork or evidence for
electrical mapping. Materials apply only to this model.

## Rebuild and validation

```powershell
py -3.14 scripts/prepare-esp30.py
py -3.14 scripts/texture-esp30.py
node scripts/prepare-esp30.mjs
npm run build
npm run test
node scripts/e2e-esp30.mjs
```

Python dependencies include `scripts/requirements-cad.txt` and Pillow; texture
generation uses the Windows Consolas font. The generator rejects an unreviewed
source hash. Full geometry, pin and texture metadata are in
`public/models/esp32-30pin.manifest.json`; the component definition is
`src/data/esp32-30pin.json`.

Production build and 51 tests pass. Browser checks verify all 30 contacts against
the actual runtime mesh (maximum error 0.000215 mm), five loaded textures, metallic
shield material, searchable UART roles, 90 calibration fields, two UI-created
wires, 90-degree rotation with zero marker-to-wire-anchor error, and JSON/ZIP
reopening in fresh browser contexts with `/models/` network access blocked.
Numerical mesh agreement is not a hardware tolerance measurement.

Artifacts: `esp30-pin-verification.json`, `esp30-editor-top.png`,
`esp30.c3dproj` and `esp30.c3dzip` under `artifacts/`.
