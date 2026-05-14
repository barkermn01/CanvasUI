# Getting Started

## Installation

1. Download the latest installer from the [Releases page](../../releases)
2. Run `CanvasUI Setup x.x.x.xxx.exe`
3. Choose your install location and complete the setup
4. Launch **CanvasUI Stream Manager** from your desktop or start menu

## First Launch

When you first open the app:

<!-- SCREENSHOT: Fresh install showing the editor with default empty scene and server running -->
![First Launch](../screenshots/first-launch.png)

1. The web server starts automatically (green dot in the toolbar)
2. A default scene is created for you
3. The app is ready to serve overlays to OBS

## Adding to OBS

1. In the app toolbar, note the server URL (e.g. `http://127.0.0.1:31589`)
2. In OBS, add a new **Browser Source**
3. Set the URL to the one shown in the app
4. Set width to `1920` and height to `1080` (or your stream resolution)
5. Check "Control audio via OBS" if using the audio visualiser

### Audio Visualiser Setup

If you want the audio visualiser:

1. Click ⚙️ next to the server controls (or go to Settings → Server)
2. Select your audio device from the dropdown
3. Copy the generated URL (it includes the `?microphone=...` parameter)
4. Use this URL in your OBS Browser Source

<!-- SCREENSHOT: Settings Server tab showing the audio device dropdown and generated URL -->
![Server Settings](../screenshots/server-settings.png)

## Setting Up Your Channel

1. Click ⚙️ **Settings** in the toolbar
2. Go to the **General** tab
3. Enter your **Channel Name** and **Twitch ID**
4. Go to the **Streamer.bot** tab and set your WebSocket port (default: 24585)
5. Go to the **Bots** tab and add any bot usernames you want hidden from chat

## Next Steps

- [[Editor Guide]] — Learn how to design scenes
- [[Streamer.bot Setup]] — Connect chat and emotes
- [[Audio Visualiser]] — Configure the visualiser
