class ConfigIO {
    #nameEl;

    constructor() {
        this.#nameEl = document.getElementById('project-name');

        document.getElementById('btn-import').addEventListener('click', async () => {
            const result = await window.api.importConfig();
            if (!result) return;
            if (result.error) {
                alert(result.error);
                return;
            }
            EditorState.configPath = result.path;
            EditorState.loadConfig(result.config);
            document.getElementById('btn-save').disabled = false;
            EditorPrefs.setLastConfigPath(result.path);
            this.#updateNameDisplay();
        });

        document.getElementById('btn-export').addEventListener('click', async () => {
            const config = EditorState.buildConfig();
            const saved = await window.api.exportConfig(config);
            if (saved) {
                EditorState.dirty = false;
            }
        });

        document.getElementById('btn-save').addEventListener('click', async () => {
            if (!EditorState.configPath) return;
            const config = EditorState.buildConfig();
            const saved = await window.api.quickSave({ configData: config, savePath: EditorState.configPath });
            if (saved) {
                EditorState.dirty = false;
            }
        });

        // Click to edit name
        this.#nameEl.addEventListener('click', () => this.#editName());

        // Update name display on state changes
        EditorState.onChange((what) => {
            if (what === 'load' || what === 'settings') {
                this.#updateNameDisplay();
            }
        });

        // Keyboard shortcut: Ctrl+S
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (EditorState.configPath) {
                    document.getElementById('btn-save').click();
                } else {
                    document.getElementById('btn-export').click();
                }
            }
            // Delete selected module (only if not focused in an input)
            if (e.key === 'Delete' && EditorState.selectedModule) {
                const active = document.activeElement;
                const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
                if (!isInput) {
                    EditorState.removeModuleFromScene(EditorState.selectedModule);
                }
            }

            // Arrow keys to move selected module
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && EditorState.selectedModule) {
                const active = document.activeElement;
                const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
                if (isInput) return;

                e.preventDefault();
                const mod = EditorState.getActiveSceneModules()[EditorState.selectedModule];
                if (!mod) return;

                // Step size: alt=1px, shift=20px, default=5px
                let step = 5;
                if (e.altKey) step = 1;
                else if (e.shiftKey) step = 20;

                let { x, y } = mod.area;
                switch (e.key) {
                    case 'ArrowUp': y -= step; break;
                    case 'ArrowDown': y += step; break;
                    case 'ArrowLeft': x -= step; break;
                    case 'ArrowRight': x += step; break;
                }

                // Constrain if locked
                if (EditorState.lockToCanvas) {
                    x = Math.max(0, Math.min(x, EditorState.canvasWidth - mod.area.width));
                    y = Math.max(0, Math.min(y, EditorState.canvasHeight - mod.area.height));
                }

                EditorState.updateModuleArea(EditorState.selectedModule, { x, y });
            }
        });
    }

    #updateNameDisplay() {
        const name = EditorState.globalConfig.Name;
        this.#nameEl.textContent = name || 'Unnamed';
        this.#nameEl.classList.toggle('unnamed', !name);
    }

    #editName() {
        const current = EditorState.globalConfig.Name || '';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = current;
        input.className = 'project-name-input';
        input.placeholder = 'Project name...';

        const commit = () => {
            EditorState.globalConfig.Name = input.value.trim();
            EditorState.notify('settings');
            input.replaceWith(this.#nameEl);
            this.#updateNameDisplay();
        };

        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
                input.replaceWith(this.#nameEl);
            }
        });

        this.#nameEl.replaceWith(input);
        input.focus();
        input.select();
    }
}
