# Modules

CanvasUI is built around a modular system. Each module handles a specific overlay feature.

## Available Modules

| Module | Icon | Description | Multiple Instances |
|--------|------|-------------|-------------------|
| `alert` | 🔔 | Animated alert popups for follows, subs, raids, and custom events | Yes |
| `audiovisualiser` | 🎵 | Audio frequency visualisation bars | Yes |
| `bitcollector` | 💎 | Glass that fills with bits/kicks and bursts at threshold | Yes |
| `chat` | 💬 | Displays Twitch/YouTube chat messages | No |
| `clock` | 🕐 | Displays current time, date, or stream uptime | Yes |
| `countdown` | ⏱️ | Configurable countdown timer with end state | Yes |
| `emote` | 😀 | Bouncing emotes from chat | No |
| `eventticker` | 📜 | Scrolling ticker of recent stream events | Yes |
| `gamepadbuttons` | 🔘 | Displays a single controller button with idle/active images | Yes |
| `gamepaddpad` | ✚ | Displays D-pad directional input from a controller | Yes |
| `goalbar` | 📊 | Progress bar toward a configurable target (subs, bits, donations) | Yes |
| `hypetrain` | 🚂 | Displays hype train level and progress | Yes |
| `image` | 🖼️ | Static image overlay | Yes |
| `pngtuber` | 🎭 | Audio-reactive PNG avatar that switches poses based on voice | Yes |
| `poll` | 📋 | Displays active poll with live-updating vote bars | Yes |
| `shoutout` | 📢 | Displays a user profile card for shoutouts | Yes |
| `spritesheet` | 🎞️ | Animated spritesheet player for borders, frames, and effects | Yes |
| `steeringwheel` | 🎮 | Displays a rotating steering wheel driven by a gamepad axis | Yes |
| `video` | 🎬 | Video playback overlay | Yes |
| `viewercount` | 👁️ | Combined viewer count across Twitch and Kick | Yes |
| `webcam` | 📷 | Live webcam feed with optional chroma key | Yes |
| `scene` | — | Scene switching and transitions (system) | — |

## Installing Custom Modules

Custom modules can be installed via the Module Manager in **Settings → Modules**:

- **📦 Install from .zip** — install a packaged module with integrity verification
- **📂 Open Modules Folder** — manually drop module folders in
- **🔄 Refresh Modules** — re-discover modules without restarting

Modules can also be hidden from the palette without uninstalling them using the visibility checkbox.

See the [[Developer Guide]] for creating and packaging your own modules.

## Module Directory Structure

Each module lives in its own directory under `www/modules/`:

```
www/modules/
├── modules.json              # Master manifest
├── global.info.json          # Global config schema
├── scene.js                  # Scene system (not in a subdirectory)
├── chat/
│   ├── info.json             # Module metadata + schema
│   └── chat.js              # Module entrypoint
├── emote/
│   ├── info.json
│   └── emote.js
├── audiovisualiser/
│   ├── info.json
│   └── audiovisualiser.js
├── webcam/
│   ├── info.json
│   ├── chromakey.js          # Dependency script
│   └── webcam.js
├── image/
│   ├── info.json
│   └── image.js
├── video/
│   ├── info.json
│   └── video.js
└── pngtuber/
    ├── info.json
    └── pngtuber.js
```

## Module Loading

The overlay loads modules via `modules.json`, which maps every bundled module name to its `info.json` file (abbreviated below — the full manifest lists all modules from the table above):

```json
{
    "chat": "chat/info.json",
    "emote": "emote/info.json",
    "audiovisualiser": "audiovisualiser/info.json",
    "webcam": "webcam/info.json",
    "image": "image/info.json",
    "video": "video/info.json",
    "...": "...",
    "scene": "scene.js"
}
```

The loader fetches each `info.json`, reads the `entrypoint` field, and loads the script. Modules listed directly as `.js` files (like `scene`) are loaded directly.

Only modules listed in `Config.Modules` are loaded:

```javascript
Modules: ["emote", "chat", "audiovisualiser", "webcam", "image", "video", "scene"]
```

## info.json Format

Each module's `info.json` defines its metadata and settings schema:

```json
{
    "name": "chat",
    "displayName": "Chat",
    "icon": "💬",
    "type": "canvas",
    "configKey": "chat",
    "entrypoint": "chat.js",
    "editorClass": "CanvasChat",
    "hasSettings": true,
    "allowMultiple": false,
    "description": "Displays Twitch/YouTube chat messages",
    "gradient": { "from": "rgba(59, 130, 246, 0.08)", "to": "rgba(59, 130, 246, 0.25)" },
    "properties": { ... },
    "schema": { ... }
}
```

| Field | Description |
|-------|-------------|
| `name` | Internal identifier (matches config key names) |
| `displayName` | Shown in the editor palette |
| `icon` | Emoji shown in palette and layer list |
| `type` | `"canvas"` — all modules render to canvas |
| `configKey` | Key in Config where this module's global settings live |
| `entrypoint` | JS filename to load (relative to module directory) |
| `editorClass` | Window property exposing `{ _main, _simulator }` for editor |
| `hasSettings` | Whether the module has a global settings tab |
| `allowMultiple` | Whether multiple instances can exist in a scene |
| `scripts` | Dependency scripts to load before entrypoint |
| `properties` | Per-instance property definitions for the Properties panel |
| `gradient` | Editor highlight colours for the module |
| `schema` | Global settings schema for the Settings panel |

## Scene System

The scene module controls draw order and module visibility. It:

1. Suppresses individual module draw calls
2. Iterates the active scene's `modules` object in order
3. Calls each module's `draw(ctx, settings, area)` with the correct clip region

Scene module entries use `_type` to identify which module renders them:

```json
"chat_frame": {
    "_type": "image",
    "area": { "x": 2012, "y": 412, "width": 548, "height": 1028 },
    "settings": { "src": "/media/Layout Parts/ChatArea.png", "opacity": 1, "objectFit": "contain" }
}
```

## Chat Module

Canvas-based chat renderer with full styling support.

**Features:**
- Twitch and YouTube platform support
- BTTV and FFZ emote rendering (inline with text)
- Badge display
- Message removal/timeout handling
- Auto-hide with fade/slide animations
- Configurable styles: font, colours, gradients, text-shadow, drop-shadow, borders, border-radius
- `fit-content` width and right-alignment support
- localStorage persistence across page reloads

## Webcam Module

Live camera feed rendered to canvas.

**Features:**
- Device selection (reads from `Config.webcam.device`)
- Mirror mode
- Mask options: none, circle, rounded
- Configurable border radius
- Shared access to virtual cameras (XSplit VCam, OBS Virtual Camera)

## Creating Custom Modules

See the [[Developer Guide]] for the full module creation walkthrough, including:
- The `{ _main, _simulator }` class pattern
- `editorRegister()` for editor preview and simulation
- The `properties` schema for per-instance settings
- Module packaging and distribution

Quick start:

1. Create a directory: `www/modules/mymodule/`
2. Create `info.json` with metadata, properties, and schema
3. Create your JS entrypoint with the `window.MyModule = { _main, _simulator }` pattern
4. Add to `modules.json`: `"mymodule": "mymodule/info.json"`
5. Add `"mymodule"` to `Config.Modules`

Or install via the Module Manager (Settings → Modules → Install from .zip) which handles steps 4-5 automatically.
