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
            const url = `http://${host}:${port}`;
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
