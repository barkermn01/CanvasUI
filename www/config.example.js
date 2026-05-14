const Config = {
    // Streamer.bot WebSocket connection settings
    StreamerBot: {
        host: "127.0.0.1",
        port: 24585,
        endpoint: "/"
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
            obsScene: "Gaming",
            transition: { type: "fade", duration: 0.5 },
            modules: {
                emote: { _type: "emote", area: { x: 0, y: 0, width: 1920, height: 1080 } },
                chat: { _type: "chat", area: { x: 0, y: 648, width: 576, height: 432 } },
                audiovisualiser: { _type: "audiovisualiser", area: { x: 0, y: 0, width: 1920, height: 80 } }
            }
        },
        "JustChatting": {
            obsScene: "Just Chatting",
            transition: { type: "fade", duration: 0.5 },
            modules: {
                chat: { _type: "chat", area: { x: 0, y: 0, width: 1920, height: 1080 } }
            }
        },
        "BRB": {
            obsScene: "Be Right Back",
            transition: { type: "fade", duration: 1 },
            modules: {
                audiovisualiser: { _type: "audiovisualiser", area: { x: 0, y: 432, width: 1920, height: 216 } }
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
        "StreamerBot",
        "Fossabot",
        "MEE6"
    ],

    // Audio Visualiser settings
    AudioVisualiser: {
        direction: "right-left",
        mirrored: true,
        barWidth: 5,
        barHeight: 5,
        barSpacing: 2,
        backgroundColor: "transparent",
        area: {
            left: "0",
            right: "0",
            top: "0",
            bottom: null,
            height: "80px"
        },
        colors: {
            mode: "levels",
            level1: "#67136f",
            level2: "#5c3886",
            level3: "#885ab4",
            level4: "#885ab4"
        }
    },

    // Emote animation settings
    emote: {
        AnimationTime: { Min: 10, Max: 20 },
        Speed: { Min: 100, Max: 300 },
        RandomDirectionsFromStart: true
    },

    // Chat display settings
    chat: {
        BeforeCanvas: true,
        hideBots: true,
        ExtendedEmotesServices: {
            BTTV: true,
            FFZ: true
        },
        MessageArea: {
            width: "100%",
            height: "100%",
            top: "0%",
            right: "0%",
            bottom: "0%",
            left: "0%"
        },
        AutoHide: {
            enabled: false,
            time: 60,
            animation: "slide",
            direction: "left"
        },
        ChatBoxes: {
            ShowBadges: true,
            BadgeSettings: { width: 24, height: 24 },
            HideSpecificBadges: [],
            ShowEmotes: true,
            UserColon: true,
            NewMessages: "below",
            position: "bottom",
            animationType: "fade",
            messageStyle: {
                "overflow-wrap": "break-word"
            },
            style: {
                "border-radius": "3px",
                "margin-bottom": "3px",
                "padding": "8px",
                "color": "white",
                "font-family": "Arial, sans-serif"
            }
        },
        RemovedMessage: {
            hideMessage: false,
            Text: "Message was removed",
            color: "#FFFFFF",
            italics: true,
            bold: true
        }
    },

    // Webcam settings
    webcam: {
        device: "",
        mirror: false,
        mask: "none",
        borderRadius: "0"
    }
};
