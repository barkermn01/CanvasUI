# Developer Guide

This guide covers creating custom modules, the schema system, the module packaging system, and how the editor discovers and renders module settings.

## Licensing

CanvasUI is licensed under **LGPL-3.0**. This means:

- **The core application** (editor, server, overlay renderer, built-in modules) is copyleft. If you modify and distribute the core code, you must share your changes under the same license.
- **Your custom modules are NOT derivative works.** Modules that communicate through the public API (`window.Modules`, `editorRegister()`, `info.json` schema) can use **any license** — proprietary, commercial, MIT, whatever you choose.
- **You can sell your modules.** The LGPL explicitly permits this. Your module code remains yours.
- **You must not** take the core CanvasUI code and integrate it into a closed-source product without open-sourcing that component.

In short: build and sell modules freely, but don't steal the core.

## Creating a Module

### 1. Create the directory

```
www/modules/mymodule/
├── info.json       # Metadata, schema, entrypoint
└── mymodule.js     # Module code
```

### 2. Write info.json

```json
{
    "name": "mymodule",
    "displayName": "My Module",
    "icon": "🔮",
    "type": "canvas",
    "configKey": "mymodule",
    "entrypoint": "mymodule.js",
    "editorClass": "MyModule",
    "hasSettings": true,
    "allowMultiple": false,
    "description": "Does something cool",
    "gradient": { "from": "rgba(100, 200, 50, 0.08)", "to": "rgba(100, 200, 50, 0.25)" },
    "schema": {
        "_type": {
            "speed": "number",
            "enabled": "bool",
            "color": "color"
        }
    }
}
```

### 3. Write the module code

The module exposes `window[editorClass]` as an object with two properties:
- `_main` — the core module class used by the overlay (and optionally the editor)
- `_simulator` — the class the editor instantiates for preview/simulation (must have `editorRegister()`)

These can be the same class if your module handles both roles.

```javascript
if (!window.MyModule) {

// ─── _main: Core module logic (used by overlay) ─────────────────────────────

class MyModuleMain {
    constructor() {
        // Initialise your module
    }

    draw(ctx, settings, area) {
        if (!area) return;
        ctx.fillStyle = settings?.color || '#ffffff';
        ctx.fillRect(area.x, area.y, area.width, area.height);
    }

    update(dt) {
        // Called every frame, dt in seconds
    }

    onMessage(data) {
        // Handle WebSocket messages from Streamer.bot
    }

    /**
     * Called by the editor after loading the script.
     * Register preview rendering and simulation callbacks.
     * Called once per placed instance — supports multiple instances.
     */
    editorRegister(register) {
        const self = this;

        register({
            // Build the static preview shown on the editor canvas
            preview: (container, settings, area) => {
                container.innerHTML = '';
                container.style.cssText = 'display:flex; align-items:center; justify-content:center;';
                container.textContent = '🔮 Preview';
            },
            // Simulation callbacks for the play button
            simulate: {
                start: (canvas, settings, area) => {
                    // Called when simulation starts — init state here
                },
                update: (settings, area, dt) => {
                    // Called every frame — update logic, dt in seconds
                },
                draw: (ctx, settings, area, dt) => {
                    // Called every frame — draw to the canvas context
                    ctx.fillStyle = settings?.color || '#ffffff';
                    ctx.fillRect(area.x, area.y, area.width, area.height);
                },
                stop: () => {
                    // Called when simulation stops — cleanup timers etc.
                }
            },
            // Called when the instance is removed from the scene
            dispose: () => {
                // Full teardown — release resources, streams, etc.
            }
        });
    }
}

// ─── Export ──────────────────────────────────────────────────────────────────

window.MyModule = {
    _main: MyModuleMain,
    _simulator: MyModuleMain  // Can be a separate class if needed
};

} // end if (!window.MyModule)

// ─── Overlay registration ───────────────────────────────────────────────────

if (document.getElementById('canvas')) {
    const instance = new window.MyModule._main();

    window.Modules.push({
        name: "mymodule",
        draw: (ctx, settings, area) => instance.draw(ctx, settings, area),
        update: (dt) => instance.update(dt),
        message: (data) => instance.onMessage(data)
    });
}
```

