# Building from Source

## Prerequisites

- Node.js 18+ (recommended: 20 LTS)
- npm
- Windows (for building the installer)

## Setup

```bash
git clone https://github.com/YourUsername/CanvasUI.git
cd CanvasUI

# Install root dependencies (for the standalone server, if needed)
npm install

# Install editor dependencies
cd editor
npm install
```

## Running in Dev Mode

```bash
cd editor
npm start
```

This:
- Increments the build number
- Opens the app with the Windows frame visible
- Opens DevTools automatically
- Loads config from `../www/config.js`

## Building the Installer

```bash
cd editor
npm run build
```

This:
- Increments the build number
- Converts `icon.png` to `.ico`
- Strips personal data from config (channel name, Twitch ID, bots)
- Copies `www/` files (excluding `media/` contents)
- Packages with electron-builder
- Creates `dist/CanvasUI Setup x.x.x.xxx.exe`
- Cleans up build artifacts

## Build Output

```
editor/dist/
├── CanvasUI Setup 1.2.0.126.exe    # NSIS installer
├── win-unpacked/                     # Unpacked app (for testing without installing)
└── builder-effective-config.yaml     # Build config used
```

## Version Numbering

Format: `MAJOR.MINOR.PATCH.BUILD`

- Major/Minor/Patch: Set manually in `build.js`
- Build: Auto-incremented in `buildnumber.json` on every `npm start` and `npm run build`

## Admin Mode

The editor has an admin mode for editing the `_type` metadata that controls how the settings UI is generated.

1. Open Settings (⚙️)
2. Click **🔒 Admin** in the top-right
3. Each settings tab now shows JSON editors for the `_type` and `_item_type` schemas

### Type Definitions

```javascript
_type: {
    propertyName: "string",           // Text input
    enabled: "bool",                  // Checkbox
    count: "number",                  // Number input
    color: "color",                   // Color picker
    mode: { type: "select", options: ["a", "b"] }  // Dropdown
}
```

### Item Type Definitions

```javascript
_item_type: {
    subObject: "object",    // Renders sub-properties recursively
    styles: "css"           // CSS key-value pair editor
}
```

## Project Architecture

```
editor/
├── src/
│   ├── main/
│   │   ├── main.js        # Electron main process, IPC handlers
│   │   ├── preload.js     # Context bridge (API exposed to renderer)
│   │   └── server.js      # Embedded HTTP + WebSocket server
│   └── renderer/
│       ├── index.html      # App shell
│       ├── styles/
│       │   └── editor.css  # All styles
│       └── components/
│           ├── app.js          # Bootstrap
│           ├── state.js        # Central state store
│           ├── prefs.js        # User preferences (localStorage)
│           ├── history.js      # Undo/redo
│           ├── canvas.js       # Canvas workspace + module rendering
│           ├── simulator.js    # Module preview animations
│           ├── sidebar.js      # Panel management
│           ├── layers.js       # Layer panel
│           ├── properties.js   # Properties panel
│           ├── palette.js      # Module palette (drag source)
│           ├── mediapanel.js   # Media library
│           ├── scenes.js       # Scene tabs
│           ├── toolbar.js      # Canvas size controls
│           ├── configio.js     # Open/Save/keyboard shortcuts
│           ├── settings.js     # Settings overlay
│           ├── serverpanel.js  # Server controls
│           ├── colorpicker.js  # Custom color picker
│           ├── typerenderer.js # Auto-generated settings UI
│           └── ...
├── build.js                # Build script
├── buildnumber.json        # Auto-incrementing build counter
├── electron-builder.json   # Packaging config
└── package.json
```
