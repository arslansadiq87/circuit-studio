# Circuit Studio 3D: feature report and demo guide

This document is a product feature inventory and a practical guide for recording a walkthrough or vlog. It describes the browser application as implemented in this repository. Use the linked technical notes for exact file formats, calibration details, and export behavior.

## Product overview

Circuit Studio 3D is a browser based workspace for assembling, wiring, inspecting, and presenting electronics projects in an interactive 3D scene. It combines a searchable component library, physical pin anchors, editable wire routes, project files, technical diagrams, and still/video export in one interface. Projects are edited in the browser; saved project files download to the user's device.

## Feature inventory

### 1. 3D workspace and navigation

- Interactive scene with orbit, pan, and zoom controls.
- Camera presets for top, bottom, front, and rear views, plus fit circuit, fit selected, center, and auto arrange actions.
- Dark Workbench, Clean White Studio, Neutral Technical, and Transparent Background scene appearances.
- Separate Workbench and Custom view choices.
- Presentation Mode hides editing chrome for a cleaner scene view.
- Scene badge reports the current part and connection totals.
- Move Components (X/Y) tool lets the user drag a part in the horizontal plane while keeping its height fixed; attached wires follow the move.
- Undo and redo for supported editing operations; Escape cancels supported in-progress interactions.

### 2. Component library

The Parts Bin is searchable and includes built-in, imported, and user-created components. Current built-in entries include:

- ESP32-S3 development board with 44 calibrated header contacts.
- ESP32 WROOM with 38 mapped header contacts.
- ESP32 WROOM-32 (30-pin), ESP32-C3 Zero, and ESP32-C6 Supermini boards.
- USB-A female breakout with four labeled screw terminals.
- Variable external power supply.
- Half-size breadboard, SOP IC package, resistor, LDR, 3 mm LED, 24BYJ-48 stepper motor, DVR8825 stepper driver, and Sonoff CAM-S3W camera model.
- Generic PCB starter and locally saved custom components.

Select a library item to place it in the scene. Select a placed part to inspect its properties, change supported values, duplicate or remove it, and replace its model when a compatible replacement is available.

### 3. Pin-aware wiring and route editing

- Wire mode connects visible physical pin markers by selecting a start pin and an end pin.
- Wires remain attached to their component and pin IDs as components move or rotate.
- Wire properties include label, color, diameter, route mode, lift height, curvature, and manual bend points.
- Manual Curve mode exposes mouse draggable route handles. Top view edits X/Y; Front view edits X/Z. Dragging supports undo and Escape cancellation.
- Eye controls can hide individual wires; hidden wires stay out of the scene and animation.
- Connection rows can be reordered by dragging. The order is saved with the project and controls one-by-one animation and video sequence order.
- Current connection table includes connection order, animation selection, net, endpoints, direction, style, and visibility.

### 4. Component inspector and physical pin data

- Inspect and edit supported component position and X/Y/Z rotation values.
- Calibrated parts expose physical pin information and verification status in the inspector.
- ESP32-S3 supports physical pin calibration by moving anchor positions.
- Several boards include searchable pin tables with role descriptions. The available guidance differs by board; do not describe every entry as independently manufacturer-verified.
- LED instances have a selectable lens color. Other components expose their own supported properties, such as supply output or resistor/IC values.
- Replace Component Model presents signal mapping choices, preserves the transform and compatible connections, and supports undo.

### 5. Custom component workshop

- Create a procedural PCB or import a GLB, glTF, OBJ, or STL model from local files.
- For glTF, select referenced sidecar files so resources can be embedded. Imports have an 80 MB total selection limit; OBJ/MTL material sidecars are not imported.
- Calibrate physical dimensions, model orientation, origin offset, and pin coordinates.
- Add/edit pin IDs, labels, local coordinates, electrical type, known voltage, orientation, and wire exit direction.
- Procedural PCB options include dimensions, color, thickness, header rows/count, and pin pitch, with editable generated pin positions.
- Preview the custom component in 3D, then save it to the browser's local IndexedDB library.
- Export/import portable `.c3dcomponent` packages. Model bytes are included in the package.

### 6. Diagrams and project inspection

- Generate a 2D schematic from the current circuit.
- Generate a component block diagram from the current circuit, with navigation back to related components and schematic view.
- Bottom panel tabs include Connections, Validation, Camera scenes, and Notes.
- Camera scenes can be saved and recalled locally for a project. Auto Video can also save generated camera scenes to the Camera scenes tab.
- The Validation tab is part of the UI; present its results as the checks currently shown by the app, not as a complete electrical simulator or formal design-rule checker.

