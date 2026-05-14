# Audio Visualiser

The audio visualiser renders frequency bars from a microphone/audio input in real-time.

## How It Works

The visualiser captures audio from a specific device via the browser's Web Audio API. It needs:
1. A microphone/audio device specified in the OBS Browser Source URL
2. Microphone permission granted in the browser source

## Setup

### 1. Configure in the Editor

Go to **Settings → Audio Visualiser** and set the `device` property to your audio device name (e.g. "Audience Mix (BEACN Mic)", "Stereo Mix", or "CABLE Output").

You can also set this in the config directly:

```javascript
AudioVisualiser: {
    device: "Audience Mix (BEACN Mic)",  // Your audio capture device
    ...
}
```

### 2. OBS Browser Source URL

Your OBS Browser Source URL must include `?allowaudio=true` to grant microphone permissions:

```
http://127.0.0.1:31589?allowaudio=true
```

The audio device is read from the config — no need to put it in the URL.

### 3. OBS Browser Source Settings

- Set the URL to `http://127.0.0.1:31589?allowaudio=true`
- Width: 1920, Height: 1080 (or your resolution)
- The first time, you may need to interact with the page to grant microphone access. Open the URL in a regular browser first and allow the microphone.

<!-- SCREENSHOT: Settings Audio Visualiser tab showing device property -->
![Audio Device Selection](../screenshots/audio-device-select.png)

## Configuration

### Direction

```javascript
direction: "right-left"  // Bars fill from right to left
```

Options: `"left-right"`, `"right-left"`, `"top-down"`, `"bottom-up"`

### Mirrored

```javascript
mirrored: true  // Bars grow from center outward (both directions)
```

### Bar Sizing

```javascript
barWidth: 5,      // Width of each bar in pixels
barSpacing: 2     // Gap between bars in pixels
```

### Colors — Level Mode

Each bar is coloured based on its intensity:

```javascript
colors: {
    mode: "levels",
    level1: "#67136f",  // Low (0-25%)
    level2: "#5c3886",  // Medium-low (25-50%)
    level3: "#885ab4",  // Medium-high (50-75%)
    level4: "#885ab4"   // High (75-100%)
}
```

### Colors — Gradient Mode

Each bar gets a gradient fill along its length:

```javascript
colors: {
    mode: "gradient",
    gradient: {
        stops: [
            { position: 0, color: "#33ccff" },
            { position: 0.5, color: "#000030" },
            { position: 1, color: "#ff99cc" }
        ]
    }
}
```

Use the **Gradient Editor** in Settings → Audio Visualiser to design gradients visually.

<!-- SCREENSHOT: Gradient editor overlay with color stops and live preview bar -->
![Gradient Editor](../screenshots/gradient-editor.png)

### Area Positioning

```javascript
area: {
    left: "0",
    right: "0",
    top: "0",
    bottom: null,
    height: "80px"
}
```

Supports pixels (`"80px"`) and percentages (`"50%"`).

## Troubleshooting

### No bars showing
- Check that `Config.AudioVisualiser.device` matches your audio device name exactly
- Make sure the OBS URL includes `?allowaudio=true`
- Make sure microphone permission is granted
- Verify audio is actually playing through that device

### "No audio device" error in overlay
- The `device` property in config is empty or not set
- Set it in Settings → Audio Visualiser or directly in config.js

### Bars not moving
- The selected audio device might not be receiving audio
- Try a different device (e.g. "Stereo Mix" or a virtual cable output)
- Check the browser console for `[AudioVisualiser]` log messages
