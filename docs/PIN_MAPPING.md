# ESP32-S3-DevKitC-1 v1.1 pin mapping

The component definition in `src/model.ts` is revision specific and verified against Espressif's [ESP32-S3-DevKitC-1 v1.1 user guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html), its J1/J3 header tables, and the linked [v1.1 PCB drawing](https://dl.espressif.com/dl/schematics/PCB_ESP32-S3-DevKitC-1_V1.1_20220429.pdf). Each header contains 22 ordered positions. The IDs are `J1-1` through `J1-22` and `J3-1` through `J3-22`; the pin record also keeps side, physical position, electrical label and local millimetre anchor.

J1 in order: 3V3, 3V3, RST/EN, GPIO4, GPIO5, GPIO6, GPIO7, GPIO15, GPIO16, GPIO17, GPIO18, GPIO8, GPIO3, GPIO46, GPIO9, GPIO10, GPIO11, GPIO12, GPIO13, GPIO14, 5V, GND.

J3 in order: GND, TX/GPIO43, RX/GPIO44, GPIO1, GPIO2, GPIO42, GPIO41, GPIO40, GPIO39, GPIO38, GPIO37, GPIO36, GPIO35, GPIO0, GPIO45, GPIO48, GPIO47, GPIO21, GPIO20/USB D+, GPIO19/USB D?, GND, GND.

The project's logical USB example connects `J3-20` to USB-A pin 2 D? and `J3-19` to pin 3 D+. Regression tests assert both physical identities and wire endpoint IDs. GPIO38 is the RGB LED assignment on v1.1; the initial DevKitC-1 revision differs (GPIO48).

The manufacturer drawing lists a 62.74 ? 25.40 mm board outline, 2.54 mm header pitch and 8 mm component-height envelope. The local PCB surface uses a 1.6 mm thickness for rendering. Silkscreen placement and device body detail are approximated procedurally; mapping verification does not certify all 3D surfaces against source CAD. Do not substitute an N16R8 or another manufacturer's board under this ID.

USB-A signals use the standard [USB 2.0 pin assignment](https://www.usb.org/document-library/usb-20-specification): 1 VBUS, 2 D?, 3 D+, 4 GND. Pin naming/order is standardized; physical socket body size/orientation in the editor is generic, not tied to one manufacturer's connector drawing.

Sprint 1 `.c3dproj` files are migrated from old `L*`/`R*`/`P*` identifiers to these IDs on open. Unrecognized wire pin IDs remain unresolved and are not auto-guessed by the wire renderer.
