/**
 * TypeRenderer - Generates UI controls based on _type metadata in config objects.
 * 
 * Reads _type (property types), _item_type (sub-object types), and renders
 * appropriate inputs for each property.
 */
class TypeRenderer {
    // Track which CSS editors are in raw mode (survives re-renders)
    static #cssRawModeState = new Map();

    /**
     * Renders a config object into a container using schema metadata.
     * Schema is read from the module registry's info files, falling back to obj._type for legacy.
     * @param {HTMLElement} container - DOM element to render into
     * @param {object} obj - The config object to render
     * @param {string} path - Dot-path to this object in globalConfig (e.g. "chat.ChatBoxes")
     * @param {object} options - { adminMode: bool, onChange: fn, schema: object }
     */
    static render(container, obj, path, options = {}) {
        const { adminMode = false, onChange = () => {}, schema = null } = options;
        const typeMap = schema?._type || obj._type || {};
        const itemTypeMap = schema?._item_type || obj._item_type || {};
        const labelsMap = schema?._labels || obj._labels || {};

        // Helper to get sub-schema for nested objects
        const getSubSchema = (key) => {
            if (schema && schema[key] && typeof schema[key] === 'object' && !Array.isArray(schema[key])) {
                return schema[key];
            }
            return null;
        };

        // Helper to get display label for a key
        const getLabel = (key) => {
            if (labelsMap[key]) return labelsMap[key];
            // Auto-format: camelCase/PascalCase to spaced words
            return key.replace(/([a-z])([A-Z])/g, '$1 $2')
                      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
                      .replace(/^./, c => c.toUpperCase());
        };

        container.innerHTML = '';

        // Admin mode: show raw JSON editor for _type
        if (adminMode) {
            const adminSection = document.createElement('div');
            adminSection.className = 'type-admin-section';

            const adminLabel = document.createElement('div');
            adminLabel.className = 'type-admin-label';
            adminLabel.textContent = '⚙ _type schema';
            adminSection.appendChild(adminLabel);

            const textarea = document.createElement('textarea');
            textarea.className = 'type-admin-textarea';
            textarea.value = JSON.stringify(typeMap, null, 2);
            textarea.rows = Math.max(4, Object.keys(typeMap).length + 2);
            textarea.addEventListener('change', () => {
                try {
                    const parsed = JSON.parse(textarea.value);
                    obj._type = parsed;
                    onChange();
                    textarea.classList.remove('type-admin-error');
                } catch {
                    textarea.classList.add('type-admin-error');
                }
            });
            adminSection.appendChild(textarea);

            if (Object.keys(itemTypeMap).length > 0) {
                const itemLabel = document.createElement('div');
                itemLabel.className = 'type-admin-label';
                itemLabel.textContent = '⚙ _item_type schema';
                adminSection.appendChild(itemLabel);

                const itemTextarea = document.createElement('textarea');
                itemTextarea.className = 'type-admin-textarea';
                itemTextarea.value = JSON.stringify(itemTypeMap, null, 2);
                itemTextarea.rows = Math.max(3, Object.keys(itemTypeMap).length + 2);
                itemTextarea.addEventListener('change', () => {
                    try {
                        const parsed = JSON.parse(itemTextarea.value);
                        obj._item_type = parsed;
                        onChange();
                        itemTextarea.classList.remove('type-admin-error');
                    } catch {
                        itemTextarea.classList.add('type-admin-error');
                    }
                });
                adminSection.appendChild(itemTextarea);
            }

            container.appendChild(adminSection);
        }

        // Render typed properties
        // Collect all keys: from the schema (if provided) or from the object
        const allKeys = new Set();
        if (schema) {
            // When schema is provided, only render keys defined in the schema
            for (const key of Object.keys(typeMap)) allKeys.add(key);
            for (const key of Object.keys(itemTypeMap)) allKeys.add(key);
        } else {
            // No schema — render all object keys + any from legacy _type
            for (const key of Object.keys(obj)) allKeys.add(key);
            for (const key of Object.keys(typeMap)) allKeys.add(key);
        }

        for (const key of allKeys) {
            if (key.startsWith('_')) continue; // Skip metadata

            const value = obj[key];
            const typeDef = typeMap[key];
            const itemType = itemTypeMap[key];

            // Conditional visibility: check showWhen on the type definition
            if (typeDef && typeof typeDef === 'object' && typeDef.showWhen) {
                const { field, value: expected } = typeDef.showWhen;
                if (obj[field] !== expected) continue;
            }
            // Also check showWhen on _item_type entries (for sub-objects)
            const keySubSchema = getSubSchema(key);
            if (keySubSchema && keySubSchema.showWhen) {
                const { field, value: expected } = keySubSchema.showWhen;
                if (obj[field] !== expected) continue;
            }

            const fullPath = path ? `${path}.${key}` : key;

            if (typeDef) {
                // Has explicit type definition — initialize default if missing
                if (value === undefined) {
                    const type = typeof typeDef === 'string' ? typeDef : typeDef.type;
                    if (type === 'gradient') obj[key] = { stops: [] };
                    else if (type === 'bool') obj[key] = false;
                    else if (type === 'number') obj[key] = 0;
                    else if (type === 'string' || type === 'color' || type === 'audioDevice') obj[key] = '';
                }
                // Pass display label from _labels if available
                const displayLabel = labelsMap[key] || null;
                const row = TypeRenderer.#createInput(key, obj[key], typeDef, fullPath, obj, onChange, displayLabel);
                if (row) container.appendChild(row);
            } else if (itemType === 'css') {
                // CSS key-value editor
                const section = TypeRenderer.#createCssEditor(key, value, fullPath, obj, onChange);
                container.appendChild(section);
            } else if (itemType === 'object' || (typeof value === 'object' && value !== null && !Array.isArray(value))) {
                // Sub-object — render recursively in a collapsible group
                const subSchema = getSubSchema(key);
                const group = TypeRenderer.#createObjectGroup(key, value, fullPath, { ...options, schema: subSchema });
                container.appendChild(group);
            } else if (Array.isArray(value)) {
                // Array without explicit type — render as string list
                const section = TypeRenderer.#createArrayEditor(key, value, fullPath, obj, onChange);
                container.appendChild(section);
            } else if (!typeDef && !itemType) {
                // Unknown type — render as text input
                const row = TypeRenderer.#createInput(key, value, TypeRenderer.#inferType(value), fullPath, obj, onChange);
                if (row) container.appendChild(row);
            }
        }
    }

