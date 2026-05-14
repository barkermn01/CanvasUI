class SceneTabs {
    #tabList;

    constructor() {
        this.#tabList = document.getElementById('scene-tab-list');

        document.getElementById('btn-add-scene').addEventListener('click', () => {
            this.#showInlineInput('', (name) => {
                if (!EditorState.addScene(name)) {
                    // Name taken — flash the input
                    return false;
                }
                return true;
            });
        });

        EditorState.onChange((what) => {
            if (['scenes', 'scene-switch', 'load'].includes(what)) {
                this.render();
            }
        });
    }

    #showInlineInput(defaultValue, onConfirm) {
        // Remove any existing inline input
        const existing = this.#tabList.querySelector('.scene-inline-input');
        if (existing) existing.remove();

        const wrapper = document.createElement('div');
        wrapper.className = 'scene-tab scene-inline-input';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue;
        input.placeholder = 'Scene name...';
        input.className = 'scene-name-input';

        const commit = () => {
            const val = input.value.trim();
            if (val) {
                const success = onConfirm(val);
                if (success !== false) {
                    wrapper.remove();
                } else {
                    input.style.borderColor = 'var(--danger)';
                    input.focus();
                }
            } else {
                wrapper.remove();
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') wrapper.remove();
        });
        input.addEventListener('blur', () => {
            setTimeout(() => wrapper.remove(), 100);
        });

        wrapper.appendChild(input);
        this.#tabList.appendChild(wrapper);
        input.focus();
    }

    render() {
        this.#tabList.innerHTML = '';
        const scenes = Object.keys(EditorState.scenes);

        scenes.forEach(name => {
            const tab = document.createElement('div');
            tab.className = 'scene-tab' + (name === EditorState.activeScene ? ' active' : '');
            tab.draggable = true;
            tab.dataset.scene = name;

            // Drag to reorder
            tab.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('scene-name', name);
                e.dataTransfer.effectAllowed = 'move';
                tab.classList.add('dragging');
            });

            tab.addEventListener('dragend', () => {
                tab.classList.remove('dragging');
                this.#tabList.querySelectorAll('.scene-tab').forEach(t => t.classList.remove('drag-over-left', 'drag-over-right'));
            });

            tab.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const draggedName = e.dataTransfer.types.includes('scene-name') ? true : false;
                if (!draggedName) return;

                this.#tabList.querySelectorAll('.scene-tab').forEach(t => t.classList.remove('drag-over-left', 'drag-over-right'));
                const rect = tab.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;
                if (e.clientX < midX) {
                    tab.classList.add('drag-over-left');
                } else {
                    tab.classList.add('drag-over-right');
                }
            });

            tab.addEventListener('dragleave', () => {
                tab.classList.remove('drag-over-left', 'drag-over-right');
            });

            tab.addEventListener('drop', (e) => {
                e.preventDefault();
                tab.classList.remove('drag-over-left', 'drag-over-right');
                const draggedName = e.dataTransfer.getData('scene-name');
                if (!draggedName || draggedName === name) return;

                const keys = Object.keys(EditorState.scenes);
                const targetIndex = keys.indexOf(name);
                const rect = tab.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;
                const insertBefore = e.clientX < midX;
                const finalIndex = insertBefore ? targetIndex : targetIndex + 1;

                EditorState.reorderSceneTo(draggedName, Math.min(finalIndex, keys.length - 1));
            });

            const label = document.createElement('span');
            label.textContent = name;
            tab.appendChild(label);

            // Double-click to rename
            label.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                label.style.display = 'none';

                const input = document.createElement('input');
                input.type = 'text';
                input.value = name;
                input.className = 'scene-name-input';

                const commit = () => {
                    const newName = input.value.trim();
                    if (newName && newName !== name) {
                        if (!EditorState.renameScene(name, newName)) {
                            input.style.borderColor = 'var(--danger)';
                            input.focus();
                            return;
                        }
                    }
                    input.remove();
                    label.style.display = '';
                };

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') { input.remove(); label.style.display = ''; }
                });
                input.addEventListener('blur', commit);

                tab.insertBefore(input, label);
                input.focus();
                input.select();
            });

            // Click to switch
            tab.addEventListener('click', () => {
                EditorState.switchScene(name);
            });

            // Settings icon on active tab — deselects module to show scene settings
            if (name === EditorState.activeScene) {
                const settingsIcon = document.createElement('span');
                settingsIcon.className = 'tab-settings';
                settingsIcon.textContent = '⚙';
                settingsIcon.title = 'Scene settings (shown in Properties panel)';
                settingsIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    EditorState.selectModule(null);
                });
                tab.appendChild(settingsIcon);
            }

            // Close button (don't allow removing default scene)
            if (scenes.length > 1 && name !== EditorState.globalConfig.DefaultScene) {
                const close = document.createElement('span');
                close.className = 'tab-close';
                close.textContent = '✕';
                close.addEventListener('click', (e) => {
                    e.stopPropagation();
                    EditorState.removeScene(name);
                });
                tab.appendChild(close);
            }

            this.#tabList.appendChild(tab);
        });
    }
}
