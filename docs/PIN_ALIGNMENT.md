# YD-ESP32-S3 v34 pin alignment

The two header housings each contain 22 individually modeled metal pins. Pin-center pitch measured from the STEP is 2.54 mm. Pin solids measure 0.65 × 11.25 × 0.65 mm. Their contact tips are at CAD Y=2.55 mm. Assembly occurrence placement puts the two rows at CAD Z=+12.7 mm and −12.7 mm; after axis conversion these become app Y=−12.7 mm and +12.7 mm. The app anchors are placed at the measured contact tips, app Z=3.05 mm relative to the PCB substrate center.

The first header occurrence (`22way PCB Header:1`) maps to J1 and the second (`:2`, placed −25.4 mm on CAD Z) maps to J3. This row identity/order is checked against the supplied PNG silkscreen views. Each row is ordered along CAD X from −26.675 mm at 2.54 mm increments. IDs are `J1-1` through `J1-22`, and `J3-1` through `J3-22`.

Critical signal identities on this YD variant:

- J3-19 is GPIO20 / USB D+.
- J3-20 is GPIO19 / USB D−.
- J1-1 and J1-2 are 3V3; J1-21 is 5V; J1-22 is GND.
- J3-1, J3-21 and J3-22 are GND.

The original DevKitC-1 pin definition remains separate and accessible. The example project’s existing DevKitC-1-to-USB-A wires are not reassigned to the YD variant. The user can wire YD J3-20 to USB-A D− and J3-19 to D+ explicitly. USB-C connector geometry is present, but its simplified CAD contacts have no verified electrical labels and are not wired by default.

To validate the transformed anchors in the UI, select the YD board, enter Calibration mode, then rotate or move the board while observing its attached wires. The E2E smoke test connects J3-20→A2 (D−) and J3-19→A3 (D+) and verifies both saved IDs.
