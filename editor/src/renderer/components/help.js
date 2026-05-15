class HelpPanel {
    #overlay;

    constructor() {
        this.#createOverlay();
    }

    #createOverlay() {
        this.#overlay = document.createElement('div');
        this.#overlay.id = 'help-overlay';
        this.#overlay.style.display = 'none';
        this.#overlay.innerHTML = `
            <div id="help-panel">
                <div id="help-header">
                    <h2>Help</h2>
                    <button id="help-close">✕</button>
                </div>
                <div id="help-body">
                    <div id="help-tabs"></div>
                    <div id="help-content"></div>
                </div>
            </div>
        `;
        document.body.appendChild(this.#overlay);

        this.#overlay.querySelector('#help-close').addEventListener('click', () => this.close());
        this.#overlay.addEventListener('click', (e) => {
            if (e.target === this.#overlay) this.close();
        });

        // Toolbar help button
        document.getElementById('btn-help')?.addEventListener('click', () => this.open());

        // F1 to open help
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F1') {
                e.preventDefault();
                this.open();
            }
        });
    }

    open() {
        this.#overlay.style.display = 'flex';
        this.#buildTabs();
        this.#renderTab('shortcuts');
    }

    close() {
        this.#overlay.style.display = 'none';
    }

    #buildTabs() {
        const tabs = [
            { id: 'shortcuts', label: 'Keyboard Shortcuts' },
            { id: 'editor', label: 'Editor Guide' },
            { id: 'getting-started', label: 'Getting Started' },
            { id: 'troubleshooting', label: 'Troubleshooting' }
        ];

        const container = this.#overlay.querySelector('#help-tabs');
        container.innerHTML = '';

        tabs.forEach(tab => {
            const btn = document.createElement('button');
            btn.className = 'help-tab';
            btn.dataset.tab = tab.id;
            btn.textContent = tab.label;
            btn.addEventListener('click', () => {
                container.querySelectorAll('.help-tab').forEach(t => t.classList.remove('active'));
                btn.classList.add('active');
                this.#renderTab(tab.id);
            });
            container.appendChild(btn);
        });

        container.querySelector('.help-tab').classList.add('active');
    }

    #renderTab(tabId) {
        const content = this.#overlay.querySelector('#help-content');
        switch (tabId) {
            case 'shortcuts': content.innerHTML = this.#renderShortcuts(); break;
            case 'editor': content.innerHTML = this.#renderEditorGuide(); break;
            case 'getting-started': content.innerHTML = this.#renderGettingStarted(); break;
            case 'troubleshooting': content.innerHTML = this.#renderTroubleshooting(); break;
        }
    }

    #renderShortcuts() {
        return `
            <div class="help-section">
                <h3>General</h3>
                <table class="help-shortcuts">
                    <tr><td><kbd>Ctrl</kbd>+<kbd>S</kbd></td><td>Save config</td></tr>
                    <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd></td><td>Undo</td></tr>
                    <tr><td><kbd>Ctrl</kbd>+<kbd>Y</kbd></td><td>Redo</td></tr>
                    <tr><td><kbd>Delete</kbd></td><td>Remove selected module</td></tr>
                    <tr><td><kbd>F1</kbd></td><td>Open this help panel</td></tr>
                </table>
            </div>
            <div class="help-section">
                <h3>Module Movement</h3>
                <table class="help-shortcuts">
                    <tr><td><kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd></td><td>Move selected module (5px)</td></tr>
                    <tr><td><kbd>Shift</kbd>+Arrow</td><td>Move selected module (20px)</td></tr>
                    <tr><td><kbd>Alt</kbd>+Arrow</td><td>Move selected module (1px)</td></tr>
                </table>
            </div>
            <div class="help-section">
                <h3>Canvas</h3>
                <table class="help-shortcuts">
                    <tr><td>Click canvas background</td><td>Deselect module</td></tr>
                    <tr><td>Drag module</td><td>Move module</td></tr>
                    <tr><td>Drag handles</td><td>Resize module</td></tr>
                    <tr><td>Drag from palette</td><td>Add module to canvas</td></tr>
                    <tr><td>Drag from media/OS</td><td>Add image/video to canvas</td></tr>
                </table>
            </div>
            <div class="help-section">
                <h3>Layers</h3>
                <table class="help-shortcuts">
                    <tr><td>Click layer</td><td>Select module</td></tr>
                    <tr><td>Drag layer</td><td>Reorder (z-index)</td></tr>
                    <tr><td><kbd>👁</kbd> button</td><td>Toggle visibility</td></tr>
                    <tr><td><kbd>▲</kbd> <kbd>▼</kbd> buttons</td><td>Move layer up/down</td></tr>
                </table>
            </div>
        `;
    }

    #renderEditorGuide() {
        return `
            <div class="help-section">
                <h3>Layout Overview</h3>
                <p>The editor has these main areas:</p>
                <ul>
                    <li><strong>Toolbar</strong> (top) — Open/Save, Settings, server controls, canvas settings</li>
                    <li><strong>Scene Tabs</strong> (below toolbar) — Switch between scenes, add new ones</li>
                    <li><strong>Left Sidebar</strong> — Layers panel and Media library</li>
                    <li><strong>Canvas</strong> (center) — Visual workspace where you position modules</li>
                    <li><strong>Right Sidebar</strong> — Modules palette and Properties panel</li>
                    <li><strong>Play/Stop Controls</strong> (above canvas) — Preview animations</li>
                </ul>
            </div>
            <div class="help-section">
                <h3>Working with Scenes</h3>
                <ul>
                    <li><strong>Create</strong> — Click the <strong>+</strong> button on the scene tabs bar</li>
                    <li><strong>Switch</strong> — Click a scene tab</li>
                    <li><strong>Duplicate</strong> — Click <strong>⧉</strong> on the active tab</li>
                    <li><strong>Delete</strong> — Click <strong>✕</strong> on a tab (can't delete default)</li>
                    <li><strong>Rename</strong> — Double-click a scene tab</li>
                </ul>
            </div>
            <div class="help-section">
                <h3>Adding Modules</h3>
                <ul>
                    <li><strong>From Palette</strong> — Drag from the Modules panel onto the canvas</li>
                    <li><strong>From Media</strong> — Drag an image/video from Media panel onto canvas</li>
                    <li><strong>From Computer</strong> — Drag files from Explorer onto canvas or media panel</li>
                </ul>
            </div>
            <div class="help-section">
                <h3>Editing Modules</h3>
                <ul>
                    <li><strong>Move</strong> — Click and drag, or use arrow keys</li>
                    <li><strong>Resize</strong> — Drag edge/corner handles</li>
                    <li><strong>Properties</strong> — Select a module to see its settings in the right sidebar</li>
                    <li><strong>Module Settings</strong> — Click ⚙️ button in Properties for full config</li>
                </ul>
            </div>
            <div class="help-section">
                <h3>Media Library</h3>
                <ul>
                    <li><strong>📁 Upload</strong> — Browse for files to add</li>
                    <li><strong>📂 New Folder</strong> — Create subdirectories</li>
                    <li><strong>Drag & Drop</strong> — Drop files from your computer onto the panel</li>
                    <li><strong>🗑</strong> on hover to delete</li>
                </ul>
                <p>Files are stored in <code>www/media/</code> and referenced as <code>/media/filename.ext</code>.</p>
            </div>
            <div class="help-section">
                <h3>Previewing</h3>
                <ul>
                    <li><strong>▶ Play</strong> button on a module — start its simulation</li>
                    <li><strong>▶ Play All</strong> — start all simulations</li>
                    <li><strong>💬</strong> on chat — send test message</li>
                    <li><strong>📡</strong> in toolbar — WebSocket admin for testing</li>
                </ul>
            </div>
        `;
    }

    #renderGettingStarted() {
        return `
            <div class="help-section">
                <h3>First Launch</h3>
                <ol>
                    <li>The web server starts automatically (green dot in toolbar)</li>
                    <li>A default scene is created for you</li>
                    <li>The app is ready to serve overlays to OBS</li>
                </ol>
            </div>
            <div class="help-section">
                <h3>Adding to OBS</h3>
                <ol>
                    <li>Note the server URL in the toolbar (e.g. <code>http://127.0.0.1:31589</code>)</li>
                    <li>In OBS, add a new <strong>Browser Source</strong></li>
                    <li>Set the URL to the one shown in the app</li>
                    <li>Set width to <code>1920</code> and height to <code>1080</code> (or your resolution)</li>
                    <li>Check "Control audio via OBS" if using the audio visualiser</li>
                </ol>
            </div>
            <div class="help-section">
                <h3>Audio Visualiser Setup</h3>
                <ol>
                    <li>Go to <strong>Settings → Audio Visualiser</strong></li>
                    <li>Set the <code>device</code> to your audio capture device name</li>
                    <li>Save the config</li>
                    <li>Make sure your OBS URL includes <code>?allowaudio=true</code></li>
                </ol>
            </div>
            <div class="help-section">
                <h3>Setting Up Your Channel</h3>
                <ol>
                    <li>Click ⚙️ <strong>Settings</strong> in the toolbar</li>
                    <li>Go to <strong>General</strong> — enter Channel Name and Twitch ID</li>
                    <li>Go to <strong>Streamer.bot</strong> — set your WebSocket port (default: 24585)</li>
                    <li>Go to <strong>Bots</strong> — add bot usernames to hide from chat</li>
                </ol>
            </div>
        `;
    }

    #renderTroubleshooting() {
        return `
            <div class="help-section">
                <h3>Server Issues</h3>
                <dl>
                    <dt>"Port in use" error</dt>
                    <dd>Close other instances of CanvasUI, or change the port in Settings → Server.</dd>
                    <dt>Can't connect from OBS</dt>
                    <dd>Check the server shows a green dot, verify the URL matches exactly, check Windows Firewall.</dd>
                    <dt>⚠️ Warning icon in toolbar</dt>
                    <dd>You're editing a config that isn't in the server's webroot. Open the correct file or change the webroot.</dd>
                </dl>
            </div>
            <div class="help-section">
                <h3>Editor Issues</h3>
                <dl>
                    <dt>Can't click modules behind other modules</dt>
                    <dd>Click the module in the Layers panel instead, or reorder layers.</dd>
                    <dt>Drag and drop not working</dt>
                    <dd>Make sure you're dragging from the Media panel or Modules palette.</dd>
                    <dt>Settings not saving</dt>
                    <dd>Click <strong>Save</strong> (💾) after making changes in Settings.</dd>
                </dl>
            </div>
            <div class="help-section">
                <h3>Overlay Issues</h3>
                <dl>
                    <dt>Chat not showing</dt>
                    <dd>Verify Streamer.bot is running, check port matches, ensure <code>chat</code> is in Modules list.</dd>
                    <dt>Audio Visualiser blank</dt>
                    <dd>URL must include <code>?allowaudio=true</code>, device name must match exactly, permission must be granted.</dd>
                    <dt>Scene not switching</dt>
                    <dd>The <code>obsScene</code> value must exactly match the OBS scene name sent by Streamer.bot.</dd>
                    <dt>Overlay not updating after save</dt>
                    <dd>Check server is running (green dot). Try the 🔄 reload button in toolbar.</dd>
                </dl>
            </div>
            <div class="help-section">
                <h3>Performance</h3>
                <dl>
                    <dt>Overlay lagging</dt>
                    <dd>Reduce active modules, increase bar width/spacing on visualiser, disable BTTV/FFZ.</dd>
                    <dt>Editor slow</dt>
                    <dd>Stop simulations when not previewing, close unused panels, avoid 4K video previews.</dd>
                </dl>
            </div>
        `;
    }
}
