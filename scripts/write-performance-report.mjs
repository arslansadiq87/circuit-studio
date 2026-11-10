import fs from 'node:fs/promises';
const read=async path=>JSON.parse(await fs.readFile(path,'utf8'));
const before=await read('artifacts/performance-baseline.json'),after=await read('artifacts/performance-optimized.json'),gpu=await read('artifacts/performance-optimized-hardware1080.json'),asset=await read('public/models/yd-esp32-s3-v34.optimization.json'),hardware=await read('artifacts/performance-acceptance-hardware.json');
const n=(value,d=0)=>value.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d});
const row=(label,a,b)=>`| ${label} | ${a} | ${b} |`;
const portable=(await fs.stat('artifacts/sprint36-sample.c3dzip')).size,legacy=(await fs.stat('artifacts/sprint36-sample.c3dproj')).size,oldProject=(await fs.stat('artifacts/sprint35-roundtrip.c3dproj')).size;
const table=[
row('Standard runtime GLB bytes',n(before.masterGlbBytes),n(asset.levels.medium.bytes)),
row('CAD triangles',n(asset.original.triangles),n(asset.levels.medium.triangles)),
row('CAD vertices',n(asset.original.vertices),n(asset.levels.medium.vertices)),
row('CAD render primitives',n(asset.original.primitives),n(asset.levels.medium.primitives)),
row('Settled scene draw calls',n(before.setup.render.calls),n(after.setup.render.calls)),
row('Actual scene meshes',n(before.setup.meshes),n(after.setup.meshes)),
row('Configured scene → mounted CAD (ms)',n(before.loadToMountedMs,1),n(after.loadToMountedMs,1)),
row('GLTF parse callbacks (ms)',before.setup.parseMs.map(v=>n(v,1)).join(' + ')+' (two parses)',after.setup.parseMs.map(v=>n(v,1)).join(' + ')+' (one parse)'),
row('Average orbit FPS, software WebGL',n(before.orbit.fps,2),n(after.orbit.fps,2)),
row('Average orbit frame interval (ms)',n(before.orbit.averageFrameMs,2),n(after.orbit.averageFrameMs,2)),
row('p95 orbit frame interval (ms)',n(before.orbit.p95FrameMs,2),n(after.orbit.p95FrameMs,2)),
row('Average render CPU submission (ms)',n(before.orbit.averageRenderSubmitMs,2),n(after.orbit.averageRenderSubmitMs,2)),
row('Idle main-scene draws / 2 seconds',n(before.idle.frames),n(after.idle.frames)),
row('Recursive raycast average (ms)',n(before.setup.raycastAverageMs,3),n(after.setup.raycastAverageMs,3)),
row('Unique scene geometry buffers (estimated bytes)',n(before.setup.geometryBytes),n(after.setup.geometryBytes)),
row('Renderer geometries / textures',`${n(before.setup.memory.geometries)} / ${before.setup.memory.textures}`,`${n(after.setup.memory.geometries)} / ${after.setup.memory.textures}`),
row('Approximate sampled JS heap (bytes)',n(before.setup.heap.used),n(after.setup.heap.used)),
row('Project file bytes (see portability note)',n(oldProject)+' (old fixture, CAD referenced)',n(portable)+' (self-contained ZIP)'),
].join('\n');
const lods=Object.entries(asset.levels).map(([level,data])=>`| ${level} | ${n(data.bytes)} | ${n(data.triangles)} | ${n(data.vertices)} | ${data.primitives} | ${data.materials} |`).join('\n');
const text=`# Sprint 3.6 performance results

Measured 29 October 2026. The editor runs at **http://localhost:5173/**. The standard CAD asset is **${n(asset.levels.medium.bytes/1e6,2)} MB**, down from **${n(before.masterGlbBytes/1e6,2)} MB**. The RX 6600 XT hardware run reached **${n(gpu.orbit.fps,2)} FPS at an actual 1920×1080 drawing buffer**, with **${n(gpu.orbit.p95FrameMs,2)} ms p95** and **zero idle draws**.

## Actual causes and applied changes

The largest CPU bottleneck was the STEP export's **12,062 face primitives**, expanded by GLTFLoader into thousands of Three.js meshes. The GLB's 182 mesh definitions did not represent draw-call count. The original scene made ${n(before.setup.render.calls)} main-view draw calls. Joining compatible materials reduced CAD primitives to 34 and scene calls to ${after.setup.render.calls}. This reduces CPU render submission; it is separate from compression.

The editor also rendered continuously, ran unlimited contact-shadow depth/blur passes, parsed each model instance independently (including a duplicate StrictMode parse), and raycast against the detailed CAD. It subscribed the editor UI to every store update. Wires were already memoized; they were **not rebuilt on every animation frame**. Their dependencies, disposal, tessellation and picking were improved rather than attributing an unmeasured per-frame rebuild problem to them.

The runtime now uses demand rendering, finite shadow baking, content-hash binary caching, shared parsed geometry/materials, calibrated LODs, selection/pin proxies, lightweight wire pick tubes, selective store subscriptions, and memoized stable scene parts. Hover does not rebuild wire geometry or re-render the Workspace. Remote HDR/font dependencies were removed. Large asset optimization runs offline; project ZIP processing is asynchronous. The component workshop also reuses its parsed source while resizing.

## Comparable before/after: software WebGL

Both runs use Playwright Chromium ${before.environment.chromium}, ANGLE SwiftShader, Ryzen 5 5600X, 32 GB RAM, Windows ${before.environment.os}, Vite development and React StrictMode. Both browser windows are 1920×1080; the editor canvas is ${before.setup.resolution.join('×')} before and ${after.setup.resolution.join('×')} after because its panels occupy part of the window. They are **not** full-HD canvas runs. The configured scene has one CAD board, USB and supply, and five wires. The baseline used a neutral HDR fixture because the old remote preset was unreachable, plus the bundled local font so the failed remote font resolver did not prevent mounting. These preconditions are recorded in the baseline document.

| Measurement | Before | After |
|---|---:|---:|
${table}

The software-rendered p95 **did not improve** even though submission time, memory and picking improved substantially. Software rendering still has large GPU emulation/scheduling stalls and the stress scene is slow there. This is not evidence of a 60 FPS result on SwiftShader. The hardware result below is a separate measurement, not a before/after speedup using different GPUs.

Model timing starts with the harness's configured-scene request and ends when decoded CAD mounts. On the optimized run, CAD HTTP is held until the timing begins. It excludes application bundle startup and does not isolate GPU upload/driver compilation. Parse callbacks measure loader completion; they are not network or GPU time. Geometry byte counts are CPU buffer estimates, not driver VRAM. Heap values are Chromium samples, not a continuously measured peak. Isolated GPU upload duration, VRAM bytes and an exact peak heap were unavailable in the original baseline; no numbers were invented for them.

The old project fixture is ${n(oldProject)} bytes because it references the bundled CAD URL and **omits model bytes**; it also contains the previous duplicate-board test scene. Its file size is not comparable as a portability ratio. For the **same finalized current circuit**, legacy self-contained JSON is **${n(legacy)} bytes**, while the new self-contained ZIP is **${n(portable)} bytes** (all three CAD LODs included). The larger file compared with old metadata buys actual offline portability.

## Hardware acceptance at full HD

Installed Chrome ${gpu.environment.chromium}, ANGLE **AMD Radeon RX 6600 XT Direct3D11**, driver 32.0.21045.16010, same CPU/RAM and development build. The drawing buffer was explicitly resized to **${gpu.setup.resolution.join('×')}**, DPR 1, Balanced, no shadows, normal CAD editing detail, and screen-dependent wire detail. This is a six-second steady orbit, not an indefinite endurance test.

| Measurement | Hardware after |
|---|---:|
| Average FPS | ${n(gpu.orbit.fps,2)} |
| Average frame interval | ${n(gpu.orbit.averageFrameMs,2)} ms |
| p95 interval | ${n(gpu.orbit.p95FrameMs,2)} ms |
| CPU render submission | ${n(gpu.orbit.averageRenderSubmitMs,2)} ms |
| Idle draws / 2 seconds | ${gpu.idle.frames} |
| Uncaught exceptions | ${gpu.errors.length} |

The hardware stress browser used 20 components (six repeated CAD boards and 14 lightweight modules), 50 wires, and the normal editor canvas. Thirty dispatched orbit drag steps completed in **${hardware.stressDragMs} ms**; selecting a wire took **${hardware.stressSelectionMs} ms**; editing its label took **${hardware.stressWireEditMs} ms**. These are action latencies, not inferred FPS. Six CAD instances referenced **${hardware.reuse.geometryReferences} geometry slots backed by ${hardware.reuse.uniqueGeometryCount} unique geometries**. Only three parses were needed across the previously exercised low/medium/high assets, with ${hardware.reuse.cacheHits} cache hits in that run.

## Derived assets and fidelity

The STEP (${n(before.sourceBytes)} bytes) and original GLB (${n(before.masterGlbBytes)} bytes) are unchanged. Original GLB SHA-256: \`${asset.sourceSha256}\`. STEP SHA-256: \`edc0685479a0c1a91abd1adf4516ec2784258a58095663b3f4272a125d5cf624\`.

The offline glTF Transform/Meshoptimizer pipeline deduplicates, flattens assembly transforms, joins compatible primitives, welds vertices, applies error-bounded simplification to medium/low, then uses meshopt compression and 16-bit positions/12-bit normals. High keeps all original triangles. The material count falls from 37 to 34 by equivalent-material deduplication. The master has no textures to compress. Draco was not added because meshopt achieves the size target without a second runtime decoder.

| LOD | GLB bytes | Triangles | Vertices | Primitives | Materials |
|---|---:|---:|---:|---:|---:|
${lods}

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

The required checks are recorded after the final run below. The browser acceptance covers original dimensions/orientation, zero idle draws/rebuilds, three-angle pin proxy hits, hover without whole-scene re-render, replacement and undo, transform/wire fidelity, all LOD levels, shared geometry, 20 components/50 wires, legacy and ZIP saving, fresh-context restoration with CAD HTTP blocked, 3840×2160 High-LOD export from Low interactive quality, and uncaught/failed-asset checks. The original GLB/glTF-sidecar workshop regression remains part of \`npm run test:e2e\`.

* [Final editor screenshot](../artifacts/sprint36-editor.png)
* [3840×2160 PNG](../artifacts/sprint36-4k.png)
* [Portable sample](../artifacts/sprint36-sample.c3dzip)
* [Compatible JSON sample](../artifacts/sprint36-sample.c3dproj)
* [Baseline raw data](../artifacts/performance-baseline.json), [software after](../artifacts/performance-optimized.json), [hardware full-HD data](../artifacts/performance-optimized-hardware1080.json)
* [Software acceptance](../artifacts/performance-acceptance.json), [hardware acceptance](../artifacts/performance-acceptance-hardware.json)
* [Asset report](../public/models/yd-esp32-s3-v34.optimization.json), [asset architecture](ASSET_MANAGEMENT.md), [graphics/LOD behavior](GRAPHICS_AND_LOD.md)

## Remaining limitations

Ambient occlusion and optional postprocessing remain off/unimplemented. Arbitrary custom imports without authored LOD assets retain their available original geometry; the included optimization pipeline targets the supplied YD CAD. Persistent IndexedDB disk-cache eviction has no UI yet; parsed resources have timed disposal. The largest lazy renderer chunk is about 767 KB minified (222 KB gzip), and Vite still reports its chunk-size warning. The 60 FPS result applies to the tested Balanced scene/GPU and six-second orbit; large scenes, Ultra/shadows, other hardware and very large custom assets may differ. SwiftShader remains slow despite lower CPU submission. Exact GPU memory, isolated upload time and baseline peak heap were not measured. USB-C electrical contact mapping remains unverified and was not invented. The supplied CAD's source license field remains blank; the original source attribution is preserved.
`;
await fs.writeFile('docs/PERFORMANCE_RESULTS.md',text);console.log('Wrote measured performance report');
