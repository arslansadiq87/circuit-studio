# Sprint 3 model and rendering notes

## Component quality

Each component geometry manifest can identify `detailed`, `enhanced-procedural`, or `simple-placeholder` visual quality. Pin electrical mapping verification is a separate `verified` property. The ESP32-S3 DevKitC-1 v1.1 has a verified 22-position J1 and J3 mapping, while its current 3D appearance is enhanced procedural geometry. The USB-A breakout uses the supplied STEP geometry and measured terminal-entry anchors; see [USB breakout](USB_BREAKOUT.md). The power supply uses enhanced procedural geometry with `verified: false`. Imported custom models are marked detailed after the user supplies physical dimensions and pin anchors; this does not imply manufacturer provenance or verification.

The component bin labels placeholders and separates the DevKitC-1 v1.1 from other ESP32-S3 boards. No N16R8 board layout is inferred from this map.

## Supplied YD-ESP32-S3 v34 CAD model

The YD-ESP32-S3 v34 is loaded from the original supplied STEP assembly converted to `public/models/yd-esp32-s3-v34.glb`; its measured dimensions, source checksum, hierarchy, colors, materials, triangle count, and two physical 22-pin rows are recorded in the asset manifest. This is a distinct board from the procedural DevKitC-1 v1.1 starter. The STEP contains simplified Type-C connectors but no verified electrical identities for their contacts. See [CAD import](CAD_IMPORT.md), [model calibration](MODEL_CALIBRATION.md), and [pin alignment](PIN_ALIGNMENT.md).

## Approximations

- The ESP32-S3 board uses an approximate 25.4 � 62.74 mm outline and physical PCB thickness. The antenna clearance area, shield, mounting rings, connectors, two 22-position header rows, header housings, gold contacts, buttons, selected surface-mount packages, and silkscreen cues are represented as geometry. Mounting rings are surface features; the board mesh does not cut true through-holes. The underside is not a complete board reconstruction.
- The USB-A breakout retains the supplied red PCB, receptacle and screw-terminal assembly. Four anchors are measured at the wire-entry aperture centers, and VBUS/D-/D+/GND follow its CAD labels. Hardware dimensions and continuity have not been independently measured. See [USB breakout](USB_BREAKOUT.md).
- The external 5 V source is a visual demonstration component. Its positive output drives USB VBUS and its ground joins the board ground. It does not model regulation, current limits, protection, or a particular board's VBUS switching circuit. Confirm the hardware power design before building a real USB-host circuit.
- Procedural board details are illustrative and do not claim component placement or tolerances from CAD. Manufacturer GLB/glTF can replace a procedural model through the Component Builder when the user supplies calibrated dimensions and pin anchors.

## Routing and rendering

Wire modes include automatic B�zier routing, manual Catmull-Rom routing with editable world-space bend points, straight lines, and orthogonal routes. Lift height and diameter are editable. Routes honor endpoint pin coordinates and exit directions, and geometry recomputes when a component moves or rotates. Automatic/orthogonal routing does not run full collision avoidance against PCB meshes or other wires; review routes and adjust bend points when they cross. Dupont sleeves and connector shells are not yet generated automatically.

The viewport offers dark workbench, white studio, neutral technical, and transparent backgrounds. Camera controls include orbit, zoom, fit selected, fit circuit, and top/bottom/front/rear views. PNG export temporarily renders the scene using the existing WebGL renderer at 1920�1080, 2560�1440, 3840�2160, or a custom size, and restores the live renderer and camera afterward. Orthographic projection and 16:9 viewport locking are not implemented.

