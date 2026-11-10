# Auto Video final rendering QA — Sprint 4.6

## Result

The USB-Circuit tutorial passes the Sprint 4.6 rendering and export checks. The released video is `artifacts/sprint4-tutorial-1080p30.mp4`: H.264, 1920×1080, 30 FPS, 21.73 seconds. It contains the five saved connections in their existing order and uses the Futuristic HUD and Dark Studio background.

The named Version 8 reference export was not present in the workspace. The before captures and material-state log were produced from the committed Sprint 4.5 renderer immediately before this fix. Both before and after samples use the same saved circuit, High CAD LOD, export camera plan and timestamps.

## ESP32 flicker diagnosis

The offline renderer cloned the scene once at High LOD, but also placed imported CAD materials into its component-focus tint map. During each seek, it set every focused component material's emissive color to warm brown `#5c3b13` at intensity `0.2`, then restored the original emission when focus changed. The ESP32 substrate material `mat_0` therefore alternated between its original black emission and the brown focus emission. The capture log shows this at the reported boundaries: focused at 10.9 and 11.2 seconds, restored at 11.3 and 11.7; restored at 16.5, focused at 16.8, and restored again by 17.7 and 18.5.

Other candidate causes were checked. The ESP32 stayed on High LOD in all sampled exports; its 34 renderable CAD meshes and the single `PCB1_1` substrate did not switch visibility. No exact coincident mesh pairs were found. The cloned light values stayed constant, shadows were disabled, and preview/export both used sRGB output, the same tone-mapping value and exposure `1`. No background setting changed the CAD material fingerprint.

The fix excludes imported model geometry from the component-focus emissive treatment. Procedural presentation components retain their existing focus behavior. CAD materials keep their authored color, emission, textures and surface properties throughout the sequence. Interactive editor LOD switching is unchanged; export still explicitly prepares and holds the High LOD.

## Closing title

The previous shared opacity curve faded the final card out during the last 0.18 seconds. With a two-second final shot, that left less than two seconds at full readability. The final card now fades in over 0.18 seconds, completes its existing 0.22-second position entrance, and does not fade out. A visible final card gets `max(configured final hold, 2 seconds) + 0.22 seconds` of final-shot time. The default video grows by 0.22 seconds, from 21.50 to 21.72 seconds, while camera paths and connection timing remain unchanged. A configured zero final hold still omits the final shot.

The regression checks the title at entrance completion and on the final frame; both are full opacity. The last encoded H.264 frame matches the direct render within 1.46 mean RGB levels.

## Visual and pipeline checks

`scripts/e2e-video-stability.mjs` loads the original ESP32 CAD asset at High LOD, logs its LOD, mesh/material state, light values, camera distance and renderer color settings, then samples a fixed camera view over visible pixels on `PCB1_1`. At 10.9, 11.2, 11.3, 11.7, 16.5, 16.8, 17.7 and 18.5 seconds, the fixed-camera PCB samples have zero mean RGB difference. Rendering the same times out of order also has zero difference. The test compares direct 1920×1080 renders with decoded MP4 frames at each of those timestamps; mean RGB error ranges from 1.43 to 1.86 levels, within the 12-level H.264 tolerance.

Dark Studio, Pure White and Neutral Gray updates preserve every ESP32 CAD material property. The completed black GND wire remains `#30323a`; its electrical color is unchanged, temporary emissive highlight is cleared, and the presentation-only `MeshBasicMaterial` outline remains visible at opacity `0.52`. The final wire endpoints and USB insertion positions still match the saved connection data. The project snapshot is unchanged after rendering, and the diagnostic renderer releases its WebGL context and canvas.

The existing camera plan passes its safe-frame bounds checks, so no framing or camera change was warranted. USB breakout terminal wires remain crowded where their correct paths converge. Endpoint and insertion assertions pass; no route change was made because there is no route-generation defect to correct.

## Review captures

- Before: `artifacts/sprint46-before/t-11-2.png`, `t-11-3.png`, `t-16-5.png`, `t-16-8.png`, `t-17-7.png`, `t-18-5.png` and `diagnostics.json`.
- After, direct renderer: `artifacts/sprint46-after/direct/`.
- After, fixed-camera PCB checks: `artifacts/sprint46-after/fixed-camera/`.
- After, decoded MP4 frames: `artifacts/sprint46-after/decoded-mp4/`.
- Closing title: `artifacts/sprint46-after/closing-title-entered.png` and `closing-title-final.png`.
- Detailed measurements and pass/fail results: `artifacts/sprint46-after/diagnostics.json`.

## Tests

Final run: `npm run build` passed; `npm run test` passed all 75 tests in 14 files; `npm run test:e2e` passed the imported-asset, performance, complete video-export, and timestamped stability suites. The video acceptance verified the playable 1080p H.264 file and alternate solid/gradient background exports. The build retains the existing Vite warning for the `RuntimeModel` chunk exceeding 500 kB.
