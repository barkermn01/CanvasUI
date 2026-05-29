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
    #rotating = null;
    #cropping = null;
    #dragOffset = { x: 0, y: 0 };
    #contextMenu = null;

    constructor() {
        this.#canvas = document.getElementById('editor-canvas');
        this.#container = document.getElementById('canvas-container');
        this.#setupSize();
        this.#setupEvents();

        EditorState.onChange((what) => {
            if (['scenes', 'scene-switch', 'modules', 'module-added', 'load'].includes(what)) {
                this.render();
            }
            if (what === 'selection') {
                this.#updateSelection();
                // Re-apply crop clip-path since it depends on selection state
                this.#canvas.querySelectorAll('[data-module-id]').forEach(el => {
                    this.#updateModuleElement(el.dataset.moduleId);
                });
            }
            if (what === 'module-settings') {
                this.#updateModulePreview();
            }
            if (what === 'module-area' && EditorState.selectedModule) {
                this.#updateModuleElement(EditorState.selectedModule);
            }
            if (what === 'module-crop' && EditorState.selectedModule) {
                this.#updateModuleElement(EditorState.selectedModule);
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
            // Dismiss context menu on any click
            this.#dismissContextMenu();
        });

        // Right-click context menu on modules
        this.#canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const moduleEl = e.target.closest('[data-module-id]');
            if (!moduleEl) {
                this.#dismissContextMenu();
                return;
            }
            const id = moduleEl.dataset.moduleId;
            EditorState.selectModule(id);
            this.#showContextMenu(e.clientX, e.clientY, id);
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
                const fileSrcPath = window.api.getPathForFile ? window.api.getPathForFile(file) : file.path;
                if (!fileSrcPath) continue;
                const results = await window.api.mediaDrop([fileSrcPath], null);
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

        if (this.#rotating) {
            const rect = this.#canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) / this.#scale;
            const my = (e.clientY - rect.top) / this.#scale;
            this.#rotating.snap = !e.shiftKey;
            this.#handleRotate(mx, my);
        }

        if (this.#cropping) {
            const rect = this.#canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) / this.#scale;
            const my = (e.clientY - rect.top) / this.#scale;
            this.#handleCrop(mx, my);
        }
    }

    #onMouseUp() {
        if (this.#resizing || this.#dragging || this.#rotating || this.#cropping) {
            // Re-render preview after drag/resize/rotate/crop completes
            this.#updateModulePreview();
        }
        this.#dragging = null;
        this.#resizing = null;
        this.#rotating = null;
        this.#cropping = null;
    }

    #showContextMenu(clientX, clientY, moduleId) {
        this.#dismissContextMenu();

        const menu = document.createElement('div');
        menu.className = 'canvas-context-menu';
        menu.style.left = clientX + 'px';
        menu.style.top = clientY + 'px';

        const isCropMode = EditorState.cropMode === moduleId;

        // Toggle crop mode
        const cropItem = document.createElement('div');
        cropItem.className = 'context-menu-item' + (isCropMode ? ' active' : '');
        cropItem.textContent = isCropMode ? '✂️ Exit Crop Mode' : '✂️ Crop Mode';
        cropItem.addEventListener('click', () => {
            EditorState.cropMode = isCropMode ? null : moduleId;
            this.#dismissContextMenu();
            this.render();
            this.#updateModuleElement(moduleId);
        });
        menu.appendChild(cropItem);

        // Reset crop
        const mod = EditorState.getActiveSceneModules()[moduleId];
        const hasCrop = mod?.crop && (mod.crop.top || mod.crop.right || mod.crop.bottom || mod.crop.left);
        if (hasCrop) {
            const resetItem = document.createElement('div');
            resetItem.className = 'context-menu-item';
            resetItem.textContent = '↩️ Reset Crop';
            resetItem.addEventListener('click', () => {
                EditorState.updateModuleCrop(moduleId, { top: 0, right: 0, bottom: 0, left: 0 });
                this.#dismissContextMenu();
                this.#updateModuleElement(moduleId);
            });
            menu.appendChild(resetItem);
        }

        document.body.appendChild(menu);
        this.#contextMenu = menu;
    }

    #dismissContextMenu() {
        if (this.#contextMenu) {
            this.#contextMenu.remove();
            this.#contextMenu = null;
        }
    }

    #handleResize(mx, my) {
        const { id, handle, startArea } = this.#resizing;
        let { x, y, width, height } = startArea;
        const minSize = 30;

        // When cropped (not in crop mode), the handles are at the cropped edges
        // but startArea is the full area. Offset mouse to match full area coordinates.
        const mod = EditorState.getActiveSceneModules()[id];
        const crop = mod?.crop || {};
        const hasCrop = crop.top || crop.right || crop.bottom || crop.left;
        const inCropMode = EditorState.cropMode === id;

        if (hasCrop && !inCropMode) {
            // Adjust mouse position: handles are at cropped edges, math expects full area edges
            // For handles on the left/top side, the handle is at area.x + crop.left (not area.x)
            // The switch below uses mx directly as the new edge position, so we need to
            // NOT adjust mx/my — instead adjust the startArea to match the cropped bounds
            const cx = startArea.x + (crop.left || 0);
            const cy = startArea.y + (crop.top || 0);
            const cw = startArea.width - (crop.left || 0) - (crop.right || 0);
            const ch = startArea.height - (crop.top || 0) - (crop.bottom || 0);

            switch (handle) {
                case 'se': width = mx - x + (crop.right || 0); height = my - y + (crop.bottom || 0); break;
                case 'sw': { const newLeft = mx - (crop.left || 0); width = (x + width) - newLeft; x = newLeft; height = my - y + (crop.bottom || 0); break; }
                case 'ne': width = mx - x + (crop.right || 0); { const newTop = my - (crop.top || 0); height = (y + height) - newTop; y = newTop; break; }
                case 'nw': { const newLeft = mx - (crop.left || 0); const newTop = my - (crop.top || 0); width = (x + width) - newLeft; height = (y + height) - newTop; x = newLeft; y = newTop; break; }
                case 'e': width = mx - x + (crop.right || 0); break;
                case 'w': { const newLeft = mx - (crop.left || 0); width = (x + width) - newLeft; x = newLeft; break; }
                case 's': height = my - y + (crop.bottom || 0); break;
                case 'n': { const newTop = my - (crop.top || 0); height = (y + height) - newTop; y = newTop; break; }
            }
        } else {
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

    #handleRotate(mx, my) {
        const { id, centerX, centerY } = this.#rotating;
        // Calculate angle from center to mouse position
        const angle = Math.atan2(my - centerY, mx - centerX) * (180 / Math.PI);
        // Offset by 90° so "up" is 0°
        let rotation = angle + 90;
        // Snap to 15° increments when not holding shift (checked via stored flag)
        if (this.#rotating.snap) {
            rotation = Math.round(rotation / 15) * 15;
        }
        // Normalize to -180..180
        if (rotation > 180) rotation -= 360;
        if (rotation < -180) rotation += 360;
        // Round to 1 decimal
        rotation = Math.round(rotation * 10) / 10;

        EditorState.updateModuleArea(id, { rotation });
        this.#updateModuleElement(id);
    }

    #handleCrop(mx, my) {
        const { id, handle, startCrop, startMouse } = this.#cropping;
        const mod = EditorState.getActiveSceneModules()[id];
        if (!mod) return;

        const dx = mx - startMouse.x;
        const dy = my - startMouse.y;
        const crop = { ...startCrop };

        // Each handle adjusts specific crop edges
        switch (handle) {
            case 'n': crop.top = Math.max(0, startCrop.top + dy); break;
            case 's': crop.bottom = Math.max(0, startCrop.bottom - dy); break;
            case 'w': crop.left = Math.max(0, startCrop.left + dx); break;
            case 'e': crop.right = Math.max(0, startCrop.right - dx); break;
            case 'nw': crop.top = Math.max(0, startCrop.top + dy); crop.left = Math.max(0, startCrop.left + dx); break;
            case 'ne': crop.top = Math.max(0, startCrop.top + dy); crop.right = Math.max(0, startCrop.right - dx); break;
            case 'sw': crop.bottom = Math.max(0, startCrop.bottom - dy); crop.left = Math.max(0, startCrop.left + dx); break;
            case 'se': crop.bottom = Math.max(0, startCrop.bottom - dy); crop.right = Math.max(0, startCrop.right - dx); break;
        }

        // Clamp so crop doesn't exceed module size
        const maxW = mod.area.width - 20;
        const maxH = mod.area.height - 20;
        crop.left = Math.min(crop.left, maxW - crop.right);
        crop.right = Math.min(crop.right, maxW - crop.left);
        crop.top = Math.min(crop.top, maxH - crop.bottom);
        crop.bottom = Math.min(crop.bottom, maxH - crop.top);

        EditorState.updateModuleCrop(id, crop);
        this.#updateModuleElement(id);
    }

    #updateModuleElement(id) {
        const el = this.#canvas.querySelector(`[data-module-id="${id}"]`);
        const mod = EditorState.getActiveSceneModules()[id];
        if (!el || !mod) return;

        // Always position at full area
        el.style.left = (mod.area.x * this.#scale) + 'px';
        el.style.top = (mod.area.y * this.#scale) + 'px';
        el.style.width = (mod.area.width * this.#scale) + 'px';
        el.style.height = (mod.area.height * this.#scale) + 'px';
        el.style.transform = mod.area.rotation ? `rotate(${mod.area.rotation}deg)` : '';

        // Apply visual crop via clip-path when not in crop mode
        const crop = mod.crop || {};
        const hasCrop = crop.top || crop.right || crop.bottom || crop.left;
        const inCropMode = EditorState.cropMode === id;

        // Apply visual crop via clip-path when not in crop mode
        // Only clip the preview content, not the handles
        const preview = el.querySelector('.module-preview');
        if (hasCrop && !inCropMode) {
            // Shrink element to cropped region
            const cx = mod.area.x + (crop.left || 0);
            const cy = mod.area.y + (crop.top || 0);
            const cw = mod.area.width - (crop.left || 0) - (crop.right || 0);
            const ch = mod.area.height - (crop.top || 0) - (crop.bottom || 0);
            el.style.left = (cx * this.#scale) + 'px';
            el.style.top = (cy * this.#scale) + 'px';
            el.style.width = (Math.max(0, cw) * this.#scale) + 'px';
            el.style.height = (Math.max(0, ch) * this.#scale) + 'px';
            el.style.overflow = 'hidden';
            el.style.clipPath = '';
            if (preview) {
                preview.style.position = 'absolute';
                preview.style.width = (mod.area.width * this.#scale) + 'px';
                preview.style.height = (mod.area.height * this.#scale) + 'px';
                preview.style.left = (-(crop.left || 0) * this.#scale) + 'px';
                preview.style.top = (-(crop.top || 0) * this.#scale) + 'px';
                preview.style.clipPath = '';
            }
        } else {
            el.style.overflow = '';
            el.style.clipPath = '';
            if (preview) {
                preview.style.position = '';
                preview.style.width = '';
                preview.style.height = '';
                preview.style.left = '';
                preview.style.top = '';
                preview.style.clipPath = '';
            }
        }

        // Crop overlay (only in crop mode)
        let overlay = el.querySelector('.crop-overlay');
        if (inCropMode && hasCrop) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'crop-overlay';
                el.appendChild(overlay);
            }
            const t = (crop.top || 0) * this.#scale;
            const r = (crop.right || 0) * this.#scale;
            const b = (crop.bottom || 0) * this.#scale;
            const l = (crop.left || 0) * this.#scale;
            overlay.style.top = t + 'px';
            overlay.style.right = r + 'px';
            overlay.style.bottom = b + 'px';
            overlay.style.left = l + 'px';
        } else if (overlay) {
            overlay.remove();
        }

        // Position crop handles at crop boundary
        if (inCropMode) {
            const tPx = (crop.top || 0) * this.#scale;
            const rPx = (crop.right || 0) * this.#scale;
            const bPx = (crop.bottom || 0) * this.#scale;
            const lPx = (crop.left || 0) * this.#scale;
            const w = mod.area.width * this.#scale;
            const h = mod.area.height * this.#scale;
            const midX = lPx + (w - lPx - rPx) / 2;
            const midY = tPx + (h - tPx - bPx) / 2;

            el.querySelectorAll('.crop-handle').forEach(handle => {
                const pos = handle.classList[1];
                // Reset all positioning
                handle.style.top = '';
                handle.style.left = '';
                handle.style.right = '';
                handle.style.bottom = '';

                switch (pos) {
                    case 'nw': handle.style.top = (tPx - 5) + 'px'; handle.style.left = (lPx - 5) + 'px'; break;
                    case 'n':  handle.style.top = (tPx - 5) + 'px'; handle.style.left = (midX - 5) + 'px'; break;
                    case 'ne': handle.style.top = (tPx - 5) + 'px'; handle.style.left = (w - rPx - 5) + 'px'; break;
                    case 'w':  handle.style.top = (midY - 5) + 'px'; handle.style.left = (lPx - 5) + 'px'; break;
                    case 'e':  handle.style.top = (midY - 5) + 'px'; handle.style.left = (w - rPx - 5) + 'px'; break;
                    case 'sw': handle.style.top = (h - bPx - 5) + 'px'; handle.style.left = (lPx - 5) + 'px'; break;
                    case 's':  handle.style.top = (h - bPx - 5) + 'px'; handle.style.left = (midX - 5) + 'px'; break;
                    case 'se': handle.style.top = (h - bPx - 5) + 'px'; handle.style.left = (w - rPx - 5) + 'px'; break;
                }
            });
        }
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

    #updateSelection() {
        const selectedId = EditorState.selectedModule;
        this.#canvas.querySelectorAll('.canvas-module').forEach(el => {
            if (el.dataset.moduleId === selectedId) {
                el.classList.add('selected');
            } else {
                el.classList.remove('selected');
            }
        });
    }

    #updateModulePreview() {
        // Only update the preview of the selected module instead of full re-render
        const id = EditorState.selectedModule;
        if (!id) return;

        const modules = EditorState.getActiveSceneModules();
        const mod = modules[id];
        if (!mod) return;

        // Don't touch modules that are actively simulating
        if (ModuleSimulator.isPlaying(id)) return;

        const el = this.#canvas.querySelector(`[data-module-id="${id}"]`);
        if (!el) return;

        // Update the preview container content
        let previewContainer = el.querySelector('.module-preview');
        const reg = ModuleSimulator.getRegistration(id);
        if (reg && reg.preview && previewContainer) {
            reg.preview(previewContainer, mod.settings || {}, mod.area);
        }
    }

    render() {
        // Unregister modules that are no longer in the scene (keep running ones alive)
        const modules = EditorState.getActiveSceneModules();
        ModuleSimulator.unregisterRemoved(Object.keys(modules));
        const moduleKeys = Object.keys(modules);

        // Set global config for modules
        window.Config = EditorState.globalConfig;

        // Diff: find which elements to keep, add, or remove
        const existingEls = new Map();
        this.#canvas.querySelectorAll('.canvas-module').forEach(el => {
            existingEls.set(el.dataset.moduleId, el);
        });

        // Remove elements for modules that no longer exist
        for (const [id, el] of existingEls) {
            if (!modules[id] || modules[id].visible === false) {
                el.remove();
                existingEls.delete(id);
            }
        }

        // Add/update elements
        for (const [id, mod] of Object.entries(modules)) {
            if (mod.visible === false) continue;

            const isSelected = EditorState.selectedModule === id;
            const layerIndex = moduleKeys.indexOf(id);

            // If element already exists, just update via #updateModuleElement
            if (existingEls.has(id)) {
                const el = existingEls.get(id);
                el.style.transform = mod.area.rotation ? `rotate(${mod.area.rotation}deg)` : '';
                el.style.zIndex = layerIndex + 1;
                el.classList.toggle('selected', isSelected);
                el.classList.toggle('crop-mode', EditorState.cropMode === id);
                this.#updateModuleElement(id);
                continue;
            }

            // Create new element
            const el = document.createElement('div');
            el.className = 'canvas-module' + (isSelected ? ' selected' : '') + (EditorState.cropMode === id ? ' crop-mode' : '');
            el.dataset.moduleId = id;

            el.style.left = (mod.area.x * this.#scale) + 'px';
            el.style.top = (mod.area.y * this.#scale) + 'px';
            el.style.width = (mod.area.width * this.#scale) + 'px';
            el.style.height = (mod.area.height * this.#scale) + 'px';
            el.style.transform = mod.area.rotation ? `rotate(${mod.area.rotation}deg)` : '';
            el.style.zIndex = layerIndex + 1;

            // Clip-path for crop is applied via #updateModuleElement after preview is built

            // Gradient background — transparent by default, visible on hover, stronger on select
            const grad = getModuleGradient(mod.type);
            el.style.setProperty('--mod-grad-from', grad.from);
            el.style.setProperty('--mod-grad-to', grad.to);

            // Label
            const label = document.createElement('div');
            label.className = 'module-label';
            label.textContent = `${getModuleIcon(mod.type)} ${id}`;
            el.appendChild(label);

            // Play/Stop simulation button — shown after registration if module has simulate callbacks
            const hasSimulate = ModuleSimulator.hasEditorSupport(mod.type);
            const modInfo = window.ModuleRegistry?.modules?.find(m => m.name === mod.type);
            const autoSim = modInfo?.autoSimulate || false;
            let playBtn = null;
            if (hasSimulate && !autoSim) {
                playBtn = document.createElement('button');
                playBtn.className = 'module-play-btn';
                playBtn.textContent = '▶';
                playBtn.title = 'Play simulation';
                playBtn.style.display = 'none'; // Hidden until we confirm simulate exists
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

            // Build preview — register module and use its preview callback
            this.#registerAndBuildPreview(id, mod, el);

            // Resize handles (only for resize, hidden in crop mode)
            ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].forEach(h => {
                const handle = document.createElement('div');
                handle.className = `resize-handle ${h}`;
                handle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    EditorState.selectModule(id);
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

            // Crop handles — separate set, positioned at crop boundary, only visible in crop mode
            ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].forEach(h => {
                const handle = document.createElement('div');
                handle.className = `crop-handle ${h}`;
                handle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    const currentMod = EditorState.getActiveSceneModules()[id];
                    if (!currentMod) return;
                    this.#cropping = {
                        id,
                        handle: h,
                        startCrop: { ...(currentMod.crop || { top: 0, right: 0, bottom: 0, left: 0 }) },
                        startMouse: { x: (e.clientX - this.#canvas.getBoundingClientRect().left) / this.#scale, y: (e.clientY - this.#canvas.getBoundingClientRect().top) / this.#scale }
                    };
                });
                el.appendChild(handle);
            });

            // Rotation handle — circular grab point above top-center
            const rotHandle = document.createElement('div');
            rotHandle.className = 'rotate-handle';
            rotHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                EditorState.selectModule(id);
                const currentMod = EditorState.getActiveSceneModules()[id];
                if (!currentMod) return;
                const centerX = currentMod.area.x + currentMod.area.width / 2;
                const centerY = currentMod.area.y + currentMod.area.height / 2;
                this.#rotating = { id, centerX, centerY, snap: true };
            });
            el.appendChild(rotHandle);

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
            const reg = await ModuleSimulator.register(id, mod.type);

            // Check if module has autoSimulate flag
            const modInfo = window.ModuleRegistry?.modules?.find(m => m.name === mod.type);
            const autoSim = modInfo?.autoSimulate || false;

            if (autoSim && (reg?.simulate?.draw || reg?.simulate?.update)) {
                // Auto-start simulation, no play button
                const preview = document.createElement('div');
                preview.className = 'module-preview';
                el.appendChild(preview);
                ModuleSimulator.start(id, preview);
                return;
            }

            // Show play button only if module registered simulate callbacks
            if (reg?.simulate?.draw || reg?.simulate?.update) {
                const playBtn = el.querySelector('.module-play-btn');
                if (playBtn) playBtn.style.display = '';
            }
        }

        // Build preview using registration (or fallback)
        const preview = this.#buildPreview(id, mod);
        el.appendChild(preview);
    }
}
