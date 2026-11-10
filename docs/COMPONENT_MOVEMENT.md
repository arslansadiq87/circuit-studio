# Mouse movement in X/Y

Click the four-arrow **Move components (X/Y)** tool in the viewport's left
toolbar, then left-drag a component. Clicking a different component selects and
drags it immediately. A green outline identifies the selection and the cursor
changes from grab to grabbing. Existing height and rotation remain fixed.

Use **Top view** in the move hint for easy placement, particularly when the
camera is edge-on to the XY plane. Right-drag camera pan and wheel zoom remain
available between component drags. Choose **Select components** or the orbit
tool to return to normal left-drag camera orbit. Wire and calibration modes keep
their existing pin interaction.

Connected wire endpoints follow live without changing pin IDs or saved routing
control points. A completed drag creates one undo action, regardless of pointer
event count. Escape cancels the current drag and exits Move mode. Pointer capture
loss, pointer cancellation or window blur cancels safely and restores controls.
Clicking without moving adds no history. Movement previews are coalesced to one
update per animation frame. Picking uses existing bounding proxies; decorative
CAD meshes remain excluded from raycasting. Static shadows are deferred while
dragging, and the selection outline is omitted from PNG exports.

Validation: production build, 58 unit tests, and
`node scripts/e2e-component-move.mjs`. Real mouse tests cover top/oblique views,
CAD/procedural components, rotated components at nonzero height, live wire-end
alignment, a stable camera during drag, one undo entry, redo, Escape cancellation,
cursor restoration, camera orbit and pin-to-pin wiring after leaving Move mode.
Screenshot: `artifacts/component-move.png`.
