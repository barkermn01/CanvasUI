// Configuration validation and defaults
const DEFAULT_CONFIG = {
    chat: {
        ChatBoxes: {
            NewMessages: "below"
        },
        RemovedMessage: {
            Text: "Message removed",
            color: "#FF0000",
            italics: true,
            bold: false
        },
        AutoHide: {
            Enabled: false,
            Delay: 60000
        }
    },
    Bots: []
};

export function validateConfig(config) {
    if (!config) {
        console.warn('No configuration provided, using defaults');
        return DEFAULT_CONFIG;
    }

    // Deep merge with defaults
    return deepMerge(DEFAULT_CONFIG, config);
}

function deepMerge(target, source) {
    const output = { ...target };
    
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    
    return output;
}

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}