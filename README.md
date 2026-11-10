# Circuit Studio 3D

Circuit Studio is a browser-first editor for arranging, wiring and presenting 3D electronics components. The editor uses React, TypeScript, Three.js, React Three Fiber, Drei, Zustand and Zod.

## Run the editor

```bash
npm install
npm run dev
```

## Deploy the website

See [DEPLOY.md](DEPLOY.md) for static hosting instructions and the included GitHub Actions workflow for deploying to GitHub Pages. The Pages workflow deploys pushes to `main` after GitHub Pages is enabled with **GitHub Actions** as its source.

Open the Vite URL shown in the terminal. Drag in the canvas to orbit, right-drag to pan, and use the wheel to zoom. Top, bottom, front and rear views, fit-selected, fit-circuit, and zoom controls adjust the live camera. Choose Dark Workbench, Clean White Studio, Neutral Technical, or Transparent Background from the viewport preset menu. Search the component library and click a part to add it. Select a part and edit position/rotation in the inspector. Select **Wire**, then click two visible pin markers. Select a wire to edit its label, color, diameter, route mode, lift height, curvature and manual bend points.

**Save** downloads a `.c3dproj` JSON project. It contains component/wire/camera data and embeds any custom model asset as base64 so the file travels independently of browser storage. **Open** validates the document and restores embedded custom models into the local library. **Export** renders the scene at 1920x1080, 2560x1440, 3840x2160, or a custom resolution. Transparent PNG export is supported.

## Create a custom component

1. Click **Create component** at the bottom of the parts bin.
2. Choose **Create PCB** or an import format.
3. For an imported model, select a local GLB, glTF, OBJ or STL. GLB is the preferred single-file option. For glTF, select the `.gltf` and each referenced `.bin`/image sidecar together. External references are embedded into the saved component; temporary object URLs are never saved.
4. Set component name, category, physical width/height/thickness in millimetres, model orientation, and origin offset.
5. Use **Add Pin** or click a physical model location. Edit pin ID, label, local X/Y/Z coordinates, electrical type, known voltage, orientation and wire-exit direction in the pin table. Remove unwanted pins with the trash control.
6. For a procedural PCB, set color, total pin count, header row count and pitch; regenerate a centered pin array, then refine positions and labels.
7. Save the component to the browser's local IndexedDB library. Use **Export package** to download a portable `.c3dcomponent` JSON package (model bytes are included as base64). **Import package** adds one to the local library. Click a custom-library entry to add it to a project.

Model and sidecar imports are limited to 80 MB total. Flat models receive a minimum calibrated thickness of 0.1 mm. GLB, glTF, OBJ and STL geometry load locally; OBJ material sidecars (MTL) are not imported. A glTF with an unselected or missing external resource is rejected with a specific error.

## Pin mapping and geometry status

The current board is **ESP32-S3**, using the supplied original CAD model. The retired ESP32-S3-DevKitC-1 v1.1 is no longer available for insertion or replacement; older projects retain compatibility with its saved pin definitions.

USB-A is now the supplied STEP breakout board with four measured screw-terminal wire entries. Stable signal IDs are A1 VBUS, A2 D-, A3 D+, A4 GND; labels are checked against the model's markings. Existing socket instances upgrade with their wiring preserved. See [USB breakout import](docs/USB_BREAKOUT.md).

## ESP32-S3 CAD model

**ESP32 WROOM** is also available in Parts Bin from the supplied `ESP32Wroom.glb`. Its runtime copy preserves all 65,200 triangles in about 442 KB. Its 38 header pins are mapped to the modeled NodeMCU ESP-32S V1.1 silkscreen, with measured underside contacts; see [ESP32 WROOM](docs/ESP32_WROOM.md).

The parts bin contains ESP32-S3, built from the supplied YD-ESP32-S3 v34 STEP assembly. Its source-derived GLB is bundled under `public/models`, and its 44 header contacts have measured 2.54 mm pitch and CAD tip coordinates. The inspector reports geometry, pin-position, and electrical-label verification separately. Select **Calibrate physical pins** to display/edit anchors, and use **Auto Arrange** to arrange the ESP32-S3, USB-A socket, and external supply. Project files reference this bundled asset by URL; custom uploads remain embedded in project files. The supplied STEP has no author or license field, and its Type-C contacts do not have a verified electrical map. Read [CAD import](docs/CAD_IMPORT.md), [model calibration](docs/MODEL_CALIBRATION.md), and [pin alignment](docs/PIN_ALIGNMENT.md).

## Project and component coordinate systems

All physical dimensions and pin local coordinates use millimetres. A component's `[x,y,z]` position is its model origin in project space. Pin `localPosition` is measured from that origin before the component's X/Y/Z degree rotation. Wire rendering resolves the named component and pin IDs and applies the component transform to the pin coordinate. The ESP32 board origin is its center; the custom builder centers imported geometry by its bounding box and lets the user change the origin offset. Imported geometry is scaled to the saved dimensions, then rotated by the saved model orientation.

A `.c3dcomponent` package is version 1 JSON with a component manifest, pin table, dimensions, geometry/import metadata and optional base64 model bytes. It is portable but not compressed. Browser-local library records reference SHA-256-addressed binary assets in IndexedDB. **Package** saves a binary `.c3dzip` project including all used CAD LODs; **Save** retains version 1 JSON with embedded assets. **Open** accepts both formats and migrates older board/USB pin IDs.

## Build and tests

```bash
npm run build
npm run test
npx playwright install chromium
npm run test:e2e
```

