# Binary assets and portable projects

The original STEP and `public/models/yd-esp32-s3-v34.glb` are masters. Runtime assets are separate `-low`, `-medium`, and `-high` files. Only the levels used by the scene are fetched. Parts Bin thumbnails are CSS/vector glyphs, not loaded CAD scenes. CAD optimization runs offline with `npm run optimize:cad`; glTF Transform is a development dependency and is not part of the browser bundle.

## Browser storage and resource lifetime

`circuit-studio-assets` stores binary `Blob` values keyed by SHA-256, with a separate URL-to-hash index. Identical bytes are stored once. `circuit-studio-library` stores component definitions and asset hashes. Existing base64 library records migrate when read or saved. `listParts()` returns metadata without model bytes; normal insertion never converts binary assets to base64.

Concurrent URL requests share a promise. Parsed Three.js groups are cached by content hash and format. Instances clone the object hierarchy and share immutable BufferGeometry and materials. LODs use independent cache entries. References are released when a component disappears; unused parsed entries are retained for five minutes to avoid repeated decoding during zoom or undo, then geometries, materials, and textures are disposed. Binary IndexedDB entries persist for reopening. There is currently no user-facing disk-cache eviction/size manager.

The component workshop shares its parsed source between measurement and preview. Changing dimensions or origin creates a new transform without decoding the asset again. Preview surface picking is intentional for anchor placement; editor CAD rendering disables mesh raycasting and uses component/pin proxies instead.

## Save formats

* **Package** saves `.c3dzip`, an asynchronous ZIP package with manifest version 2. It contains `manifest.json`, `project.json`, `components.json`, and content-addressed binary files under `assets/`. The project includes all pin definitions, connection endpoints, routing, transforms, dimensions, and camera data. All bundled CAD LODs used by the project are included, making close-up inspection and high-quality export portable too.
* **Save** retains version 1 `.c3dproj` JSON compatibility. It embeds custom models as base64 and includes bundled runtime LODs in `url:` asset entries. Base64 conversion occurs only for explicit legacy export. This format is larger and uses more temporary memory than ZIP.
* **Open** detects ZIP by signature and continues to accept legacy JSON. The versioned ZIP manifest is validated, binary hashes are checked, missing pins/assets are rejected, and component metadata is restored before the project is loaded. Older pin-ID migrations still apply. Unknown future package versions produce an error rather than guessing.

Packaging/unpacking uses fflate's asynchronous worker interface; SHA-256 uses Web Crypto. Progress messages keep import/export status visible. glTF sidecars selected in the workshop are embedded into their model resource, including texture images. Standalone GLBs should include their own resources; runtime loading does not crawl arbitrary model dependency directories.

Portable restoration is tested in a fresh browser context, with empty IndexedDB and CAD HTTP requests deliberately blocked. This tests access to the saved model bytes independently of the original project folder. A reopened package may update an existing URL-to-hash mapping; a component content hash triggers reloading if the previous network request failed.

Component `.c3dcomponent` packages remain compatible JSON. The new project package is the recommended format for sharing a circuit containing large binary assets.
