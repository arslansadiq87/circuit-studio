# Projects and images

`.c3dproj` is versioned JSON. It includes circuit, camera, wire-route data, and any embedded model assets used by custom instances. Opening on a fresh browser profile recreates those custom library records. Project and component schemas are validated before data is applied.

PNG export temporarily renders the current scene at a selected resolution: 1920x1080, 2560x1440, 3840x2160, or custom dimensions. It adjusts the export camera aspect to the chosen output and restores the live renderer, camera, background, and project state when complete. Transparent PNG output is supported.

Wokwi JSON, CAD conversion, Fritzing, KiCad and CSV adapters are not included in this sprint.
