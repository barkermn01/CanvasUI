# CanvasUI Stream Manager

A fully local stream overlay system — no cloud, no third-party dependencies. Design scenes in a desktop editor, serve them to OBS as a single browser source.

Uses Streamer.bot for real-time events (chat, emotes, scene switching). Renders everything to a single HTML5 canvas for minimal OBS memory usage.

![Editor Overview](docs/screenshots/editor-overview.png)

## Features

- **Visual Scene Editor** — Drag and drop modules, resize and position visually
- **Multi-Scene Support** — Different layouts for Gaming, Just Chatting, BRB, etc.
- **OBS Scene Switching** — Overlay layout changes when OBS switches scenes (via Streamer.bot)
- **Live Preview** — Simulate chat, emotes, audio visualiser, and webcam in the editor
- **Built-in Web Server** — Serves overlays directly to OBS, no separate setup
- **Live Reload** — Save in the editor, OBS updates instantly
- **Media Library** — Upload and manage images/videos, drag onto scenes
- **Modular Architecture** — Drop a folder into `www/modules/` to add custom modules
- **Canvas Rendering** — All modules render to a single canvas for consistent output
- **Per-Instance Settings** — Multiple webcams, images, videos, audio visualisers per scene

## Quick Start

1. Download the latest installer from [Releases](../../releases)
2. Launch **CanvasUI Stream Manager**
3. In OBS, add a **Browser Source** with the URL shown in the editor toolbar
4. Design your scenes, hit Save — OBS updates live

## Documentation

Full documentation is in the [Wiki](../../wiki):

- [Getting Started](../../wiki/Getting-Started)
- [Editor Guide](../../wiki/Editor-Guide)
- [Configuration](../../wiki/Configuration)
- [Modules](../../wiki/Modules)
- [Streamerbot Setup](../../wiki/Streamerbot-Setup)
- [Developer Guide](../../wiki/Developer-Guide)
- [Changelog](../../wiki/Changelog)

## For Developers

```bash
git clone https://github.com/barkermn01/CanvasUI.git
cd CanvasUI/editor
npm install
npm run dev
```

See the [Developer Guide](../../wiki/Developer-Guide) for module creation, schema system, and architecture details.

## Building the Installer

```bash
cd editor
npm run build
```

Output: `editor/dist/CanvasUI Setup x.x.x.xxx.exe`

## License

MIT
