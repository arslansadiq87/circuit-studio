# Testing

Run `npm run test` for Vitest checks covering the ordered 44-position J1/J3 map, exact GPIO19/GPIO20 pin IDs, USB-A pin order and measured screw-terminal entry anchors, external-supply VBUS/common-ground connectivity, rotated world-space anchors, finite geometry for all four wire route modes, project migration, persistence, connections, and undo/redo.

Run `npx playwright install chromium` once, then `npm run test:e2e`. The Chromium flow imports a GLB and a glTF plus external binary, edits four pins on each, places the custom parts, uses browser pointer events on named pin hit targets to make connections, and checks the saved wire endpoint IDs. It also moves and rotates a wired part, uses camera controls, saves/reopens the project, and downloads a 3840×2160 PNG whose PNG header is checked for exact dimensions and nonempty content.

`npm run build`, `npm run test`, and `npm run test:e2e` passed during Sprint 3 implementation. The browser test uses SwiftShader and exercises the same pin pointer handler and store as normal interaction. It does not establish manufacturer mesh fidelity or physical connector tolerances.

Use `node scripts/capture-sprint3.mjs` to regenerate visual acceptance images in `artifacts/`. Screenshots include the default circuit, ESP32 header close-up, USB-A receptacle close-up, and low-side angle; the script also exports a true 3840×2160 PNG.
