# Troubleshooting

## Server Issues

### "Port in use" error
Another instance of CanvasUI (or another app) is using port 31589.
- Close the other instance
- Or change the port in Settings → Server

### Can't connect from OBS
- Make sure the server shows a green dot in the toolbar
- Verify the URL matches exactly (including port)
- Check Windows Firewall isn't blocking the connection

### ⚠️ Warning icon in toolbar
You're editing a config file that isn't in the server's webroot. Saves won't update the overlay. Open the correct config file or change the server webroot in Settings → Server.

## Editor Issues

### Can't click modules behind other modules
Click the module in the **Layers** panel instead, or use the layer order buttons to move it.

### Drag and drop not working on canvas
Make sure you're dragging from the Media panel or Modules palette. The cursor should show a copy icon when over the canvas.

### Undo requires multiple Ctrl+Z
This can happen if a single action creates multiple state changes. Most operations are batched correctly, but some edge cases may require two undos.

### Settings not saving
Settings are saved to the config file. Make sure you click **Save** (⚡) after making changes in the Settings panel.

## Overlay Issues

### Chat not showing
- Verify Streamer.bot is running and WebSocket is enabled
- Check the port matches between Streamer.bot and your config
- Make sure `chat` is in your `Modules` list
- Check the browser console (F12 in a regular browser) for connection errors

### Emotes not appearing
- Streamer.bot needs to send the emote trigger action
- Make sure `emote` is in your `Modules` list

### Audio Visualiser blank
- The OBS URL must include `?allowaudio=true`
- The `device` name in config must exactly match your audio device (case-sensitive)
- Microphone permission must be granted
- Audio must be playing through that device

### Scene not switching
- The `obsScene` value in config must exactly match the OBS scene name sent by Streamer.bot
- Make sure `scene` is in your `Modules` list
- Check Streamer.bot action is firing on scene change

### Overlay not updating after save
- Check the server is running (green dot)
- The live reload WebSocket must be connected
- Try clicking the 🔄 reload button in the toolbar

## Performance

### Overlay lagging
- Reduce the number of active modules
- Lower the audio visualiser bar count (increase `barWidth` or `barSpacing`)
- Disable BTTV/FFZ if not needed
- Use `allowClipping: false` to limit chat messages

### Editor slow
- Stop all simulations when not previewing
- Close unused panels
- Large media files (4K videos) may slow the preview
