# Sprint 4.2 — wiring animation validation

## Deliverables

- Full Auto Video H.264 export: [`artifacts/sprint4-tutorial-1080p30.mp4`](../artifacts/sprint4-tutorial-1080p30.mp4) (1920×1080, 30 fps, 863 frames, 28.77 seconds).
- Decoded 1080p frames from that export: [`artifacts/sprint42-frames`](../artifacts/sprint42-frames). The folder includes opening/final frames, actual GPIO source close-ups, reveal and completed frames for all five connections, and the USB terminal detail.
- Machine-readable browser export checks: [`artifacts/sprint4-acceptance.json`](../artifacts/sprint4-acceptance.json).
- CAD entry and housing-clearance checks: [`artifacts/usb-breakout-verification.json`](../artifacts/usb-breakout-verification.json).

## Root causes corrected

1. The old manual route added a 3 mm control point beyond the USB terminal face, then bent back to the aperture. That left an exterior tail. The source endpoints were valid calibrated pins, but the route endpoint did not describe the physical connector entry.
2. Manual routes applied one Catmull–Rom spline across the saved bendpoints and connector insertion waypoints. Spline smoothing could distort the final approach through the casing. The saved bendpoints remain unchanged; the route now ends its smooth segment at a CAD-derived clearance waypoint and uses straight, explicit entry segments.
3. The first 0.35 mm insertion could be seen through the CAD terminal’s open underside. The final insulation endpoint is 0.05 mm inside the measured entry plane, aligned to the bore, with a 0.25 mm exterior approach and a clearance waypoint derived from the CAD bounds. The centerline check reports zero USB housing intersections for GPIO19/D− and GPIO20/D+.

Pin IDs, calibrated local/CAD pin positions, electrical mapping and all five stored connections remain unchanged. Geometry checks cover all four USB apertures and test the rendered static D−/D+ routes against the imported casing.

## Video review

The e2e script decodes representative frames from the actual MP4, including GPIO19/D−, GPIO20/D+, USB ground, 5V, final supply ground and the completed circuit. It verifies connection order, pin callout anchors and separation, route endpoints and insertion direction, caption-to-wire clearance, camera safe margins/continuity, active marker behavior, dark ground-wire contrast, project equality before/after export, full final draw ranges and the two-second final hold. The export metadata reports H.264 at 30 fps, 1920×1080.

Source close-ups are generated from physical GPIO anchors; route views retain the full source-to-terminal path. Captions are scored against projected route samples and component geometry. The final overview restores wire opacity and original colors.

## Validation performed

- `npm run build` — passed (Vite reports the existing large RuntimeModel chunk warning).
- `npm run test` — passed, 68 tests across 14 files.
- `npm run test:e2e` — passed, including custom/imported component and performance browser checks and the full Auto Video export/acceptance flow.
- `node scripts/e2e-usb-breakout.mjs` — aperture centers match calibrated pin anchors; measured clear bore is approximately 6 mm; 0.05 mm insertion has no CAD wall hit; final data-wire centerlines have zero housing intersections.
- Decoded-frame inspection — checked opening, GPIO19, GPIO20, ground, 5V, final ground and completed-circuit frames in `artifacts/sprint42-frames`.

## Remaining limitation

The supplied breakout CAD describes the housing and entry bore, but not the internal conductor clamp/contact. The checks establish that the modeled insulation ends flush at the measured bore opening and that the route clears the housing; they cannot certify the hidden electrical clamping geometry.
