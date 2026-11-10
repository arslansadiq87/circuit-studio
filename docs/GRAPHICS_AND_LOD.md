# Graphics, picking and LOD

Balanced is the default. Settings are browser preferences, separate from document history and the Unsaved indicator. Low/Balanced/High/Ultra set pixel ratio, anti-aliasing, contact-shadow quality, geometry, wire quality, grid and texture-size limits. Interface text can be enlarged to 110% or 120%. Anti-aliasing recreates the WebGL context and preserves the camera pose.

The main canvas uses `frameloop="demand"`. Drei OrbitControls invalidates while damping settles. Scene/asset/lighting changes request frames. Idle monitoring uses a DOM timer and does not invalidate WebGL. Optional contact shadows bake one frame after a scene or model change rather than rendering depth and four blur passes continuously. Balanced disables shadows. Lighting and the OFL IBM Plex Mono scene font are local; there is no required HDR/font CDN request.

## CAD detail

Automatic LOD uses the component's projected screen size, checked at most five times per second during rendered frames. It uses these hysteresis bands:

| Transition | Projected maximum dimension |
|---|---:|
| Medium → Low | below 115 px |
| Low → Medium | above 165 px |
| Medium → High | above 680 px |
| High → Medium | below 500 px |

While the camera is moving, a measured average above 25 ms across 20 samples permits a temporary lower level. After movement/damping stops, normal quality returns. High/Low explicit settings remain user choices. A nearby medium level is preloaded when viewing low or high; previously decoded levels stay cached. Custom models without LOD assets use their available original visual geometry.

Every supplied-board level uses the **same master center, orientation, physical scale and origin offset**. Visual meshes never define wire endpoints. The 44 saved pin IDs and anchor coordinates are independent component data and remain unchanged during LOD switches. A 0.15 mm dimension check still rejects incorrect calibrated scale. Measured optimized bounds differ from the master by less than 0.001 mm on each overall dimension.

## Wires and picking

Wires cache their path from endpoint positions/directions and routing parameters. Color, hover, labels, unrelated component edits, idle and camera animation do not reconstruct the path. Explicit disposal releases replaced tube geometries. Normal editing uses 56 longitudinal segments, adapting to 28 for distant curves or 128 for close-up curves with hysteresis. High uses 128 segments and 12 radial segments. Low uses 28/6; constrained camera motion can use 24 longitudinal segments temporarily. Proxy tubes use 24/4 and a generous hit radius. Manual routes include endpoint exit stubs, so wires leave the correct terminal direction.

CAD mesh raycasting is disabled **again on instance clones** because Three.js cloning does not preserve an instance's overridden `raycast` method. Selection uses a simple box. Physical pin proxies use exact component-local anchors and stay active during wiring/calibration. The board box stops intercepting clicks in those modes. Pin HTML controls provide readable labels and keyboard access. Decorative CAD is never used for ordinary hover picking. A BVH was unnecessary after removing triangle picking.

## Captures and remaining controls

PNG preparation explicitly loads the selected export LOD (High by default), selects high wire tessellation, hides pin markers and selection outlines, then renders at the requested pixel dimensions. It restores editing quality afterward. Interactive Low settings do not select low CAD geometry for 4K captures. Diagnostics are DOM overlays and are absent from PNGs and Presentation Mode.

The Performance Monitor is enabled in Settings. It reports sampled FPS, mean/p95 frame time, calls, triangles, meshes, parsed-model cache entries, textures, render resolution and JS heap when Chromium exposes it. When no frames occur, it reports idle instead of requesting new frames. Its statistics describe recent rendered frames, not the UI's responsiveness while idle.

Ambient occlusion and postprocessing effects are currently **off and not implemented**; the settings panel states this explicitly. This sprint prioritized measured CAD/draw-call/render-loop bottlenecks. GPU byte allocation and isolated GPU upload time are not exposed as reliable standard WebGL statistics; geometry buffer bytes and renderer resource counts are reported as estimates rather than VRAM measurements.
