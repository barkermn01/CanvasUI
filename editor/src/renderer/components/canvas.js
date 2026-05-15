// Module icons and gradients are now provided by window.ModuleRegistry (populated by palette.js)
// Fallback constants for when registry hasn't loaded yet
const MODULE_ICONS_FALLBACK = { chat: '💬', emote: '😀', audiovisualiser: '🎵', image: '🖼️', video: '🎬' };
const MODULE_GRADIENTS_FALLBACK = {
    chat: { from: 'rgba(59, 130, 246, 0.08)', to: 'rgba(59, 130, 246, 0.25)' },
    emote: { from: 'rgba(234, 179, 8, 0.08)', to: 'rgba(234, 179, 8, 0.25)' },
    audiovisualiser: { from: 'rgba(168, 85, 247, 0.08)', to: 'rgba(168, 85, 247, 0.25)' },
    image: { from: 'rgba(34, 197, 94, 0.08)', to: 'rgba(34, 197, 94, 0.25)' },
    video: { from: 'rgba(239, 68, 68, 0.08)', to: 'rgba(239, 68, 68, 0.25)' }
};

function getModuleIcon(type) {
    if (window.ModuleRegistry) return window.ModuleRegistry.getIcon(type);
    return MODULE_ICONS_FALLBACK[type] || '📦';
}

function getModuleGradient(type) {
    if (window.ModuleRegistry) return window.ModuleRegistry.getGradient(type);
    return MODULE_GRADIENTS_FALLBACK[type] || { from: 'rgba(255,255,255,0.05)', to: 'rgba(255,255,255,0.15)' };
}

class CanvasWorkspace {
    #canvas;
    #container;
    #scale = 1;
    #dragging = null;
    #resizing = null;
    #dragOffset = { x: 0, y: 0 };

    constructor() {
        this.#canvas = document.getElementById('editor-canvas');
        this.#container = document.getElementById('canvas-container');
        this.#setupSize();
        this.#setupEvents();

        EditorState.onChange((what) => {
            if (['scenes', 'scene-switch', 'modules', 'load', 'selection'].includes(what)) {
                this.render();
            }
        });
    }

    #setupSize() {
        const w = EditorState.canvasWidth;
        const h = EditorState.canvasHeight;
        const workspace = document.getElementById('workspace');
        const maxW = workspace.clientWidth - 40;
        const maxH = workspace.clientHeight - 40;
        this.#scale = Math.min(maxW / w, maxH / h, 1);

        this.#canvas.style.width = (w * this.#scale) + 'px';
        this.#canvas.style.height = (h * this.#scale) + 'px';
        this.#container.style.width = (w * this.#scale) + 'px';
        this.#container.style.height = (h * this.#scale) + 'px';

