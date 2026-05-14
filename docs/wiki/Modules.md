# Modules

CanvasUI is built around a modular system. Each module handles a specific overlay feature.

## Available Modules

| Module | Description |
|--------|-------------|
| `chat` | Displays Twitch/YouTube chat messages |
| `emote` | Bouncing emote animations |
| `audiovisualiser` | Real-time audio frequency bars |
| `scene` | Scene switching and transitions |
| `image` | Static image overlay |
| `video` | Video playback overlay |

## Module Loading

Modules are loaded in the order specified in `Config.Modules`:

```javascript
Modules: ["emote", "chat", "audiovisualiser", "scene"]
```

The scene module should always be last as it wraps other modules' draw/update calls.

## Chat Module

Displays chat messages with full styling support.

**Features:**
- Twitch and YouTube platform support
- BTTV and FFZ emote rendering
- Badge display
- Message removal/timeout handling
- Auto-hide with fade/slide animations
- Customisable CSS styling per message
- Separated mode (split Twitch/YouTube into columns)

## Emote Module

Spawns animated emotes that bounce around the screen.

**Features:**
- GIF animation support (frame-by-frame rendering)
- Configurable speed and lifetime
- Random direction on spawn
- Fade-out when expiring

**Triggered by** Streamer.bot sending an emote URL.

## Audio Visualiser Module

Renders real-time audio frequency data as bars.

**Features:**
- Four direction modes
- Mirrored mode (bars from center)
- Level-based or gradient colouring
- Configurable bar width/spacing
- Device selection via URL parameter

See [[Audio Visualiser]] for full setup guide.

## Scene Module

Manages scene switching and transitions.

**Features:**
- Clips other modules to their scene-defined areas
- Fade transitions between scenes
- OBS scene name mapping
- Repositions chat container on scene change

**Triggered by** Streamer.bot sending a SceneChange message.

## Image Module

Displays a static image in a defined area.

**Properties:**
- `src` — Path to image file (e.g. `/media/background.png`)
- `opacity` — 0 to 1
- `objectFit` — `contain`, `cover`, `fill`, `none`

## Video Module

Plays a video file in a defined area.

**Properties:**
- `src` — Path to video file (e.g. `/media/intro.mp4`)
- `loop` — Whether to loop playback
- `muted` — Whether audio is muted
- `opacity` — 0 to 1
- `objectFit` — `contain`, `cover`, `fill`, `none`

## Creating Custom Modules

Modules register themselves on `window.Modules`:

```javascript
window.Modules.push({
    name: "mymodule",
    draw: (ctx) => { /* canvas 2D drawing */ },
    update: (dt) => { /* logic update, dt in seconds */ },
    message: (data) => { /* handle WebSocket messages */ }
});
```

All three methods are optional. The module loader calls them each frame (draw/update) or on WebSocket message (message).
