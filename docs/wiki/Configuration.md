# Configuration

All settings are stored in `www/config.js`. You can edit them visually in the editor (Settings → each tab) or manually in the file.

## Config Structure

```javascript
const Config = {
    Name: "My Stream",              // Project name (shown in editor title)
    StreamerBot: { ... },           // WebSocket connection
    ChannelName: "YourChannel",     // Twitch channel name
    TwitchID: "123456",             // Twitch user ID
    Modules: [...],                 // Which modules to load
    Bots: [...],                    // Bot usernames to hide from chat
    DefaultScene: "Gaming",         // Scene to show on startup
    Scenes: { ... },                // Scene definitions
    AudioVisualiser: { ... },       // Visualiser settings
    emote: { ... },                 // Emote animation settings
    chat: { ... }                   // Chat display settings
}
```

## StreamerBot

```javascript
StreamerBot: {
    host: "127.0.0.1",     // Streamer.bot WebSocket host
    port: 24585,           // Streamer.bot WebSocket port
    endpoint: "/"          // WebSocket endpoint
}
```

## Scenes

Each scene maps to an OBS scene and defines which modules are visible and where:

```javascript
Scenes: {
    "Gaming": {
        obsScene: "Gaming",                    // OBS scene name that triggers this
        transition: { type: "fade", duration: 0.5 },
        modules: {
            emote: { area: { x: 0, y: 0, width: 1920, height: 1080 } },
            chat: { area: { x: 0, y: 648, width: 576, height: 432 } },
            audiovisualiser: { area: { x: 0, y: 0, width: 1920, height: 80 } }
        }
    }
}
```

## Audio Visualiser

```javascript
AudioVisualiser: {
    direction: "right-left",       // "left-right", "right-left", "top-down", "bottom-up"
    mirrored: true,                // Bars grow from center outward
    barWidth: 5,                   // Pixel width of each bar
    barHeight: 5,                  // Used for vertical modes
    barSpacing: 2,                 // Gap between bars
    backgroundColor: "transparent",
    area: {                        // CSS positioning
        left: "0", right: "0", top: "0", bottom: null, height: "80px"
    },
    colors: {
        mode: "levels",            // "levels" or "gradient"
        // Level mode:
        level1: "#67136f",         // Low intensity
        level2: "#5c3886",
        level3: "#885ab4",
        level4: "#885ab4",         // High intensity
        // Gradient mode:
        gradient: {
            stops: [
                { position: 0, color: "#33ccff" },
                { position: 1, color: "#ff99cc" }
            ]
        }
    }
}
```

## Chat

```javascript
chat: {
    BeforeCanvas: true,            // Chat behind or in front of canvas
    hideBots: true,                // Hide messages from bots
    ExtendedEmotesServices: {
        BTTV: true,                // BetterTTV emotes
        FFZ: true                  // FrankerFaceZ emotes
    },
    MessageArea: {                 // Chat container positioning
        width: "100%", height: "100%",
        top: "0%", right: "0%", bottom: "0%", left: "0%"
    },
    AutoHide: {
        enabled: false,            // Auto-hide messages after time
        time: 60,                  // Seconds before hiding
        animation: "slide",        // "slide" or "fade"
        direction: "left"          // Slide direction
    },
    ChatBoxes: {
        ShowBadges: true,
        UserColon: true,           // Show ":" after username
        allowClipping: true,       // Allow messages to overflow
        NewMessages: "below",      // "below" or "above"
        position: "bottom",        // "top" or "bottom"
        messageStyle: {            // CSS for message text
            "overflow-wrap": "break-word"
        },
        style: {                   // CSS for message container
            "border-radius": "3px",
            "padding": "8px",
            "color": "white",
            "font-family": "Arial, sans-serif"
        }
    },
    RemovedMessage: {
        hideMessage: false,        // true = remove entirely, false = show text
        Text: "Message was removed",
        color: "#FFFFFF",
        italics: true,
        bold: true
    }
}
```

## Emotes

```javascript
emote: {
    AnimationTime: { Min: 10, Max: 20 },  // Seconds on screen
    Speed: { Min: 100, Max: 300 },         // Pixels per second
    RandomDirectionsFromStart: true         // Random initial direction
}
```

## Webcam

```javascript
webcam: {
    device: "XSplit VCam",     // Camera device name (blank = default)
    mirror: false,             // Flip horizontally
    mask: "none",              // "none", "circle", "rounded"
    borderRadius: "0"          // CSS border-radius for "rounded" mask
}
```

## Type System

Module settings schemas are defined in each module's `info.json` file under the `schema` field. The editor reads these schemas to auto-generate the settings UI. The config file itself contains only data values — no metadata.

See [[Modules]] for the info.json format and schema structure.
