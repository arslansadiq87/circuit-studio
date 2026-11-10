# Connection drawing animation

The Connections panel provides **Animate all**, **Animate one by one**, and
**Stop** during playback. All visible, valid connections start empty and draw
from `from` (source) to `to` (destination), following their existing routes.

- All mode draws every visible wire together over 1.6 seconds.
- One-by-one mode follows connection-table order, drawing each wire over
  1.6 seconds. Drag a row by its grip in the ORDER column to change that order;
  the custom order is saved with the project and restored when it is reopened.
  New connections are appended to the end. Completed wires stay visible while
  later wires remain empty.
- Select multiple nets with the row checkboxes, then click **Animate selected**
  to draw just those visible nets together. Unselected wires stay fully drawn.
  The header checkbox selects or clears all eligible visible nets. Selection is
  temporary UI state and is not saved into the project.
- Playback finishes with all visible wires fully drawn. Either animation button
  restarts playback; Stop immediately restores full visible wires.

Eye-hidden wires remain hidden and are omitted from the sequence. Editing wire
data or changing the connection list ends playback. Project contents, dirty
state, undo history and saved files are unaffected by playback. PNG export ends
playback and captures the complete visible wiring.

The demand renderer runs continuously only during playback. Wire tube index
ranges reveal source-to-destination segments without rebuilding geometry each
frame. Animation uses 160 longitudinal segments per wire; normal detail resumes
afterward. Full-length wire picking proxies are disabled during playback, and
baked contact shadows are temporarily omitted so unseen wire sections do not
leave shadows. Source/destination coordinates and routes stay unchanged.

Validation: 55 unit tests, production build, and
`node scripts/e2e-wire-animation.mjs`. Browser checks cover simultaneous timing,
sequential order, empty future wires, source direction, stable geometry during
playback, completion, Stop, hidden nets, and unchanged project fingerprints and
undo history. Screenshot: `artifacts/wire-animation-sequential.png`.
