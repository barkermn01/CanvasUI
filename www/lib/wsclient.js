/**
 * WebSocket Client for Streamer.bot
 *
 * Supports two message routing systems:
 * 1. Custom actions (General.Custom) — routed by resp.data.Module to module.message()
 * 2. Native events (Twitch.*, Kick.*, etc.) — routed to module.events handlers
 *
 * Modules can register event handlers via:
 *   window.Modules.push({
 *       name: "mymodule",
 *       message: (data) => { ... },           // Custom action messages
 *       events: {                              // Native Streamer.bot events
 *           "Twitch.ViewerCountUpdate": (data) => { ... },
 *           "Kick.Follow": (data) => { ... }
 *       }
 *   });
 *
 * Event subscriptions are collected from all modules after initialization
 * and merged into the WebSocket subscribe config.
 */

// Collect event subscriptions from modules after they load
function collectEventSubscriptions() {
    const subs = { "General": ["Custom"] };

    if (!window.Modules) return subs;

    for (const mod of window.Modules) {
        if (!mod.events) continue;
        for (const eventKey of Object.keys(mod.events)) {
            const [source, event] = eventKey.split('.');
            if (!source || !event) continue;
            if (!subs[source]) subs[source] = [];
            if (!subs[source].includes(event)) {
                subs[source].push(event);
            }
        }
    }

    return subs;
}

// Route a native event to all modules that registered for it
function routeEvent(eventSource, eventType, data) {
    const eventKey = `${eventSource}.${eventType}`;

    if (!window.Modules) return;

    for (const mod of window.Modules) {
        if (!mod.events) continue;

        // Check exact match
        if (mod.events[eventKey] && typeof mod.events[eventKey] === 'function') {
            try {
                mod.events[eventKey](data);
            } catch (err) {
                console.error(`[${mod.name}] Event handler error (${eventKey}):`, err);
            }
        }

        // Check wildcard (e.g. "Twitch.*" or "*.*")
        const wildcardSource = `${eventSource}.*`;
        if (mod.events[wildcardSource] && typeof mod.events[wildcardSource] === 'function') {
            try {
                mod.events[wildcardSource]({ type: eventType, ...data });
            } catch (err) {
                console.error(`[${mod.name}] Wildcard event handler error (${wildcardSource}):`, err);
            }
        }
    }
}

// Route a custom action message to the target module
function routeCustomMessage(resp) {
    try {
        const moduleName = resp.data?.Module;
        if (!moduleName) return;

        const module = window.Modules.find(item => item.name.toLowerCase() === moduleName.toLowerCase());
        if (module && typeof module.message === 'function') {
            try {
                module.message(resp.data.Data);
            } catch (err) {
                if (typeof ShowError !== 'undefined') new ShowError(err, true);
                console.error('Module message processing error:', err);
            }
        }
    } catch (e) {
        // Silently ignore malformed messages
    }
}

// Initialize after a short delay to let modules register
setTimeout(() => {
    const subscriptions = collectEventSubscriptions();
    console.log('[WS] Subscribing to:', JSON.stringify(subscriptions));

    const client = new StreamerbotClient({
        host: Config.StreamerBot?.host || '127.0.0.1',
        port: Config.StreamerBot?.port || 24585,
        endpoint: Config.StreamerBot?.endpoint || '/',
        subscribe: subscriptions,
        reconnect: true,
        reconnectAttempts: 5,
        reconnectInterval: 5000,
        onError: (error) => {
            console.error('[WS] Error:', error);
        },
        onClose: () => {
            console.log('[WS] Connection closed');
        },
        onData: (resp) => {
            if (!resp) return;

            // Determine if this is a native event or a custom action
            if (resp.event && resp.event.source && resp.event.type) {
                // Native Streamer.bot event (e.g. Twitch.ViewerCountUpdate)
                routeEvent(resp.event.source, resp.event.type, resp.data);
            } else if (resp.data && resp.data.Module) {
                // Custom action message (General.Custom)
                routeCustomMessage(resp);
            }
        }
    });

    // Expose client for debugging
    window._sbClient = client;
}, 100);
