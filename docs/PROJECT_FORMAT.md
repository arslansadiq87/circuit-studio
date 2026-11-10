# Project format

Version 1 is a Zod-validated JSON document with project name, components, wires, camera position/target and optional base64 custom-model `assets`. A component includes its model ID, transform, dimensions, ordered pins and optional geometry metadata. Wires point to stable component/pin IDs and include color, diameter, label and curvature. The camera state is restored on open; view changes can be made with the live camera controls.

Browser **Save** downloads `.c3dproj` JSON. Custom geometry bytes are embedded so projects are portable. Browser **Open** validates the project, restores custom assets into IndexedDB and migrates Sprint 1 board/USB pin IDs. The file is not ZIP-based; there is no autosave or crash recovery yet. A corrupt or invalid file is rejected without replacing the current project state.
