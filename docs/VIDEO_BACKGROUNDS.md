# Video backgrounds

The Auto Video **Background** dropdown controls the automatic preview, PNG frames, WebM and MP4 renders. Background settings are saved in the browser's `c3d-video-preset-v1` settings record and remain available when the user closes the panel or opens another project in the same browser profile. They are independent of the editor viewport theme and do not become part of the electrical circuit data.

## Presets

| Preset | Initial color |
| --- | --- |
| Dark Studio | `#171B22` |
| Pure Black | `#000000` |
| Pure White | `#FFFFFF` |
| Light Gray | `#D9DCE1` |
| Neutral Gray | `#777B82` |
| Studio Blue | `#172A44` |
| Green Screen | `#00FF00` |

Custom Solid Color accepts six digit HEX (`#24354F` is an example). Invalid draft text stays in the field as an error and is not saved. Color controls use sRGB HEX values; solid colors are converted through Three.js color management and gradient canvas textures are explicitly tagged as sRGB.

Dark Gradient runs from charcoal `#171B22` to blue `#172A44`; Light Gradient runs from `#F7F8F8` to `#D9DCE1`. Custom Gradient provides two colors, vertical/horizontal/diagonal direction, and a transition-position slider. Gradients are a small screen-space texture made when the settings change, so they stay fixed while the camera moves and add no per-frame texture allocation.

## Floor, grid and shadows

Show Floor, Floor Color, Grid and Ground Shadows affect the generated video renderer only. They are separate from the background color. Floor, grid and shadows default off to preserve the established floating technical presentation and render cost. Shadows use the existing scene lights and a soft shadow map; they do not relight the scene. The editor workbench and its light settings are never changed by video preview or export.

## Alpha and chroma key

Transparent is selectable only for Numbered RGBA PNG frames (ZIP). MP4/H.264 and the current WebM export are opaque. Switching an alpha PNG configuration to MP4/WebM resets the background to Dark Studio and displays that limitation. For a green screen, the export background is pure `#00FF00`; antialiasing at object edges and reflected scene color can affect chroma-key extraction.

## Preview and saved settings

The settings panel shows a lightweight background swatch with a circuit thumbnail. It does not load a second CAD scene. **Preview sequence** uses the same dedicated WebGL and caption-composition renderer as final frames. Changing a background while the sequence preview is open updates that renderer immediately. Background configuration is version 2; saved version 1 settings migrate, retaining animation timing, camera overrides, labels and compatible old Dark Studio/Clean White selections.

The adaptive connection caption chooses light text on dark backgrounds and dark text on light backgrounds. Green Screen uses a dark neutral panel. Captions are composited into each PNG frame before encoding, so their contrast is the same in preview and exported video.
