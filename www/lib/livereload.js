// Live reload client - connects to the editor's WebSocket server
// When the editor saves config, this reloads the page to pick up changes
(function() {
    const port = window.location.port || 31589;
    const host = window.location.hostname || '127.0.0.1';
    let ws = null;
    let reconnectTimer = null;

    function connect() {
        try {
            ws = new WebSocket(`ws://${host}:${port}`);

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'config-reload') {
                        console.log('[LiveReload] Config changed, reloading...');
                        window.location.reload();
                    }
                } catch (e) {}
            };

            ws.onclose = () => {
                ws = null;
                // Reconnect after 3 seconds
                reconnectTimer = setTimeout(connect, 3000);
            };

            ws.onerror = () => {
                ws?.close();
            };
        } catch (e) {
            reconnectTimer = setTimeout(connect, 3000);
        }
    }

    connect();
})();
