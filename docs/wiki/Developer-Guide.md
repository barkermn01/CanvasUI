# Developer Guide

This guide covers creating custom modules, the schema system, the properties system, module packaging, and how the editor discovers and renders module settings.

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
├── info.json       # Metadata, properties, schema, entrypoint
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
    "hasSettings": false,
    "allowMultiple": true,
    "description": "Does something cool",
    "gradient": { "from": "rgba(100, 200, 50, 0.08)", "to": "rgba(100, 200, 50, 0.25)" },
    "properties": {
        "speed": { "type": "range", "label": "Speed", "min": 0, "max": 100, "step": 1, "default": 50 },
        "enabled": { "type": "bool", "label": "Enabled", "default": true },
        "color": { "type": "color", "label": "Color", "default": "#ff0000" },
        "src": { "type": "media", "label": "Image", "mediaType": "image" }
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

    editorRegister(register) {
        const self = this;

        register({
            preview: (container, settings, area) => {
                container.innerHTML = '';
                container.style.cssText = 'display:flex; align-items:center; justify-content:center;';
                container.textContent = '🔮 Preview';
            },
            simulate: {
                start: (canvas, settings, area) => {},
                update: (settings, area, dt) => {},
                draw: (ctx, settings, area, dt) => {
                    self.draw(ctx, settings, area);
                },
                stop: () => {}
            },
            dispose: () => {}
        });
    }
}

window.MyModule = {
    _main: MyModuleMain,
    _simulator: MyModuleMain
};

} // end if (!window.MyModule)

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

### 5. Enable in config

Add `"mymodule"` to the `Modules` array in `www/config.js`:

```javascript
Modules: ["emote", "chat", "mymodule", "scene"]
```

The scene module should always be last.

> **Note:** The Module Manager handles steps 4 and 5 automatically when installing from a .zip package. You only need to do this manually if developing a module by dropping files directly into the modules folder.

---

## info.json Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Internal identifier, matches config keys |
| `displayName` | string | Yes | Shown in the editor palette |
| `icon` | string | Yes | Emoji for palette and layer list |
| `type` | string | Yes | Always `"canvas"` |
| `configKey` | string | Yes | Key in `Config` where global settings live |
| `entrypoint` | string | Yes | JS filename to load (relative to module dir) |
| `editorClass` | string | No | Window property name exposing `{ _main, _simulator }` |
| `hasSettings` | bool | No | Whether a global settings tab appears (default: false) |
| `allowMultiple` | bool | No | Whether multiple instances can exist per scene (default: true) |
| `description` | string | No | Tooltip in the palette |
| `gradient` | object | No | `{ from, to }` — editor highlight colours |
| `scripts` | array | No | Dependency scripts to load before entrypoint (e.g. `["chromakey.js"]`) |
| `properties` | object | No | Per-instance property definitions for the Properties panel |
| `schema` | object | No | Global settings schema for the Settings panel |

---

## Properties System (Per-Instance)

The `"properties"` field in info.json defines the controls shown in the Properties panel when a module instance is selected. Each property maps to a key in `mod.settings`.

### Property Types

| Type | Widget | Description |
|------|--------|-------------|
| `string` | Text input | Free text entry |
| `number` | Number input | Numeric with optional min/max/step |
| `bool` | Checkbox | True/false toggle |
| `color` | Color picker | Click to open color picker popup |
| `select` | Dropdown | Choose from predefined options |
| `range` | Slider | Numeric slider with live value display |
| `media` | Browse button | Opens media panel for file selection |
| `audioDevice` | Dropdown | Populated with system audio input devices |
| `cameraDevice` | Dropdown | Populated with system video input devices |

### Property Definition Format

