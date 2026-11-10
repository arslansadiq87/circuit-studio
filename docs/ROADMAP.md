# Roadmap and implementation status

## Sprint 1 foundation (implemented, with corrections)

- React/TypeScript/Vite, R3F/Drei, Zustand and Zod browser editor.
- Editable transforms, pin-referenced wire geometry, color/diameter/curvature fields, JSON project save/open and viewport PNG.
- DevKitC-1 v1.1 ordered J1/J3 pin map, official J3 GPIO20/19 USB mapping, measured PCB outline and migration of old project pin IDs.
- Starter USB-A with standardized pin order and explicitly generic mechanical geometry.

## Sprint 2 verification and builder (implemented and exercised)

- Custom component editor with procedural PCB setup, 3D preview, physical size/origin/orientation, coordinate pin table and metadata.
- GLB, glTF with selected external sidecars embedded, OBJ and STL geometry import.
- IndexedDB library, `.c3dcomponent` export/import, embedded assets in `.c3dproj` and offline model reuse.
- Vitest regressions and Playwright Chromium workflow for GLB, glTF sidecar, pins, persistence, placement, transform, camera actions, project/PNG export and fresh-library project recovery.

## Remaining work

- Verify all ESP32-S3 N16R8/manufacturer-specific layouts as distinct definitions.
- Model all board/USB details against source CAD and specific connector drawings; add accurate back-side components and silk.
- Resolve OBJ/MTL dependencies, zipped project bundles, autosave/crash recovery, high-resolution/offscreen PNG, expanded component manipulation and advanced validation.
- Add Wokwi/import adapters, electrical checks, presentation scenes/timeline, animation, and Tauri distribution in later sprints.

This sprint does not implement animation, Wokwi integration or Tauri packaging.
