# Sprint 3.6 baseline — 29 October 2026

Collected **before runtime or CAD optimization** with `node scripts/profile-performance.mjs baseline`. Raw results: `artifacts/performance-baseline.json`; matching camera image: `artifacts/sprint36-baseline.png`.

## Environment and measurement limits

Windows 10.0.26300; AMD Ryzen 5 5600X (12 logical cores), 32 GB RAM; Chromium 156, headless ANGLE SwiftShader **software** WebGL. Browser window 1920×1080, actual canvas 1390×736. Vite development build with React StrictMode. These numbers do not establish desktop GPU 60 FPS performance.

The original remote city HDR and default font resolver failed under restricted network access. For a measurable baseline the harness supplies a neutral 1×1 HDR fixture, and scene labels use the bundled OFL IBM Plex Mono font. All geometry, render loop, picking, wires and shadows were otherwise the original implementation. A fresh context replaces the procedural board with one original CAD board; USB and supply retain five sample connections. It waits for mounting and settling, measures idle for two seconds, then six seconds of camera orbit. Frame interval includes browser scheduling and software rendering; render submission is CPU time, not isolated GPU time.

## Measurements

| Measurement | Before |
|---|---:|
| STEP master | 20,631,414 bytes |
| GLB master | 19,774,332 bytes |
| CAD triangles | 736,345 |
| GLB mesh definitions / materials / textures | 182 / 37 / 0 |
| Actual scene meshes | 12,155 |
| Scene vertices / triangles | 658,806 / 764,723 |
| Draw calls (settled view) | 12,156 |
| Unique geometry buffer bytes (CPU estimate) | 16,954,620 |
| Renderer geometries / textures | 9,069 / 7 |
| JS heap (Chromium approximate) | 342 MB |
| Model request to mounted geometry | 2,012.8 ms |
| GLTF parse callbacks (StrictMode duplicate) | 509.3 + 401.3 ms |
| Idle renders in 2 seconds | 20 |
| Orbit average interval / FPS | 234.66 ms / 4.26 |
| Orbit p95 interval | 283.30 ms |
| Average render CPU submission | 114.16 ms |
| Recursive full-scene raycast average, 100 probes | 15.94 ms |
| React commits while settled / orbiting | 0 / 0 |
| Active lights / shadow lights | 3 / 1 |

GPU allocation bytes and isolated GPU upload duration are not available through standard WebGL renderer statistics. Geometry byte estimates exclude driver copies, textures, shader programs and render targets. Mounted time excludes complete GPU compilation; parse callbacks exclude GPU work. ContactShadows performs additional offscreen render/blur work each frame (unbounded `frames`), beyond the main scene draw count. No postprocessing composer is present.

## Identified causes from measurements and code

* The 182 CAD mesh definitions contain thousands of face primitives. GLTFLoader expands these into about 12,000 renderable objects. **182 is not the actual runtime draw count.** Material-compatible primitive merging is the first priority.
* Canvas uses continuous rendering and ContactShadows has no frame limit. Idle graphics work is substantial even with zero React commits.
* `Imported` fetches and parses per instance in an effect. StrictMode already parses twice; repeated instances have no shared decoded geometry cache.
* Click handlers on ancestor groups cause recursive triangle picking through all CAD descendants. Full-scene raycasts average approximately one frame budget on their own.
* App subscribes to the entire Zustand store. Hover updates rebuild the editor hierarchy, though camera orbit itself causes no React commits. Workspace creates new component copies and arrays when it renders.
* Wire TubeGeometry is already memoized; it is **not regenerated per animation frame**. Its memo includes color unnecessarily, curves/vectors are reconstructed on React render, and replaced geometries lack explicit disposal.
* JSON projects embed imported custom bytes as base64; bundled CAD uses a URL and is not embedded. This creates a portability gap for bundled assets as well as base64 overhead for custom assets.
* Remote HDR/font dependencies can fail the entire viewport offline. These failures were recorded and resolved as a measurement precondition, not hidden as performance gains.

References: [glTF Transform transforms](https://gltf-transform.dev/), [R3F demand rendering and resource reuse](https://r3f.docs.pmnd.rs/advanced/scaling-performance).
