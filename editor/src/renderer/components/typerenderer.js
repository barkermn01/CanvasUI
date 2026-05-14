/**
 * TypeRenderer - Generates UI controls based on _type metadata in config objects.
 * 
 * Reads _type (property types), _item_type (sub-object types), and renders
 * appropriate inputs for each property.
 */
class TypeRenderer {
    /**
     * Renders a config object into a container using its _type metadata.
     * @param {HTMLElement} container - DOM element to render into
     * @param {object} obj - The config object to render
     * @param {string} path - Dot-path to this object in globalConfig (e.g. "chat.ChatBoxes")
     * @param {object} options - { adminMode: bool, onChange: fn }
     */
    static render(container, obj, path, options = {}) {
        const { adminMode = false, onChange = () => {} } = options;
        const typeMap = obj._type || {};
        const itemTypeMap = obj._item_type || {};

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
        for (const [key, value] of Object.entries(obj)) {
            if (key.startsWith('_')) continue; // Skip metadata

            const typeDef = typeMap[key];
            const itemType = itemTypeMap[key];
            const fullPath = path ? `${path}.${key}` : key;

            if (typeDef) {
                // Has explicit type definition
                const row = TypeRenderer.#createInput(key, value, typeDef, fullPath, obj, onChange);
                if (row) container.appendChild(row);
            } else if (itemType === 'css') {
                // CSS key-value editor
                const section = TypeRenderer.#createCssEditor(key, value, fullPath, obj, onChange);
                container.appendChild(section);
            } else if (itemType === 'object' || (typeof value === 'object' && value !== null && !Array.isArray(value))) {
                // Sub-object — render recursively in a collapsible group
                const group = TypeRenderer.#createObjectGroup(key, value, fullPath, options);
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

    static #inferType(value) {
        if (typeof value === 'boolean') return 'bool';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'string') {
            if (/^#[0-9a-fA-F]{6}$/.test(value)) return 'color';
            return 'string';
        }
        return 'string';
    }

    static #createInput(key, value, typeDef, fullPath, obj, onChange) {
        const row = document.createElement('div');
        row.className = 'tr-row';

        const label = document.createElement('label');
        label.textContent = key;
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
        TypeRenderer.render(content, value, fullPath, options);
        group.appendChild(content);

        return group;
    }

    static #createCssEditor(key, value, fullPath, parentObj, onChange) {
        const section = document.createElement('div');
        section.className = 'tr-css-section';

        const header = document.createElement('div');
        header.className = 'tr-group-header';
        header.textContent = `${key} (CSS)`;
        section.appendChild(header);

        const list = document.createElement('div');
        list.className = 'tr-css-list';

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
}
