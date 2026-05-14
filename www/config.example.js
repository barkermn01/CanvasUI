const Config = {
    // Streamer.bot WebSocket connection settings
    StreamerBot: {
        host: "127.0.0.1",         // Streamer.bot WebSocket server host
        port: 24585,               // Streamer.bot WebSocket server port
        endpoint: "/"              // WebSocket endpoint path
    },

    // Your Twitch channel info
    ChannelName: "YourChannelName",
    TwitchID: "YourTwitchID",

    // Modules are rendered in order of top to bottom
    Modules: [
        "emote",
        "chat",
        "audiovisualiser",
        "scene"
    ],

    // Scene system (optional - remove "scene" from Modules if not using)
    DefaultScene: "Gaming",
    Scenes: {
        "Gaming": {
            obsScene: "Gaming",        // OBS scene name that triggers this layout
            transition: { type: "fade", duration: 0.5 },
            modules: {
                emote: { area: { x: 0, y: 0, width: "100%", height: "100%" } },
                chat: { area: { left: "0%", top: "60%", width: "30%", height: "40%" } },
                audiovisualiser: { area: { x: 0, y: 0, width: "100%", height: "80px" } }
            }
        },
        "JustChatting": {
            obsScene: "Just Chatting", // OBS scene name that triggers this layout
            transition: { type: "fade", duration: 0.5 },
            modules: {
                chat: { area: { left: "0%", top: "0%", width: "100%", height: "100%" } }
            }
        },
        "BRB": {
            obsScene: "Be Right Back", // OBS scene name that triggers this layout
            transition: { type: "fade", duration: 1 },
            modules: {
                audiovisualiser: { area: { x: 0, y: "40%", width: "100%", height: "20%" } }
            }
        }
    },

    // Bot usernames to filter from chat display
    Bots: [
        "Nightbot",
        "StreamElements",
        "Moobot",
        "StreamLabs",
        "Botisimo",
        "PhantomBot",
        "WizeBot",
        "CommanderRoot",
        "AutomodBot",
        "RaidShield",
        "OWLBot",
        "StreamerBot",
        "Sery_Bot",
        "Fossabot",
        "deepbot",
        "CommunityBot",
        "ScriptedBot",
        "Streamcord",
        "MEE6"
    ],

    // Audio Visualiser settings
    AudioVisualiser: {
        direction: "right-left",   // "right-left", "left-right", "top-down", "bottom-up"
        mirrored: true,            // Mirror bars from center
        barWidth: 5,
        barHeight: 5,
        barSpacing: 2,
        backgroundColor: "transparent",
        area: {
            left: "0",             // CSS style positioning
            right: "0",
            top: "0",
            bottom: null,
            height: "80px"         // Only used if both top/bottom aren't set
        },
        colors: {
            mode: "levels",        // "levels" = solid color per intensity, "gradient" = gradient fill per bar
            // Gradient config (used when mode is "gradient"):
            // gradient: {
            //     stops: [
            //         { position: 0, color: "#33ccff" },
            //         { position: 0.5, color: "#000030" },
            //         { position: 1, color: "#ff99cc" }
            //     ]
            // },
            // Level colors (used when mode is "levels"):
            level1: "#67136f",     // Lowest intensity
            level2: "#5c3886",
            level3: "#885ab4",
            level4: "#885ab4"      // Highest intensity
        }
    },

    // Emote animation settings
    emote: {
        AnimationTime: {           // Seconds emotes stay on screen (fixed number or Min/Max range)
            Min: 10,
            Max: 20
        },
        Speed: {                   // Pixels per second movement speed (fixed number or Min/Max range)
            Min: 100,
            Max: 300
        },
        RandomDirectionsFromStart: true  // Randomize initial movement direction
    },

    // Chat display settings
    chat: {
        BeforeCanvas: true,        // true = chat behind canvas, false = chat in front
        hideBots: true,            // Hide messages from bots listed above
        ExtendedEmotesServices: {
            BTTV: true,            // Enable BetterTTV emotes
            FFZ: true              // Enable FrankerFaceZ emotes
        },
        MessageArea: {             // Chat container positioning
            width: "100%",
            height: "100%",
            top: "0%",
            right: "0%",
            bottom: "0%",
            left: "0%"
        },
        AutoHide: {
            enabled: false,        // Whether messages auto-hide after a time
            time: 60,              // Seconds before messages start to hide
            animation: "slide",    // "fade" or "slide"
            direction: "left"      // Slide direction: "left" or "right"
        },
        platforms: {
            youtube: {
                "backgroundColor": "rgba(255, 0, 0, 0.1)",
                "position": "right"
            },
            twitch: {
                "backgroundColor": "rgba(100, 65, 164, 0.1)",
                "position": "left"
            }
        },
        ChatBoxes: {
            ShowBadges: true,
            BadgeSettings: {
                width: 24,
                height: 24
            },
            HideSpecificBadges: [],
            ShowEmotes: true,
            UserColon: true,       // Show colon after username (false = space only)
            NewMessages: "below",  // "below" or "above"
            position: "bottom",    // "top" or "bottom" - where chat starts from
            animationType: "fade", // "left", "right", "fade"
            messageStyle: {        // CSS applied to message text content
                "overflow-wrap": "break-word"
            },
            style: {               // CSS applied to each chat message container
                "border-radius": "3px",
                "margin-bottom": "3px",
                "padding": "8px",
                "color": "white",
                "font-family": "Arial, sans-serif"
            }
        },
        RemovedMessage: {
            hideMessage: false,    // true = remove entirely, false = show replacement text
            Text: "Message was removed",
            color: "#FFFFFF",
            italics: true,
            bold: true
        }
    }
};
