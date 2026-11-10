# ESP32 WROOM - verified 38-pin map

The supplied model is marked **NODE MCU / ESP-32S / V1.1** on its underside. All 38 modeled silkscreen labels were read and cross-checked with [Espressif's classic ESP32 header table](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html#header-block) and [ESP32 electrical pin capabilities](https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf). The model is a NodeMCU ESP-32S board, and does not use the ESP32-S3 pin map. No GPIO20 or native USB D+/D- header mapping is assigned.

## Source and geometry

Original: `Custom Components/ESP32Wroom.glb`, 6,284,216 bytes, SHA-256 `872bdd0ce72a66e2c4d7cce59642cfeb43f1bb5e3feb49ae1c7993776c085225`. Runtime: `public/models/esp32-wroom.glb`, 441,516 bytes, all 65,200 source triangles retained. The original and runtime GLB geometry were not changed while adding pins.

The source normalizer converts glTF meters/Y-up into editor millimeters/Z-up. Model dimensions are approximately 49.05 x 25.40 x 13.00 mm. Physical hardware dimensions have not been independently measured. The model's row spacing is **22.899985 mm**, with **2.54 mm pitch**; the geometry is not resized to match another board's drawing.

The electrical evidence is the complete modeled underside silkscreen plus the reference header order. The published DevKitC table is used as an electrical cross-check, not as proof of this model's manufacturer or mechanical dimensions.

![Readable underside labels](../artifacts/esp32-wroom-silkscreen-verification.png)

## Complete header assignment

**P1-P38 are physical contact IDs, not GPIO numbers.** Each row below goes from the antenna end toward the Micro-USB end. With the component in its default app orientation, antenna is +X/right, USB is -X/left; the left header is +Y and the right header is -Y.

| Contact | Board label | Signal / restriction | Contact | Board label | Signal / restriction |
|---|---|---|---|---|---|
| P1 | 3V3 | 3V3 | P38 | GND | GND |
| P2 | EN | EN | P37 | P23 | GPIO23 |
| P3 | SVP | SVP / GPIO36 - input only | P36 | P22 | GPIO22 |
| P4 | SVN | SVN / GPIO39 - input only | P35 | TX | TX / GPIO1 |
| P5 | P34 | GPIO34 - input only | P34 | RX | RX / GPIO3 |
| P6 | P35 | GPIO35 - input only | P33 | P21 | GPIO21 |
| P7 | P32 | GPIO32 | P32 | GND | GND |
| P8 | P33 | GPIO33 | P31 | P19 | GPIO19 |
| P9 | P25 | GPIO25 | P30 | P18 | GPIO18 |
| P10 | P26 | GPIO26 | P29 | P5 | GPIO5 |
| P11 | P27 | GPIO27 | P28 | P17 | GPIO17 |
| P12 | P14 | GPIO14 | P27 | P16 | GPIO16 |
| P13 | P12 | GPIO12 | P26 | P4 | GPIO4 |
| P14 | GND | GND | P25 | P0 | GPIO0 |
| P15 | P13 | GPIO13 | P24 | P2 | GPIO2 |
| P16 | SD2 | SD2 / GPIO9 - flash-reserved | P23 | P15 | GPIO15 |
| P17 | SD3 | SD3 / GPIO10 - flash-reserved | P22 | SD1 | SD1 / GPIO8 - flash-reserved |
| P18 | CMD | CMD / GPIO11 - flash-reserved | P21 | SD0 | SD0 / GPIO7 - flash-reserved |
| P19 | 5V | 5V | P20 | CLK | CLK / GPIO6 - flash-reserved |

There are three separate grounds (P14, P32, P38), two supply contacts (P1 3V3, P19 5V), EN/reset (P2), and 32 GPIO-connected contacts. Four GPIOs are input-only; six exposed GPIOs are connected to SPI flash and are flagged as reserved. The UI includes per-pin aliases, ADC/touch/DAC/UART functions, voltage, direction/type and boot/flash/input restrictions. UART0 is shared with the on-board USB-to-UART bridge.

## Physical anchors and verification

`scripts/verify-esp32-wroom-pins.mjs` welds the original metal geometry for connected-component analysis, finds 38 isolated 0.5 x 0.5 x 6.2 mm header shafts, validates two 19-contact rows and their pitch, and extracts the **center of each underside male tip**. These are the actual exposed mating ends, below the PCB. Default exit directions are [0, 0, -1]. The runtime mesh is never used to infer GPIO identities.

The script refuses a different source checksum so a replacement model cannot silently inherit these assignments. Measured references are stored in `src/data/esp32-wroom-anchors.json` and `public/models/esp32-wroom.pins.json`. Pins carry independent editable positions and saved reference positions; the reference tolerance is 0.05 mm.

Browser verification casts directly against the rendered metal surfaces: all 38 contacts hit their shaft ends, with maximum anchor-to-surface difference **0.00006424 mm** (source/runtime quantization difference, not physical hardware accuracy). The nearest picking proxy was correct for **38/38/38** pins at three viewing angles. After translation and rotation, maximum marker-to-wire-anchor error was **0 mm**, and connected IDs P36/P38 remained unchanged.

## Use in the editor

Select **ESP32 WROOM**. The inspector exposes the full searchable pin table. Click **View underside**, then **Wire** to pick a physical contact, or use a pin's P-number button in the table to start a connection. **Calibrate pins** shows XYZ fields and deviation from the saved reference for all 38 contacts. GPIO/input/flash restrictions appear in the table and pin tooltips.

Older saved WROOM instances with zero pins are upgraded on opening, retaining their transforms and assets. Existing nonempty/custom calibration tables are preserved. JSON and ZIP projects retain the full pin metadata and wire endpoints, including in a fresh browser context with WROOM HTTP downloads blocked.

![38 calibrated pin controls](../artifacts/esp32-wroom-38-pins.png)

## Checks and reproduction

- `npm run build` - passed.
- `npm run test` - 31 tests passed, including seven new WROOM mapping/geometry/migration/transform cases.
- `node scripts/e2e-wroom-pins.mjs` - passed: all 38 metal-tip hits, 114 calibration fields, 3-angle picking, actual wire creation, 3D transforms and portable JSON/ZIP roundtrips.
- `node scripts/e2e-esp32-wroom.mjs` - asset placement and project-format browser regression.

Rebuild the model and measured reference data with `node scripts/prepare-esp32-wroom.mjs`; it runs the pin verifier after conversion. Or rerun only `node scripts/verify-esp32-wroom-pins.mjs`. See [raw browser verification](../artifacts/esp32-wroom-pin-verification.json).
