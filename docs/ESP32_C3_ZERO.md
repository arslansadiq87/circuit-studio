# ESP32-C3 Zero

The Parts Bin includes **ESP32-C3 Zero**, imported from the supplied
`Custom Components/ESP32-C3_Zero.step`. The source is unchanged, SHA256
`670a80bce24e2a33c418da38056006d08fbfd25365cd7e8358394e15cd9dfba9`.

The model matches Waveshare's ESP32-C3-Zero without fitted headers. It retains
the original blue PCB, component geometry, colors and all 80,764 tessellated
triangles. The runtime GLB is 413,496 bytes with 15 materials. Overall dimensions
are approximately 18 x 24.75 x 4.91 mm; the PCB itself is 18 x 23.5 x 1.6 mm.
Physical hardware dimensions have not been independently measured.

## Verified external contacts

Pin numbers and signal identities follow the manufacturer's
[pinout and hardware documentation](https://docs.waveshare.com/ESP32-C3-Zero)
and [V2 schematic](https://files.waveshare.com/wiki/ESP32-C3-Zero/ESP32-C3-Zero-Sch-V2.pdf).
GPIO functions are cross-checked against the
[Espressif C3 datasheet](https://documentation.espressif.com/esp32-c3_datasheet_en.html).
The supplied CAD does not include pin-label silkscreen; its connector, antenna,
buttons, components and 18-contact footprint were matched to the manufacturer view.
The reference diagram is saved as `artifacts/c3-reference-pinout.webp`.

In the editor's top view, USB is at +Y and antenna at -Y. Manufacturer pin numbers
are preserved: left side P1-P9 runs USB to antenna, right side P10-P18 runs
antenna to USB.

| Left contact | Signal | Right contact | Signal |
| --- | --- | --- | --- |
| P1 | 5V | P18 | TX / GPIO21 |
| P2 | GND | P17 | RX / GPIO20 |
| P3 | 3V3 output | P16 | GPIO19 / USB D+ |
| P4 | GPIO0 | P15 | GPIO18 / USB D- |
| P5 | GPIO1 | P14 | GPIO10 |
| P6 | GPIO2 | P13 | GPIO9 |
| P7 | GPIO3 | P12 | GPIO8 |
| P8 | GPIO4 | P11 | GPIO7 |
| P9 | GPIO5 | P10 | GPIO6 |

These are 15 GPIOs and three power contacts. GPIO12-17 are reserved for internal
flash and are not exposed. No extra reset or flash header pins are invented.
GPIO2/8/9 are strapping signals; GPIO9 shares BOOT. GPIO10 drives the onboard
RGB LED. GPIO18/19 share native USB, while UART0 RX/TX use GPIO20/21. All GPIO
logic is 3.3 V. ADC1 channels 0-4 are on GPIO0-4; GPIO5's ADC2 role requires
checking software support. The inspector includes these notes and aliases.

## Measured wiring anchors

The supplied source uses PCB XY with top Z=0. Its geometry is rotated 180 degrees
about Z to match the manufacturer's published view. Runtime coordinates are
[-CAD X,-CAD Y,CAD Z+0.8], with the origin at the PCB center.

There are nine full plated holes per side, at CAD X=+/-7.62 mm and 2.54 mm pitch.
Each is paired with the castellated edge contact of the same signal. Wiring
anchors use the inward top copper annulus, halfway between measured 0.45 mm
inner and 0.8 mm outer radii. Thus anchor X is +/-6.995 mm, Y ranges from
10.16 to -10.16 mm, and Z=0.8 mm. Exits point +Z. The anchors sit on the solder
contact area rather than the empty hole centers; no artificial headers are added.

The inspector provides all 18 searchable contacts, per-pin wire buttons,
underside view and 54 coordinate calibration fields. Existing scene geometry,
wiring, rotations, undo and portable model assets use the normal project flow.

## Rebuild and checks

```powershell
py -3.14 scripts/prepare-c3.py
node scripts/prepare-c3.mjs
npm run build
npm run test
node scripts/e2e-c3.mjs
```

Python dependencies are in `scripts/requirements-cad.txt`. Direct OpenCascade
XCAF import preserves source colors and placements. The mapping generator rejects
unreviewed source checksums. Measurements and component data are in
`public/models/esp32-c3-zero.manifest.json` and `src/data/esp32-c3-zero.json`.

Production build and 48 tests pass. Browser checks cover all 18 contacts against
the runtime mesh (maximum separation 0.00983 mm, within the 0.02 mm tolerance),
USB pin search, calibration fields, two UI-created wires, 90-degree rotation
with zero marker-to-wire-anchor error, and JSON/ZIP reopening in fresh browser
contexts while all `/models/` requests are blocked. Geometry agreement does not
constitute a physical continuity or hardware measurement.

Artifacts: `c3-pin-verification.json`, `c3-editor-top.png`, `c3.c3dproj` and
`c3.c3dzip` in `artifacts/`.
