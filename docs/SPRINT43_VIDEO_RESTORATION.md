# Sprint 4.3 — restore the stable Auto Video sequence

## Restoration basis

This workspace has no `.git` directory, so a historical branch or commit could not be checked out. I preserved the pre-change `cinematic.ts`, `videoExport.ts` and cinematic tests in [`artifacts/sprint43-checkpoint`](../artifacts/sprint43-checkpoint), then compared the output with the available Version 3 MP4 at `C:\Users\Administrator\Downloads\ESP32-S3 - USB-Circuit_Wiring_1080p30 (2).mp4` (20.7667 seconds). The sequence was reconstructed against that actual reference and the existing Sprint 4.1 frame samples; it was not restored from Git.

## Version 4 regression and correction

The default tutorial builder inserted a 1.25-second source-pin `inspect` shot, a separate 0.8-second paired-view move, and an additional destination `inspect` shot when the coarse occlusion score flagged an endpoint. The source/destination focus planner framed only a ±7 mm region around one anchor. That produced the extreme pin and terminal close-ups, the extra transitions and the longer 28.75-second Version 4 export.

The default tutorial now has one 0.8-second transition to a paired view and one progressive wire reveal per connection. Each paired view includes the full connected component bounds and 41 sampled points along the saved route. No isolated source or destination macro shots are inserted. Connection view candidates stay in the previous upper workbench hemisphere (direction dot > 0.55), avoiding behind/underside camera choices while retaining the existing camera planner and stable camera-up interpolation. The default closing move is 2 seconds; the final completed overview holds for 2 seconds.

The wire curve generation, insertion geometry, pin IDs, calibrated anchors, stored routes, electrical mapping, reveal renderer, MP4 codec/muxer and frame-rendering pipeline were not changed for this rollback.

## Visual comparisons

The comparison images place Version 3 on the left and the regenerated Sprint 4.3 frame on the right:

- [Opening comparison](../artifacts/sprint43-compare-opening.png)
- [GPIO19 / USB D− at 3.5 seconds](../artifacts/sprint43-compare-3_5s.png)
- [GPIO20 / USB D+ at 7 seconds](../artifacts/sprint43-compare-7s.png)
- [Final overview comparison](../artifacts/sprint43-compare-final.png)
- [Full Version 3 contact sheet](../artifacts/sprint43-checkpoint/version3-contact-sheet.png)
- [Full Sprint 4.3 contact sheet](../artifacts/sprint43-current-contact.png)

The [decoded Sprint 4.3 frames](../artifacts/sprint43-frames) include the opening, paired camera views, reveals and completed frames for all five wires, and the ending. Actual frame inspection shows both connected components remain in each route view, with no isolated pin or terminal close-up. The five connections remain in stored order. The final overview restores all wires and holds steadily.

## Deliverables and validation

- Playable H.264 MP4: [`artifacts/sprint4-tutorial-1080p30.mp4`](../artifacts/sprint4-tutorial-1080p30.mp4).
- Output is 1920×1080, 30 FPS, 646 decoded frames, 21.533 seconds. The reference Version 3 file is 20.767 seconds.
- [`artifacts/sprint4-acceptance.json`](../artifacts/sprint4-acceptance.json) contains the camera bounds, route visibility, timeline order, decoded frame paths, codec metadata, project equality and reveal checks.
- `npm run build` — passed (existing RuntimeModel chunk-size warning remains).
- `npm run test` — passed, 69 tests across 14 files.
- `npm run test:e2e:video` — passed; MP4/WebM/PNG paths, decoded frames, 4K sample, deterministic rendering, project equality and all paired-view assertions passed.
- `npm run test:e2e` — passed; custom/imported components, project save/reopen, component movement, LOD and quality switching, performance stress scenario, 4K PNG export, and Auto Video acceptance passed.

The application’s component editor, custom model import, manual wire editing, saved camera scenes, project persistence, graphics optimizations, LOD behavior, 4K image export, and undo/redo code were left untouched. Their existing browser checks passed in the full E2E suite.
