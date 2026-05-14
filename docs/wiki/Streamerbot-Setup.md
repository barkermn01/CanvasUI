# Streamer.bot Setup

CanvasUI connects to Streamer.bot via WebSocket to receive chat messages, emote triggers, and scene change notifications.

## Prerequisites

- [Streamer.bot](https://streamer.bot/) installed and running
- WebSocket Server enabled in Streamer.bot (Settings → WebSocket Server)

## Connecting

1. In Streamer.bot, go to **Settings → WebSocket Server**
2. Note the port (default: 24585)
3. In CanvasUI, go to **Settings → Streamer.bot**
4. Set the port to match
5. The overlay connects automatically when loaded in OBS

## Chat Messages

Chat messages are sent automatically when you have the Streamer.bot chat integration active. No additional setup needed — CanvasUI subscribes to the `General > Custom` event.

Your Streamer.bot actions send messages in this format:

```json
{
    "Module": "chat",
    "Data": {
        "Type": "MessageAdded",
        "ID": "message-id",
        "DisplayName": "Username",
        "DisplayNameColor": "#ff0000",
        "Message": "Hello world!",
        "Emotes": [],
        "Badges": [],
        "Platform": "twitch",
        "UserId": "12345"
    }
}
```

## Emote Triggers

To trigger a bouncing emote on screen:

```json
{
    "Module": "emote",
    "Data": {
        "imageUrl": "https://cdn.betterttv.net/emote/abc123/3x"
    }
}
```

## Scene Switching

### Setup

1. In Streamer.bot, create a new **Action**
2. Add a trigger: **OBS → Scene Changed**
3. Add a sub-action: **Core → Execute C# Code**
4. Paste this code:

```csharp
using System;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

public class CPHInline
{
    public bool Execute()
    {
        string sceneName = args.ContainsKey("scene") ? args["scene"].ToString() : string.Empty;
        if (string.IsNullOrEmpty(sceneName)) return false;

        JObject jObj = new JObject
        {
            ["Module"] = "scene",
            ["Data"] = new JObject
            {
                ["Type"] = "SceneChange",
                ["Scene"] = sceneName
            }
        };

        CPH.WebsocketBroadcastJson(JsonConvert.SerializeObject(jObj));
        return true;
    }
}
```

### Config Mapping

In your config, each scene has an `obsScene` property:

```javascript
Scenes: {
    "Gaming": {
        obsScene: "My Gaming Scene",  // Must match your OBS scene name exactly
        ...
    }
}
```

When Streamer.bot sends the OBS scene name, CanvasUI looks up which config scene has a matching `obsScene` value and switches to it.

## Message Removal

When a message is deleted/timed out:

```json
{
    "Module": "chat",
    "Data": {
        "Type": "MessageRemoved",
        "ID": "message-id-to-remove"
    }
}
```

## Clear Chat

```json
{
    "Module": "chat",
    "Data": {
        "Type": "ClearChat"
    }
}
```

## Timeout/Ban User (Remove All Messages)

```json
{
    "Module": "chat",
    "Data": {
        "Type": "MessageRemoveUser",
        "UserId": "user-id"
    }
}
```
