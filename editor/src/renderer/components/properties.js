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

        // Type-specific settings
        if (mod.type === 'image') {
            html += this.#imageProps(mod);
        } else if (mod.type === 'video') {
            html += this.#videoProps(mod);
        } else if (mod.type === 'webcam') {
            html += this.#webcamProps(mod);
        } else if (mod.type === 'audiovisualiser') {
            html += this.#audioVisualiserProps(mod);
        } else if (mod.type === 'pngtuber') {
            html += this.#pngtuberProps(mod);
        }

        // Transition (scene-level)
        if (EditorState.activeScene && EditorState.scenes[EditorState.activeScene]) {
            const scene = EditorState.scenes[EditorState.activeScene];
            html += `<div class="prop-group">`;
            html += `<div class="prop-group-title">Scene Settings</div>`;
            html += `<div class="prop-row"><label>OBS Scene</label><input type="text" data-prop="obs-scene" value="${scene.obsScene || ''}" placeholder="OBS scene name"></div>`;
            html += `<div class="prop-row"><label>Type</label>`;
            html += `<select id="prop-transition-type">`;
            html += `<option value="fade" ${scene.transition?.type === 'fade' ? 'selected' : ''}>Fade</option>`;
            html += `<option value="none" ${scene.transition?.type === 'none' ? 'selected' : ''}>None</option>`;
            html += `</select></div>`;
            html += this.#numRow('Duration', 'transition-dur', scene.transition?.duration || 0.5, 0.1, 0, 5);
            html += `</div>`;
        }

        // Module settings button (opens settings panel to the relevant tab)
        // Dynamic: show button if the module has hasSettings in its registry info
        const modInfo = window.ModuleRegistry?.modules?.find(m => m.name === mod.type);
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

    #imageProps(mod) {
        let html = `<div class="prop-group">`;
        html += `<div class="prop-group-title">Image Settings</div>`;
        html += `<div class="prop-row"><label>Source</label><button id="btn-pick-image">Browse...</button></div>`;
        if (mod.settings.src) {
            html += `<div class="prop-row"><label></label><span style="font-size:11px;color:var(--text-secondary);word-break:break-all;">${mod.settings.src.split(/[/\\]/).pop()}</span></div>`;
        }
        html += `<div class="prop-row"><label>Opacity</label><input type="number" data-prop="setting-opacity" value="${mod.settings.opacity ?? 1}" step="0.1" min="0" max="1"></div>`;
        html += `<div class="prop-row"><label>Fit</label><select data-prop="setting-objectFit">`;
        ['contain', 'cover', 'fill', 'none'].forEach(v => {
            html += `<option value="${v}" ${mod.settings.objectFit === v ? 'selected' : ''}>${v}</option>`;
        });
        html += `</select></div>`;
        html += `</div>`;
        return html;
    }

    #videoProps(mod) {
        let html = `<div class="prop-group">`;
        html += `<div class="prop-group-title">Video Settings</div>`;
        html += `<div class="prop-row"><label>Source</label><button id="btn-pick-video">Browse...</button></div>`;
        if (mod.settings.src) {
            html += `<div class="prop-row"><label></label><span style="font-size:11px;color:var(--text-secondary);word-break:break-all;">${mod.settings.src.split(/[/\\]/).pop()}</span></div>`;
        }
        html += `<div class="prop-row"><label>Loop</label><input type="checkbox" data-prop="setting-loop" ${mod.settings.loop ? 'checked' : ''}></div>`;
        html += `<div class="prop-row"><label>Muted</label><input type="checkbox" data-prop="setting-muted" ${mod.settings.muted ? 'checked' : ''}></div>`;
        html += `<div class="prop-row"><label>Opacity</label><input type="number" data-prop="setting-opacity" value="${mod.settings.opacity ?? 1}" step="0.1" min="0" max="1"></div>`;
        html += `<div class="prop-row"><label>Fit</label><select data-prop="setting-objectFit">`;
        ['contain', 'cover', 'fill', 'none'].forEach(v => {
            html += `<option value="${v}" ${mod.settings.objectFit === v ? 'selected' : ''}>${v}</option>`;
        });
        html += `</select></div>`;
        html += `</div>`;
        return html;
    }

    #webcamProps(mod) {
        const settings = mod.settings || {};
        let html = `<div class="prop-group">`;
        html += `<div class="prop-group-title">Webcam Settings</div>`;
        html += `<div class="prop-row"><label>Device</label><select id="prop-webcam-device"><option value="">Loading cameras...</option></select></div>`;
        html += `<div class="prop-row"><label>Mirror</label><input type="checkbox" id="prop-webcam-mirror" ${settings.mirror ? 'checked' : ''}></div>`;
        html += `<div class="prop-row"><label>Mask</label><select id="prop-webcam-mask">`;
        ['none', 'circle', 'rounded'].forEach(v => {
            html += `<option value="${v}" ${settings.mask === v ? 'selected' : ''}>${v}</option>`;
        });
        html += `</select></div>`;
        html += `<div class="prop-row"><label>Border Radius</label><input type="text" id="prop-webcam-borderRadius" value="${settings.borderRadius || '0'}" placeholder="e.g. 16px"></div>`;
        html += `</div>`;

        // Chroma Key settings
        html += `<div class="prop-group">`;
        html += `<div class="prop-group-title">Chroma Key</div>`;
        html += `<div class="prop-row"><label>Enabled</label><input type="checkbox" id="prop-webcam-chromaKey" ${settings.chromaKey ? 'checked' : ''}></div>`;
        html += `<div id="prop-chromakey-options" style="${settings.chromaKey ? '' : 'display:none'}">`;
        html += `<div class="prop-row"><label>Key Color</label><div class="cp-placeholder" id="prop-webcam-chromaKeyColor-cp" data-cp-field="chromaKeyColor" data-cp-value="${settings.chromaKeyColor || '#00ff00'}"></div></div>`;
        html += `<div class="prop-row"><label>Similarity</label><input type="range" id="prop-webcam-chromaKeySimilarity" min="0" max="1" step="0.01" value="${settings.chromaKeySimilarity ?? 0.4}"><span id="prop-chromakey-sim-val">${settings.chromaKeySimilarity ?? 0.4}</span></div>`;
        html += `<div class="prop-row"><label>Smoothness</label><input type="range" id="prop-webcam-chromaKeySmoothness" min="0" max="1" step="0.01" value="${settings.chromaKeySmoothness ?? 0.08}"><span id="prop-chromakey-smooth-val">${settings.chromaKeySmoothness ?? 0.08}</span></div>`;
        html += `<div class="prop-row"><label>Spill</label><input type="range" id="prop-webcam-chromaKeySpill" min="0" max="1" step="0.01" value="${settings.chromaKeySpill ?? 0.1}"><span id="prop-chromakey-spill-val">${settings.chromaKeySpill ?? 0.1}</span></div>`;
        html += `</div>`;
        html += `</div>`;

        // Enumerate cameras and bind events after render
        setTimeout(() => this.#populateWebcamDevices(settings), 0);
        setTimeout(() => this.#bindWebcamEvents(), 0);

        return html;
    }

    #bindWebcamEvents() {
        const id = EditorState.selectedModule;
        const mirrorEl = document.getElementById('prop-webcam-mirror');
        const maskEl = document.getElementById('prop-webcam-mask');
        const radiusEl = document.getElementById('prop-webcam-borderRadius');
        const chromaKeyEl = document.getElementById('prop-webcam-chromaKey');
        const chromaOptionsEl = document.getElementById('prop-chromakey-options');
        const simEl = document.getElementById('prop-webcam-chromaKeySimilarity');
        const smoothEl = document.getElementById('prop-webcam-chromaKeySmoothness');
        const spillEl = document.getElementById('prop-webcam-chromaKeySpill');

        if (mirrorEl) {
            mirrorEl.addEventListener('change', () => {
                EditorState.updateModuleSetting(id, 'mirror', mirrorEl.checked);
            });
        }
        if (maskEl) {
            maskEl.addEventListener('change', () => {
                EditorState.updateModuleSetting(id, 'mask', maskEl.value);
            });
        }
        if (radiusEl) {
            radiusEl.addEventListener('change', () => {
                EditorState.updateModuleSetting(id, 'borderRadius', radiusEl.value);
            });
        }
        if (chromaKeyEl) {
            chromaKeyEl.addEventListener('change', () => {
                EditorState.updateModuleSetting(id, 'chromaKey', chromaKeyEl.checked);
                if (chromaOptionsEl) chromaOptionsEl.style.display = chromaKeyEl.checked ? '' : 'none';
            });
        }
        if (simEl) {
            simEl.addEventListener('input', () => {
                document.getElementById('prop-chromakey-sim-val').textContent = simEl.value;
                EditorState.updateModuleSetting(id, 'chromaKeySimilarity', parseFloat(simEl.value));
            });
        }
        if (smoothEl) {
            smoothEl.addEventListener('input', () => {
                document.getElementById('prop-chromakey-smooth-val').textContent = smoothEl.value;
                EditorState.updateModuleSetting(id, 'chromaKeySmoothness', parseFloat(smoothEl.value));
            });
        }
        if (spillEl) {
            spillEl.addEventListener('input', () => {
                document.getElementById('prop-chromakey-spill-val').textContent = spillEl.value;
                EditorState.updateModuleSetting(id, 'chromaKeySpill', parseFloat(spillEl.value));
            });
        }

        // Color picker for chroma key color
        const cpEl = document.getElementById('prop-webcam-chromaKeyColor-cp');
        if (cpEl) {
            const currentColor = cpEl.dataset.cpValue || '#00ff00';
            const swatch = ColorPicker.create(currentColor, (hex) => {
                EditorState.updateModuleSetting(id, 'chromaKeyColor', hex);
            });
            cpEl.innerHTML = '';
            cpEl.appendChild(swatch);
        }
    }

    async #populateWebcamDevices(settings) {
        const select = document.getElementById('prop-webcam-device');
        if (!select) return;

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(d => d.kind === 'videoinput');

            if (cameras.length === 0) {
                select.innerHTML = '<option value="">(No cameras found)</option>';
                return;
            }

            select.innerHTML = '';

            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = '(Default camera)';
            select.appendChild(defaultOpt);

            cameras.forEach(cam => {
                const opt = document.createElement('option');
                opt.value = cam.label || cam.deviceId;
                opt.textContent = cam.label || `Camera ${cam.deviceId.slice(0, 8)}`;
                if ((cam.label || cam.deviceId) === (settings.device || '')) opt.selected = true;
                select.appendChild(opt);
            });

            select.addEventListener('change', () => {
                EditorState.updateModuleSetting(EditorState.selectedModule, 'device', select.value);
            });
        } catch (e) {
            select.innerHTML = '<option value="">(Camera access denied)</option>';
        }
    }

    #audioVisualiserProps(mod) {
        const settings = mod.settings || {};
        let html = `<div class="prop-group">`;
        html += `<div class="prop-group-title">Audio Visualiser Settings</div>`;
        html += `<div class="prop-row"><label>Device</label><select id="prop-av-device"><option value="">Loading...</option></select></div>`;
        html += `<div class="prop-row"><label>Direction</label><select id="prop-av-direction">`;
        ['right-left', 'left-right', 'top-down', 'bottom-up'].forEach(v => {
            html += `<option value="${v}" ${settings.direction === v ? 'selected' : ''}>${v}</option>`;
        });
        html += `</select></div>`;
        html += `<div class="prop-row"><label>Mirrored</label><input type="checkbox" id="prop-av-mirrored" ${settings.mirrored ? 'checked' : ''}></div>`;
        html += `<div class="prop-row"><label>Bar Width</label><input type="number" id="prop-av-barWidth" value="${settings.barWidth || 5}" min="1" max="50"></div>`;
        html += `<div class="prop-row"><label>Bar Spacing</label><input type="number" id="prop-av-barSpacing" value="${settings.barSpacing || 2}" min="0" max="20"></div>`;
        html += `</div>`;

        setTimeout(() => this.#bindAudioVisualiserEvents(), 0);
        setTimeout(() => this.#populateAudioDevicesForAV(settings), 0);

        return html;
    }

    #bindAudioVisualiserEvents() {
        const id = EditorState.selectedModule;

        const dirEl = document.getElementById('prop-av-direction');
        const mirrorEl = document.getElementById('prop-av-mirrored');
        const barWEl = document.getElementById('prop-av-barWidth');
        const barSEl = document.getElementById('prop-av-barSpacing');

        if (dirEl) dirEl.addEventListener('change', () => EditorState.updateModuleSetting(id, 'direction', dirEl.value));
        if (mirrorEl) mirrorEl.addEventListener('change', () => EditorState.updateModuleSetting(id, 'mirrored', mirrorEl.checked));
        if (barWEl) barWEl.addEventListener('change', () => EditorState.updateModuleSetting(id, 'barWidth', parseInt(barWEl.value) || 5));
        if (barSEl) barSEl.addEventListener('change', () => EditorState.updateModuleSetting(id, 'barSpacing', parseInt(barSEl.value) || 2));
    }

    async #populateAudioDevicesForAV(settings) {
        const select = document.getElementById('prop-av-device');
        if (!select) return;

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(d => d.kind === 'audioinput');

            select.innerHTML = '';
            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = '(Default / Global)';
            select.appendChild(defaultOpt);

            audioInputs.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.label || d.deviceId;
                opt.textContent = d.label || `Device ${d.deviceId.slice(0, 8)}`;
                if ((d.label || d.deviceId) === (settings.device || '')) opt.selected = true;
                select.appendChild(opt);
            });

            select.addEventListener('change', () => {
                EditorState.updateModuleSetting(EditorState.selectedModule, 'device', select.value);
            });
        } catch (e) {
            select.innerHTML = '<option value="">(No devices found)</option>';
        }
    }

    #pngtuberProps(mod) {
        const settings = mod.settings || {};
        let html = `<div class="prop-group">`;
        html += `<div class="prop-group-title">PNGTuber Settings</div>`;
        html += `<div class="prop-row"><label>Audio Device</label><select id="prop-pt-device"><option value="">Loading...</option></select></div>`;
        html += `<div class="prop-row"><label>Threshold</label><input type="number" id="prop-pt-threshold" value="${settings.threshold ?? 30}" min="0" max="255"></div>`;
        html += `<div class="prop-row"><label>Hold Time (ms)</label><input type="number" id="prop-pt-holdTime" value="${settings.holdTime ?? 200}" min="0" max="2000"></div>`;
        html += `<div class="prop-row"><label>Freq Min (Hz)</label><input type="number" id="prop-pt-freqMin" value="${settings.frequencyMin ?? 85}" min="20" max="2000"></div>`;
        html += `<div class="prop-row"><label>Freq Max (Hz)</label><input type="number" id="prop-pt-freqMax" value="${settings.frequencyMax ?? 300}" min="20" max="2000"></div>`;
        html += `</div>`;

        html += `<div class="prop-group">`;
        html += `<div class="prop-group-title">Images</div>`;
        html += `<div class="prop-row"><label>Idle</label><button id="btn-pick-pt-idle">Browse...</button></div>`;
        if (settings.idleImage) {
            html += `<div class="prop-row"><label></label><span style="font-size:11px;color:var(--text-secondary);word-break:break-all;">${settings.idleImage.split(/[/\\]/).pop()}</span></div>`;
        }
        html += `<div class="prop-row"><label>Talking</label><button id="btn-pick-pt-talking">Browse...</button></div>`;
        if (settings.talkingImage) {
            html += `<div class="prop-row"><label></label><span style="font-size:11px;color:var(--text-secondary);word-break:break-all;">${settings.talkingImage.split(/[/\\]/).pop()}</span></div>`;
        }
        html += `<div class="prop-row"><label>Blink</label><button id="btn-pick-pt-blink">Browse...</button></div>`;
        if (settings.blinkImage) {
            html += `<div class="prop-row"><label></label><span style="font-size:11px;color:var(--text-secondary);word-break:break-all;">${settings.blinkImage.split(/[/\\]/).pop()}</span></div>`;
        }
        html += `</div>`;

        html += `<div class="prop-group">`;
        html += `<div class="prop-group-title">Animation</div>`;
        html += `<div class="prop-row"><label>Blink Interval (s)</label><input type="number" id="prop-pt-blinkInterval" value="${settings.blinkInterval ?? 4}" min="0" max="30" step="0.5"></div>`;
        html += `<div class="prop-row"><label>Blink Duration (ms)</label><input type="number" id="prop-pt-blinkDuration" value="${settings.blinkDuration ?? 150}" min="50" max="1000"></div>`;
        html += `<div class="prop-row"><label>Bounce on Talk</label><input type="checkbox" id="prop-pt-bounce" ${settings.bounce ? 'checked' : ''}></div>`;
        html += `<div class="prop-row"><label>Bounce Pixels</label><input type="number" id="prop-pt-bounceAmount" value="${settings.bounceAmount ?? 5}" min="1" max="50"></div>`;
        html += `</div>`;

        setTimeout(() => this.#bindPNGTuberEvents(), 0);
        setTimeout(() => this.#populateAudioDevicesForPT(settings), 0);

        return html;
    }

    #bindPNGTuberEvents() {
        const id = EditorState.selectedModule;

        const threshEl = document.getElementById('prop-pt-threshold');
        const holdEl = document.getElementById('prop-pt-holdTime');
        const freqMinEl = document.getElementById('prop-pt-freqMin');
        const freqMaxEl = document.getElementById('prop-pt-freqMax');
        const blinkIntEl = document.getElementById('prop-pt-blinkInterval');
        const blinkDurEl = document.getElementById('prop-pt-blinkDuration');
        const bounceEl = document.getElementById('prop-pt-bounce');
        const bounceAmtEl = document.getElementById('prop-pt-bounceAmount');

        if (threshEl) threshEl.addEventListener('change', () => EditorState.updateModuleSetting(id, 'threshold', parseInt(threshEl.value) || 30));
        if (holdEl) holdEl.addEventListener('change', () => EditorState.updateModuleSetting(id, 'holdTime', parseInt(holdEl.value) || 200));
        if (freqMinEl) freqMinEl.addEventListener('change', () => EditorState.updateModuleSetting(id, 'frequencyMin', parseInt(freqMinEl.value) || 85));
        if (freqMaxEl) freqMaxEl.addEventListener('change', () => EditorState.updateModuleSetting(id, 'frequencyMax', parseInt(freqMaxEl.value) || 300));
        if (blinkIntEl) blinkIntEl.addEventListener('change', () => EditorState.updateModuleSetting(id, 'blinkInterval', parseFloat(blinkIntEl.value) || 4));
        if (blinkDurEl) blinkDurEl.addEventListener('change', () => EditorState.updateModuleSetting(id, 'blinkDuration', parseInt(blinkDurEl.value) || 150));
        if (bounceEl) bounceEl.addEventListener('change', () => EditorState.updateModuleSetting(id, 'bounce', bounceEl.checked));
        if (bounceAmtEl) bounceAmtEl.addEventListener('change', () => EditorState.updateModuleSetting(id, 'bounceAmount', parseInt(bounceAmtEl.value) || 5));

        // Image browse buttons
        const pickIdle = document.getElementById('btn-pick-pt-idle');
        const pickTalking = document.getElementById('btn-pick-pt-talking');
        const pickBlink = document.getElementById('btn-pick-pt-blink');

        if (pickIdle) pickIdle.addEventListener('click', () => {
            window.mediaPanel.startSelection('image', (path) => {
                EditorState.updateModuleSetting(id, 'idleImage', path);
                this.render();
            });
        });
        if (pickTalking) pickTalking.addEventListener('click', () => {
            window.mediaPanel.startSelection('image', (path) => {
                EditorState.updateModuleSetting(id, 'talkingImage', path);
                this.render();
            });
        });
        if (pickBlink) pickBlink.addEventListener('click', () => {
            window.mediaPanel.startSelection('image', (path) => {
                EditorState.updateModuleSetting(id, 'blinkImage', path);
                this.render();
            });
        });
    }

    async #populateAudioDevicesForPT(settings) {
        const select = document.getElementById('prop-pt-device');
        if (!select) return;

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(d => d.kind === 'audioinput');

            select.innerHTML = '';
            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = '(Select device)';
            select.appendChild(defaultOpt);

            audioInputs.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.label || d.deviceId;
                opt.textContent = d.label || `Device ${d.deviceId.slice(0, 8)}`;
                if ((d.label || d.deviceId) === (settings.device || '')) opt.selected = true;
                select.appendChild(opt);
            });

            select.addEventListener('change', () => {
                EditorState.updateModuleSetting(EditorState.selectedModule, 'device', select.value);
            });
        } catch (e) {
            select.innerHTML = '<option value="">(No devices found)</option>';
        }
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

        // Transition
        const transType = document.getElementById('prop-transition-type');
        if (transType) {
            transType.addEventListener('change', () => {
                EditorState.scenes[EditorState.activeScene].transition.type = transType.value;
                EditorState.notify('module-settings');
            });
        }
        const transDur = this.#container.querySelector('[data-prop="transition-dur"]');
        if (transDur) {
            transDur.addEventListener('change', () => {
                EditorState.scenes[EditorState.activeScene].transition.duration = parseFloat(transDur.value) || 0.5;
                EditorState.notify('module-settings');
            });
        }

        // OBS Scene name
        const obsSceneInput = this.#container.querySelector('[data-prop="obs-scene"]');
        if (obsSceneInput) {
            obsSceneInput.addEventListener('change', () => {
                EditorState.scenes[EditorState.activeScene].obsScene = obsSceneInput.value || '';
                EditorState.notify('module-settings');
            });
        }

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
