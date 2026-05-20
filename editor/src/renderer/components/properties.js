class PropertiesPanel {
    #container;

    constructor() {
        this.#container = document.getElementById('props-content');

        EditorState.onChange((what) => {
            if (['selection', 'module-area', 'scene-switch', 'load', 'modules'].includes(what)) {
                this.render();
            }
        });
    }

    render() {
        const mod = EditorState.getSelectedModule();
        const id = EditorState.selectedModule;

        if (!mod) {
            // No module selected — show scene settings if a scene is active
            if (EditorState.activeScene && EditorState.scenes[EditorState.activeScene]) {
                const scene = EditorState.scenes[EditorState.activeScene];
                let html = '';
                html += `<div class="prop-group">`;
                html += `<div class="prop-group-title">Scene: ${EditorState.activeScene}</div>`;
                html += `<div class="prop-row"><label>OBS Scene</label><input type="text" id="prop-scene-obs" value="${scene.obsScene || ''}" placeholder="OBS scene name"></div>`;
                html += `<div class="prop-row"><label>Transition</label>`;
                html += `<select id="prop-scene-trans-type">`;
                html += `<option value="fade" ${scene.transition?.type === 'fade' ? 'selected' : ''}>Fade</option>`;
                html += `<option value="none" ${scene.transition?.type === 'none' ? 'selected' : ''}>None</option>`;
                html += `</select></div>`;
                html += `<div class="prop-row"><label>Duration</label><input type="number" id="prop-scene-trans-dur" value="${scene.transition?.duration || 0.5}" step="0.1" min="0" max="5"></div>`;
                html += `</div>`;
                this.#container.innerHTML = html;

                // Bind scene settings
                document.getElementById('prop-scene-obs')?.addEventListener('change', (e) => {
                    scene.obsScene = e.target.value;
                    EditorState.notify('module-settings');
                });
                document.getElementById('prop-scene-trans-type')?.addEventListener('change', (e) => {
                    if (!scene.transition) scene.transition = {};
                    scene.transition.type = e.target.value;
                    EditorState.notify('module-settings');
                });
                document.getElementById('prop-scene-trans-dur')?.addEventListener('change', (e) => {
                    if (!scene.transition) scene.transition = {};
                    scene.transition.duration = parseFloat(e.target.value) || 0.5;
                    EditorState.notify('module-settings');
                });
            } else {
                this.#container.innerHTML = '<p class="props-hint">Select a module on the canvas to edit its properties</p>';
            }
            return;
        }

        let html = '';

        // Module info
        html += `<div class="prop-group">`;
        html += `<div class="prop-group-title">${getModuleIcon(mod.type)} ${mod.type}</div>`;
        html += `<div class="prop-row"><label>ID</label><input type="text" id="prop-module-id" value="${id}"></div>`;
        html += `</div>`;

        // Position & Size
        html += `<div class="prop-group">`;
        html += `<div class="prop-group-title">Position & Size</div>`;
        html += this.#numRow('X', 'area-x', Math.round(mod.area.x));
        html += this.#numRow('Y', 'area-y', Math.round(mod.area.y));
        html += this.#numRow('Width', 'area-w', Math.round(mod.area.width));
        html += this.#numRow('Height', 'area-h', Math.round(mod.area.height));
        html += `</div>`;

        // Type-specific settings — dynamically built from info.json properties field
        const modInfo = window.ModuleRegistry?.modules?.find(m => m.name === mod.type);
        if (modInfo?.properties) {
            html += this.#dynamicProps(mod, modInfo.properties);
        }

        // Module settings button (opens settings panel to the relevant tab)
        // Dynamic: show button if the module has hasSettings in its registry info
        if (modInfo?.hasSettings) {
            const displayName = modInfo.displayName || mod.type.charAt(0).toUpperCase() + mod.type.slice(1);
            html += `<button class="prop-btn-settings" id="btn-module-settings" data-tab="${mod.type}">⚙️ ${displayName} Settings</button>`;
        }

        // Delete button
        html += `<button class="prop-btn-danger" id="btn-delete-module">🗑️ Remove Module</button>`;

        this.#container.innerHTML = html;
        this.#bindEvents(id, mod);
    }

    #numRow(label, dataId, value, step = 1, min = 0, max = 99999) {
        return `<div class="prop-row"><label>${label}</label><input type="number" data-prop="${dataId}" value="${value}" step="${step}" min="${min}" max="${max}"></div>`;
    }

    #dynamicProps(mod, properties) {
        const settings = mod.settings || {};
        let html = `<div class="prop-group">`;
        html += `<div class="prop-group-title">${window.ModuleRegistry?.getDisplayName(mod.type) || mod.type} Settings</div>`;

        for (const [key, prop] of Object.entries(properties)) {
            // showWhen conditional
            if (prop.showWhen) {
                const depVal = settings[prop.showWhen.field];
                const matches = depVal === prop.showWhen.value || depVal === String(prop.showWhen.value);
                if (!matches) continue;
            }

            const value = settings[key] ?? prop.default ?? '';

            switch (prop.type) {
                case 'string':
                    html += `<div class="prop-row"><label>${prop.label}</label><input type="text" data-dprop="${key}" value="${value}" ${prop.placeholder ? `placeholder="${prop.placeholder}"` : ''}></div>`;
                    break;
                case 'number':
                    html += `<div class="prop-row"><label>${prop.label}</label><input type="number" data-dprop="${key}" value="${value}" ${prop.min !== undefined ? `min="${prop.min}"` : ''} ${prop.max !== undefined ? `max="${prop.max}"` : ''} ${prop.step ? `step="${prop.step}"` : ''}></div>`;
                    break;
                case 'bool':
                    html += `<div class="prop-row"><label>${prop.label}</label><input type="checkbox" data-dprop="${key}" data-dprop-type="bool" ${value ? 'checked' : ''}></div>`;
                    break;
                case 'color':
                    html += `<div class="prop-row"><label>${prop.label}</label><div class="dp-color-placeholder" data-dprop="${key}" data-dprop-value="${value || prop.default || '#ffffff'}"></div></div>`;
                    break;
                case 'select':
                    html += `<div class="prop-row"><label>${prop.label}</label><select data-dprop="${key}">`;
                    for (const opt of (prop.options || [])) {
                        html += `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`;
                    }
                    html += `</select></div>`;
                    break;
                case 'range':
                    html += `<div class="prop-row"><label>${prop.label}</label><input type="range" data-dprop="${key}" min="${prop.min ?? 0}" max="${prop.max ?? 1}" step="${prop.step ?? 0.01}" value="${value}"><span class="dp-range-val" data-dprop-range="${key}">${value}</span></div>`;
                    break;
                case 'media':
                    html += `<div class="prop-row"><label>${prop.label}</label><button class="dp-media-btn" data-dprop="${key}" data-media-type="${prop.mediaType || 'image'}">Browse...</button></div>`;
                    if (value) {
                        html += `<div class="prop-row"><label></label><span style="font-size:11px;color:var(--text-secondary);word-break:break-all;">${String(value).split(/[/\\]/).pop()}</span></div>`;
                    }
                    break;
                case 'audioDevice':
                    html += `<div class="prop-row"><label>${prop.label}</label><select class="dp-audio-device" data-dprop="${key}"><option value="">Loading...</option></select></div>`;
                    break;
                case 'cameraDevice':
                    html += `<div class="prop-row"><label>${prop.label}</label><select class="dp-camera-device" data-dprop="${key}"><option value="">Loading...</option></select></div>`;
                    break;
                case 'gamepadDevice':
                    html += `<div class="prop-row"><label>${prop.label}</label><select class="dp-gamepad-device" data-dprop="${key}"><option value="">Loading...</option></select></div>`;
                    break;
                case 'gamepadButton':
                    html += `<div class="prop-row"><label>${prop.label}</label><select class="dp-gamepad-button" data-dprop="${key}"><option value="">Loading...</option></select></div>`;
                    break;
            }
        }

        html += `</div>`;

        setTimeout(() => this.#bindDynamicProps(properties, settings), 0);

        return html;
    }

    #bindDynamicProps(properties, settings) {
        const id = EditorState.selectedModule;
        if (!id) return;

        // Standard inputs (string, number, select)
        this.#container.querySelectorAll('[data-dprop]').forEach(el => {
            if (el.classList.contains('dp-color-placeholder') || el.classList.contains('dp-media-btn') || el.classList.contains('dp-audio-device') || el.classList.contains('dp-camera-device') || el.classList.contains('dp-gamepad-device') || el.classList.contains('dp-gamepad-button')) return;

            const key = el.dataset.dprop;
            const prop = properties[key];
            if (!prop) return;

            const eventType = (el.type === 'range') ? 'input' : 'change';
            el.addEventListener(eventType, () => {
                let value;
                if (el.dataset.dpropType === 'bool') {
                    value = el.checked;
                } else if (prop.type === 'number' || prop.type === 'range') {
                    value = parseFloat(el.value);
                } else {
                    value = el.value;
                }
                EditorState.updateModuleSetting(id, key, value);

                // Update range display
                if (prop.type === 'range') {
                    const valSpan = this.#container.querySelector(`[data-dprop-range="${key}"]`);
                    if (valSpan) valSpan.textContent = el.value;
                }

                // Re-render if showWhen dependencies changed
                const hasDependents = Object.values(properties).some(p => p.showWhen?.field === key);
                if (hasDependents) this.render();
            });
        });

        // Color pickers
        this.#container.querySelectorAll('.dp-color-placeholder').forEach(el => {
            const key = el.dataset.dprop;
            const value = el.dataset.dpropValue || '#ffffff';
            const swatch = ColorPicker.create(value, (hex) => {
                EditorState.updateModuleSetting(id, key, hex);
            });
            el.innerHTML = '';
            el.appendChild(swatch);
        });

        // Media pickers
        this.#container.querySelectorAll('.dp-media-btn').forEach(btn => {
            const key = btn.dataset.dprop;
            const mediaType = btn.dataset.mediaType || 'image';
            btn.addEventListener('click', () => {
                if (window.mediaPanel) {
                    window.mediaPanel.startSelection(mediaType, (path) => {
                        EditorState.updateModuleSetting(id, key, path);
                        this.render();
                    });
                }
            });
        });

        // Audio device dropdowns
        this.#container.querySelectorAll('.dp-audio-device').forEach(async (select) => {
            const key = select.dataset.dprop;
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(d => d.kind === 'audioinput');
                select.innerHTML = '<option value="">(Select device)</option>';
                audioInputs.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.label || d.deviceId;
                    opt.textContent = d.label || `Device ${d.deviceId.slice(0, 8)}`;
                    if ((d.label || d.deviceId) === (settings[key] || '')) opt.selected = true;
                    select.appendChild(opt);
                });
                select.addEventListener('change', () => {
                    EditorState.updateModuleSetting(id, key, select.value);
                });
            } catch (e) {
                select.innerHTML = '<option value="">(No devices found)</option>';
            }
        });

        // Camera device dropdowns
        this.#container.querySelectorAll('.dp-camera-device').forEach(async (select) => {
            const key = select.dataset.dprop;
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const cameras = devices.filter(d => d.kind === 'videoinput');
                select.innerHTML = '<option value="">(Select camera)</option>';
                cameras.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.label || d.deviceId;
                    opt.textContent = d.label || `Camera ${d.deviceId.slice(0, 8)}`;
                    if ((d.label || d.deviceId) === (settings[key] || '')) opt.selected = true;
                    select.appendChild(opt);
                });
                select.addEventListener('change', () => {
                    EditorState.updateModuleSetting(id, key, select.value);
                });
            } catch (e) {
                select.innerHTML = '<option value="">(No cameras found)</option>';
            }
        });

        // Gamepad device dropdowns
        this.#container.querySelectorAll('.dp-gamepad-device').forEach((select) => {
            const key = select.dataset.dprop;
            const currentVal = String(settings[key] ?? '');

            // Show saved value immediately without requiring detection
            const populateGamepads = () => {
                const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
                const prevVal = select.value || currentVal;
                let hasGamepads = false;

                for (let i = 0; i < gamepads.length; i++) {
                    if (gamepads[i]) { hasGamepads = true; break; }
                }

                // If no gamepads detected but we have a saved value, keep showing it
                if (!hasGamepads && prevVal) {
                    if (select.options.length <= 1 || select.value !== prevVal) {
                        select.innerHTML = '';
                        const opt = document.createElement('option');
                        opt.value = prevVal;
                        const savedName = settings[key + 'Name'] || '';
                        opt.textContent = savedName ? `[${prevVal}] ${savedName}` : `[${prevVal}] (press button to detect)`;
                        opt.selected = true;
                        select.appendChild(opt);
                    }
                    return false;
                }

                if (!hasGamepads) {
                    select.innerHTML = '<option value="">(Press a button to detect controllers)</option>';
                    return false;
                }

                // Gamepads detected — populate full list
                select.innerHTML = '<option value="">(Select gamepad)</option>';
                for (let i = 0; i < gamepads.length; i++) {
                    const gp = gamepads[i];
                    if (!gp) continue;
                    const opt = document.createElement('option');
                    opt.value = String(i);
                    opt.textContent = `[${i}] ${gp.id}`;
                    if (String(i) === prevVal) opt.selected = true;
                    select.appendChild(opt);
                }
                return true;
            };

            // Initial populate — show saved value
            const detected = populateGamepads();

            // Only start polling when user clicks the dropdown
            let polling = false;
            select.addEventListener('mousedown', () => {
                if (!polling) {
                    polling = true;
                    const pollInterval = setInterval(() => {
                        if (!select.isConnected) { clearInterval(pollInterval); return; }
                        populateGamepads();
                    }, 500);
                }
            });

            const onConnect = () => populateGamepads();
            window.addEventListener('gamepadconnected', onConnect);
            window.addEventListener('gamepaddisconnected', onConnect);

            select.addEventListener('change', () => {
                const idx = select.value ? parseInt(select.value) : 0;
                EditorState.updateModuleSetting(id, key, idx);
                // Save controller name for display when not detected
                const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
                const gp = gamepads[idx];
                if (gp) {
                    EditorState.updateModuleSetting(id, key + 'Name', gp.id);
                }
            });
        });

        // Gamepad button dropdowns
        this.#container.querySelectorAll('.dp-gamepad-button').forEach((select) => {
            const key = select.dataset.dprop;
            const savedVal = settings[key];
            const currentVal = savedVal !== undefined && savedVal !== null ? String(savedVal) : '';

            const populateButtons = () => {
                // Get gamepad index from the gamepadDevice dropdown if present, else from settings
                const gpDeviceSelect = this.#container.querySelector('.dp-gamepad-device');
                const gpIndex = gpDeviceSelect ? parseInt(gpDeviceSelect.value) || 0 : (settings.gamepadIndex ?? 0);
                const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
                const gp = gamepads[gpIndex];

                // If gamepad not detected but we have a saved value, keep showing it
                if ((!gp || !gp.buttons) && currentVal) {
                    if (select.options.length <= 1 || select.value !== currentVal) {
                        select.innerHTML = '';
                        const opt = document.createElement('option');
                        opt.value = currentVal;
                        opt.textContent = `Button ${currentVal}`;
                        opt.selected = true;
                        select.appendChild(opt);
                    }
                    return false;
                }

                if (!gp || !gp.buttons) {
                    select.innerHTML = '<option value="">(Connect controller first)</option>';
                    return false;
                }

                // Gamepad detected — populate full list
                const prevVal = select.value || currentVal;
                select.innerHTML = '<option value="">(Select button)</option>';
                for (let i = 0; i < gp.buttons.length; i++) {
                    const opt = document.createElement('option');
                    opt.value = String(i);
                    opt.textContent = `Button ${i}`;
                    if (String(i) === prevVal) opt.selected = true;
                    select.appendChild(opt);
                }
                return true;
            };

            // Show saved value immediately
            populateButtons();

            // Re-populate when controller dropdown changes
            const gpDeviceSelect = this.#container.querySelector('.dp-gamepad-device');
            if (gpDeviceSelect) {
                gpDeviceSelect.addEventListener('change', () => populateButtons());
            }

            // Poll on interaction and on gamepad connect
            let polling = false;
            select.addEventListener('mousedown', () => {
                if (!polling) {
                    polling = true;
                    const pollInterval = setInterval(() => {
                        if (!select.isConnected) { clearInterval(pollInterval); return; }
                        populateButtons();
                    }, 500);
                }
            });

            window.addEventListener('gamepadconnected', () => populateButtons());

            select.addEventListener('change', () => {
                EditorState.updateModuleSetting(id, key, select.value ? parseInt(select.value) : 0);
            });
        });
    }

    #bindEvents(id, mod) {
        // Module ID rename
        const idInput = document.getElementById('prop-module-id');
        if (idInput) {
            idInput.addEventListener('change', () => {
                const newId = idInput.value.trim();
                if (newId && newId !== id) {
                    if (EditorState.renameModule(id, newId)) {
                        // Re-render with new id
                        this.render();
                    } else {
                        idInput.value = id; // revert
                    }
                }
            });
        }

        // Area inputs
        const areaMap = { 'area-x': 'x', 'area-y': 'y', 'area-w': 'width', 'area-h': 'height' };
        Object.entries(areaMap).forEach(([prop, key]) => {
            const input = this.#container.querySelector(`[data-prop="${prop}"]`);
            if (input) {
                input.addEventListener('change', () => {
                    EditorState.updateModuleArea(id, { [key]: parseFloat(input.value) || 0 });
                });
            }
        });

        // Settings inputs
        this.#container.querySelectorAll('[data-prop^="setting-"]').forEach(input => {
            const key = input.dataset.prop.replace('setting-', '');
            const handler = () => {
                let value;
                if (input.type === 'checkbox') value = input.checked;
                else if (input.type === 'number') value = parseFloat(input.value);
                else value = input.value;
                EditorState.updateModuleSetting(id, key, value);
            };
            input.addEventListener('change', handler);
        });

        // Media pickers — use in-app media panel
        const pickImage = document.getElementById('btn-pick-image');
        if (pickImage) {
            pickImage.addEventListener('click', () => {
                if (window.mediaPanel) {
                    window.mediaPanel.startSelection('image', (mediaPath) => {
                        EditorState.updateModuleSetting(id, 'src', mediaPath);
                        this.render();
                    });
                }
            });
        }

        const pickVideo = document.getElementById('btn-pick-video');
        if (pickVideo) {
            pickVideo.addEventListener('click', () => {
                if (window.mediaPanel) {
                    window.mediaPanel.startSelection('video', (mediaPath) => {
                        EditorState.updateModuleSetting(id, 'src', mediaPath);
                        this.render();
                    });
                }
            });
        }

        // Delete
        const deleteBtn = document.getElementById('btn-delete-module');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                EditorState.removeModuleFromScene(id);
            });
        }

        // Module settings button
        const settingsBtn = document.getElementById('btn-module-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                const tab = settingsBtn.dataset.tab;
                // Use the settings panel's open method, then switch to the right tab
                if (window.settingsPanel) {
                    window.settingsPanel.openTo(tab);
                } else {
                    // Fallback: open overlay and click tab
                    const settingsOverlay = document.getElementById('settings-overlay');
                    if (settingsOverlay) {
                        settingsOverlay.style.display = 'flex';
                        const tabBtn = settingsOverlay.querySelector(`.settings-tab[data-tab="${tab}"]`);
                        if (tabBtn) tabBtn.click();
                    }
                }
            });
        }
    }
}
