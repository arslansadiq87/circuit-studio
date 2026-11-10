# Architecture

- `src/model.ts`: Zod project/component/wire schemas, the official DevKitC-1 v1.1 pin registry, starter circuit and Sprint 1 migration.
- `src/geometry.ts`: conversion from local millimetre pin coordinates to component world coordinates after Euler rotation/translation.
- `src/store.ts`: Zustand project state, bounded snapshot undo/redo, wire gestures, custom library cache and camera requests.
- `src/library.ts`: Zod component-package schema plus IndexedDB CRUD and portable JSON package helpers.
- `src/Workspace.tsx`: React Three Fiber scene, procedural PCB/USB geometry, imported local meshes, individually pickable pin anchors, wires, orbit and camera controls.
- `src/ComponentBuilder.tsx`: model import/calibration, procedural PCB setup, editable pin table, local library persistence and package I/O.
- `src/App.tsx`: editor shell, inspector, library, schema-validated project I/O and PNG export.

Wire data stores component and pin IDs, not endpoint guesses. Each render resolves those IDs to local pin coordinates and transforms them into world space. A missing component or pin suppresses that wire mesh rather than inventing a replacement. Imported files remain local: model bytes go to IndexedDB and project packages; temporary object URLs are used only for previews.
