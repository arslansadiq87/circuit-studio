# Video export verification

Acceptance performed on 29 October 2026. Tests use the real browser renderer and actual WebCodecs encoding, not mocked media files. Vite runs on localhost:5173. The video harness requests installed Chrome with ANGLE D3D11; the existing performance regression uses Playwright Chromium/SwiftShader. Chrome, FFmpeg and ffprobe must be installed. Unsupported acceptance H.264 is an explicit failure rather than a skipped test.

Commands:

```sh
npm run build
npm run test
npm run test:e2e
node scripts/e2e-wire-animation.mjs
node scripts/smoke-video-production.mjs
```

The production smoke additionally needs `npm run preview -- --port 5174`. The full E2E command includes custom import, performance/editor regression and `scripts/e2e-auto-video.mjs`. A model-bounds assertion in the performance harness now explicitly targets the YD board model, instead of the last CAD model encountered (which could be the USB breakout). Its original physical-dimension tolerance remains unchanged.

Verified behavior:

- Current circuit has five stored connections in saved order: D-, D+, USB GND, VBUS, external common GND. Exact source/destination IDs and manual routes are preserved. GPIO19 remains J3-20 and GPIO20 remains J3-19.
- Planning diagnostics contain shot camera poses, visibility flags, route scores and warnings. Default circuit has no occlusion warnings. Unit coverage includes a rotated/transformed circuit, hidden components, invalid pins and selected wires.
- Seeking back to the same timestamp matches both pure animation state and renderer PNG pixels. Simultaneous and sequential progress use the shared editor reveal calculation.
- Full export leaves serialized project, camera pose and undo count unchanged. Original interactive animation browser regression also checks stable geometry, true source anchors, parallel/sequential playback, completion, stop and hidden connections.
- Cancellation after submitted frames restores export quality. The video regression exercises a lost GPU context and checks that it reports an explicit error.
- Saved generated camera scenes append locally without replacing manual views.
- H.264 MP4 and VP9 WebM are capability checked. A browser context without VideoEncoder reports both unavailable; PNG frame export still works without WebCodecs. Transparent output is PNG only.
- Direct-file positional streaming is exercised through an adapter and the resulting MP4 is decoded. Automated tests do not interact with the native operating-system save dialog itself.
- Another circuit combines an imported ESP32-C6 CAD model with a procedural custom sensor, rotations out of the board plane and a manual route, and generates a selected-connection video with correct identities.
- ffprobe inspects codec, frame size, target rate, duration and exact decoded frame count. FFmpeg decodes the entire MP4/WebM without errors. Opening, USB, power and final PNGs are extracted from the finished movie. Visual inspection confirms CAD detail, physical anchors, readable labels and a clean final frame with all five wires and no editor controls.

Media deliverables:

| Artifact | Output |
| --- | --- |
| [Full tutorial](../artifacts/sprint4-tutorial-1080p30.mp4) | H.264, 1920×1080, 30 FPS, 623 frames, approximately 20.767 seconds |
| [4K sample](../artifacts/sprint4-sample-4k.mp4) | H.264, 3840×2160, 30 FPS, 36 frames, 1.2 seconds |
| [WebM fallback](../artifacts/sprint4-fallback.webm) | VP9, 1920×1080, 30 FPS, 12 frames |
| [PNG sequence fallback](../artifacts/sprint4-fallback.zip) | Numbered PNG frame entries in a valid ZIP |
| [Production smoke](../artifacts/sprint4-production-smoke.mp4) | Actual one-click MP4 from the compiled application |
| [Raw acceptance report](../artifacts/sprint4-acceptance.json) | Camera diagnostics, circuit preservation, media metadata, capability and memory samples |

Representative frames decoded from the actual completed MP4:

- [Opening](../artifacts/sprint4-decoded-opening.png)
- [GPIO19 to USB D-](../artifacts/sprint4-decoded-first-usb.png)
- [Power connection](../artifacts/sprint4-decoded-power.png)
- [Final completed circuit](../artifacts/sprint4-decoded-final.png)
- [Advanced settings and shot preview](../artifacts/sprint4-preview-ui.png)

Memory behavior is checked by architecture (one sequential frame producer, awaited source backpressure, disposed owned resources), sampled Chromium JS heap during the complete tutorial and 4K export, and existing shared-model/zero-idle-render regressions. This is not a driver VRAM measurement, an exact process peak, or a multi-hour 4K endurance test. Raw heap samples and 4K render timing are retained in the report. SwiftShader stress remains substantially slower than the hardware path; no new editor FPS claim is made.

Known limits: bounding-box occlusion/composition approximations need preview review for dense/enclosed scenes; camera interpolation is not a general collision-free path planner. Local scenes/presets are not embedded in portable project packages and scenes are keyed by project name. Normal encoded downloads and PNG ZIPs are capped at 512 MiB. Direct-file output skips rereading the entire file for automatic decode validation. Codec/device support varies, 4K can render slower than playback, and the build retains a renderer chunk-size warning. No alpha MP4, audio/narration, chapter grouping, timeline editor, full CAD triangle visibility solver or backend encoder was added.

Final check results: `npm run build` passed (documented chunk-size warning); `npm run test` passed (64 tests across 14 files); `npm run test:e2e` passed (custom imports, editor/performance and video acceptance); original wire-animation regression passed; compiled-production one-click MP4 smoke passed.

The complete tutorial collected 23 JS heap samples, ranging from 139,109,993 to 189,012,134 bytes. The short 4K run sampled 147,549,419 bytes peak JS heap and took 1.700 seconds in this run. These include other browser scene/test allocations and are not isolated video-buffer or VRAM measurements.

The full tutorial MP4 and decoded opening/USB/power/final frames were regenerated after the video connection-card redesign. The 1920x1080, 30 FPS H.264 file again decoded as 623 frames with a 20.766667-second duration; the USB frame was visually inspected for the wire-colored chip, FROM/TO names and physical pin IDs.

After the overview-orientation fix, the tutorial MP4 and decoded opening/final frames were regenerated and visually inspected. The opening, closing and final cameras face the upright workbench side; ffprobe again reports H.264, 1920x1080, 30 FPS, 623 decoded frames and 20.766667 seconds. A unit regression now checks the overview camera and projected board/supply ordering. The latest unit run passes 65 tests.
