# Sprint 3.6 performance results

Measured 29 October 2026. The editor runs at **http://localhost:5173/**. The standard CAD asset is **1.40 MB**, down from **19.77 MB**. The RX 6600 XT hardware run reached **60.01 FPS at an actual 1920×1080 drawing buffer**, with **16.90 ms p95** and **zero idle draws**.

## Actual causes and applied changes

The largest CPU bottleneck was the STEP export's **12,062 face primitives**, expanded by GLTFLoader into thousands of Three.js meshes. The GLB's 182 mesh definitions did not represent draw-call count. The original scene made 12,156 main-view draw calls. Joining compatible materials reduced CAD primitives to 34 and scene calls to 79. This reduces CPU render submission; it is separate from compression.

The editor also rendered continuously, ran unlimited contact-shadow depth/blur passes, parsed each model instance independently (including a duplicate StrictMode parse), and raycast against the detailed CAD. It subscribed the editor UI to every store update. Wires were already memoized; they were **not rebuilt on every animation frame**. Their dependencies, disposal, tessellation and picking were improved rather than attributing an unmeasured per-frame rebuild problem to them.

The runtime now uses demand rendering, finite shadow baking, content-hash binary caching, shared parsed geometry/materials, calibrated LODs, selection/pin proxies, lightweight wire pick tubes, selective store subscriptions, and memoized stable scene parts. Hover does not rebuild wire geometry or re-render the Workspace. Remote HDR/font dependencies were removed. Large asset optimization runs offline; project ZIP processing is asynchronous. The component workshop also reuses its parsed source while resizing.

## Comparable before/after: software WebGL

Both runs use Playwright Chromium 156.0.8078.4, ANGLE SwiftShader, Ryzen 5 5600X, 32 GB RAM, Windows win32 10.0.26300, Vite development and React StrictMode. Both browser windows are 1920×1080; the editor canvas is 1390×736 before and 1390×733 after because its panels occupy part of the window. They are **not** full-HD canvas runs. The configured scene has one CAD board, USB and supply, and five wires. The baseline used a neutral HDR fixture because the old remote preset was unreachable, plus the bundled local font so the failed remote font resolver did not prevent mounting. These preconditions are recorded in the baseline document.

| Measurement | Before | After |
|---|---:|---:|
| Standard runtime GLB bytes | 19,774,332 | 1,404,616 |
| CAD triangles | 736,345 | 289,338 |
| CAD vertices | 619,875 | 288,464 |
| CAD render primitives | 12,062 | 34 |
| Settled scene draw calls | 12,156 | 79 |
| Actual scene meshes | 12,155 | 78 |
| Configured scene → mounted CAD (ms) | 2,012.8 | 84.0 |
| GLTF parse callbacks (ms) | 509.3 + 401.3 (two parses) | 15.1 (one parse) |
| Average orbit FPS, software WebGL | 4.26 | 6.27 |
| Average orbit frame interval (ms) | 234.66 | 159.39 |
| p95 orbit frame interval (ms) | 283.30 | 466.70 |
| Average render CPU submission (ms) | 114.16 | 1.64 |
| Idle main-scene draws / 2 seconds | 20 | 0 |
| Recursive raycast average (ms) | 15.938 | 0.100 |
| Unique scene geometry buffers (estimated bytes) | 16,954,620 | 6,470,926 |
| Renderer geometries / textures | 9,069 / 7 | 86 / 5 |
| Approximate sampled JS heap (bytes) | 342,000,000 | 116,000,000 |
| Project file bytes (see portability note) | 44,270 (old fixture, CAD referenced) | 2,709,514 (self-contained ZIP) |

The software-rendered p95 **did not improve** even though submission time, memory and picking improved substantially. Software rendering still has large GPU emulation/scheduling stalls and the stress scene is slow there. This is not evidence of a 60 FPS result on SwiftShader. The hardware result below is a separate measurement, not a before/after speedup using different GPUs.

Model timing starts with the harness's configured-scene request and ends when decoded CAD mounts. On the optimized run, CAD HTTP is held until the timing begins. It excludes application bundle startup and does not isolate GPU upload/driver compilation. Parse callbacks measure loader completion; they are not network or GPU time. Geometry byte counts are CPU buffer estimates, not driver VRAM. Heap values are Chromium samples, not a continuously measured peak. Isolated GPU upload duration, VRAM bytes and an exact peak heap were unavailable in the original baseline; no numbers were invented for them.