`npm run test` runs Vitest geometry, pin-map, project migration, connection, undo/redo and IndexedDB tests. The browser regression script creates an in-memory GLB triangle, imports it, creates four pins, imports a glTF with an external binary sidecar, saves both, reloads and places them, moves/rotates a part, checks camera controls, exports a project and PNG, clears IndexedDB, then opens the project and verifies embedded model restoration. The standard browser suite exercises imported model assets, save/reopen and rendering paths. The separate CAD browser check loads the supplied STEP-derived assembly, verifies the two USB signal endpoint IDs, saves the project, and exports an exact 3840×2160 PNG.

## Current limitations

Known gaps include full collision-aware cable routing, generated Dupont shells, orthographic projection, a fixed 16:9 viewport, complete underside CAD detail, and a manufacturer-specific USB receptacle model. The board and connector geometries are procedural approximations. Browser library data is local to that browser profile until the user exports a component package or project file.


## Sprint 3.6: performance and portable CAD

The default USB circuit contains one original ESP32-S3 CAD board, USB-A and regulated supply with five verified connections. The retired DevKitC-1 is removed from Parts Bin and replacement choices. Select a component and choose **Replace Component Model** to review signal mappings, resolve duplicated grounds, keep its transform and preserve connections; the replacement supports Undo.

**Settings** contains Balanced/Low/High/Ultra, detail, pixel ratio, anti-aliasing, shadow, texture, grid, UI scaling and PNG geometry controls, plus the optional Performance Monitor. Rendering stops when idle. Fit All (camera icon), Fit Selected and Center Circuit frame the visible circuit. PNG preparation loads High CAD and wire detail independently of editing settings.

```powershell
npm run optimize:cad
npm run profile:performance
node scripts/profile-performance.mjs optimized-hardware1080 --hardware --full-canvas
npm run test:e2e:performance -- --hardware
```

Optimization requires the existing master GLB and development dependencies; it never overwrites the STEP/master. Hardware commands use installed Chrome with ANGLE D3D11. The standard E2E command runs both the original custom-component regression and Sprint 3.6 acceptance with Playwright Chromium/SwiftShader.

See [baseline](docs/PERFORMANCE_BASELINE.md), [results](docs/PERFORMANCE_RESULTS.md), [asset/package architecture](docs/ASSET_MANAGEMENT.md), and [graphics/LOD behavior](docs/GRAPHICS_AND_LOD.md). Reusable captures are in `scripts/capture-sprint36.mjs` and `scripts/capture-cad-comparison.mjs`.

The 3 mm LED now uses the supplied STEP model with a per-instance lens color picker. See [LED import and color controls](docs/LED_3MM.md).

ESP32-C6 Supermini is available from the supplied STEP, with 20 measured header tips, five GPIO solder pads and two battery pads. Its searchable pin table includes USB/UART roles and strapping notes. See [C6 import and pin verification](docs/ESP32_C6_SUPERMINI.md).

ESP32-C3 Zero is available from the supplied STEP, with all 18 manufacturer-numbered castellated contacts, searchable USB/UART/ADC roles, strapping notes and measured solder-pad anchors. See [C3 Zero import and pin verification](docs/ESP32_C3_ZERO.md).

ESP32 WROOM-32 (30 pin) uses the supplied STEP with realistic embedded surface textures, metallic finishes and 30 CAD-measured header contacts. Its user-selected standard electrical map is distinguished from exact PCB verification. See [30-pin model, materials and pinout](docs/ESP32_30PIN.md).

Connections can be drawn with **Animate all** or **Animate one by one** in the bottom panel. Both follow the saved source-to-destination routes and respect hidden nets; **Stop** restores the complete wiring. See [connection animation](docs/WIRE_ANIMATION.md).

Use the viewport four-arrow **Move components (X/Y)** tool to left-drag parts while keeping height fixed. Wires follow live, each drag has one Undo step, and Escape cancels. Select mode restores normal camera orbit. See [mouse component movement](docs/COMPONENT_MOVEMENT.md).


Select a wire in **Manual curve** mode and choose **Edit route with mouse** to drag its bend handles. Top view edits X/Y; Front edits X/Z. Each drag supports Undo and Escape cancellation. See [manual wire editing](docs/MANUAL_WIRE_EDITING.md).

Drag the grip in the Connections table to set the one-by-one net animation sequence. The row order is saved with the project.

## Automatic cinematic wiring videos (Sprint 4)

**Auto Video** generates a silent, native-resolution wiring tutorial directly from the current circuit. It plans cameras from real CAD bounds and pin anchors, reveals saved wire routes in saved order, composites technical labels into every frame, and muxes a playable MP4. Optional settings provide WebM/PNG fallback, 1080p/1440p/4K, 24/30/60 FPS, preview seeking, shot overrides and reusable presets. Original editor animation controls remain available.

- [User workflow and presets](docs/AUTO_VIDEO_GENERATOR.md)
- [Video background presets, gradients, floor/grid controls, alpha limits and saved settings](docs/VIDEO_BACKGROUNDS.md)
- [Automatic camera planning and limitations](docs/AUTO_CAMERA_PLANNING.md)
- [Deterministic timeline](docs/ANIMATION_TIMELINE.md)
- [Encoding and memory pipeline](docs/VIDEO_RENDER_PIPELINE.md)
- [Acceptance tests and media artifacts](docs/VIDEO_EXPORT_TESTING.md)
- [Example 1080p30 MP4](artifacts/sprint4-tutorial-1080p30.mp4)
- [Short native 4K MP4](artifacts/sprint4-sample-4k.mp4)

Run `npm run test:e2e:video` for the real Chromium video acceptance, or `npm run test:e2e` for all browser regressions. The Vite development server must be running on port 5173. Video acceptance requires installed Chrome with working WebCodecs and FFmpeg/ffprobe on PATH; unsupported H.264 is reported as a failure for the acceptance example, not skipped.
