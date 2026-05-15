# Modules

CanvasUI is built around a modular system. Each module handles a specific overlay feature.

## Available Modules

| Module | Icon | Description | Multiple Instances |
|--------|------|-------------|-------------------|
| `chat` | 💬 | Displays Twitch/YouTube/Kick chat messages | No |
| `emote` | 😀 | Bouncing emote animations | No |
| `audiovisualiser` | 🎵 | Real-time audio frequency bars | Yes |
| `webcam` | 📷 | Live webcam feed | Yes |
| `image` | 🖼️ | Static image overlay | Yes |
| `video` | 🎬 | Video playback overlay | Yes |
| `pngtuber` | 🎭 | Audio-reactive PNG avatar | Yes |
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
│   └── webcam.js
├── image/
│   ├── info.json
│   └── image.js
└── video/
    ├── info.json
    └── video.js
```

## Module Loading

The overlay loads modules via `modules.json`, which maps names to their `info.json` files:

```json
{
    "chat": "chat/info.json",
    "emote": "emote/info.json",
    "audiovisualiser": "audiovisualiser/info.json",
    "webcam": "webcam/info.json",
    "image": "image/info.json",
    "video": "video/info.json",
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
    "hasSettings": true,
    "allowMultiple": false,
    "description": "Displays Twitch/YouTube chat messages",
    "gradient": { "from": "rgba(59, 130, 246, 0.08)", "to": "rgba(59, 130, 246, 0.25)" },
    "schema": { ... }
}
```

| Field | Description |
|-------|-------------|
| `name` | Internal identifier (matches config key names) |
| `displayName` | Shown in the editor palette |
| `icon` | Emoji shown in palette and layer list |
| `type` | `"canvas"` — all modules now render to canvas |
| `configKey` | Key in Config where this module's settings live |
| `entrypoint` | JS filename to load (relative to module directory) |
| `hasSettings` | Whether the module has a settings tab |
| `allowMultiple` | Whether multiple instances can exist in a scene |
| `gradient` | Editor highlight colours for the module |
| `schema` | Settings schema for the editor UI (replaces `_type` in config) |

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

1. Create a directory: `www/modules/mymodule/`
2. Create `info.json` with metadata and schema
3. Create your JS entrypoint
4. Add to `modules.json`: `"mymodule": "mymodule/info.json"`
5. Add `"mymodule"` to `Config.Modules`

Your module registers on `window.Modules`:

```javascript
if (document.getElementById('canvas')) {
    window.Modules.push({
        name: "mymodule",
        draw: (ctx, settings, area) => { /* canvas 2D drawing */ },
        update: (dt) => { /* logic update, dt in seconds */ },
        message: (data) => { /* handle WebSocket messages */ }
    });
}
```

The `draw` function receives:
- `ctx` — Canvas 2D rendering context
- `settings` — The module instance's settings from the scene config
- `area` — `{ x, y, width, height }` defining where to draw

All three methods are optional.