### 4. Register in modules.json

Add your module to `www/modules/modules.json`:

```json
{
    "chat": "chat/info.json",
    "emote": "emote/info.json",
    "mymodule": "mymodule/info.json",
    "scene": "scene.js"
}
```

If you install via the Module Manager (Settings → Modules → Install from .zip), steps 4 and 5 are handled automatically.

### 5. Enable in config

Add `"mymodule"` to the `Modules` array in `www/config.js`:

```javascript
Modules: ["emote", "chat", "mymodule", "scene"]
```

The scene module should always be last.

> **Note:** The Module Manager handles this automatically when installing from a .zip package. You only need to do this manually if you're developing a module by dropping files directly into the modules folder.

## Module Packaging

Modules can be distributed as `.zip` packages for easy installation via the Module Manager (Settings → Modules).

### Package Format

```
mymodule.zip
├── manifest.json    # Package metadata + file integrity hashes
├── info.json        # Standard module info
└── mymodule.js      # Module code (+ any other files)
```

### manifest.json

```json
{
    "name": "mymodule",
    "displayName": "My Module",
    "version": "1.0.0",
    "description": "Does something cool",
    "files": [
        { "path": "info.json", "hash": "sha256-hex-hash-of-file" },
        { "path": "mymodule.js", "hash": "sha256-hex-hash-of-file" }
    ]
}
```

The `files` array lists every file in the package with its SHA-256 hash. During installation, the Module Manager verifies each file's hash matches — if any file has been tampered with, installation is rejected.

### Creating a Package

Use the **📤 Export** button in Settings → Modules to package any installed custom module. It automatically generates the manifest with correct hashes.

### Installing a Package

Use the **📦 Install from .zip** button in Settings → Modules. The installer:
1. Extracts the zip to a temp directory
2. Validates `manifest.json` exists and has required fields
3. Verifies SHA-256 hash of every file against the manifest
4. Checks `info.json` exists
5. Copies files to `www/modules/{name}/`
6. Updates `modules.json`
7. Refreshes the module registry (no restart needed)

### Module Hot-Reload

The Module Manager supports reloading modules without restarting the editor:
- **🔄 Refresh Modules** re-discovers all modules from disk
- Removes old script tags and class references from memory
- Re-registers all module instances with fresh code
- The overlay page still needs a manual reload (live-reload handles this on save)

## info.json Reference

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Internal identifier, matches config keys |
| `displayName` | string | Shown in the editor palette |
| `icon` | string | Emoji for palette and layer list |
| `type` | string | Always `"canvas"` |
| `configKey` | string | Key in `Config` where global settings live |
| `entrypoint` | string | JS filename to load (relative to module dir) |
| `editorClass` | string | Window property name exposing `{ _main, _simulator }` for editor |
| `hasSettings` | bool | Whether a settings tab appears in Global Settings |
| `allowMultiple` | bool | Whether multiple instances can exist per scene |
| `description` | string | Tooltip in the palette |
| `gradient` | object | `{ from, to }` — editor highlight colours |
| `schema` | object | Settings schema for the editor UI |

## Schema System

The schema defines what controls the editor renders for your module's settings. It replaces the old `_type` / `_item_type` metadata that used to live inside the config.

### Basic Types

```json
"schema": {
    "_type": {
        "name": "string",
        "count": "number",
        "enabled": "bool",
        "color": "color",
        "device": "audioDevice"
    }
}
```

| Type | Renders |
|------|---------|
| `"string"` | Text input |
| `"number"` | Number input |
| `"bool"` | Checkbox |
| `"color"` | Color picker swatch |
| `"audioDevice"` | Dropdown of audio input devices |
| `"gradient"` | Gradient editor with stops and preview |

