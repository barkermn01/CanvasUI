class SettingsPanel {
    #overlay;
    #panel;
    #activeTab = 'general';
    #adminMode = false;
    #schemas = {}; // Cached schemas from module registry

    constructor() {
        this.#adminMode = EditorPrefs.getAdminMode();
        this.#createOverlay();
        this.#loadSchemas();

        document.getElementById('btn-settings').addEventListener('click', () => {
            this.open();
        });
    }

    #loadSchemas() {
        // Load schemas from module registry (populated by palette.js discovery)
        if (window.ModuleRegistry && window.ModuleRegistry.modules) {
            for (const mod of window.ModuleRegistry.modules) {
                if (mod.schema) {
                    this.#schemas[mod.name] = mod.schema;
                }
            }
        }
    }

    #getModuleSchema(name) {
        // Try cached first, then re-check registry (it loads async)
        if (this.#schemas[name]) return this.#schemas[name];
        if (window.ModuleRegistry && window.ModuleRegistry.modules) {
            const mod = window.ModuleRegistry.modules.find(m => m.name === name);
            if (mod?.schema) {
                this.#schemas[name] = mod.schema;
                return mod.schema;
            }
        }
        return null;
    }

    #buildTabs() {
        const tabsContainer = this.#overlay.querySelector('#settings-tabs');
        tabsContainer.innerHTML = '';

        // System tabs
        const systemTabs = [
            { id: 'general', label: 'General' },
            { id: 'server', label: 'Server' },
            { id: 'streamerbot', label: 'Streamer.bot' },
            { id: 'bots', label: 'Bots' },
            { id: 'module-manager', label: 'Modules' }
        ];

        // Dynamic tabs from discovered modules with hasSettings
        const moduleTabs = [];
        if (window.ModuleRegistry && window.ModuleRegistry.modules) {
            for (const mod of window.ModuleRegistry.modules) {
                if (mod.hasSettings && mod.name && !mod.name.startsWith('_')) {
                    moduleTabs.push({ id: mod.name, label: mod.displayName || mod.name });
                }
            }
        }

        const allTabs = [...systemTabs, ...(moduleTabs.length ? [{ id: '_divider', label: '' }] : []), ...moduleTabs];

        allTabs.forEach((tab, i) => {
            if (tab.id === '_divider') {
                const divider = document.createElement('div');
                divider.className = 'settings-tab-divider';
                tabsContainer.appendChild(divider);
                return;
            }
            const btn = document.createElement('button');
            btn.className = 'settings-tab' + (tab.id === this.#activeTab ? ' active' : '');
            btn.dataset.tab = tab.id;
            btn.textContent = tab.label;
            tabsContainer.appendChild(btn);
        });

        // Bind tab clicks
        tabsContainer.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.#activeTab = tab.dataset.tab;
                tabsContainer.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.#renderTab();
            });
        });
    }

    #createOverlay() {
        this.#overlay = document.createElement('div');
        this.#overlay.id = 'settings-overlay';
        this.#overlay.style.display = 'none';
        this.#overlay.innerHTML = `
            <div id="settings-panel">
                <div id="settings-header">
                    <h2>Global Settings</h2>
                    <div id="settings-header-right">
                        <button id="settings-admin-toggle" title="Toggle Admin Mode">🔒 Admin</button>
                        <button id="settings-close">✕</button>
                    </div>
                </div>
                <div id="settings-body">
                    <div id="settings-tabs"></div>
                    <div id="settings-content"></div>
                </div>
            </div>
        `;
        document.body.appendChild(this.#overlay);

        // Build tabs dynamically
        this.#buildTabs();

        this.#overlay.querySelector('#settings-close').addEventListener('click', () => this.close());
        this.#overlay.querySelector('#settings-admin-toggle').addEventListener('click', () => {
            this.#adminMode = !this.#adminMode;
            EditorPrefs.setAdminMode(this.#adminMode);
            const btn = this.#overlay.querySelector('#settings-admin-toggle');
            btn.textContent = this.#adminMode ? '🔓 Admin' : '🔒 Admin';
            btn.classList.toggle('active', this.#adminMode);
            this.#renderTab();
        });
        this.#overlay.addEventListener('click', (e) => {
            if (e.target === this.#overlay) this.close();
        });
    }

    open() {
        this.#overlay.style.display = 'flex';
        // Rebuild tabs in case modules were discovered after initial creation
        this.#loadSchemas();
        this.#buildTabs();
        this.#renderTab();
        // Sync admin button state
        const btn = this.#overlay.querySelector('#settings-admin-toggle');
        btn.textContent = this.#adminMode ? '🔓 Admin' : '🔒 Admin';
        btn.classList.toggle('active', this.#adminMode);
        this.#renderTab();
    }

    openTo(tab) {
        this.#activeTab = tab;
        this.open();
    }

    close() {
        this.#overlay.style.display = 'none';
    }

    #renderTab() {
        const content = this.#overlay.querySelector('#settings-content');
        switch (this.#activeTab) {
            case 'general':
                content.innerHTML = '';
                TypeRenderer.render(content, EditorState.globalConfig, '', {
                    adminMode: this.#adminMode,
                    onChange: () => EditorState.notify('settings'),
                    schema: this.#getModuleSchema('_global')
                });
                return;
            case 'server':
                content.innerHTML = '';
                this.#renderServer(content);
                return;
            case 'streamerbot':
                content.innerHTML = '';
                TypeRenderer.render(content, EditorState.globalConfig.StreamerBot || {}, 'StreamerBot', {
                    adminMode: this.#adminMode,
                    onChange: () => EditorState.notify('settings'),
                    schema: this.#getModuleSchema('_global')?.StreamerBot || null
                });
                return;
            case 'bots': content.innerHTML = this.#renderBots(); break;
            case 'module-manager':
                content.innerHTML = '';
                this.#renderModuleManager(content);
                return;
            default: {
                // Dynamic module tab — find the module info and render its config
                const modInfo = window.ModuleRegistry?.modules?.find(m => m.name === this.#activeTab);
                if (modInfo && modInfo.configKey) {
                    content.innerHTML = '';
                    const configObj = EditorState.globalConfig[modInfo.configKey] || {};
                    // Ensure the config key exists
                    if (!EditorState.globalConfig[modInfo.configKey]) {
                        EditorState.globalConfig[modInfo.configKey] = {};
                    }
                    TypeRenderer.render(content, EditorState.globalConfig[modInfo.configKey], modInfo.configKey, {
                        adminMode: this.#adminMode,
                        onChange: () => EditorState.notify('settings'),
                        schema: this.#getModuleSchema(modInfo.name)
                    });
                    return;
                }
                content.innerHTML = '<p>No settings available for this module.</p>';
                return;
            }
        }
        this.#bindTab(content);
    }

    #renderServer(container) {
        const port = EditorPrefs.get('serverPort', 31589);
        const host = EditorPrefs.get('serverHost', '127.0.0.1');
        const webroot = EditorPrefs.get('serverWebroot', './www');
        const autoStart = EditorPrefs.get('serverAutoStart', true);

        const baseUrl = `http://${host}:${port}?allowaudio=true`;

        container.innerHTML = `
            <div class="settings-section">
                <h3>Web Server</h3>
                <div class="s-row"><label class="has-tooltip" data-tooltip="IP address the server listens on (use 0.0.0.0 for all interfaces)">Host</label><input type="text" id="srv-host" value="${host}"></div>
                <div class="s-row"><label class="has-tooltip" data-tooltip="Port number for the web server">Port</label><input type="number" id="srv-port" value="${port}"></div>
                <div class="s-row"><label class="has-tooltip" data-tooltip="Root directory for overlay files">Web Root</label><input type="text" id="srv-webroot" value="${webroot}"></div>
                <div class="s-row"><label class="has-tooltip" data-tooltip="Start the server automatically when the editor opens">Auto Start</label><input type="checkbox" id="srv-autostart" ${autoStart ? 'checked' : ''}></div>
                <div class="s-row">
                    <label></label>
                    <button id="srv-restart" class="srv-btn">🔄 Restart Server</button>
                    <button id="srv-reload-clients" class="srv-btn">📡 Reload Browsers</button>
                </div>
            </div>
            <div class="settings-section">
                <h3>OBS Browser Source URL</h3>
                <p class="s-hint">Copy this URL into your OBS Browser Source. Add <code>?allowaudio=true</code> if using the Audio Visualiser.</p>
                <div class="obs-url-box">
                    <code id="srv-obs-url">${baseUrl}</code>
                    <button id="srv-copy-url" title="Copy to clipboard">📋</button>
                </div>
            </div>
        `;

        // Setup custom tooltips for server labels
        container.querySelectorAll('.has-tooltip').forEach(label => {
            label.style.cursor = 'help';
            label.style.textDecoration = 'underline dotted';
            const tip = document.createElement('div');
            tip.className = 'tr-tooltip';
            tip.textContent = label.dataset.tooltip;
            document.body.appendChild(tip);
            label.addEventListener('mouseenter', () => {
                const rect = label.getBoundingClientRect();
                tip.style.display = 'block';
                tip.style.left = rect.left + 'px';
                tip.style.top = (rect.top - tip.offsetHeight - 4) + 'px';
            });
            label.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
        });

        // Bind server settings
        const hostInput = container.querySelector('#srv-host');
        const portInput = container.querySelector('#srv-port');
        const webrootInput = container.querySelector('#srv-webroot');
        const autoStartInput = container.querySelector('#srv-autostart');

        const saveServerSettings = () => {
            EditorPrefs.set('serverHost', hostInput.value);
            EditorPrefs.set('serverPort', parseInt(portInput.value) || 31589);
            EditorPrefs.set('serverWebroot', webrootInput.value);
            EditorPrefs.set('serverAutoStart', autoStartInput.checked);
            // Update displayed URL
            const urlEl = container.querySelector('#srv-obs-url');
            if (urlEl) urlEl.textContent = `http://${hostInput.value}:${portInput.value}?allowaudio=true`;
        };

        hostInput.addEventListener('change', saveServerSettings);
        portInput.addEventListener('change', saveServerSettings);
        webrootInput.addEventListener('change', saveServerSettings);
        autoStartInput.addEventListener('change', saveServerSettings);

        // Restart server
        container.querySelector('#srv-restart').addEventListener('click', async () => {
            await window.api.serverStop();
            const result = await window.api.serverStart({
                port: parseInt(portInput.value) || 31589,
                host: hostInput.value,
                webroot: webrootInput.value
            });
            if (!result.success) {
                alert('Server failed to start: ' + result.error);
            }
        });

        // Reload all browsers
        container.querySelector('#srv-reload-clients').addEventListener('click', async () => {
            const result = await window.api.serverReload();
            if (result.success) {
                const btn = container.querySelector('#srv-reload-clients');
                btn.textContent = `📡 Reloaded (${result.clients})`;
                setTimeout(() => { btn.textContent = '📡 Reload Browsers'; }, 2000);
            }
        });

        // Copy URL
        container.querySelector('#srv-copy-url').addEventListener('click', () => {
            const url = container.querySelector('#srv-obs-url').textContent;
            navigator.clipboard.writeText(url).then(() => {
                const btn = container.querySelector('#srv-copy-url');
                btn.textContent = '✓';
                setTimeout(() => { btn.textContent = '📋'; }, 1500);
            });
        });
    }

    #updateObsUrl(container) {
        const host = EditorPrefs.get('serverHost', '127.0.0.1');
        const port = EditorPrefs.get('serverPort', 31589);
        const urlEl = container.querySelector('#srv-obs-url');
        if (urlEl) urlEl.textContent = `http://${host}:${port}?allowaudio=true`;
    }

    #renderStreamerBot() {
        const sb = EditorState.globalConfig.StreamerBot || {};
        const container = document.createElement('div');
        TypeRenderer.render(container, sb, 'StreamerBot', {
            adminMode: this.#adminMode,
            onChange: () => EditorState.notify('settings')
        });
        return container.innerHTML;
    }

    #renderChat() {
        const chat = EditorState.globalConfig.chat || {};
        const boxes = chat.ChatBoxes || {};
        const removed = chat.RemovedMessage || {};
        const autoHide = chat.AutoHide || {};
        const ext = chat.ExtendedEmotesServices || {};
        const area = chat.MessageArea || {};
        return `
            <div class="settings-section">
                <h3>General</h3>
                <div class="s-row"><label>Before Canvas</label><input type="checkbox" data-field="chat.BeforeCanvas" ${chat.BeforeCanvas ? 'checked' : ''}></div>
                <div class="s-row"><label>Hide Bots</label><input type="checkbox" data-field="chat.hideBots" ${chat.hideBots ? 'checked' : ''}></div>
            </div>
            <div class="settings-section">
                <h3>Extended Emotes</h3>
                <div class="s-row"><label>BTTV</label><input type="checkbox" data-field="chat.ExtendedEmotesServices.BTTV" ${ext.BTTV ? 'checked' : ''}></div>
                <div class="s-row"><label>FFZ</label><input type="checkbox" data-field="chat.ExtendedEmotesServices.FFZ" ${ext.FFZ ? 'checked' : ''}></div>
            </div>
            <div class="settings-section">
                <h3>Message Area</h3>
                <div class="s-row"><label>Width</label><input type="text" data-field="chat.MessageArea.width" value="${area.width || '100%'}"></div>
                <div class="s-row"><label>Height</label><input type="text" data-field="chat.MessageArea.height" value="${area.height || '100%'}"></div>
                <div class="s-row"><label>Top</label><input type="text" data-field="chat.MessageArea.top" value="${area.top || '0%'}"></div>
                <div class="s-row"><label>Right</label><input type="text" data-field="chat.MessageArea.right" value="${area.right || '0%'}"></div>
                <div class="s-row"><label>Bottom</label><input type="text" data-field="chat.MessageArea.bottom" value="${area.bottom || '0%'}"></div>
                <div class="s-row"><label>Left</label><input type="text" data-field="chat.MessageArea.left" value="${area.left || '0%'}"></div>
            </div>
            <div class="settings-section">
                <h3>Chat Boxes</h3>
                <div class="s-row"><label>Show Badges</label><input type="checkbox" data-field="chat.ChatBoxes.ShowBadges" ${boxes.ShowBadges ? 'checked' : ''}></div>
                <div class="s-row"><label>Badge Width</label><input type="number" data-field="chat.ChatBoxes.BadgeSettings.width" value="${boxes.BadgeSettings?.width || 24}"></div>
                <div class="s-row"><label>Badge Height</label><input type="number" data-field="chat.ChatBoxes.BadgeSettings.height" value="${boxes.BadgeSettings?.height || 24}"></div>
                <div class="s-row"><label>Show Emotes</label><input type="checkbox" data-field="chat.ChatBoxes.ShowEmotes" ${boxes.ShowEmotes ? 'checked' : ''}></div>
                <div class="s-row"><label>User Colon</label><input type="checkbox" data-field="chat.ChatBoxes.UserColon" ${boxes.UserColon !== false ? 'checked' : ''}></div>
                <div class="s-row"><label>Allow Clipping</label><input type="checkbox" data-field="chat.ChatBoxes.allowClipping" ${boxes.allowClipping !== false ? 'checked' : ''}></div>
                <div class="s-row"><label>New Messages</label>
                    <select data-field="chat.ChatBoxes.NewMessages">
                        <option value="below" ${boxes.NewMessages === 'below' ? 'selected' : ''}>Below</option>
                        <option value="above" ${boxes.NewMessages === 'above' ? 'selected' : ''}>Above</option>
                    </select>
                </div>
                <div class="s-row"><label>Position</label>
                    <select data-field="chat.ChatBoxes.position">
                        <option value="bottom" ${boxes.position === 'bottom' ? 'selected' : ''}>Bottom</option>
                        <option value="top" ${boxes.position === 'top' ? 'selected' : ''}>Top</option>
                    </select>
                </div>
                <div class="s-row"><label>Animation</label>
                    <select data-field="chat.ChatBoxes.animationType">
                        <option value="fade" ${(boxes.animationType || 'fade') === 'fade' ? 'selected' : ''}>Fade</option>
                        <option value="left" ${boxes.animationType === 'left' ? 'selected' : ''}>Slide Left</option>
                        <option value="right" ${boxes.animationType === 'right' ? 'selected' : ''}>Slide Right</option>
                    </select>
                </div>
            </div>
            <div class="settings-section">
                <h3>Chat Box Style (CSS)</h3>
                <textarea data-field="chat.ChatBoxes.style" rows="6">${JSON.stringify(boxes.style || {}, null, 2)}</textarea>
            </div>
            <div class="settings-section">
                <h3>Message Style (CSS)</h3>
                <textarea data-field="chat.ChatBoxes.messageStyle" rows="4">${JSON.stringify(boxes.messageStyle || {}, null, 2)}</textarea>
            </div>
            <div class="settings-section">
                <h3>Auto Hide</h3>
                <div class="s-row"><label>Enabled</label><input type="checkbox" data-field="chat.AutoHide.enabled" ${autoHide.enabled ? 'checked' : ''}></div>
                <div class="s-row"><label>Time (sec)</label><input type="number" data-field="chat.AutoHide.time" value="${autoHide.time || 60}"></div>
                <div class="s-row"><label>Animation</label>
                    <select data-field="chat.AutoHide.animation">
                        <option value="slide" ${(autoHide.animation || 'slide') === 'slide' ? 'selected' : ''}>Slide</option>
                        <option value="fade" ${autoHide.animation === 'fade' ? 'selected' : ''}>Fade</option>
                    </select>
                </div>
                <div class="s-row"><label>Direction</label>
                    <select data-field="chat.AutoHide.direction">
                        <option value="left" ${(autoHide.direction || 'left') === 'left' ? 'selected' : ''}>Left</option>
                        <option value="right" ${autoHide.direction === 'right' ? 'selected' : ''}>Right</option>
                    </select>
                </div>
            </div>
            <div class="settings-section">
                <h3>Removed Messages</h3>
                <div class="s-row"><label>Hide Entirely</label><input type="checkbox" data-field="chat.RemovedMessage.hideMessage" ${removed.hideMessage ? 'checked' : ''}></div>
                <div class="s-row"><label>Text</label><input type="text" data-field="chat.RemovedMessage.Text" value="${removed.Text || 'Message was removed'}"></div>
                <div class="s-row"><label>Color</label><div class="cp-placeholder" data-cp-field="chat.RemovedMessage.color" data-cp-value="${removed.color || '#FFFFFF'}"></div></div>
                <div class="s-row"><label>Italics</label><input type="checkbox" data-field="chat.RemovedMessage.italics" ${removed.italics ? 'checked' : ''}></div>
                <div class="s-row"><label>Bold</label><input type="checkbox" data-field="chat.RemovedMessage.bold" ${removed.bold ? 'checked' : ''}></div>
            </div>
        `;
    }

    #renderEmote() {
        const emote = EditorState.globalConfig.emote || {};
        const animTime = emote.AnimationTime || {};
        const speed = emote.Speed || {};
        return `
            <div class="settings-section">
                <h3>Animation Time (seconds)</h3>
                <div class="s-row"><label>Min</label><input type="number" data-field="emote.AnimationTime.Min" value="${animTime.Min || 10}"></div>
                <div class="s-row"><label>Max</label><input type="number" data-field="emote.AnimationTime.Max" value="${animTime.Max || 20}"></div>
            </div>
            <div class="settings-section">
                <h3>Speed (px/sec)</h3>
                <div class="s-row"><label>Min</label><input type="number" data-field="emote.Speed.Min" value="${speed.Min || 100}"></div>
                <div class="s-row"><label>Max</label><input type="number" data-field="emote.Speed.Max" value="${speed.Max || 300}"></div>
            </div>
            <div class="settings-section">
                <h3>Behavior</h3>
                <div class="s-row"><label>Random Directions</label><input type="checkbox" data-field="emote.RandomDirectionsFromStart" ${emote.RandomDirectionsFromStart !== false ? 'checked' : ''}></div>
            </div>
        `;
    }

    #renderAudioVisualiser() {
        const av = EditorState.globalConfig.AudioVisualiser || {};
        const area = av.area || {};
        const colors = av.colors || {};
        const gradient = colors.gradient || { stops: [] };
        return `
            <div class="settings-section">
                <h3>Direction & Layout</h3>
                <div class="s-row"><label>Direction</label>
                    <select data-field="AudioVisualiser.direction">
                        <option value="left-right" ${av.direction === 'left-right' ? 'selected' : ''}>Left → Right</option>
                        <option value="right-left" ${av.direction === 'right-left' ? 'selected' : ''}>Right → Left</option>
                        <option value="top-down" ${av.direction === 'top-down' ? 'selected' : ''}>Top → Down</option>
                        <option value="bottom-up" ${av.direction === 'bottom-up' ? 'selected' : ''}>Bottom → Up</option>
                    </select>
                </div>
                <div class="s-row"><label>Mirrored</label><input type="checkbox" data-field="AudioVisualiser.mirrored" ${av.mirrored ? 'checked' : ''}></div>
                <div class="s-row"><label>Bar Width</label><input type="number" data-field="AudioVisualiser.barWidth" value="${av.barWidth || 5}"></div>
                <div class="s-row"><label>Bar Height</label><input type="number" data-field="AudioVisualiser.barHeight" value="${av.barHeight || 5}"></div>
                <div class="s-row"><label>Bar Spacing</label><input type="number" data-field="AudioVisualiser.barSpacing" value="${av.barSpacing || 2}"></div>
                <div class="s-row"><label>Background</label><input type="text" data-field="AudioVisualiser.backgroundColor" value="${av.backgroundColor || 'transparent'}"></div>
            </div>
            <div class="settings-section">
                <h3>Area</h3>
                <div class="s-row"><label>Left</label><input type="text" data-field="AudioVisualiser.area.left" value="${area.left || '0'}"></div>
                <div class="s-row"><label>Right</label><input type="text" data-field="AudioVisualiser.area.right" value="${area.right || '0'}"></div>
                <div class="s-row"><label>Top</label><input type="text" data-field="AudioVisualiser.area.top" value="${area.top || '0'}"></div>
                <div class="s-row"><label>Bottom</label><input type="text" data-field="AudioVisualiser.area.bottom" value="${area.bottom || ''}"></div>
                <div class="s-row"><label>Height</label><input type="text" data-field="AudioVisualiser.area.height" value="${area.height || '80px'}"></div>
            </div>
            <div class="settings-section">
                <h3>Colors</h3>
                <div class="s-row"><label>Mode</label>
                    <select data-field="AudioVisualiser.colors.mode" id="av-color-mode">
                        <option value="levels" ${(colors.mode || 'levels') === 'levels' ? 'selected' : ''}>Levels (solid)</option>
                        <option value="gradient" ${colors.mode === 'gradient' ? 'selected' : ''}>Gradient</option>
                    </select>
                </div>
            </div>
            <div class="settings-section" id="av-levels-section" style="${colors.mode === 'gradient' ? 'display:none' : ''}">
                <h3>Level Colors</h3>
                <div class="s-row"><label>Level 1</label><div class="cp-placeholder" data-cp-field="AudioVisualiser.colors.level1" data-cp-value="${colors.level1 || '#67136f'}"></div></div>
                <div class="s-row"><label>Level 2</label><div class="cp-placeholder" data-cp-field="AudioVisualiser.colors.level2" data-cp-value="${colors.level2 || '#5c3886'}"></div></div>
                <div class="s-row"><label>Level 3</label><div class="cp-placeholder" data-cp-field="AudioVisualiser.colors.level3" data-cp-value="${colors.level3 || '#885ab4'}"></div></div>
                <div class="s-row"><label>Level 4</label><div class="cp-placeholder" data-cp-field="AudioVisualiser.colors.level4" data-cp-value="${colors.level4 || '#885ab4'}"></div></div>
            </div>
            <div class="settings-section" id="av-gradient-section" style="${colors.mode !== 'gradient' ? 'display:none' : ''}">
                <h3>Gradient Stops</h3>
                <button id="btn-open-gradient-editor" class="gradient-edit-btn">🎨 Edit Gradient</button>
                <div id="gradient-preview-bar" class="gradient-preview-bar"></div>
            </div>
        `;
    }

    #renderBots() {
        const bots = EditorState.globalConfig.Bots || [];
        let listHtml = bots.map((bot, i) => `
            <div class="bot-item" data-index="${i}">
                <span class="bot-name" data-index="${i}">${bot}</span>
                <button class="bot-delete" data-index="${i}" title="Remove">✕</button>
            </div>
        `).join('');

        return `
            <div class="settings-section">
                <h3>Bot Usernames</h3>
                <p class="s-hint">Messages from these users will be hidden from chat.</p>
                <div id="bot-list">${listHtml}</div>
                <div class="bot-add-row">
                    <input type="text" id="bot-add-input" placeholder="Bot username...">
                    <button id="bot-add-btn">+ Add</button>
                </div>
            </div>
        `;
    }

    async #renderModuleManager(container) {
        container.innerHTML = '<p class="s-hint">Loading modules...</p>';

        const modules = await window.api.moduleListInstalled();

        let html = `
            <div class="settings-section">
                <h3>Installed Modules</h3>
                <p class="s-hint">Manage installed modules. Built-in modules cannot be removed.</p>
                <div class="module-manager-actions">
                    <button id="mm-install-btn" class="mm-btn">📦 Install from .zip</button>
                    <button id="mm-refresh-btn" class="mm-btn">🔄 Refresh Modules</button>
                    <button id="mm-open-dir-btn" class="mm-btn">📂 Open Modules Folder</button>
                </div>
                <div id="mm-module-list" class="mm-list">
        `;

        for (const mod of modules) {
            const isHidden = EditorPrefs.get('hiddenModules', []).includes(mod.dir);
            html += `
                <div class="mm-item ${mod.builtIn ? 'mm-builtin' : 'mm-thirdparty'}">
                    <div class="mm-item-info">
                        <input type="checkbox" class="mm-visible-check" data-module="${mod.dir}" ${!isHidden ? 'checked' : ''} title="Show in palette">
                        <span class="mm-item-icon">${mod.icon}</span>
                        <span class="mm-item-name">${mod.displayName}</span>
                        ${mod.builtIn ? '<span class="mm-badge">Built-in</span>' : '<span class="mm-badge mm-badge-custom">Custom</span>'}
                    </div>
                    <div class="mm-item-desc">${mod.description}</div>
                    <div class="mm-item-actions">
                        ${!mod.builtIn ? `<button class="mm-btn-sm mm-export-btn" data-module="${mod.dir}" title="Export as .zip">📤 Export</button>` : ''}
                        ${!mod.builtIn ? `<button class="mm-btn-sm mm-btn-danger mm-uninstall-btn" data-module="${mod.dir}" title="Uninstall">🗑 Uninstall</button>` : ''}
                    </div>
                </div>
            `;
        }

        html += `</div></div>`;
        container.innerHTML = html;

        // Bind events
        container.querySelector('#mm-install-btn').addEventListener('click', async () => {
            const result = await window.api.moduleInstall();
            if (result.success) {
                // Refresh module registry
                await this.#reloadModuleRegistry();
                this.#renderModuleManager(container);
            } else if (result.error !== 'Cancelled') {
                alert('Install failed: ' + result.error);
            }
        });

        container.querySelector('#mm-refresh-btn').addEventListener('click', async () => {
            await this.#reloadModuleRegistry();
            this.#renderModuleManager(container);
        });

        container.querySelector('#mm-open-dir-btn').addEventListener('click', async () => {
            await window.api.openModulesDir();
        });

        // Visibility checkboxes
        container.querySelectorAll('.mm-visible-check').forEach(cb => {
            cb.addEventListener('change', () => {
                const name = cb.dataset.module;
                let hidden = EditorPrefs.get('hiddenModules', []);
                if (cb.checked) {
                    hidden = hidden.filter(m => m !== name);
                } else {
                    if (!hidden.includes(name)) hidden.push(name);
                }
                EditorPrefs.set('hiddenModules', hidden);
                // Rebuild palette to reflect visibility
                this.#rebuildPalette();
            });
        });

        container.querySelectorAll('.mm-export-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const name = btn.dataset.module;
                btn.textContent = '⏳...';
                const result = await window.api.moduleExport(name);
                if (result.success) {
                    btn.textContent = '✓ Exported';
                    setTimeout(() => { btn.textContent = '📤 Export'; }, 2000);
                } else if (result.error !== 'Cancelled') {
                    btn.textContent = '❌ Failed';
                    setTimeout(() => { btn.textContent = '📤 Export'; }, 2000);
                } else {
                    btn.textContent = '📤 Export';
                }
            });
        });

        container.querySelectorAll('.mm-uninstall-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const name = btn.dataset.module;
                if (!btn.dataset.armed) {
                    btn.dataset.armed = 'true';
                    btn.textContent = '⚠️ Confirm?';
                    setTimeout(() => { btn.dataset.armed = ''; btn.textContent = '🗑 Uninstall'; }, 3000);
                    return;
                }
                const result = await window.api.moduleUninstall(name);
                if (result.success) {
                    // Remove all instances of this module from all scenes
                    for (const [sceneName, scene] of Object.entries(EditorState.scenes)) {
                        const toRemove = [];
                        for (const [id, mod] of Object.entries(scene.modules)) {
                            if (mod.type === name) toRemove.push(id);
                        }
                        for (const id of toRemove) {
                            delete scene.modules[id];
                        }
                    }
                    if (EditorState.selectedModule) {
                        const currentMod = EditorState.getActiveSceneModules()[EditorState.selectedModule];
                        if (!currentMod) EditorState.selectedModule = null;
                    }
                    EditorState.notify('modules');

                    // Auto-save config to prevent stale module references
                    if (EditorState.configPath) {
                        const config = EditorState.buildConfig();
                        await window.api.quickSave({ configData: config, savePath: EditorState.configPath });
                    }

                    // Reload module type in simulator
                    ModuleSimulator.reloadModuleType(name);
                    await this.#reloadModuleRegistry();
                    this.#renderModuleManager(container);
                } else {
                    alert('Uninstall failed: ' + result.error);
                }
            });
        });
    }

    async #reloadModuleRegistry() {
        // Re-discover modules from disk
        const modules = await window.api.discoverModules();
        window.ModuleRegistry.modules = modules;

        // Rebuild lookup maps
        window.ModuleRegistry.icons = {};
        window.ModuleRegistry.displayNames = {};
        window.ModuleRegistry.allowMultiple = {};
        window.ModuleRegistry.editorClasses = {};
        window.ModuleRegistry.gradients = {};
        window.ModuleRegistry.schemas = {};

        for (const mod of modules) {
            window.ModuleRegistry.icons[mod.name] = mod.icon;
            window.ModuleRegistry.displayNames[mod.name] = mod.displayName;
            window.ModuleRegistry.allowMultiple[mod.name] = mod.allowMultiple ?? true;
            if (mod.editorClass) window.ModuleRegistry.editorClasses[mod.name] = mod.editorClass;
            if (mod.gradient) window.ModuleRegistry.gradients[mod.name] = mod.gradient;
            if (mod.schema) window.ModuleRegistry.schemas[mod.name] = mod.schema;
        }

        // Reload simulator classes
        ModuleSimulator.reloadAll();

        // Rebuild palette
        this.#rebuildPalette();

        // Rebuild settings tabs
        this.#loadSchemas();
        this.#buildTabs();
    }

    #rebuildPalette() {
        const hidden = EditorPrefs.get('hiddenModules', []);
        const palette = document.getElementById('palette');
        if (!palette) return;

        palette.innerHTML = '';
        for (const mod of (window.ModuleRegistry.modules || [])) {
            if (!mod.icon || mod.name.startsWith('_')) continue;
            if (hidden.includes(mod.name)) continue;

            const item = document.createElement('div');
            item.className = 'palette-item';
            item.dataset.module = mod.name;
            item.draggable = true;
            item.innerHTML = `<span class="palette-icon">${mod.icon}</span> ${mod.displayName}`;
            item.title = mod.description || mod.displayName;
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('module-type', mod.name);
                e.dataTransfer.effectAllowed = 'copy';
            });
            palette.appendChild(item);
        }
    }

    #bindTab(content) {
        // Handle color mode toggle for audio visualiser
        const modeSelect = content.querySelector('#av-color-mode');
        if (modeSelect) {
            modeSelect.addEventListener('change', () => {
                const levelsSection = content.querySelector('#av-levels-section');
                const gradientSection = content.querySelector('#av-gradient-section');
                if (modeSelect.value === 'gradient') {
                    levelsSection.style.display = 'none';
                    gradientSection.style.display = '';
                } else {
                    levelsSection.style.display = '';
                    gradientSection.style.display = 'none';
                }
            });
        }

        // Bot list interactions
        const botList = content.querySelector('#bot-list');
        const botAddBtn = content.querySelector('#bot-add-btn');
        const botAddInput = content.querySelector('#bot-add-input');

        if (botList) {
            // Delete buttons
            botList.querySelectorAll('.bot-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(btn.dataset.index);
                    EditorState.globalConfig.Bots.splice(index, 1);
                    EditorState.notify('settings');
                    this.#renderTab();
                });
            });

            // Click name to edit
            botList.querySelectorAll('.bot-name').forEach(span => {
                span.addEventListener('click', () => {
                    const index = parseInt(span.dataset.index);
                    const current = EditorState.globalConfig.Bots[index];
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = current;
                    input.className = 'bot-edit-input';

                    const commit = () => {
                        const val = input.value.trim();
                        if (val) {
                            EditorState.globalConfig.Bots[index] = val;
                        }
                        EditorState.notify('settings');
                        this.#renderTab();
                    };

                    input.addEventListener('blur', commit);
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') this.#renderTab();
                    });

                    span.replaceWith(input);
                    input.focus();
                    input.select();
                });
            });
        }

        if (botAddBtn && botAddInput) {
            const addBot = () => {
                const val = botAddInput.value.trim();
                if (val) {
                    if (!EditorState.globalConfig.Bots) EditorState.globalConfig.Bots = [];
                    EditorState.globalConfig.Bots.push(val);
                    EditorState.notify('settings');
                    this.#renderTab();
                }
            };
            botAddBtn.addEventListener('click', addBot);
            botAddInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') addBot();
            });
        }

        // Gradient editor button
        const gradientBtn = content.querySelector('#btn-open-gradient-editor');
        if (gradientBtn) {
            gradientBtn.addEventListener('click', () => this.#openGradientEditor());
            // Render preview bar
            this.#updateGradientPreview(content);
        }

        // Custom color picker placeholders
        content.querySelectorAll('.cp-placeholder').forEach(placeholder => {
            const field = placeholder.dataset.cpField;
            const value = placeholder.dataset.cpValue || '#ffffff';
            const swatch = ColorPicker.create(value, (hex) => {
                // Set the value in globalConfig
                const parts = field.split('.');
                let obj = EditorState.globalConfig;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
                    obj = obj[parts[i]];
                }
                obj[parts[parts.length - 1]] = hex;
                EditorState.notify('settings');
            });
            placeholder.replaceWith(swatch);
        });

        // Bind all other inputs
        content.querySelectorAll('input[data-field], select[data-field], textarea[data-field]').forEach(input => {
            const field = input.dataset.field;
            if (!field) return;

            const handler = () => {
                this.#setField(field, input);
                EditorState.notify('settings');
            };

            if (input.type === 'checkbox') {
                input.addEventListener('change', handler);
            } else {
                input.addEventListener('change', handler);
                input.addEventListener('blur', handler);
            }
        });
    }

    #setField(path, input) {
        const parts = path.split('.');
        let value;

        if (input.type === 'checkbox') {
            value = input.checked;
        } else if (input.type === 'number') {
            value = parseFloat(input.value);
        } else if (input.tagName === 'TEXTAREA') {
            // Try to parse as JSON, fall back to newline-split array
            const text = input.value.trim();
            try {
                value = JSON.parse(text);
            } catch {
                // Treat as newline-separated list
                value = text.split('\n').map(s => s.trim()).filter(s => s);
            }
        } else {
            value = input.value;
        }

        // Special case: Modules field is comma-separated
        if (path === 'Modules' && typeof value === 'string') {
            value = value.split(',').map(s => s.trim()).filter(s => s);
        }

        // Navigate into globalConfig and set the value
        let obj = EditorState.globalConfig;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') {
                obj[parts[i]] = {};
            }
            obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
    }

    #updateGradientPreview(container) {
        const bar = container.querySelector('#gradient-preview-bar');
        if (!bar) return;
        const stops = EditorState.globalConfig.AudioVisualiser?.colors?.gradient?.stops || [];
        if (stops.length === 0) {
            bar.style.background = '#333';
            return;
        }
        const css = stops.map(s => `${s.color} ${s.position * 100}%`).join(', ');
        bar.style.background = `linear-gradient(to right, ${css})`;
    }

    #openGradientEditor() {
        const av = EditorState.globalConfig.AudioVisualiser;
        if (!av.colors) av.colors = {};
        if (!av.colors.gradient) av.colors.gradient = { stops: [] };

        // Clone stops for editing
        let editStops = JSON.parse(JSON.stringify(av.colors.gradient.stops || []));
        if (editStops.length === 0) {
            editStops = [
                { position: 0, color: '#0000ff' },
                { position: 1, color: '#ff00ff' }
            ];
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'gradient-editor-overlay';
        overlay.innerHTML = `
            <div id="gradient-editor-panel">
                <div id="gradient-editor-header">
                    <h2>Gradient Editor</h2>
                    <button id="gradient-editor-close">✕</button>
                </div>
                <div id="gradient-editor-body">
                    <div id="gradient-editor-preview"></div>
                    <div id="gradient-editor-stops"></div>
                    <div class="gradient-add-row">
                        <button id="gradient-add-stop">+ Add Stop</button>
                    </div>
                </div>
                <div id="gradient-editor-footer">
                    <button id="gradient-editor-cancel">Cancel</button>
                    <button id="gradient-editor-save">💾 Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const renderStops = () => {
            const stopsContainer = overlay.querySelector('#gradient-editor-stops');
            stopsContainer.innerHTML = '';

            editStops.forEach((stop, i) => {
                const row = document.createElement('div');
                row.className = 'gradient-stop-row';

                const label = document.createElement('label');
                label.textContent = `Stop ${i + 1}`;

                const colorSwatch = ColorPicker.create(stop.color, (hex) => {
                    editStops[i].color = hex;
                    updatePreview();
                });

                const slider = document.createElement('input');
                slider.type = 'range';
                slider.className = 'gradient-stop-position';
                slider.min = '0';
                slider.max = '100';
                slider.value = Math.round(stop.position * 100);

                const posLabel = document.createElement('span');
                posLabel.className = 'gradient-stop-pos-label';
                posLabel.textContent = Math.round(stop.position * 100) + '%';

                slider.addEventListener('input', () => {
                    editStops[i].position = parseInt(slider.value) / 100;
                    posLabel.textContent = slider.value + '%';
                    updatePreview();
                });

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'gradient-stop-delete';
                deleteBtn.textContent = '✕';
                deleteBtn.addEventListener('click', () => {
                    if (editStops.length <= 2) return;
                    editStops.splice(i, 1);
                    renderStops();
                    updatePreview();
                });

                row.appendChild(label);
                row.appendChild(colorSwatch);
                row.appendChild(slider);
                row.appendChild(posLabel);
                row.appendChild(deleteBtn);
                stopsContainer.appendChild(row);
            });
        };

        const updatePreview = () => {
            const preview = overlay.querySelector('#gradient-editor-preview');
            const sorted = [...editStops].sort((a, b) => a.position - b.position);
            const css = sorted.map(s => `${s.color} ${s.position * 100}%`).join(', ');
            preview.style.background = `linear-gradient(to right, ${css})`;
        };

        renderStops();
        updatePreview();

        // Add stop
        overlay.querySelector('#gradient-add-stop').addEventListener('click', () => {
            editStops.push({ position: 0.5, color: '#ffffff' });
            renderStops();
            updatePreview();
        });

        // Cancel
        overlay.querySelector('#gradient-editor-cancel').addEventListener('click', () => {
            overlay.remove();
        });
        overlay.querySelector('#gradient-editor-close').addEventListener('click', () => {
            overlay.remove();
        });

        // Save
        overlay.querySelector('#gradient-editor-save').addEventListener('click', () => {
            // Sort by position before saving
            editStops.sort((a, b) => a.position - b.position);
            av.colors.gradient.stops = editStops;
            EditorState.notify('settings');
            overlay.remove();
            this.#renderTab();
        });

        // Click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }
}
