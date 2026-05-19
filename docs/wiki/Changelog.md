# Changelog

## v1.4.0 — Cross Platform

### Cross-Platform Support
- macOS and Linux support — app now runs on all three platforms
- Platform-aware user data paths (macOS: `~/Library/Application Support/`, Linux: `~/.config/`)
- Windows unchanged — user data stays in install directory
- Built-in modules synced from app bundle on every launch (macOS/Linux)
- Custom modules preserved across updates on all platforms
- Replaced PowerShell zip with `adm-zip` (pure JS, cross-platform)
- Added DMG (macOS) and AppImage/deb (Linux) build targets

### Schema-Driven Properties
- Module properties panel auto-generated from `info.json` `"properties"` field
- Supports: string, number, bool, color picker, select, range slider, media browser, audio/camera device dropdowns
- `showWhen` conditional visibility for dependent fields
- Removed all hardcoded per-module property methods
- Canvas re-renders live when properties change
- Scene Settings only shown when no module is selected

### Webcam Chroma Key
- WebGL-accelerated green screen removal (GPU-powered, YCbCr color space)
- Chroma key settings per-instance in Properties panel
- Color picker for key color, sliders for similarity/smoothness/spill
- Color picker auto-repositions to stay within viewport

### Chat Improvements
- Hide messages by prefix — `hideMessageStartingWith` setting filters bot commands
- Fixed emote spacing and text rendering
- Fixed Kick emote text leaking as plain text

### PNGTuber Fixes
- Fixed images not rendering in editor or OBS
- Proper URL resolution and CORS handling
- Shows actual idle image in editor preview

### Other
- Fixed video module not looping
- Module manager auto-adds/removes from Config.Modules
- Updated Streamer.bot import for Kick emote fix
- License changed from MIT to LGPL-3.0

## v1.3.6 — Drop It In

### New: PNGTuber Module 🎭
- Audio-reactive PNG avatar that switches between idle/talking poses
- Monitors microphone in configurable frequency range (85-300Hz for voice)
- Volume threshold with hold time to prevent flickering
- Optional blink overlay at configurable intervals
- Bounce animation on talk
- All settings per-instance in properties panel
- Media browser integration for image selection

### New: Module Manager
- Settings → Modules tab for managing installed modules
- Install from .zip with SHA-256 file integrity verification
- Export custom modules as .zip packages for sharing
- Uninstall removes module and cleans up all scene references, auto-saves config
- Refresh Modules — hot-reload classes without restarting
- Open Modules Folder for quick access
- Palette visibility checkbox — hide modules from palette without removing

### Other
- Dynamic settings button in properties (removed hardcoded module list)
- Settings tab divider between system and module settings
- Installer preserves custom modules during Windows updates

## v1.3.5

### Editor Improvements
- Arrow key movement — 5px (default), 20px (shift), 1px (alt)
- In-app Help panel (F1 or toolbar ❓ button)
- Canvas Settings dropdown with Lock to Canvas toggle
- Layer visibility toggle (eye icon)
- Canvas resizes when sidebar panels are toggled
- Settings panel fix — module tabs always appear from properties button
- `npm run screenshots` for automated wiki documentation captures

### Chat Module Fixes
- Fixed CSS gradient rendering using SVG foreignObject (pixel-perfect)
- Fixed border rendering (ridge/groove/etc) via CSS capture
- Fixed badge/text vertical alignment
- Added NameOnNewLine setting
- Fixed message overflow for all NewMessages + Position combinations
- Emotes persist across page reloads
- Chat simulation auto-spawns test messages on play
- Removed obsolete settings (BeforeCanvas, MessageArea, platforms)

### Media Library
- Fixed OS file drag-drop (webUtils.getPathForFile for Electron sandbox)
- Delete works in subdirectories
- Folder delete button
- Hidden `/media/` prefix from breadcrumb

## v1.3.4 — Modular by Design

### Module Simulation System Overhaul
- Simulation logic moved into modules via `editorRegister()` / `{ _main, _simulator }` pattern
- Editor dynamically loads and registers simulators per instance
- Proper cleanup on delete, scene switch, and re-render
- New `editorClass` field in info.json
- Developer Guide updated with new module authoring pattern

### Chat Module Fixes
- CSS gradient rendering via SVG foreignObject for pixel-perfect output
- Border styles (ridge/groove/etc) rendered correctly
- Badge/text vertical alignment when badges are larger than font
- NameOnNewLine setting for username on separate line
- allowClipping — hide partial messages instead of visually clipping
- hideBots moved into ChatBoxes section
- Removed obsolete BeforeCanvas/MessageArea/platforms settings
- Cache invalidation on style config changes

### Editor Fixes
- Settings panel module tabs fix
- openTo(tab) method for properties panel settings button
- Fix script load order (simulator.js before canvas.js)
- Play All button uses new async simulator API

### Other
- Dynamic settings tabs from module discovery
- Schema labels with tooltips
- Fixed OS file drag-drop
- Developer Guide and README documentation

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