    static #formatLabel(key) {
        // Convert camelCase/PascalCase to spaced title case
        return key.replace(/([a-z])([A-Z])/g, '$1 $2')
                  .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
                  .replace(/^./, c => c.toUpperCase());
    }

    static #inferType(value) {
        if (typeof value === 'boolean') return 'bool';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'string') {
            if (/^#[0-9a-fA-F]{6}$/.test(value)) return 'color';
            return 'string';
        }
        return 'string';
    }

    static #createInput(key, value, typeDef, fullPath, obj, onChange, displayLabel) {
        const row = document.createElement('div');
        row.className = 'tr-row';

        const label = document.createElement('label');
        label.textContent = displayLabel?.label || displayLabel || TypeRenderer.#formatLabel(key);
        if (displayLabel?.tooltip) {
            label.style.cursor = 'help';
            label.style.textDecoration = 'underline dotted';

            const tip = document.createElement('div');
            tip.className = 'tr-tooltip';
            tip.textContent = displayLabel.tooltip;
            document.body.appendChild(tip);

            label.addEventListener('mouseenter', (e) => {
                const rect = label.getBoundingClientRect();
                tip.style.display = 'block';
                tip.style.left = rect.left + 'px';
                tip.style.top = (rect.top - tip.offsetHeight - 4) + 'px';
            });
            label.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
        }
        row.appendChild(label);

        const type = typeof typeDef === 'string' ? typeDef : typeDef.type;

        switch (type) {
            case 'bool': {
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = !!value;
                input.addEventListener('change', () => {
                    obj[key] = input.checked;
                    onChange();
                });
                row.appendChild(input);
                break;
            }
            case 'number': {
                const input = document.createElement('input');
                input.type = 'number';
                input.value = value ?? 0;
                if (typeDef.min !== undefined) input.min = typeDef.min;
                if (typeDef.max !== undefined) input.max = typeDef.max;
                if (typeDef.step !== undefined) input.step = typeDef.step;
                input.addEventListener('change', () => {
                    obj[key] = parseFloat(input.value);
                    onChange();
                });
                row.appendChild(input);
                break;
            }
            case 'string': {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = value ?? '';
                input.addEventListener('change', () => {
                    obj[key] = input.value;
                    onChange();
                });
                row.appendChild(input);
                break;
            }
            case 'audioDevice': {
                const select = document.createElement('select');
                select.innerHTML = '<option value="">Loading...</option>';
                row.appendChild(select);
                // Populate async
                navigator.mediaDevices.enumerateDevices().then(devices => {
                    const inputs = devices.filter(d => d.kind === 'audioinput');
                    select.innerHTML = '';
                    const none = document.createElement('option');
                    none.value = '';
                    none.textContent = '(None)';
                    select.appendChild(none);
                    inputs.forEach(d => {
                        const opt = document.createElement('option');
                        opt.value = d.label || d.deviceId;
                        opt.textContent = d.label || `Device ${d.deviceId.slice(0, 8)}`;
                        if ((d.label || d.deviceId) === value) opt.selected = true;
                        select.appendChild(opt);
                    });
                }).catch(() => {
                    select.innerHTML = '<option value="">(No devices found)</option>';
                });
                select.addEventListener('change', () => {
                    obj[key] = select.value;
                    onChange();
                });
                break;
            }
            case 'sceneSelect': {
                const select = document.createElement('select');
                const scenes = typeof EditorState !== 'undefined' ? Object.keys(EditorState.scenes) : [];
                scenes.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.textContent = s;
                    if (s === value) opt.selected = true;
                    select.appendChild(opt);
                });
                select.addEventListener('change', () => {
                    obj[key] = select.value;
                    onChange();
                });
                row.appendChild(select);
                break;
            }
            case 'color': {
                const swatch = ColorPicker.create(value || '#ffffff', (hex) => {
                    obj[key] = hex;
                    onChange();
                });
                row.appendChild(swatch);
                break;
            }
            case 'select': {
                const select = document.createElement('select');
                (typeDef.options || []).forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    if (opt === value) option.selected = true;
                    select.appendChild(option);
                });
                select.addEventListener('change', () => {
                    obj[key] = select.value;
                    onChange();
                });
                row.appendChild(select);
                break;
            }
            case 'range': {
                const input = document.createElement('input');
                input.type = 'range';
                input.min = typeDef.min ?? 0;
                input.max = typeDef.max ?? 100;
                input.step = typeDef.step ?? 1;
                input.value = value ?? 0;
                const valLabel = document.createElement('span');
                valLabel.className = 'tr-range-val';
                valLabel.textContent = value;
                input.addEventListener('input', () => {
                    valLabel.textContent = input.value;
                    obj[key] = parseFloat(input.value);
                    onChange();
                });
                row.appendChild(input);
                row.appendChild(valLabel);
                break;
            }
            case 'array': {
                // Render inline for simple arrays
                return TypeRenderer.#createArrayEditor(key, value || [], fullPath, obj, onChange);
            }
            case 'gradient': {
                // Gradient stops editor with preview bar
                const wrapper = document.createElement('div');
                wrapper.className = 'tr-gradient-wrapper';

                const stops = value?.stops || [];
                const previewBar = document.createElement('div');
                previewBar.className = 'gradient-preview-bar';
                previewBar.style.height = '20px';
                previewBar.style.borderRadius = '4px';
                previewBar.style.marginBottom = '6px';
                if (stops.length > 0) {
                    const css = stops.map(s => `${s.color} ${s.position * 100}%`).join(', ');
                    previewBar.style.background = `linear-gradient(to right, ${css})`;
                } else {
                    previewBar.style.background = '#333';
                }
                wrapper.appendChild(previewBar);

                const editBtn = document.createElement('button');
                editBtn.className = 'gradient-edit-btn';
                editBtn.textContent = '🎨 Edit Gradient';
                editBtn.addEventListener('click', () => {
                    TypeRenderer.#openGradientEditor(obj, key, () => {
                        // Update preview after edit
                        const newStops = obj[key]?.stops || [];
                        if (newStops.length > 0) {
                            const css = newStops.map(s => `${s.color} ${s.position * 100}%`).join(', ');
                            previewBar.style.background = `linear-gradient(to right, ${css})`;
                        }
                        onChange();
                    });
                });
                wrapper.appendChild(editBtn);

                row.appendChild(wrapper);
                break;
            }
            default: {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = JSON.stringify(value);
                input.addEventListener('change', () => {
                    try { obj[key] = JSON.parse(input.value); } catch { obj[key] = input.value; }
                    onChange();
                });
                row.appendChild(input);
            }
        }

        return row;
    }

    static #createObjectGroup(key, value, fullPath, options) {
        const group = document.createElement('div');
        group.className = 'tr-group';

        const header = document.createElement('div');
        header.className = 'tr-group-header';
        header.textContent = key;
        header.addEventListener('click', () => {
            content.classList.toggle('collapsed');
            header.classList.toggle('collapsed');
        });
        group.appendChild(header);

        const content = document.createElement('div');
        content.className = 'tr-group-content';

        // Wrap onChange to re-render this group when values change
        const originalOnChange = options.onChange || (() => {});
        const groupOptions = {
            ...options,
            onChange: () => {
                originalOnChange();
                // Re-render this group's content to reflect conditional visibility
                TypeRenderer.render(content, value, fullPath, groupOptions);
            }
        };

        TypeRenderer.render(content, value, fullPath, groupOptions);
        group.appendChild(content);

        return group;
    }

    static #createCssEditor(key, value, fullPath, parentObj, onChange) {
        const section = document.createElement('div');
        section.className = 'tr-css-section';

        const header = document.createElement('div');
        header.className = 'tr-group-header tr-css-header';

        const headerLabel = document.createElement('span');
        headerLabel.textContent = `${key} (CSS)`;
        header.appendChild(headerLabel);

        const modeToggle = document.createElement('button');
        modeToggle.className = 'tr-css-mode-toggle';
        modeToggle.textContent = '{ }';
        modeToggle.title = 'Toggle raw CSS mode';
        header.appendChild(modeToggle);

        section.appendChild(header);

        const list = document.createElement('div');
        list.className = 'tr-css-list';

        const rawEditor = document.createElement('div');
        rawEditor.className = 'tr-css-raw';
        rawEditor.style.display = 'none';

        const textarea = document.createElement('textarea');
        textarea.className = 'tr-css-textarea';
        textarea.spellcheck = false;
        textarea.placeholder = 'font-size: 14px;\nbackground: rgba(0,0,0,0.5);\nborder-radius: 8px;';
        rawEditor.appendChild(textarea);

        const rawStatus = document.createElement('div');
        rawStatus.className = 'tr-css-raw-status';
        rawEditor.appendChild(rawStatus);

        let rawMode = false;

        // Persist raw mode state across re-renders using a static Map keyed by path
        const rawModeKey = `${fullPath}.${key}`;
        if (TypeRenderer.#cssRawModeState.get(rawModeKey)) {
            rawMode = true;
        }

        // Convert object to CSS text
        const objToCss = (obj) => {
            return Object.entries(obj || {}).map(([p, v]) => `${p}: ${v};`).join('\n');
        };

        // Parse CSS text back to object
        const cssToObj = (text) => {
            const result = {};
            const lines = text.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('/*') || trimmed.startsWith('//')) continue;
                // Find the first colon that separates property from value
                const colonIdx = trimmed.indexOf(':');
                if (colonIdx === -1) continue;
                const prop = trimmed.substring(0, colonIdx).trim();
                let val = trimmed.substring(colonIdx + 1).trim();
                // Remove trailing semicolon
                if (val.endsWith(';')) val = val.slice(0, -1).trim();
                if (prop) result[prop] = val;
            }
            return result;
        };

        const switchToRaw = () => {
            textarea.value = objToCss(value);
            list.style.display = 'none';
            rawEditor.style.display = '';
            modeToggle.classList.add('active');
            modeToggle.title = 'Switch to property editor';
            rawStatus.textContent = '';
        };

        const switchToProperties = () => {
            list.style.display = '';
            rawEditor.style.display = 'none';
            modeToggle.classList.remove('active');
            modeToggle.title = 'Toggle raw CSS mode';
            renderList();
        };

        modeToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            rawMode = !rawMode;
            TypeRenderer.#cssRawModeState.set(rawModeKey, rawMode);
            if (rawMode) {
                switchToRaw();
            } else {
                switchToProperties();
            }
        });

        // Apply raw CSS on change — only when Save is clicked
        const saveBtn = document.createElement('button');
        saveBtn.className = 'tr-css-save-btn';
        saveBtn.textContent = '💾 Save CSS';
        saveBtn.addEventListener('click', () => {
            try {
                const parsed = cssToObj(textarea.value);
                // Clear existing keys and apply parsed
                for (const k of Object.keys(value)) delete value[k];
                Object.assign(value, parsed);
                parentObj[key] = value;
                rawStatus.textContent = `✓ ${Object.keys(parsed).length} properties saved`;
                rawStatus.className = 'tr-css-raw-status success';
                onChange();
            } catch (err) {
                rawStatus.textContent = '⚠ Parse error';
                rawStatus.className = 'tr-css-raw-status error';
            }
        });
        rawEditor.appendChild(saveBtn);

        const renderList = () => {
            list.innerHTML = '';
            const entries = Object.entries(value || {});
            entries.forEach(([prop, val]) => {
                const row = document.createElement('div');
                row.className = 'tr-css-row';

                const propInput = document.createElement('input');
                propInput.type = 'text';
                propInput.value = prop;
                propInput.className = 'tr-css-prop';

                const valInput = document.createElement('input');
                valInput.type = 'text';
                valInput.value = val;
                valInput.className = 'tr-css-val';

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'tr-css-delete';
                deleteBtn.textContent = '✕';

                propInput.addEventListener('change', () => {
                    delete value[prop];
                    if (propInput.value.trim()) {
                        value[propInput.value.trim()] = valInput.value;
                    }
                    parentObj[key] = value;
                    onChange();
                    renderList();
                });

                valInput.addEventListener('change', () => {
                    value[prop] = valInput.value;
                    parentObj[key] = value;
                    onChange();
                });

                deleteBtn.addEventListener('click', () => {
                    delete value[prop];
                    parentObj[key] = value;
                    onChange();
                    renderList();
                });

                row.appendChild(propInput);
                row.appendChild(valInput);
                row.appendChild(deleteBtn);
                list.appendChild(row);
            });

            // Add row
            const addRow = document.createElement('div');
            addRow.className = 'tr-css-add';
            const addBtn = document.createElement('button');
            addBtn.textContent = '+ Add Property';
            addBtn.addEventListener('click', () => {
                value['new-property'] = '';
                parentObj[key] = value;
                onChange();
                renderList();
            });
            addRow.appendChild(addBtn);
            list.appendChild(addRow);
        };

        renderList();
        section.appendChild(list);
        section.appendChild(rawEditor);

        // If raw mode was active before re-render, restore it
        if (rawMode) {
            switchToRaw();
        }

        return section;
    }

    static #createArrayEditor(key, value, fullPath, parentObj, onChange) {
        const section = document.createElement('div');
        section.className = 'tr-array-section';

        const header = document.createElement('div');
        header.className = 'tr-group-header';
        header.textContent = key;
        section.appendChild(header);

        const list = document.createElement('div');
        list.className = 'tr-array-list';

        const renderList = () => {
            list.innerHTML = '';
            value.forEach((item, i) => {
                const row = document.createElement('div');
                row.className = 'tr-array-row';

                const input = document.createElement('input');
                input.type = 'text';
                input.value = item;
                input.addEventListener('change', () => {
                    value[i] = input.value;
                    parentObj[key] = value;
                    onChange();
                });

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'tr-array-delete';
                deleteBtn.textContent = '✕';
                deleteBtn.addEventListener('click', () => {
                    value.splice(i, 1);
                    parentObj[key] = value;
                    onChange();
                    renderList();
                });

                row.appendChild(input);
                row.appendChild(deleteBtn);
                list.appendChild(row);
            });

            const addRow = document.createElement('div');
            addRow.className = 'tr-array-add';
            const addInput = document.createElement('input');
            addInput.type = 'text';
            addInput.placeholder = 'New item...';
            const addBtn = document.createElement('button');
            addBtn.textContent = '+';
            addBtn.addEventListener('click', () => {
                if (addInput.value.trim()) {
                    value.push(addInput.value.trim());
                    parentObj[key] = value;
                    onChange();
                    renderList();
                }
            });
            addInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') addBtn.click();
            });
            addRow.appendChild(addInput);
            addRow.appendChild(addBtn);
            list.appendChild(addRow);
        };

        renderList();
        section.appendChild(list);
        return section;
    }

    static #openGradientEditor(obj, key, onSave) {
        if (!obj[key]) obj[key] = { stops: [] };

        let editStops = JSON.parse(JSON.stringify(obj[key].stops || []));
        if (editStops.length === 0) {
            editStops = [
                { position: 0, color: '#0000ff' },
                { position: 1, color: '#ff00ff' }
            ];
        }

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

        const updatePreview = () => {
            const preview = overlay.querySelector('#gradient-editor-preview');
            if (editStops.length > 0) {
                const css = editStops.map(s => `${s.color} ${s.position * 100}%`).join(', ');
                preview.style.background = `linear-gradient(to right, ${css})`;
            } else {
                preview.style.background = '#333';
            }
        };

        const renderStops = () => {
            const stopsContainer = overlay.querySelector('#gradient-editor-stops');
            stopsContainer.innerHTML = '';

            editStops.forEach((stop, i) => {
                const row = document.createElement('div');
                row.className = 'gradient-stop-row';

                const colorSwatch = ColorPicker.create(stop.color, (hex) => {
                    editStops[i].color = hex;
                    updatePreview();
                });

                const slider = document.createElement('input');
                slider.type = 'range';
                slider.className = 'gradient-stop-position';
                slider.min = 0;
                slider.max = 100;
                slider.value = Math.round(stop.position * 100);
                slider.addEventListener('input', () => {
                    editStops[i].position = parseInt(slider.value) / 100;
                    posLabel.textContent = slider.value + '%';
                    updatePreview();
                });

                const posLabel = document.createElement('span');
                posLabel.className = 'gradient-stop-pos-label';
                posLabel.textContent = Math.round(stop.position * 100) + '%';

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'gradient-stop-delete';
                deleteBtn.textContent = '✕';
                deleteBtn.addEventListener('click', () => {
                    editStops.splice(i, 1);
                    renderStops();
                    updatePreview();
                });

                row.appendChild(colorSwatch);
                row.appendChild(slider);
                row.appendChild(posLabel);
                if (editStops.length > 2) row.appendChild(deleteBtn);
                stopsContainer.appendChild(row);
            });
        };

        renderStops();
        updatePreview();

        overlay.querySelector('#gradient-add-stop').addEventListener('click', () => {
            editStops.push({ position: 0.5, color: '#ffffff' });
            renderStops();
            updatePreview();
        });

        overlay.querySelector('#gradient-editor-close').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#gradient-editor-cancel').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#gradient-editor-save').addEventListener('click', () => {
            obj[key] = { stops: editStops };
            onSave();
            overlay.remove();
        });
    }
}