### Select (Dropdown)

```json
"direction": {
    "type": "select",
    "options": ["left-right", "right-left", "top-down", "bottom-up"]
}
```

### Conditional Visibility (showWhen)

Show a field only when another field has a specific value:

```json
"level1": { "type": "color", "showWhen": { "field": "mode", "value": "levels" } },
"gradient": { "type": "gradient", "showWhen": { "field": "mode", "value": "gradient" } }
```

When `mode` changes, the UI re-renders and shows/hides fields accordingly.

### Sub-Objects

Use `_item_type` to define how sub-objects render:

```json
"schema": {
    "_type": {
        "enabled": "bool"
    },
    "_item_type": {
        "colors": "object",
        "style": "css"
    },
    "colors": {
        "_type": {
            "primary": "color",
            "secondary": "color"
        }
    }
}
```

| Item Type | Renders |
|-----------|---------|
| `"object"` | Collapsible group, rendered recursively |
| `"css"` | Key-value CSS property editor |

### Nested Schemas

Sub-objects can have their own `_type` and `_item_type`:

```json
"schema": {
    "_item_type": {
        "ChatBoxes": "object"
    },
    "ChatBoxes": {
        "_type": {
            "ShowBadges": "bool",
            "position": { "type": "select", "options": ["top", "bottom"] }
        },
        "_item_type": {
            "style": "css"
        }
    }
}
```

## Module Draw Signature

The scene system calls your module's `draw` function with:

```javascript
draw(ctx, settings, area)
```

| Parameter | Description |
|-----------|-------------|
| `ctx` | Canvas 2D rendering context |
| `settings` | The instance's settings from the scene config (e.g. `{ src: "/media/bg.png", opacity: 1 }`) |
| `area` | `{ x, y, width, height }` — where to draw on the canvas |

For modules with `allowMultiple: true`, `draw` is called once per instance with different settings/area each time.

## Scene Config Format

Each module instance in a scene has:

```json
"my_overlay": {
    "_type": "image",
    "area": { "x": 100, "y": 50, "width": 400, "height": 300 },
    "settings": { "src": "/media/overlay.png", "opacity": 0.8 }
}
```

- `_type` — which module renders this instance
- `area` — pixel position and size
- `settings` — passed to the module's `draw` function

The key (`"my_overlay"`) is the user-defined ID shown in the editor.

## Global Settings Tabs

If your module has `"hasSettings": true` in info.json, it automatically gets a tab in the Global Settings panel. The tab renders your schema using the TypeRenderer, reading/writing to `Config[configKey]`.

## File Storage

| Path | Purpose |
|------|---------|
| `www/config.js` | User's config (gitignored) |
| `www/config.example.js` | Template for new installs |
| `www/modules/modules.json` | Master manifest |
| `www/modules/{name}/info.json` | Module metadata + schema |
| `www/modules/{name}/{entrypoint}` | Module code |
| `www/modules/global.info.json` | Schema for root config fields |
| `www/media/` | User-uploaded media (gitignored) |
| `editor/src/main/` | Electron main process |
| `www/lib/` | Shared libraries (wsclient, livereload, etc.) |

## WebSocket Message Format

Messages from Streamer.bot arrive via `wsclient.js` and are routed by module name:

```json
{
    "data": {
        "Module": "chat",
        "Data": {
            "Type": "MessageAdded",
            "DisplayName": "User",
            "Message": "Hello!",
            ...
        }
    }
}
```

The `Module` field matches the module's registered `name`. The `Data` object is passed to the module's `message(data)` function.

## Editor WebSocket (Live Reload)

The editor's server also has a WebSocket for:
- `{ type: "config-reload" }` — triggers page reload in overlay
- `{ type: "module-message", module: "chat", data: {...} }` — sends a message to a specific module
- `{ type: "raw", data: {...} }` — broadcasts to all modules

Use the 📡 WebSocket Admin tool in the editor to test messages.
