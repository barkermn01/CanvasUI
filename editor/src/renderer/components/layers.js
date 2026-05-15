class LayerPanel {
    #list;
    #dragItem = null;
    #dragOverItem = null;

    constructor() {
        this.#list = document.getElementById('layer-list');

        EditorState.onChange((what) => {
            if (['scenes', 'scene-switch', 'modules', 'load', 'selection'].includes(what)) {
                this.render();
            }
        });
    }

    render() {
        this.#list.innerHTML = '';
        const modules = EditorState.getActiveSceneModules();

        // Render in reverse order (top layer first in the list)
        const entries = Object.entries(modules).reverse();

        entries.forEach(([id, mod], displayIndex) => {
            const item = document.createElement('div');
            item.className = 'layer-item' + (EditorState.selectedModule === id ? ' active' : '');
            if (mod.visible === false) item.classList.add('layer-hidden');
            item.dataset.layerId = id;
            item.draggable = true;

            // Drag and drop
            item.addEventListener('dragstart', (e) => {
                this.#dragItem = id;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', id);
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                this.#list.querySelectorAll('.layer-item').forEach(el => {
                    el.classList.remove('drag-over-top');
                    el.classList.remove('drag-over-bottom');
                });
                this.#dragItem = null;
                this.#dragOverItem = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (this.#dragItem && this.#dragItem !== id) {
                    this.#list.querySelectorAll('.layer-item').forEach(el => {
                        el.classList.remove('drag-over-top');
                        el.classList.remove('drag-over-bottom');
                    });
                    // Determine if hovering on top or bottom half
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        item.classList.add('drag-over-top');
                    } else {
                        item.classList.add('drag-over-bottom');
                    }
                    this.#dragOverItem = id;
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over-top');
                item.classList.remove('drag-over-bottom');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over-top');
                item.classList.remove('drag-over-bottom');
                if (this.#dragItem && this.#dragItem !== id) {
                    const keys = Object.keys(modules);
                    // The list is displayed reversed, so we need to convert display position to actual index
                    // In display: top = high z-index = last in object
                    // "drop above" in display = move to higher actual index
                    // "drop below" in display = move to lower actual index
                    const targetActualIndex = keys.indexOf(id);
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    const droppedAbove = e.clientY < midY;

                    // In reversed display: above = higher actual index, below = lower actual index
                    let finalIndex;
                    if (droppedAbove) {
                        finalIndex = targetActualIndex + 1;
                    } else {
                        finalIndex = targetActualIndex;
                    }

                    finalIndex = Math.max(0, Math.min(finalIndex, keys.length - 1));
                    EditorState.reorderModuleTo(this.#dragItem, finalIndex);
                }
            });

            // Icon
            const icon = document.createElement('span');
            icon.className = 'layer-icon';
            icon.textContent = getModuleIcon(mod.type);

            // Name
            const name = document.createElement('span');
            name.className = 'layer-name';
            name.textContent = id;

            // Buttons container
            const buttons = document.createElement('span');
            buttons.className = 'layer-buttons';

            // Visibility toggle
            const visBtn = document.createElement('button');
            visBtn.className = 'layer-btn layer-btn-vis';
            visBtn.textContent = mod.visible !== false ? '👁' : '👁‍🗨';
            visBtn.title = mod.visible !== false ? 'Hide module' : 'Show module';
            visBtn.style.opacity = mod.visible !== false ? '1' : '0.4';
            visBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                mod.visible = mod.visible === false ? true : false;
                EditorState.notify('modules');
            });

            // Move up (higher in render order = later in object = down in reversed list)
            const upBtn = document.createElement('button');
            upBtn.className = 'layer-btn';
            upBtn.textContent = '▲';
            upBtn.title = 'Move up (render later / on top)';
            upBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // "Up" in the layer list means higher render order = +1 in actual order
                EditorState.reorderModule(id, 1);
            });

            // Move down (lower in render order = earlier in object = up in reversed list)
            const downBtn = document.createElement('button');
            downBtn.className = 'layer-btn';
            downBtn.textContent = '▼';
            downBtn.title = 'Move down (render earlier / behind)';
            downBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                EditorState.reorderModule(id, -1);
            });

            // Delete
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'layer-btn layer-btn-delete';
            deleteBtn.textContent = '🗑';
            deleteBtn.title = 'Remove module';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                EditorState.removeModuleFromScene(id);
            });

            buttons.appendChild(visBtn);
            buttons.appendChild(upBtn);
            buttons.appendChild(downBtn);
            buttons.appendChild(deleteBtn);

            item.appendChild(icon);
            item.appendChild(name);
            item.appendChild(buttons);

            item.addEventListener('click', () => {
                EditorState.selectModule(id);
            });

            this.#list.appendChild(item);
        });

        if (entries.length === 0) {
            const hint = document.createElement('p');
            hint.className = 'props-hint';
            hint.textContent = 'Drag modules from the palette onto the canvas';
            this.#list.appendChild(hint);
        }
    }
}
