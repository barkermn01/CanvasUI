class ServerPanel {
    #statusEl;
    #toggleBtn;
    #warnEl;
    #running = false;
    #pollInterval = null;

    constructor() {
        this.#createUI();
        this.#autoStart();
        this.#startPolling();

        // Watch for config path changes
        EditorState.onChange((what) => {
            if (what === 'load') {
                this.#checkMismatch();
            }
        });
    }

    #createUI() {
        const container = document.getElementById('server-controls');

        this.#warnEl = document.createElement('span');
        this.#warnEl.className = 'server-mismatch-warn';
        this.#warnEl.textContent = '⚠️';
        this.#warnEl.style.display = 'none';

        const warnTooltip = document.createElement('span');
        warnTooltip.className = 'server-mismatch-tooltip';
        warnTooltip.textContent = 'Editing a config not served by this server — saves won\'t update the overlay';
        this.#warnEl.appendChild(warnTooltip);

        this.#statusEl = document.createElement('span');
        this.#statusEl.className = 'server-status offline';
        this.#statusEl.innerHTML = `<span class="server-dot offline"></span> Offline`;
        this.#statusEl.addEventListener('click', () => {
            if (!this.#running) return;
            const host = EditorPrefs.get('serverHost', '127.0.0.1');
            const port = EditorPrefs.get('serverPort', 31589);
            const url = `http://${host}:${port}?allowaudio=true`;
            navigator.clipboard.writeText(url).then(() => {
                this.#statusEl.innerHTML = `<span class="server-dot online"></span> Copied!`;
                setTimeout(() => { this.#updateUI(); }, 1200);
            });
        });

        this.#toggleBtn = document.createElement('button');
        this.#toggleBtn.className = 'server-toggle-btn';
        this.#toggleBtn.textContent = '▶ Start';
        this.#toggleBtn.addEventListener('click', () => this.#toggle());

        const reloadBtn = document.createElement('button');
        reloadBtn.className = 'server-toggle-btn';
        reloadBtn.textContent = '🔄';
        reloadBtn.title = 'Reload all connected browsers';
        reloadBtn.addEventListener('click', async () => {
            await window.api.serverReload();
            reloadBtn.textContent = '✓';
            setTimeout(() => { reloadBtn.textContent = '🔄'; }, 1000);
        });

        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'server-toggle-btn';
        settingsBtn.textContent = '⚙';
        settingsBtn.title = 'Server settings';
        settingsBtn.addEventListener('click', () => {
            const overlay = document.getElementById('settings-overlay');
            if (overlay) {
                overlay.style.display = 'flex';
                const tab = overlay.querySelector('.settings-tab[data-tab="server"]');
                if (tab) tab.click();
            }
        });

        container.appendChild(this.#warnEl);
        container.appendChild(this.#statusEl);
        container.appendChild(this.#toggleBtn);
        container.appendChild(reloadBtn);
        container.appendChild(settingsBtn);

        // Raw WebSocket message sender (admin tool)
        const rawBtn = document.createElement('button');
        rawBtn.className = 'server-toggle-btn';
        rawBtn.textContent = '📡';
        rawBtn.title = 'Send raw WebSocket message to overlay';
        rawBtn.addEventListener('click', () => this.#showRawSender());
        container.appendChild(rawBtn);
    }

    #showRawSender() {
        // Toggle the raw sender panel
        let panel = document.getElementById('raw-ws-panel');
        if (panel) {
            panel.remove();
            return;
        }

        panel = document.createElement('div');
        panel.id = 'raw-ws-panel';
        panel.style.cssText = 'position: fixed; top: 50px; right: 10px; width: 450px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 8px; padding: 12px; z-index: 9999; box-shadow: 0 4px 20px rgba(0,0,0,0.5);';

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="color: var(--text-primary);">📡 WebSocket Admin</strong>
                <button id="raw-ws-close" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:16px;">✕</button>
            </div>
            <div style="margin-bottom: 8px;">
                <label style="font-size: 11px; color: var(--text-secondary);">Module:</label>
                <select id="raw-ws-module" style="width: 100%; padding: 4px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border); border-radius: 4px;">
                    <option value="">All modules (raw broadcast)</option>
                    <option value="chat">Chat</option>
                    <option value="emote">Emote</option>
                    <option value="scene">Scene</option>
                </select>
            </div>
            <div style="margin-bottom: 8px;">
                <label style="font-size: 11px; color: var(--text-secondary);">JSON Data:</label>
                <textarea id="raw-ws-data" style="width: 100%; height: 120px; padding: 6px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border); border-radius: 4px; font-family: monospace; font-size: 11px; resize: vertical;" placeholder='{"Type": "MessageAdded", "DisplayName": "TestUser", "Message": "Hello!", "DisplayNameColor": "#ff0000", "Emotes": [], "Badges": [], "Platform": "twitch", "UserId": "test1", "ID": "msg1"}'></textarea>
            </div>
            <div style="display: flex; gap: 6px;">
                <button id="raw-ws-send" style="flex:1; padding: 6px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer;">Send</button>
                <button id="raw-ws-test-chat" style="flex:1; padding: 6px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border); border-radius: 4px; cursor: pointer;">Test Chat Msg</button>
            </div>
            <div id="raw-ws-result" style="margin-top: 8px; font-size: 11px; color: var(--text-secondary);"></div>
        `;

        document.body.appendChild(panel);

        document.getElementById('raw-ws-close').addEventListener('click', () => panel.remove());

        document.getElementById('raw-ws-send').addEventListener('click', async () => {
            const module = document.getElementById('raw-ws-module').value;
            const dataStr = document.getElementById('raw-ws-data').value.trim();
            const resultEl = document.getElementById('raw-ws-result');

            try {
                const data = JSON.parse(dataStr);
                let payload;
                if (module) {
                    payload = { type: 'module-message', module, data };
                } else {
                    payload = { type: 'raw', data };
                }
                const result = await window.api.serverBroadcastRaw(payload);
                resultEl.textContent = `✓ Sent to ${result.clients} client(s)`;
                resultEl.style.color = '#2ecc71';
            } catch (e) {
                resultEl.textContent = `✗ ${e.message}`;
                resultEl.style.color = '#e74c3c';
            }
        });

        document.getElementById('raw-ws-test-chat').addEventListener('click', async () => {
            const resultEl = document.getElementById('raw-ws-result');
            const testMsg = {
                Type: "MessageAdded",
                ID: "test_" + Date.now(),
                DisplayName: "TestUser",
                DisplayNameColor: "#e74c3c",
                Message: "Test message from admin panel " + new Date().toLocaleTimeString(),
                Emotes: [],
                Badges: [],
                Platform: "twitch",
                UserId: "admin_test",
            };
            document.getElementById('raw-ws-data').value = JSON.stringify(testMsg, null, 2);
            document.getElementById('raw-ws-module').value = 'chat';

            const payload = { type: 'module-message', module: 'chat', data: testMsg };
            const result = await window.api.serverBroadcastRaw(payload);
            resultEl.textContent = `✓ Chat test sent to ${result.clients} client(s)`;
            resultEl.style.color = '#2ecc71';
        });
    }

    #checkMismatch() {
        if (!this.#running || !EditorState.configPath) {
            this.#warnEl.style.display = 'none';
            return;
        }

        const webroot = EditorPrefs.get('serverWebroot', './www');
        const configPath = EditorState.configPath.replace(/\\/g, '/');

        // Check if the config file is inside the server's webroot
        const webrootNorm = webroot.replace(/^\.\//, '').replace(/\\/g, '/');
        const isMatch = configPath.includes('/' + webrootNorm + '/') || configPath.includes('\\' + webrootNorm + '\\');

        this.#warnEl.style.display = isMatch ? 'none' : 'inline';
    }

    async #autoStart() {
        const autoStart = EditorPrefs.get('serverAutoStart', true);
        if (autoStart) {
            await this.#start();
        }
    }

    async #start() {
        const port = EditorPrefs.get('serverPort', 31589);
        const host = EditorPrefs.get('serverHost', '127.0.0.1');
        const webroot = EditorPrefs.get('serverWebroot', './www');

        const result = await window.api.serverStart({ port, host, webroot });
        if (result.success) {
            this.#running = true;
            this.#updateUI();
            this.#checkMismatch();
        } else {
            console.warn('Server start failed:', result.error);
            this.#running = false;
            this.#statusEl.innerHTML = `<span class="server-dot offline"></span> Port in use`;
            this.#statusEl.className = 'server-status error';
        }
    }

    async #stop() {
        await window.api.serverStop();
        this.#running = false;
        this.#updateUI();
    }

    async #toggle() {
        if (this.#running) {
            await this.#stop();
        } else {
            await this.#start();
        }
    }

    #updateUI() {
        if (this.#running) {
            const host = EditorPrefs.get('serverHost', '127.0.0.1');
            const port = EditorPrefs.get('serverPort', 31589);
            this.#statusEl.innerHTML = `<span class="server-dot online"></span> http://${host}:${port}`;
            this.#statusEl.className = 'server-status online';
            this.#statusEl.title = 'Click to copy URL';
            this.#toggleBtn.textContent = '⏹ Stop';
        } else {
            this.#statusEl.innerHTML = `<span class="server-dot offline"></span> Offline`;
            this.#statusEl.className = 'server-status offline';
            this.#statusEl.title = '';
            this.#toggleBtn.textContent = '▶ Start';
        }
    }

    #startPolling() {
        this.#pollInterval = setInterval(async () => {
            const status = await window.api.serverStatus();
            this.#running = status.running;
            this.#updateUI();
            if (status.running && status.clients > 0) {
                const host = EditorPrefs.get('serverHost', '127.0.0.1');
                const port = EditorPrefs.get('serverPort', 31589);
                this.#statusEl.innerHTML = `<span class="server-dot online"></span> http://${host}:${port} (${status.clients})`;
            }
        }, 5000);
    }
}
