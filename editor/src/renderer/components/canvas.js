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
                x = Math.max(0, Math.min(x, EditorState.canvasWidth - mod.area.width));
                y = Math.max(0, Math.min(y, EditorState.canvasHeight - mod.area.height));
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
        x = Math.max(0, Math.min(x, EditorState.canvasWidth - minSize));
        y = Math.max(0, Math.min(y, EditorState.canvasHeight - minSize));

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

    #buildChatPreview() {
        const container = document.createElement('div');
        container.className = 'module-preview chat-preview';
        container.style.cssText = 'position: relative; overflow: hidden;';

        // Live canvas for chat rendering
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'width: 100%; height: 100%; pointer-events: none;';
        container.appendChild(canvas);

        // Load CanvasChat from server and start rendering
        this.#loadChatModule(container, canvas);

        return container;
    }

    #loadChatModule(container, canvas) {
        const host = EditorPrefs.get('serverHost', '127.0.0.1');
        const port = EditorPrefs.get('serverPort', 31589);

        if (window.CanvasChat) {
            this.#startChatPreview(container, canvas);
            return;
        }

        if (document.querySelector('script[data-chat-module]')) {
            const check = setInterval(() => {
                if (window.CanvasChat) {
                    clearInterval(check);
                    this.#startChatPreview(container, canvas);
                }
            }, 100);
            return;
        }

        const script = document.createElement('script');
        script.src = `http://${host}:${port}/modules/chat/chat.js`;
        script.dataset.chatModule = 'true';
        script.onload = () => {
            this.#startChatPreview(container, canvas);
        };
        script.onerror = () => {
            canvas.remove();
            const fallback = document.createElement('div');
            fallback.style.cssText = 'display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:var(--text-secondary); font-size:11px;';
            fallback.textContent = 'Start server to preview chat';
            container.appendChild(fallback);
        };
        document.head.appendChild(script);
    }

    #startChatPreview(container, canvas) {
        if (!window.CanvasChat) return;

        window.Config = EditorState.globalConfig;
        const chatInstance = new window.CanvasChat();
        container._chatInstance = chatInstance;

        let lastTime = performance.now();
        const animate = () => {
            if (!container.isConnected) return;

            const now = performance.now();
            const dt = (now - lastTime) / 1000;
            lastTime = now;

            // Get the module's real area dimensions (not the scaled editor size)
            const moduleId = container.closest('[data-module-id]')?.dataset.moduleId;
            const mod = moduleId ? EditorState.getActiveSceneModules()[moduleId] : null;
            const w = mod ? mod.area.width : (container.clientWidth || 300);
            const h = mod ? mod.area.height : (container.clientHeight || 200);

            if (!w || !h) {
                requestAnimationFrame(animate);
                return;
            }
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, w, h);

            window.Config = EditorState.globalConfig;
            chatInstance.update(dt);
            chatInstance.draw(ctx, {}, { x: 0, y: 0, width: w, height: h });

            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }

    #buildEmotePreview() {
        const container = document.createElement('div');
        container.className = 'module-preview emote-preview';
        container.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 24px; pointer-events: none;';
        container.textContent = '😀 🎉 ❤️ 🔥 👀';
        return container;
    }

    #buildAudioVisualiserPreview(mod) {
        const av = EditorState.globalConfig.AudioVisualiser || {};
        const settings = mod.settings || {};
        const colors = av.colors || {};
        const direction = settings.direction || av.direction || 'right-left';
        const mirrored = settings.mirrored ?? av.mirrored ?? false;
        const barWidth = settings.barWidth || av.barWidth || 5;
        const barSpacing = settings.barSpacing || av.barSpacing || 2;

        const container = document.createElement('div');
        container.className = 'module-preview av-preview';
        container.style.cssText = `display: flex; align-items: ${mirrored ? 'center' : 'flex-end'}; gap: ${barSpacing}px; padding: 0; pointer-events: none; overflow: hidden;`;

        if (direction === 'right-left') {
            container.style.flexDirection = 'row-reverse';
            container.style.justifyContent = 'flex-start';
        } else {
            container.style.flexDirection = 'row';
            container.style.justifyContent = 'flex-start';
        }

        const barCount = 120;
        for (let i = 0; i < barCount; i++) {
            const noise = Math.sin(i * 0.3) * 30 + Math.sin(i * 0.7) * 20 + Math.sin(i * 1.5) * 10;
            const height = Math.max(5, Math.min(95, 40 + noise + (Math.random() * 15 - 7)));

            if (mirrored) {
                const wrapper = document.createElement('div');
                wrapper.style.cssText = `display: flex; flex-direction: column; justify-content: center; width: ${barWidth}px; min-width: ${barWidth}px; height: 100%; flex-shrink: 0;`;
                const topBar = document.createElement('div');
                topBar.style.cssText = `width: ${barWidth}px; height: ${height / 2}%; border-radius: 1px;`;
                topBar.style.background = this.#getAvBarBackground(colors, height);
                const bottomBar = document.createElement('div');
                bottomBar.style.cssText = `width: ${barWidth}px; height: ${height / 2}%; border-radius: 1px;`;
                bottomBar.style.background = this.#getAvBarBackground(colors, height);
                wrapper.appendChild(topBar);
                wrapper.appendChild(bottomBar);
                container.appendChild(wrapper);
            } else {
                const bar = document.createElement('div');
                bar.style.cssText = `width: ${barWidth}px; min-width: ${barWidth}px; height: ${height}%; border-radius: 1px; flex-shrink: 0;`;
                bar.style.background = this.#getAvBarBackground(colors, height);
                container.appendChild(bar);
            }
        }

        return container;
    }

    #getAvBarBackground(colors, height) {
        if (colors.mode === 'gradient' && colors.gradient?.stops?.length) {
            const stops = colors.gradient.stops;
            const gradientCSS = stops.map(s => `${s.color} ${s.position * 100}%`).join(', ');
            return `linear-gradient(to top, ${gradientCSS})`;
        }
        const level = height < 35 ? 'level1' : height < 50 ? 'level2' : height < 70 ? 'level3' : 'level4';
        return colors[level] || '#885ab4';
    }

    #buildWebcamPreview(mod) {
        const container = document.createElement('div');
        container.className = 'module-preview webcam-preview';
        container.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; background: rgba(0,0,0,0.3); position: relative; overflow: hidden; gap: 4px;';

        const icon = document.createElement('div');
        icon.style.cssText = 'font-size: 28px; opacity: 0.8;';
        icon.textContent = '📷';

        const label = document.createElement('div');
        label.style.cssText = 'font-size: 10px; color: #aaa;';
        label.textContent = mod.settings?.device || 'Default camera';

        container.appendChild(icon);
        container.appendChild(label);
        return container;
    }

    #buildPreview(mod) {
        switch (mod.type) {
            case 'chat':
                return this.#buildChatPreview();
            case 'emote':
                return this.#buildEmotePreview();
            case 'audiovisualiser':
                return this.#buildAudioVisualiserPreview(mod);
            case 'webcam':
                return this.#buildWebcamPreview(mod);
            case 'image':
                if (mod.settings.src) {
                    const container = document.createElement('div');
                    container.className = 'module-preview';
                    const img = document.createElement('img');
                    const host = EditorPrefs.get('serverHost', '127.0.0.1');
                    const port = EditorPrefs.get('serverPort', 31589);
                    img.src = `http://${host}:${port}${mod.settings.src}`;
                    img.style.objectFit = mod.settings.objectFit || 'contain';
                    container.appendChild(img);
                    return container;
                } else {
                    return this.#buildNoMediaPreview('No image selected');
                }
            case 'video':
                if (mod.settings.src) {
                    const container = document.createElement('div');
                    container.className = 'module-preview';
                    const vid = document.createElement('video');
                    // Use server URL for playback since src is a web-relative path
                    const host = EditorPrefs.get('serverHost', '127.0.0.1');
                    const port = EditorPrefs.get('serverPort', 31589);
                    vid.src = `http://${host}:${port}${mod.settings.src}`;
                    vid.muted = true;
                    vid.loop = true;
                    vid.style.objectFit = mod.settings.objectFit || 'contain';
                    vid.style.width = '100%';
                    vid.style.height = '100%';
                    container.appendChild(vid);
                    return container;
                } else {
                    return this.#buildNoMediaPreview('No video selected');
                }
        }

        // Fallback: icon
        const container = document.createElement('div');
        container.className = 'module-preview';
        container.textContent = getModuleIcon(mod.type);
        return container;
    }

    #buildNoMediaPreview(text) {
        const container = document.createElement('div');
        container.className = 'module-preview module-preview-error';
        container.innerHTML = `
            <div class="module-no-media">
                <span class="module-no-media-icon">⚠️</span>
                <span class="module-no-media-text">${text}</span>
            </div>
        `;
        return container;
    }

    render() {
        // Stop any running simulations before rebuilding DOM
        ModuleSimulator.stopAll();
        this.#canvas.innerHTML = '';
        const modules = EditorState.getActiveSceneModules();
        const moduleKeys = Object.keys(modules);

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

            // Play/Stop simulation button
            if (['emote', 'audiovisualiser', 'video', 'webcam', 'image'].includes(mod.type)) {
                const playBtn = document.createElement('button');
                playBtn.className = 'module-play-btn';
                playBtn.textContent = ModuleSimulator.isPlaying(id) ? '⏹' : '▶';
                playBtn.title = ModuleSimulator.isPlaying(id) ? 'Stop simulation' : 'Play simulation';
                playBtn.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                });
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const preview = el.querySelector('.module-preview');
                    ModuleSimulator.toggle(id, mod, preview);
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
                    const preview = el.querySelector('.chat-preview');
                    if (!preview || !preview._chatInstance) return;
                    const names = ['Viewer42', 'NightOwl', 'GamerPro', 'LurkKing', 'SubHype', 'ChillDude'];
                    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c'];
                    const msgs = ['Hello! 👋', 'GG well played', 'Lets gooo 🎉', 'Nice stream!', 'First time here!', '❤️❤️❤️'];
                    const i = Math.floor(Math.random() * names.length);
                    preview._chatInstance.onMessage({
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
                    const preview = el.querySelector('.chat-preview');
                    if (preview && preview._chatInstance) preview._chatInstance.onMessage({ Type: 'ClearChat' });
                });
                el.appendChild(chatClearBtn);
            }

            // Config-driven preview
            const preview = this.#buildPreview(mod);
            el.appendChild(preview);

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
}
