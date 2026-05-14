# Changelog

## v1.3.2

### Module Discovery System
- Modules now live in their own directories: `www/modules/{name}/`
- Each module has an `info.json` manifest with metadata, schema, and entrypoint
- `www/modules/modules.json` is the master manifest mapping module names to their info files
- The editor palette is built dynamically from discovered modules
- Third-party modules can be added by dropping a folder into `www/modules/`

### Scene System Overhaul
- Scene modules now use `_type` field to identify which module renders them
- Draw order follows the scene config order (first entry = bottom layer, last = top)
- Multi-instance support: modules like `image` and `video` can have multiple instances per scene (e.g. `chat_bg`, `chat_frame`, `cam_frame`)
- `allowMultiple` flag in info.json controls whether the editor allows duplicates

### Canvas-Based Chat
- Chat module completely rewritten to render directly to canvas (no DOM elements)
- Supports: text-shadow, drop-shadow, linear-gradient backgrounds (multiple layers), borders, fit-content width, right-alignment
- Font size, family, padding, border-radius all read from config style object
- localStorage persistence for message history
- Live preview in editor with 💬 (test message) and 🗑 (clear) buttons

### Webcam Module (New)
- New `webcam` module for live camera feed
- Renders directly to canvas via `ctx.drawImage`
- Device selection dropdown in properties panel
- Mirror, mask (circle/rounded), and border-radius options
- Settings stored in global `Config.webcam`
- `--disable-features=MediaFoundationVideoCapture` flag for shared virtual camera access

### Editor Improvements
- **Dynamic palette**: Built from module discovery, no hardcoded items
- **Scene duplication**: ⧉ button on active scene tab to clone a scene
- **Scene rename**: Double-click scene tab to rename (fixed click/dblclick conflict)
- **Layer names**: Simplified to icon + ID (removed redundant type text)
- **Module IDs**: Custom IDs now saved correctly to config (no longer overwritten with type_N)
- **Image simulation**: Images render in Play All mode
- **WebSocket Admin tool**: 📡 button in toolbar opens a panel to send raw messages to overlay clients for testing
- **Chat preview**: Live canvas-based preview with test message/clear buttons
- **Media permissions**: Auto-granted in Electron for camera/microphone access

### Config Refactor
- All `_type` and `_item_type` metadata moved from config.js to module info.json `schema` fields
- Config is now pure data — no metadata keys polluting the saved file
- `global.info.json` holds schema for root-level config fields
- TypeRenderer reads schema from module registry, falls back to legacy `_type` in config

### Server & Build
- Removed audio device selector from server settings (device is configured per-module now)
- OBS URL always includes `?allowaudio=true`
- Toolbar URL copy matches server settings
- Build script reads version from package.json instead of hardcoding it
- Installer preserves `www/media/` and `www/config.js` during updates
- Build uses `config.example.js` as the release config (no personal data leaks)

### Cleanup
- Removed debug console.log statements from audio visualiser
- Removed debug logging from media panel drag-drop
- Removed `chat.css` (no longer needed — chat is canvas-based)
- Removed split/separated chat mode