        this.#canvas.dataset.realWidth = w;
        this.#canvas.dataset.realHeight = h;
    }

    updateSize() {
        this.#setupSize();
        this.render();
    }

    #setupEvents() {
        this.#canvas.addEventListener('mousedown', (e) => {
            if (e.target === this.#canvas) {
                EditorState.selectModule(null);
            }
        });

        // Click workspace background (blue area) to deselect
        document.getElementById('workspace').addEventListener('mousedown', (e) => {
            if (e.target === document.getElementById('workspace')) {
                EditorState.selectModule(null);
            }
        });

        this.#canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        // Toggle drag-active class to disable pointer-events on modules during drag
        this.#canvas.addEventListener('dragenter', () => {
            this.#canvas.classList.add('drag-active');
        });
        this.#canvas.addEventListener('dragleave', (e) => {
            // Only remove if leaving the canvas entirely
            if (!this.#canvas.contains(e.relatedTarget)) {
                this.#canvas.classList.remove('drag-active');
            }
        });
        this.#canvas.addEventListener('drop', async (e) => {
            this.#canvas.classList.remove('drag-active');
            e.preventDefault();

            const rect = this.#canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / this.#scale;
            const y = (e.clientY - rect.top) / this.#scale;

            // Check if it's a palette module drag
            const moduleType = e.dataTransfer.getData('module-type');
            if (moduleType) {
                const id = EditorState.addModuleToScene(moduleType, {
                    x: Math.max(0, x - 150),
                    y: Math.max(0, y - 100),
                    width: 300,
                    height: 200
                });
                if (id) EditorState.selectModule(id);
                return;
            }

            // Check if it's a media item dragged from the media panel
            const mediaType = e.dataTransfer.getData('media-type');
            const mediaPath = e.dataTransfer.getData('media-path');
            if (mediaType && mediaPath) {
                if (window.undoHistory) window.undoHistory.batch();
                const id = EditorState.addModuleToScene(mediaType, {
                    x: Math.max(0, x - 200),
                    y: Math.max(0, y - 150),
                    width: 400,
                    height: 300
                });
                if (id) {
                    EditorState.updateModuleSetting(id, 'src', mediaPath);
                    EditorState.selectModule(id);
                }
                if (window.undoHistory) window.undoHistory.endBatch();
                return;
            }

            // Check if it's a file drop from OS
            const files = [...e.dataTransfer.files];
            if (files.length === 0) return;

            const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
            const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi'];

            if (window.undoHistory) window.undoHistory.batch();

            for (const file of files) {
                const ext = '.' + file.name.split('.').pop().toLowerCase();
                let type = null;

                if (imageExts.includes(ext)) type = 'image';
                else if (videoExts.includes(ext)) type = 'video';
                else continue;

                // Copy file to www/media/
                const results = await window.api.mediaDrop([file.path], null);
                if (!results || !results[0]?.success) continue;

                const filePath = results[0].path;

                const id = EditorState.addModuleToScene(type, {
                    x: Math.max(0, x - 200),
                    y: Math.max(0, y - 150),
                    width: 400,
                    height: 300
                });

                if (id) {
                    EditorState.updateModuleSetting(id, 'src', filePath);
                    EditorState.selectModule(id);
                }
            }

            if (window.undoHistory) window.undoHistory.endBatch();
            if (window.mediaPanel) window.mediaPanel.refresh();
        });

        document.addEventListener('mousemove', (e) => this.#onMouseMove(e));
        document.addEventListener('mouseup', () => this.#onMouseUp());

        window.addEventListener('resize', () => {
            this.#setupSize();
            this.render();
        });
    }

    #onMouseMove(e) {
        if (this.#dragging) {
            const rect = this.#canvas.getBoundingClientRect();
            let x = (e.clientX - rect.left) / this.#scale - this.#dragOffset.x;
            let y = (e.clientY - rect.top) / this.#scale - this.#dragOffset.y;

            const mod = EditorState.getActiveSceneModules()[this.#dragging];
            if (mod) {
                if (EditorState.lockToCanvas) {
                    x = Math.max(0, Math.min(x, EditorState.canvasWidth - mod.area.width));
                    y = Math.max(0, Math.min(y, EditorState.canvasHeight - mod.area.height));
                }
                EditorState.updateModuleArea(this.#dragging, { x, y });
                this.#updateModuleElement(this.#dragging);
            }
        }

        if (this.#resizing) {
            const rect = this.#canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) / this.#scale;
            const my = (e.clientY - rect.top) / this.#scale;
            this.#handleResize(mx, my);
        }
    }

    #onMouseUp() {
        this.#dragging = null;
        this.#resizing = null;
    }

    #handleResize(mx, my) {
        const { id, handle, startArea } = this.#resizing;
        let { x, y, width, height } = startArea;
        const minSize = 30;

        switch (handle) {
            case 'se': width = mx - x; height = my - y; break;
            case 'sw': width = (x + width) - mx; x = mx; height = my - y; break;
            case 'ne': width = mx - x; height = (y + height) - my; y = my; break;
            case 'nw': width = (x + width) - mx; height = (y + height) - my; x = mx; y = my; break;
            case 'e': width = mx - x; break;
            case 'w': width = (x + width) - mx; x = mx; break;
            case 's': height = my - y; break;
            case 'n': height = (y + height) - my; y = my; break;
        }

        width = Math.max(minSize, width);
        height = Math.max(minSize, height);

        if (EditorState.lockToCanvas) {
            // Constrain position and size to stay within canvas
            x = Math.max(0, x);
            y = Math.max(0, y);
            if (x + width > EditorState.canvasWidth) width = EditorState.canvasWidth - x;
            if (y + height > EditorState.canvasHeight) height = EditorState.canvasHeight - y;
            width = Math.max(minSize, width);
            height = Math.max(minSize, height);
            x = Math.min(x, EditorState.canvasWidth - minSize);
            y = Math.min(y, EditorState.canvasHeight - minSize);
        }

        EditorState.updateModuleArea(id, { x, y, width, height });
        this.#updateModuleElement(id);
    }

    #updateModuleElement(id) {
        const el = this.#canvas.querySelector(`[data-module-id="${id}"]`);
        const mod = EditorState.getActiveSceneModules()[id];
        if (!el || !mod) return;

        el.style.left = (mod.area.x * this.#scale) + 'px';
        el.style.top = (mod.area.y * this.#scale) + 'px';
        el.style.width = (mod.area.width * this.#scale) + 'px';
        el.style.height = (mod.area.height * this.#scale) + 'px';
    }

    /**
     * Build the preview for a module instance using the registered preview callback.
     * Falls back to a simple icon if no registration exists yet.
     */
    #buildPreview(id, mod) {
        const container = document.createElement('div');
        container.className = 'module-preview';

        const reg = ModuleSimulator.getRegistration(id);
        if (reg?.preview) {
            reg.preview(container, mod.settings, mod.area);
        } else {
            // Fallback: just show the icon
            container.style.cssText = 'display: flex; align-items: center; justify-content: center; font-size: 32px; pointer-events: none;';
            container.textContent = getModuleIcon(mod.type);
        }

        return container;
    }

    render() {
        // Unregister all module instances — they'll be re-registered as we rebuild
        ModuleSimulator.unregisterAll();
        this.#canvas.innerHTML = '';
        const modules = EditorState.getActiveSceneModules();
        const moduleKeys = Object.keys(modules);

        // Set global config for modules
        window.Config = EditorState.globalConfig;

        for (const [id, mod] of Object.entries(modules)) {
            const isSelected = EditorState.selectedModule === id;
            const layerIndex = moduleKeys.indexOf(id);
            const el = document.createElement('div');
            el.className = 'canvas-module' + (isSelected ? ' selected' : '');
            el.dataset.moduleId = id;
            el.style.left = (mod.area.x * this.#scale) + 'px';
            el.style.top = (mod.area.y * this.#scale) + 'px';
            el.style.width = (mod.area.width * this.#scale) + 'px';
            el.style.height = (mod.area.height * this.#scale) + 'px';
            el.style.zIndex = layerIndex + 1;

            // Gradient background — transparent by default, visible on hover, stronger on select
            const grad = getModuleGradient(mod.type);
            el.style.setProperty('--mod-grad-from', grad.from);
            el.style.setProperty('--mod-grad-to', grad.to);

            // Label
            const label = document.createElement('div');
            label.className = 'module-label';
            label.textContent = `${getModuleIcon(mod.type)} ${id}`;
            el.appendChild(label);

            // Play/Stop simulation button — shown for any module with editorClass
            if (ModuleSimulator.hasEditorSupport(mod.type)) {
                const playBtn = document.createElement('button');
                playBtn.className = 'module-play-btn';
                playBtn.textContent = '▶';
                playBtn.title = 'Play simulation';
                playBtn.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                });
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const preview = el.querySelector('.module-preview');
                    ModuleSimulator.toggle(id, preview);
                    playBtn.textContent = ModuleSimulator.isPlaying(id) ? '⏹' : '▶';
                    playBtn.title = ModuleSimulator.isPlaying(id) ? 'Stop simulation' : 'Play simulation';
                });
                el.appendChild(playBtn);
            }

            // Chat module: test message + clear buttons
            if (mod.type === 'chat') {
                const chatTestBtn = document.createElement('button');
                chatTestBtn.className = 'module-play-btn';
                chatTestBtn.textContent = '💬';
                chatTestBtn.title = 'Send test message';
                chatTestBtn.style.right = '30px';
                chatTestBtn.addEventListener('mousedown', (e) => e.stopPropagation());
                chatTestBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Access the chat instance from the registry
                    const entry = ModuleSimulator.getEntry(id);
                    const chatInstance = entry?.classInstance;
                    if (!chatInstance || typeof chatInstance.onMessage !== 'function') return;
                    const names = ['Viewer42', 'NightOwl', 'GamerPro', 'LurkKing', 'SubHype', 'ChillDude'];
                    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c'];
                    const msgs = ['Hello! 👋', 'GG well played', 'Lets gooo 🎉', 'Nice stream!', 'First time here!', '❤️❤️❤️'];
                    const i = Math.floor(Math.random() * names.length);
                    chatInstance.onMessage({
                        Type: 'MessageAdded',
                        ID: 'test_' + Date.now(),
                        DisplayName: names[i],
                        DisplayNameColor: colors[i],
                        Message: msgs[i],
                        Emotes: [],
                        Badges: [],
                        Platform: 'twitch',
                        UserId: 'test_' + i
                    });
                });
                el.appendChild(chatTestBtn);

                const chatClearBtn = document.createElement('button');
                chatClearBtn.className = 'module-play-btn';
                chatClearBtn.textContent = '🗑';
                chatClearBtn.title = 'Clear chat';
                chatClearBtn.addEventListener('mousedown', (e) => e.stopPropagation());
                chatClearBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const entry = ModuleSimulator.getEntry(id);
                    const chatInstance = entry?.classInstance;
                    if (chatInstance && typeof chatInstance.onMessage === 'function') {
                        chatInstance.onMessage({ Type: 'ClearChat' });
                    }
                });
                el.appendChild(chatClearBtn);
            }

            // Build preview — register module and use its preview callback
            this.#registerAndBuildPreview(id, mod, el);

            // Resize handles
            ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].forEach(h => {
                const handle = document.createElement('div');
                handle.className = `resize-handle ${h}`;
                handle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    EditorState.selectModule(id);
                    // Re-fetch module from state since selectModule triggers render
                    const currentMod = EditorState.getActiveSceneModules()[id];
                    if (!currentMod) return;
                    this.#resizing = {
                        id,
                        handle: h,
                        startArea: { ...currentMod.area }
                    };
                });
                el.appendChild(handle);
            });

            // Drag to move
            el.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('resize-handle')) return;
                e.stopPropagation();
                EditorState.selectModule(id);

                // Re-fetch module from state since selectModule triggers render
                const currentMod = EditorState.getActiveSceneModules()[id];
                if (!currentMod) return;

                const rect = this.#canvas.getBoundingClientRect();
                this.#dragOffset = {
                    x: (e.clientX - rect.left) / this.#scale - currentMod.area.x,
                    y: (e.clientY - rect.top) / this.#scale - currentMod.area.y
                };
                this.#dragging = id;
            });

            this.#canvas.appendChild(el);
        }
    }

    /**
     * Asynchronously register a module instance and build its preview.
     * Appends the preview to the element once ready.
     */
    async #registerAndBuildPreview(id, mod, el) {
        // Try to register (loads script if needed)
        if (ModuleSimulator.hasEditorSupport(mod.type)) {
            await ModuleSimulator.register(id, mod.type);
        }

        // Build preview using registration (or fallback)
        const preview = this.#buildPreview(id, mod);
        el.appendChild(preview);
    }
}
