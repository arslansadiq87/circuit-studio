# Mouse editing for manual wires

Select a wire, set **Route mode → Manual curve**, then click **Edit route with mouse** in the inspector. Green handles mark its bend points. If no points exist, a middle handle lets you create the first point by dragging. **Add bend point** adds more handles; the existing coordinate fields and remove buttons remain available.

Drag with the left mouse button. Movement follows the camera's screen plane: **Top** edits X/Y, **Front** edits X/Z, and an oblique view allows movement in its corresponding plane. Camera orbit pauses during a handle drag and resumes on release. Terminal anchors and components remain fixed. Each completed drag creates one Undo step, and Redo restores it. Escape, losing focus or losing pointer capture cancels an unfinished drag. **Done editing route** hides the handles.

Edits use the existing manual bend-point data and therefore save, reopen and animate normally. Other route modes retain their existing behavior. Handles are editor overlays and are excluded from PNG export and wire animation.

Implementation: `WireRouteHandles.tsx` previews points locally and commits once on release. `wireRouteEditor.ts` stores only the temporary editing selection. `Workspace.tsx` renders the preview using the existing manual curve builder.

Validation: `node scripts/e2e-wire-route-edit.mjs` exercises actual mouse drags, creation and editing of multiple points, X/Y and height changes, terminal anchors, stationary camera/components, Undo/Redo, Escape cancellation and exiting editing. Capture: `artifacts/manual-wire-edit.png`.
