# Model calibration

## Coordinate convention

Circuit Studio stores dimensions and pin anchors in millimeters. The supplied CAD uses millimeters in X/Y/Z with the PCB top normal along +CAD Y. CadQuery writes glTF coordinates as `(CAD X, CAD Z, -CAD Y)`. The app rotates that GLB +180° about X, yielding app coordinates `(CAD X, -CAD Z, CAD Y)`. A +0.5 mm app-Z translation places the CAD board substrate center plane at app Z=0 before recentering the assembly. The component origin is the geometric center of the PCB substrate, which makes board transforms intuitive and keeps pin anchors independent of the full assembly bounding-box center.

The board substrate center is CAD `(0, -0.5, 0)`. The overall assembly center is CAD `(-2.80310967, -2.745, 0)`. The converted model is recentered on its full assembly bounds, then offset so the PCB substrate center coincides with the component origin. No fit-to-box scale is applied to calibrated CAD; the app checks the rotated GLB bounds against the measured dimensions within 0.15 mm and displays a missing-model state if they do not match.

## Pin calibration controls

Select the YD-ESP32-S3 v34 component and choose **Calibrate physical pins** in the inspector. Calibration mode displays anchor markers over the physical header tips and exposes XYZ fields for all 44 contacts. The nominal CAD contact remains in `cadPosition`, so later edits can be compared against the measured anchor. Default tolerance is 0.15 mm. The contact hit target remains at the pin position; normal presentation hides the colored debug marker, while Wire and Calibration modes show it.

Moving or rotating a component applies its transform to the same local anchor used by the wire renderer. The separate `geometryVerified`, `pinPositionsVerified`, and `electricalMappingVerified` fields report geometry, contact location and board labeling independently.

The label-to-position association was cross-checked against all four supplied reference views. The STEP provides two 22-pin header rows and their physical positions; it does not define electrical semantics. The YD board retains its own revision-specific signal labels and is not silently migrated to the DevKitC-1 map.