```json
"properties": {
    "settingKey": {
        "type": "range",
        "label": "Display Label",
        "min": 0,
        "max": 100,
        "step": 1,
        "default": 50,
        "showWhen": { "field": "otherKey", "value": true }
    }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Widget type (see table above) |
| `label` | Yes | Display label in the Properties panel |
| `default` | No | Default value for new instances |
| `min` | No | Minimum value (number/range) |
| `max` | No | Maximum value (number/range) |
| `step` | No | Step increment (number/range) |
| `options` | No | Array of choices (select type) |
| `mediaType` | No | `"image"` or `"video"` (media type) |
| `placeholder` | No | Placeholder text (string type) |
| `showWhen` | No | Conditional visibility (see below) |

### Conditional Visibility (showWhen)

Show a property only when another property has a specific value:

```json
"chromaKey": { "type": "bool", "label": "Chroma Key", "default": false },
"chromaKeyColor": {
    "type": "color",
    "label": "Key Color",
    "default": "#00ff00",
    "showWhen": { "field": "chromaKey", "value": true }
}
```

When `chromaKey` is toggled, the panel re-renders and shows/hides dependent fields.

### Example: Full Properties Definition

```json
"properties": {
    "device": { "type": "cameraDevice", "label": "Camera" },
    "mirror": { "type": "bool", "label": "Mirror", "default": false },
    "mask": { "type": "select", "label": "Mask", "options": ["none", "circle", "rounded"], "default": "none" },
    "borderRadius": { "type": "string", "label": "Border Radius", "placeholder": "16px", "showWhen": { "field": "mask", "value": "rounded" } },
    "opacity": { "type": "range", "label": "Opacity", "min": 0, "max": 1, "step": 0.1, "default": 1 },
    "tint": { "type": "color", "label": "Tint Color", "default": "#ffffff" },
    "src": { "type": "media", "label": "Overlay Image", "mediaType": "image" }
}
```

---

## Schema System (Global Settings)

If your module has `"hasSettings": true`, it gets a tab in the Global Settings panel (Settings → your module name). The `"schema"` field defines what controls appear there.

Global settings are stored in `Config[configKey]` and are shared across all instances of the module.

### Basic Types

```json
"schema": {
    "_type": {
        "name": "string",
        "count": "number",
        "enabled": "bool",
        "color": "color",
        "device": "audioDevice"
    },
    "_labels": {
        "name": { "label": "Display Name", "tooltip": "Help text on hover" }
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

```json
"level1": { "type": "color", "showWhen": { "field": "mode", "value": "levels" } },
"gradient": { "type": "gradient", "showWhen": { "field": "mode", "value": "gradient" } }
```

### Sub-Objects

Use `_item_type` to define how sub-objects render:

```json
"schema": {
    "_type": { "enabled": "bool" },
    "_item_type": { "colors": "object", "style": "css" },
    "colors": {
        "_type": { "primary": "color", "secondary": "color" }
    }
}
```

| Item Type | Renders |
|-----------|---------|
| `"object"` | Collapsible group, rendered recursively |
| `"css"` | Key-value CSS property editor |

---

## Editor Registration (editorRegister)

The `editorRegister` method is called by the editor after loading your module's script. It lets you provide:

- **preview** — static preview shown on the editor canvas
- **simulate** — animation callbacks for the play button
- **dispose** — cleanup when the instance is removed

```javascript
editorRegister(register) {
    register({
        preview: (container, settings, area) => {
            // Build DOM preview inside container
        },
        simulate: {
            start: (canvas, settings, area) => {
                // Init simulation state
            },
            update: (settings, area, dt) => {
                // Per-frame logic, dt in seconds
            },
            draw: (ctx, settings, area, dt) => {
                // Per-frame canvas rendering
            },
            stop: () => {
                // Cleanup on stop (timers, etc.)
            }
        },
        dispose: () => {
            // Full teardown (streams, contexts, etc.)
        }
    });
}
```

If `simulate` is not provided (or has no `draw`/`update`), the play button won't appear for that module.

---

## Module Draw Signature

The scene system calls your module's `draw` function with:

```javascript
draw(ctx, settings, area)
```

| Parameter | Description |
|-----------|-------------|
| `ctx` | Canvas 2D rendering context |
| `settings` | The instance's settings from the scene config |
| `area` | `{ x, y, width, height }` — where to draw on the canvas |

For modules with `allowMultiple: true`, `draw` is called once per instance with different settings/area each time.

---

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
- `settings` — passed to the module's `draw` function (matches `properties` keys)

---

## Module Packaging

Modules can be distributed as `.zip` packages for installation via the Module Manager (Settings → Modules).

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
        { "path": "info.json", "hash": "sha256-hex-hash" },
        { "path": "mymodule.js", "hash": "sha256-hex-hash" }
    ]
}
```

The `files` array lists every file with its SHA-256 hash. Installation verifies each file — tampered packages are rejected.

### Creating a Package

Use **📤 Export** in Settings → Modules to package any installed custom module. It generates the manifest with correct hashes automatically.

### Installing a Package

Use **📦 Install Module** in Settings → Modules. The installer:
1. Extracts and validates the manifest
2. Verifies SHA-256 hash of every file
3. Copies to `www/modules/{name}/`
4. Updates `modules.json` and `Config.Modules`
5. Refreshes the module registry (no restart needed)

---

## Module Signing (.cumod Format)

Modules can be signed with an Ed25519 certificate to prove authorship and detect tampering. Signed modules show a green **✓ Developer Name** badge in the Module Manager. Unsigned modules show **Unverified**.

### .cumod Binary Format

The `.cumod` format wraps a zip package with a signed header:

```
┌─────────────────────────────────────────┐
│ Magic: "CUMOD" (5 bytes)                │
│ Version: 1 (uint8, 1 byte)             │
│ Header length: uint32LE (4 bytes)       │
│ Header JSON (variable):                 │
│   - name, displayName, version, author  │
│   - zipHash (SHA-256 of zip data)       │
│   - signature (hex, Ed25519)            │
│   - certificate (JSON object)           │
│ Zip data (rest of file)                 │
└─────────────────────────────────────────┘
```

### Trust Chain

```
CA public key (bundled with app)
  └─ verifies certificate.caSignature
       └─ certificate.publicKey verifies header.signature
            └─ signature covers zipHash
                 └─ zipHash covers zip contents
                      └─ manifest.json hashes cover extracted files