The old project fixture is 44,270 bytes because it references the bundled CAD URL and **omits model bytes**; it also contains the previous duplicate-board test scene. Its file size is not comparable as a portability ratio. For the **same finalized current circuit**, legacy self-contained JSON is **7,273,172 bytes**, while the new self-contained ZIP is **2,709,514 bytes** (all three CAD LODs included). The larger file compared with old metadata buys actual offline portability.

## Hardware acceptance at full HD

Installed Chrome 156.0.8078.49, ANGLE **AMD Radeon RX 6600 XT Direct3D11**, driver 32.0.21045.16010, same CPU/RAM and development build. The drawing buffer was explicitly resized to **1920×1080**, DPR 1, Balanced, no shadows, normal CAD editing detail, and screen-dependent wire detail. This is a six-second steady orbit, not an indefinite endurance test.

| Measurement | Hardware after |
|---|---:|
| Average FPS | 60.01 |
| Average frame interval | 16.66 ms |
| p95 interval | 16.90 ms |
| CPU render submission | 0.94 ms |
| Idle draws / 2 seconds | 0 |
| Uncaught exceptions | 0 |

The hardware stress browser used 20 components (six repeated CAD boards and 14 lightweight modules), 50 wires, and the normal editor canvas. Thirty dispatched orbit drag steps completed in **589 ms**; selecting a wire took **151 ms**; editing its label took **100 ms**. These are action latencies, not inferred FPS. Six CAD instances referenced **204 geometry slots backed by 33 unique geometries**. Only three parses were needed across the previously exercised low/medium/high assets, with 8 cache hits in that run.

## Derived assets and fidelity

The STEP (20,631,414 bytes) and original GLB (19,774,332 bytes) are unchanged. Original GLB SHA-256: `f675b1f9f4ca88f183e1dc8b887bf775eb1b6f20fd72fcdf2e942a3d3e27a92b`. STEP SHA-256: `edc0685479a0c1a91abd1adf4516ec2784258a58095663b3f4272a125d5cf624`.

The offline glTF Transform/Meshoptimizer pipeline deduplicates, flattens assembly transforms, joins compatible primitives, welds vertices, applies error-bounded simplification to medium/low, then uses meshopt compression and 16-bit positions/12-bit normals. High keeps all original triangles. The material count falls from 37 to 34 by equivalent-material deduplication. The master has no textures to compress. Draco was not added because meshopt achieves the size target without a second runtime decoder.

| LOD | GLB bytes | Triangles | Vertices | Primitives | Materials |
|---|---:|---:|---:|---:|---:|
| high | 2,933,312 | 736,345 | 617,678 | 34 | 34 |
| medium | 1,404,616 | 289,338 | 288,464 | 34 | 34 |
| low | 1,094,824 | 213,608 | 232,570 | 34 | 34 |

The simplification target ratios are limits to aim for, not promises that justify violating error/border constraints. Actual triangle counts above are measured. Every LOD retains the same master center, unit scale, orientation and PCB origin. Measured app bounds are **64.0237793×27.9492648×11.9104043 mm**, compared with reference **64.023780861×27.95×11.91 mm**, within 0.001 mm on each overall dimension. The independent 44 electrical anchors and their IDs are unchanged. GPIO19/J3-20 remains USB D− and GPIO20/J3-19 remains USB D+.

### Matching camera visual comparison

Both images use the current renderer, identical camera and local lighting; only the original master versus optimized medium asset changes. The ordinary baseline/after workspace screenshots also exist, but their old/new lighting and wire routes differ and are not used as a pixel-identical fidelity comparison.

![Original CAD close-up](../artifacts/sprint36-model-original.png)

![Optimized medium CAD close-up](../artifacts/sprint36-model-optimized.png)

The PCB silhouette, both USB-C sockets, shield, buttons, main IC packages, two header rows, QR/printed markings and colors remain recognizable. Medium reduces rounded/chamfer surfaces and changes some tiny component shading (visible on the white LED package); High retains full source topology for close inspection and export. This was visually inspected, not established by a numerical image-error metric or CAD manufacturing certification. No procedural replacement of the real board was introduced.

## Screenshot and document-state fixes