### 7. Save, reopen, and portability

- New creates a blank project; Open loads a project file; Save downloads a `.c3dproj`; Package downloads a `.c3dzip` portable project bundle.
- Project schemas are checked when files are opened. Files contain circuit, camera, and wire-route information.
- Custom model data used by a project is embedded so it can be restored on a fresh browser profile. Bundled built-in CAD models remain referenced by their app asset URLs.
- Custom component records and video preferences are local to the browser until exported. Project files remain on the user's device unless the user chooses to share them.
- This is a browser-first editor; it does not currently provide a cloud project account or synchronized project storage.

### 8. PNG rendering and graphics controls

- Export a still image at 1920×1080, 2560×1440, 3840×2160, or custom dimensions.
- Transparent PNG output is supported.
- Export temporarily prepares scene geometry and restores the interactive editing state afterward.
- Settings include Low, Balanced, High, and Ultra quality profiles, detail, pixel ratio, anti-aliasing, shadows, textures, grid, UI scale, and PNG geometry controls.
- Optional Performance Monitor displays recent render and scene statistics where the browser exposes them.
- Rendering is demand driven while idle. Supplied CAD assets use levels of detail where available.

### 9. Connection animation

- Animate all visible connections together or play them one at a time in saved connection order.
- Select eligible connection rows to animate a subset; a header control selects or clears eligible visible nets.
- Stop restores the complete visible wiring.
- Playback does not modify project wiring or undo history.

### 10. Auto Video generator

- Generate a silent cinematic tutorial from the current circuit without screen recording.
- Automatic Tutorial, All Connections, One by One, Selected Connections, and Final Circuit Orbit modes.
- Output options include 1920, 2560, and 3840 pixel wide formats; 24, 30, or 60 FPS; MP4/H.264, WebM, or numbered PNG frames in a ZIP.
- Automatic camera planning uses component bounds, pin anchors, and wire routes. Captions identify endpoints and physical pins; visible route sections reveal in sequence.
- Preview with seek controls and a shot list. Optional editor-camera overrides can be saved per shot, cleared, or saved as camera scenes.
- Reusable settings include Default Tutorial, Fast Wiring Demonstration, Detailed Technical Explanation, and Final Circuit Showcase. Settings persist locally in the browser.
- Customize shot timing, camera preference, captions, closing label, solid or gradient background, floor, grid, shadows, wire fading, completed wires, and optional reveal guide.
- Normal video export downloads a finalized file. Save directly to file is optional where the browser file picker is supported. PNG frames are required for transparency.
- Codec support varies by browser and device. The app reports when a requested video codec is unavailable; PNG ZIP is an alternative.

## Suggested demo setup

For a clean, repeatable recording:

1. Open the default USB circuit or load a prepared project with a few representative parts and connections.
2. Set the viewport to Dark Workbench or Clean White Studio and choose a useful camera framing.
3. Close dialogs and leave the Parts Bin, inspector, and connection table in a readable state.
4. Confirm that the example project contains visible connections, since Auto Video needs eligible components/connections for most modes.
5. For export demonstrations, use a short circuit first. 4K renders and high frame rates can take longer and depend on device/browser codec support.
6. Use project copies for demonstrations involving destructive edits. Save or Package the finished example before resetting it.

## Five to seven minute screen-recording outline

| Segment | On-screen action | Talking point |
|---|---|---|
| 0:00–0:25 — Intro | Show the full 3D workspace and orbit the default circuit. | “Circuit Studio 3D is a browser workspace for laying out, wiring, and presenting electronics projects in 3D.” |
| 0:25–1:00 — Parts | Search for a board or LED, add a part, and use fit/auto arrange. | “The searchable Parts Bin combines built-in CAD based parts and components you create for your own projects.” |
| 1:00–1:45 — Inspect | Select a board, show its inspector and pin information, change one supported property. | “Parts have editable transforms and pin anchors, so connections track the physical points as the layout changes.” Mention calibration/verification only where shown for the selected model. |
| 1:45–2:30 — Wire | Start Wire mode, connect two pin markers, select the wire, adjust a visible property or route handle. | “Connections are pin referenced, and route shape, color, and diameter can be edited in the workspace.” |
| 2:30–3:00 — Edit and organize | Move a component in X/Y; show the wire following it. Drag a connection row to reorder it. | “The move tool keeps height fixed, and the saved connection order drives sequential playback and video.” |
| 3:00–3:35 — Diagrams | Open Schematic and Blocks views, then return to 3D. | “The project can be reviewed as a 2D schematic or a component block diagram as well as a 3D scene.” |
| 3:35–4:15 — Custom parts | Open Create component, show import/procedural choices, pin editing, and preview. Avoid a full large model import during a short take. | “You can build a PCB or import common mesh formats, calibrate it, add pins, and keep it in a browser library.” |
| 4:15–4:45 — Save and image | Save or Package a copy, then open Export and show resolution/transparent output. | “Project files and custom assets are portable, and the scene can render high-resolution PNG images with transparency.” |
| 4:45–5:20 — Animation | Start Animate all or one-by-one, then stop. | “The editor can animate connections in the saved order for a quick explanation.” |
| 5:20–6:20 — Auto Video | Open settings, show modes/format/backgrounds, preview a shot, then start a short export if time permits. | “Auto Video plans camera shots and connection captions directly from project data, so a circuit walkthrough can be exported without recording the screen.” |
| 6:20–6:40 — Wrap | Return to a clean overview and show presentation view. | Summarize the workflow: assemble, connect, inspect, document, and export. |