```

### Verification States

| Badge | Meaning |
|-------|---------|
| ✓ Developer Name | Signed, certificate valid, files intact |
| Unverified | No signature present (still works, just not verified) |
| ⚠️ Tampered | Signature invalid, files modified, or cert not from trusted CA |
| 🚫 Revoked | Developer's certificate has been revoked — module disabled |

Revoked modules are fully disabled: hidden from the palette, checkbox locked, cannot be added to scenes.

---

## Getting a Signed Certificate

To sign your modules, you need a developer certificate issued by the CanvasUI CA.

### Step 1: Generate Your Key & Signing Request

**Option A: Using the Editor UI**

1. Open Settings → Modules
2. Click **🔑 Generate Key & Signing Request**
3. Fill in your details:
   - **Developer Name** (required) — shown on the verified badge
   - **Organisation** (optional)
   - **Website** (optional) — shown in the certificate popup
   - **Support Email** (optional) — shown in the certificate popup
4. Choose a save location
5. You'll get two files:
   - `developer.key` — your private key (KEEP SECRET, never share)
   - `developer.csr.json` — your signing request (send to CA)

**Option B: Using the CLI**

```bash
node tools/dev-keygen.js
```

Follow the prompts. Same output files.

### Step 2: Submit Your CSR

Open a **Certificate Signing Request** issue on the [CanvasUI GitHub repository](https://github.com/barkermn01/CanvasUI/issues/new/choose):

1. Select the "🔑 Certificate Signing Request" template
2. Paste the contents of `developer.csr.json`
3. Describe your module
4. Confirm the acknowledgements

> ⚠️ **NEVER submit your `developer.key` file.** If your private key appears in the request, your certificate will be permanently rejected and you'll need to generate a new keypair.

### Step 3: Receive Your Certificate

The CA administrator will review your request and sign your CSR. You'll receive a `developer.cert.json` file — this is your signed certificate.

### Step 4: Sign Your Modules

1. Open Settings → Modules
2. Click **📤 Export** on your module
3. Select **Sign with Key File**
4. Browse to your `developer.key`
5. Browse to your `developer.cert.json`
6. Save as `.cumod`

Your exported module will now show as verified when installed by anyone running CanvasUI.

### Certificate Details

Hovering over a verified badge shows certificate details:
- Developer name and organisation
- Website (clickable, opens in browser)
- Email
- Issued and expiry dates

### Certificate Expiry

Certificates have an expiry date, but **already-signed modules remain verified forever**. Expiry only prevents signing *new* modules — you'll need to request a new certificate to continue publishing.

### Certificate Revocation

If a developer's certificate is compromised or their modules are found to be malicious, the CA can revoke their certificate. Revoked modules are immediately disabled for all users on the next app update.

### External Signatures (YubiKey / FIPS 140)

For hardware security keys that don't expose the private key:

1. Generate your keypair on the hardware device
2. Export the public key and create a `developer.csr.json` manually
3. Get it CA-signed as normal
4. At export time, select **External Signature** mode
5. The app shows the zipHash — sign it externally with your hardware key
6. Paste the hex signature into the dialog

---

## CA Administration (For Repo Maintainers)

These tools are for the CA administrator (repo owner) only.

### Initialise the CA

```bash
node tools/ca-init.js
```

Generates `tools/ca.key` (private, gitignored) and `tools/ca.json` (public, bundled with app).

### Sign a Developer CSR

```bash
node tools/ca-sign.js path/to/developer.csr.json
```

Outputs `developer.cert.json` in the same directory. Send it back to the developer.

### Revoke a Certificate

Add the developer's public key (from their certificate) to `tools/crl.json`:

```json
{
    "version": 1,
    "revoked": ["abcdef1234567890..."]
}
```

Ship an app update — the module will be disabled for all users.

### Build Signed Packages for Built-in Modules

```bash
node tools/build-cumods.js
```

Generates `.cumod` packages in `www/modules/.packages/` for all built-in modules, signed with the CA key.

### Module Hot-Reload

**🔄 Refresh Modules** re-discovers all modules from disk, removes old script tags and class references, and re-registers everything fresh. The overlay page needs a manual reload (live-reload handles this on save).

---

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

---

## Editor WebSocket (Live Reload)

The editor's server has a WebSocket for:
- `{ type: "config-reload" }` — triggers page reload in overlay
- `{ type: "module-message", module: "chat", data: {...} }` — sends a message to a specific module
- `{ type: "raw", data: {...} }` — broadcasts to all modules

Use the 📡 WebSocket Admin tool in the editor to test messages.

---

## File Storage

| Path | Purpose |
|------|---------|
| `www/config.js` | User's config (gitignored) |
| `www/config.example.js` | Template for new installs |
| `www/modules/modules.json` | Master manifest |
| `www/modules/{name}/info.json` | Module metadata + properties + schema |
| `www/modules/{name}/{entrypoint}` | Module code |
| `www/modules/{name}/{scripts[]}` | Dependency scripts (loaded before entrypoint) |
| `www/modules/global.info.json` | Schema for root config fields |
| `www/media/` | User-uploaded media (gitignored) |
| `editor/src/main/` | Electron main process |
| `www/lib/` | Shared libraries (wsclient, livereload, etc.) |

### Platform-Specific Data Locations

| Platform | User Data (config, media, custom modules) |
|----------|------------------------------------------|
| Windows | Inside install directory (`resources/www/`) |
| macOS | `~/Library/Application Support/CanvasUI/www/` |
| Linux | `~/.config/CanvasUI/www/` |

Built-in modules are synced from the app bundle on every launch (macOS/Linux). Custom modules are never overwritten by updates.
