# ESP32-C6 Supermini

The Parts Bin includes the supplied `Custom Components/ESP32 C6 Supermini.step`
as **ESP32-C6 Supermini**, with 27 external wiring contacts. The STEP identifies
the assembly as Tenstar C6 Supermini v31; its modeled underside says Super Mini
ESP32-C6. The source is unchanged, SHA256
`d9810a2aa01813701d7cf2bf6f06b5e51e5b7dc61a8628fadd68cd8553b4d6e1`.

The import preserves the assembly's original placements, purple PCB, colors and
all 322,272 tessellated triangles. Runtime: 1,541,888 bytes, 38 materials.
Dimensions are approximately 18 x 27.969 x 13.133 mm including connector and pins.
The PCB itself is 18 x 26 x 1.17 mm. Physical hardware has not been measured.

## Pin verification

Labels are read directly from the supplied top and bottom CAD silkscreen, captured
in `artifacts/c6-top.png` and `artifacts/c6-bottom.png`. GPIO roles are checked
against the [Espressif ESP32-C6 datasheet](https://documentation.espressif.com/esp32-c6_dataSheet_en.pdf).
This verifies modeled identities and geometry, not PCB continuity or battery limits.
No DevKitC header ordering is substituted for the Supermini layout.

The two headers have ten pins each. Both are numbered from the USB end toward
the antenna, with J1 on local -X and J2 on local +X:

| Position | J1 / left marking | J2 / right marking |
| ---: | --- | --- |
| 1 | 5V | TX / GPIO16 |
| 2 | GND | RX / GPIO17 |
| 3 | 3V3 | GPIO0 |
| 4 | GPIO20 | GPIO1 |
| 5 | GPIO19 | GPIO2 |
| 6 | GPIO18 | GPIO3 |
| 7 | GPIO15 | GPIO4 |
| 8 | GPIO14 | GPIO5 |
| 9 | GPIO9 | GPIO6 |
| 10 | GPIO8 | GPIO7 |

Five interior plated solder holes expose GPIO12, GPIO13, GPIO21, GPIO22 and
GPIO23 as `PAD-GPIO12`, `PAD-GPIO13`, `PAD-GPIO21`, `PAD-GPIO22`, `PAD-GPIO23`.
Two underside rectangular pads expose the model's `B+` and `B-` battery labels.
Thus all 22 GPIOs present on this QFN32 chip variant are represented, plus three
header power contacts and two battery contacts. There is no invented EN header.

GPIOs use 3.3 V logic. GPIO4/5/8/9/15 are strapping pins. GPIO12 and GPIO13
share native USB D- and D+; GPIO16/17 provide UART0 TX/RX. ADC channels are
assigned to GPIO0-6. Battery pad voltage limits and protection are unspecified.

## Anchor measurements

The local origin is the PCB center at CAD [9,13,0.575] mm; axes are unchanged
and USB points toward local -Y. OpenCascade's direct GLB export uses meters,
which the runtime pipeline converts to millimeters before recentering.

Twenty 0.64 x 0.64 x 11.6 mm shaft solids provide the underside tip anchors:
local Z=-9.175 mm, J1 X=-7.613781, J2 X=7.636219. Local Y starts at -11.429351
and advances by 2.54 mm. The actual modeled row spacing is 15.25 mm. Small
misalignments between the modeled header and PCB hole pitch are preserved.

Solder-hole anchors sit on the top annular metal, halfway between measured
0.473 mm inner and 0.598 mm outer radii, at Z=0.585 mm. They are offset
0.5355 mm along +X from the hole center so wires attach to copper, not air.
Battery anchors are the centers of the two bottom pad faces at Z=-0.585 mm.

The inspector has a searchable 27-contact table, wire-start buttons, underside
view and calibration fields for all coordinates. Strapping and USB roles appear
in the notes. Position, rotation, undo and existing portable project assets use
the same mechanisms as the other imported components.

## Rebuild and validation

```powershell
py -3.14 scripts/prepare-c6.py
node scripts/prepare-c6.mjs
npm run build
npm run test
node scripts/e2e-c6.mjs
```

Direct OpenCascade XCAF import handles repeated assembly names without editing
the source. Python dependencies are in `scripts/requirements-cad.txt`.
The Node generator refuses an unreviewed source checksum for this pin mapping.

Production build and 45 tests pass. Browser checks cover all 27 surface anchors
(maximum error 0.000193 mm against the quantized runtime mesh), searchable USB
pin roles, 81 calibration fields, two actual UI-created wires, 90-degree rotation
with zero marker-to-wire-anchor error, and JSON/ZIP reopening in fresh browser
contexts while all `/models/` requests are blocked. Numerical mesh agreement is
not a hardware tolerance measurement.

Measurements: `public/models/esp32-c6-supermini.manifest.json`.
Browser report: `artifacts/c6-pin-verification.json`.
Screenshot: `artifacts/c6-editor-top.png`.
Portable samples: `artifacts/c6.c3dproj` and `artifacts/c6.c3dzip`.