## Vlog talking points

Use these as prompts rather than a rigid script:

- **Why it exists:** Make circuit layouts easier to understand visually by connecting physical components and their pins in a navigable 3D scene.
- **What makes a connection useful:** Wires refer to component and pin IDs, so layout edits can move the endpoints with the parts.
- **What is customizable:** Add local mesh models or procedural PCBs, calibrate dimensions and pins, and reuse them from the browser library.
- **How it communicates:** Switch between the 3D view, generated schematic, block diagram, connection table, and animations.
- **How it produces content:** Export still renders or generate a camera planned wiring tutorial from the circuit itself.
- **How it handles files:** Download project files and portable packages; custom model data can travel with project files.
- **Current scope:** This is a visual design and presentation tool. Avoid claims that it simulates electrical behavior, automatically proves a circuit safe, or provides complete collision-aware routing.
- **Invite viewers:** Ask which board/component they would like added, which diagram/video option they would use, or what workflow should be demonstrated next.

## Accuracy notes for public demos

- Call pin mappings “verified” only when the selected component inspector/docs say they are verified. Some standard maps are user selected; some contacts are geometrically calibrated without a confirmed electrical assignment.
- A generated schematic or block diagram visualizes the project; do not imply full electrical simulation or automatic correctness checking.
- The editor does not include Wokwi, Fritzing, or KiCad adapters, and it does not include a cloud account/storage service.
- Imported meshes are visual models with defined pins; a 3D appearance alone does not establish electrical behavior or manufacturer authenticity.
- Transparent background is supported for PNG rendering and PNG frame export. Current MP4/H.264 and WebM exports are opaque.
- Browser-local custom library items, video preferences, and saved generated camera scenes are not automatically synchronized across devices.
- Auto Video does not infer electrical meaning from a net name. Captions identify the saved component and pin endpoints.

## Feature documentation map

- Custom components and formats: [COMPONENT_FORMAT.md](COMPONENT_FORMAT.md)
- CAD models and pin verification: [CAD_IMPORT.md](CAD_IMPORT.md), [MODEL_CALIBRATION.md](MODEL_CALIBRATION.md), [PIN_MAPPING.md](PIN_MAPPING.md), and board specific guides in this folder
- Move and edit wire routes: [COMPONENT_MOVEMENT.md](COMPONENT_MOVEMENT.md), [MANUAL_WIRE_EDITING.md](MANUAL_WIRE_EDITING.md)
- Project and image files: [IMPORT_EXPORT.md](IMPORT_EXPORT.md), [PROJECT_FORMAT.md](PROJECT_FORMAT.md), [ASSET_MANAGEMENT.md](ASSET_MANAGEMENT.md)
- Graphics and performance controls: [GRAPHICS_AND_LOD.md](GRAPHICS_AND_LOD.md), [PERFORMANCE_RESULTS.md](PERFORMANCE_RESULTS.md)
- Wire animation: [WIRE_ANIMATION.md](WIRE_ANIMATION.md)
- Video workflow and limitations: [AUTO_VIDEO_GENERATOR.md](AUTO_VIDEO_GENERATOR.md), [VIDEO_BACKGROUNDS.md](VIDEO_BACKGROUNDS.md), [AUTO_CAMERA_PLANNING.md](AUTO_CAMERA_PLANNING.md), [VIDEO_RENDER_PIPELINE.md](VIDEO_RENDER_PIPELINE.md)
