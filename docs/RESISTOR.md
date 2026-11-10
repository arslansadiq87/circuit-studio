# Imported resistor

The Parts Bin's Resistor replaces the former Axial resistor placeholder with the
user-supplied `Custom Components/Resistor.step`. The original file is unchanged.
Its SHA256 is `372f6171d3129bebece4bdc6482ca02ef770eccde0dc460443f214b4066aed78`.

The model retains its blue body, dark bands, metal leads and original millimeter
scale: approximately 9.4 x 2.34 x 2.34 mm. The runtime asset preserves all
37,210 tessellated triangles and uses three materials with meshopt compression.
No resistance or wattage is assumed from the old placeholder's 220-ohm label.

Select a resistor and enter its Resistance in the inspector, choose ohms,
kilohms, megohms or gigohms, then click Set resistance (or press Enter).
Any finite nonnegative value is accepted, including zero, decimals and scientific
notation. Clear returns to unspecified. Each instance stores `resistanceOhms`
in both JSON and portable project files, with undo/redo support. The CAD band
colors remain the source colors; changing resistance updates the stored property.

Two passive, nonpolar contacts are measured at the planar metal lead ends:
P0 / terminal 1 at X=-4.7 mm and P1 / terminal 2 at X=+4.7 mm. Exit directions
point outward along X. The source Z center of 1.7 mm is removed consistently
from the model and anchors. Physical hardware dimensions remain unverified.

Older procedural resistor instances upgrade when opened, preserving instance IDs,
positions, rotations and wire records. The erroneous four-pin placeholder's
left contacts P0/P1 map to terminal P0, and right contacts P2/P3 map to terminal
P1. Thus connections on the same physical side now share the same real lead.
Already imported models and custom library components are left intact.

Rebuild the runtime model and measured component definition:

```powershell
py -3.14 scripts/prepare-resistor.py
node scripts/prepare-resistor.mjs
```

The Python stage requires `scripts/requirements-cad.txt`. The conversion uses
OpenCascade STEP face colors and CadQuery tessellation. The Node stage centers
the model, restores CAD Z-up orientation, joins by material and compresses it.
The manifest is `public/models/resistor.manifest.json`.

Validation: production build, 34 unit tests, and `node scripts/e2e-resistor.mjs`.
The browser check places the resistor, connects both terminals, saves and reopens
the embedded model with all seven scene connections. Screenshot:
`artifacts/resistor-editor.png`.

The browser raycasts into each lead end face from its outward direction, checks
the surface normal and compares the hit with the wiring anchor. Both contacts
agree within 0.000001 mm of the runtime mesh (numerical agreement, not a hardware
measurement). Results are saved in `artifacts/resistor-pin-verification.json`.
The inspector shows verified contacts with direct terminal wiring buttons.