* The default sample contains one original YD board on the left, USB-A on the right and regulated supply below. Five connections use verified J3-19/J3-20/J1-22 identities. Both board types remain available; existing projects are not silently replaced.
* Replace Component Model reviews unique signal/alias matches, requires ambiguous/unmatched pin resolution, preserves or explicitly changes the transform, remaps endpoints atomically, and supports Undo/Redo.
* Signal and power routes have distinct bends and exit stubs. The USB-A shell is hollow, with its mating opening visible. Supply terminals protrude and have readable 5V+/GND labels.
* Fit All uses rotated component bounds and wire paths; Fit Selected frames the component; Center Circuit preserves viewing offset. Hidden components are excluded. Camera commands no longer collide after project reload or retain stale damping.
* Parts Bin, connections, inspector and control text are larger; UI scale is adjustable. Accumulated UTF-8 mojibake was repaired, with local font licensing bundled.
* Dirty state compares with the saved document. Loading, settings and model completion do not mark it modified; Undo back to the saved document becomes clean. Save/reopen also includes the actual camera pose.
* Irrelevant pin/selection overlays are hidden; export explicitly selects high CAD and high wire geometry. Interactive texture caps preserve original image sources and restore them for high-quality capture.

## Verification and delivered artifacts

The required checks are recorded after the final run below. The browser acceptance covers original dimensions/orientation, zero idle draws/rebuilds, three-angle pin proxy hits, hover without whole-scene re-render, replacement and undo, transform/wire fidelity, all LOD levels, shared geometry, 20 components/50 wires, legacy and ZIP saving, fresh-context restoration with CAD HTTP blocked, 3840×2160 High-LOD export from Low interactive quality, and uncaught/failed-asset checks. The original GLB/glTF-sidecar workshop regression remains part of `npm run test:e2e`.

* [Final editor screenshot](../artifacts/sprint36-editor.png)
* [3840×2160 PNG](../artifacts/sprint36-4k.png)
* [Portable sample](../artifacts/sprint36-sample.c3dzip)
* [Compatible JSON sample](../artifacts/sprint36-sample.c3dproj)
* [Baseline raw data](../artifacts/performance-baseline.json), [software after](../artifacts/performance-optimized.json), [hardware full-HD data](../artifacts/performance-optimized-hardware1080.json)
* [Software acceptance](../artifacts/performance-acceptance.json), [hardware acceptance](../artifacts/performance-acceptance-hardware.json)
* [Asset report](../public/models/yd-esp32-s3-v34.optimization.json), [asset architecture](ASSET_MANAGEMENT.md), [graphics/LOD behavior](GRAPHICS_AND_LOD.md)

## Remaining limitations

Ambient occlusion and optional postprocessing remain off/unimplemented. Arbitrary custom imports without authored LOD assets retain their available original geometry; the included optimization pipeline targets the supplied YD CAD. Persistent IndexedDB disk-cache eviction has no UI yet; parsed resources have timed disposal. The largest lazy renderer chunk is about 767 KB minified (222 KB gzip), and Vite still reports its chunk-size warning. The 60 FPS result applies to the tested Balanced scene/GPU and six-second orbit; large scenes, Ultra/shadows, other hardware and very large custom assets may differ. SwiftShader remains slow despite lower CPU submission. Exact GPU memory, isolated upload time and baseline peak heap were not measured. USB-C electrical contact mapping remains unverified and was not invented. The supplied CAD's source license field remains blank; the original source attribution is preserved.

### Final check results

- `npm run build` — passed; Vite reports the documented lazy-renderer chunk-size warning.
- `npm run test` — passed, 24 tests across three files.
- `npm run test:e2e` — passed, including the GLB/glTF-sidecar regression and Sprint 3.6 browser acceptance in Chromium/SwiftShader.
- `node scripts/e2e-performance.mjs --hardware` — passed with Radeon RX 6600 XT / ANGLE D3D11.
- Exact 3840×2160 export asserted High CAD while interactive settings were Low; no uncaught exceptions or failed assets in normal browser acceptance.
- Original STEP and original GLB checksums rechecked unchanged.

A final export timing failure was caught and fixed: PNG preparation now waits for the requested high-detail object to commit into the scene instead of assuming two animation frames are enough. Both software and hardware acceptance passed afterward. Texture-limit testing also verifies that interactive downsizing preserves the shared original image and restores it for export.
