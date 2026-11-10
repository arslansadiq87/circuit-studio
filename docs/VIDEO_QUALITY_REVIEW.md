# Auto Video quality review (Sprint 4.1)

## Review artifacts

The externally reviewed export was available at `C:\Users\Administrator\Downloads\ESP32-S3 - USB-Circuit_Wiring_1080p30 (2).mp4` (H.264, 1920×1080, 30 fps, 20.77 seconds). The repaired export from the app's actual Auto Video path is [`artifacts/sprint4-tutorial-1080p30.mp4`](../artifacts/sprint4-tutorial-1080p30.mp4). The application downloads the same filename to the browser's Downloads folder unless **Save directly to file** is enabled.

## Before and after

The left image samples the reviewed MP4. The right image samples the new renderer output at opening, completed data/power connections and final overview.

| Reviewed export | Repaired export |
| --- | --- |
| ![Reviewed MP4 sample frames](../artifacts/sprint41-before/contact.png) | ![Repaired MP4 sample frames](../artifacts/sprint41-after/contact.png) |

Additional full-resolution frames are in [`artifacts/sprint41-before`](../artifacts/sprint41-before) and [`artifacts/sprint41-after`](../artifacts/sprint41-after). The final end-to-end run also decodes frames from the completed H.264 file and checks their stream metadata.

## Findings and fixes

- **Framing:** Connection planning previously framed only the 40 sampled wire points. That let a useful-looking route crop the attached board or connector. Its fit calculation also reserved much larger margins than requested (78% horizontal and 68% vertical occupancy) and added a fixed world-space camera distance. Candidate connection views now fit the sampled route and both attached component bounds in the 16:9 export camera with 8% side, 10% top and 12% bottom margins. Source/destination visibility ignores the attached component's own coarse occlusion box. Candidate views stay in the prior camera hemisphere when comparably clear.
- **Opening and ending:** The opening used scene bounds that included routes hidden until their reveal, leaving empty background. It now fits the visible component bounds. Closing and final shots still fit the complete assembly, including all completed wires. The opening label is compact and remains within the safe frame.
- **Captions:** The default caption is a compact pin-to-pin chip with component names below it. It projects connected component bounds, route samples and terminals to the export frame, scores four safe-frame corners, and places the caption where it overlaps the least. Detailed dark and white captions remain available. E2E assertions verify that the active connection card does not cover either terminal.
- **Camera continuity:** Camera transitions have a longer 0.8 second move, fixed world-up and a continuity preference when selecting similarly clear views. The camera remains stable during wire reveal. `CinematicRenderer.cameraDiagnostics` exposes each planned pose, score, endpoint coordinates, projected route bounds, clipping warnings and travel distance. Set `localStorage.circuit.videoCameraDebug` to `1` in development to log the plan; diagnostics do not draw into the video.
- **Wire ends:** The reviewed file's partial-reveal frames show a wire still progressing toward its terminal, which made the endpoint look uncertain. Geometry inspection found no uncontrolled extension: line, cubic Bezier and centripetal Catmull-Rom routes preserve their source and destination points, and the tube uses that saved curve. No pin positions, wire routing or electrical data were changed. Unit and browser acceptance checks now verify world-transformed anchors, full tube endpoints, complete draw range at finish and no lingering optional tip marker.

## Validation

- `npm run build` — passed.
- `npm run test` — passed (66 tests across 14 files).
- `npm run test:e2e` — the complete browser suite, including real ESP32-S3, USB breakout and power-supply MP4 export, project integrity, camera safe frames, adaptive label clearance, wire endpoints, H.264 metadata, WebM/PNG fallback, 4K sample and custom/imported component cases.
- Reviewed MP4 sample extraction and final MP4 decoding — passed. Generated video is 1920×1080 H.264 at 30 fps. Exact duration and frame count are recorded in `artifacts/sprint4-acceptance.json`.

For the real USB circuit, measured overview safe-frame extents are 0.802 horizontal / 0.676 vertical at opening and 0.675 / 0.760 at closing (NDC limit: 0.84 / 0.78). All five connection shots report no route-clipping warnings. The five tube endpoint errors in the browser renderer are at most `7.2e-15` world units, with all tube indices drawn at completion. The exported file is 21.533 seconds (646 frames); the timeline is longer than the reviewed export because camera moves now have a deliberate 0.8-second setup.

## Remaining limits

Visibility scoring uses component bounding boxes to avoid expensive CAD triangle raycasts. This is intentionally conservative for dense imported assemblies; a future triangle-level diagnostic could distinguish genuine occlusion from overlapping bounds. Saved manual wire routes are intentionally preserved, including their visual crossings.
