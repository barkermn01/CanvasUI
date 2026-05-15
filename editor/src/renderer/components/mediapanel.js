class MediaPanel {
    #list;
    #currentPath = null; // null = root of media/
    #selectCallback = null;
    #filterType = null;

    constructor() {
        this.#list = document.getElementById('media-list');
        this.#setupDropZone();
        this.#setupButtons();
        this.refresh();

        EditorState.onChange((what) => {
            if (what === 'load') this.refresh();
        });

        // Watch for external file system changes
        if (window.api.onMediaChanged) {
            window.api.onMediaChanged(() => this.refresh());
        }
    }

    async refresh() {
        const items = await window.api.mediaList(this.#currentPath);
        this.#render(items);
    }

    startSelection(type, callback) {
        this.#selectCallback = callback;
        this.#filterType = type;
        this.refresh();

        const panelEl = document.querySelector('.sidebar-panel[data-panel="media"]');
        const pinBtn = panelEl?.querySelector('.panel-pin');
        const activityBtn = document.querySelector('.activity-btn[data-panel="media"]');
        if (panelEl && !panelEl.classList.contains('visible')) {
            panelEl.classList.add('visible');
            pinBtn?.classList.add('pinned');
            activityBtn?.classList.add('active');
            const sidebar = panelEl.closest('.sidebar');
            sidebar?.querySelector('.sidebar-panels')?.classList.remove('collapsed');
        }
    }

    cancelSelection() {
        this.#selectCallback = null;
        this.#filterType = null;
        this.refresh();
    }

    #render(items) {
        this.#list.innerHTML = '';

        // Selection mode banner
        if (this.#selectCallback) {
            const banner = document.createElement('div');
            banner.className = 'media-select-banner';
            banner.innerHTML = `<span>Select a ${this.#filterType || 'file'}...</span><button id="media-cancel-select">✕</button>`;
            this.#list.appendChild(banner);
            banner.querySelector('#media-cancel-select').addEventListener('click', () => this.cancelSelection());
        }

        // Breadcrumb / back button
        if (this.#currentPath) {
            const nav = document.createElement('div');
            nav.className = 'media-breadcrumb';

            const backBtn = document.createElement('button');
            backBtn.className = 'media-back-btn';
            backBtn.textContent = '← Back';
            backBtn.addEventListener('click', () => {
                const parts = this.#currentPath.split('/');
                parts.pop();
                this.#currentPath = parts.length > 0 ? parts.join('/') : null;
                this.refresh();
            });
            nav.appendChild(backBtn);

            const pathLabel = document.createElement('span');
            pathLabel.className = 'media-path-label';
            pathLabel.textContent = `/media/${this.#currentPath}`;
            nav.appendChild(pathLabel);

            this.#list.appendChild(nav);
        }

        // Filter items
        let filtered = items;
        if (this.#filterType) {
            filtered = items.filter(f => f.type === this.#filterType || f.type === 'directory');
        }

        if (filtered.length === 0) {
            const hint = document.createElement('p');
            hint.className = 'props-hint';
            hint.textContent = 'Empty folder. Drop files here or click Upload.';
            hint.style.padding = '12px';
            this.#list.appendChild(hint);
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'media-grid';

        filtered.forEach(item => {
            if (item.type === 'directory') {
                grid.appendChild(this.#createDirItem(item));
            } else {
                grid.appendChild(this.#createFileItem(item));
            }
        });

        this.#list.appendChild(grid);
    }

    #createDirItem(item) {
        const el = document.createElement('div');
        el.className = 'media-item media-item-dir';
        el.title = item.name;

        const thumb = document.createElement('div');
        thumb.className = 'media-thumb media-thumb-dir';
        thumb.textContent = '📁';
        el.appendChild(thumb);

        const name = document.createElement('div');
        name.className = 'media-name';
        name.textContent = item.name;
        el.appendChild(name);

        el.addEventListener('click', () => {
            this.#currentPath = item.path;
            this.refresh();
        });

        return el;
    }

    #createFileItem(item) {
        const el = document.createElement('div');
        el.className = 'media-item';
        el.title = item.name;
        el.draggable = true;

        // Drag to canvas
        el.addEventListener('dragstart', (e) => {
            const ext = '.' + item.name.split('.').pop().toLowerCase();
            const type = ['.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi'].includes(ext) ? 'video' : 'image';
            e.dataTransfer.setData('media-type', type);
            e.dataTransfer.setData('media-path', item.path);
            e.dataTransfer.effectAllowed = 'copy';
        });

        const thumb = document.createElement('div');
        thumb.className = 'media-thumb';
        if (item.type === 'image') {
            thumb.style.backgroundImage = `url("${item.fullPath.replace(/\\/g, '/')}")`;
        } else {
            thumb.innerHTML = '🎬';
            thumb.classList.add('media-thumb-video');
        }
        el.appendChild(thumb);

        const name = document.createElement('div');
        name.className = 'media-name';
        name.textContent = item.name;
        el.appendChild(name);

        // Click to select
        el.addEventListener('click', () => {
            if (this.#selectCallback) {
                this.#selectCallback(item.path);
                this.#selectCallback = null;
                this.#filterType = null;
                this.refresh();
            }
        });

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'media-delete-btn';
        deleteBtn.textContent = '🗑';
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            // Double-click to confirm delete (no confirm() in Electron)
            if (deleteBtn.dataset.armed) {
                await window.api.mediaDelete(item.name);
                this.refresh();
            } else {
                deleteBtn.dataset.armed = 'true';
                deleteBtn.textContent = '❌';
                deleteBtn.title = 'Click again to confirm delete';
                setTimeout(() => {
                    deleteBtn.dataset.armed = '';
                    deleteBtn.textContent = '🗑';
                    deleteBtn.title = '';
                }, 2000);
            }
        });
        el.appendChild(deleteBtn);

        return el;
    }

    #setupDropZone() {
        const panel = document.querySelector('.sidebar-panel[data-panel="media"]');
        if (!panel) return;

        panel.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            panel.classList.add('media-drag-over');
        });

        panel.addEventListener('dragleave', () => {
            panel.classList.remove('media-drag-over');
        });

        panel.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            panel.classList.remove('media-drag-over');

            const files = [...e.dataTransfer.files];
            if (files.length === 0) return;

            // Use Electron's webUtils to get real file paths (File.path is empty in sandbox mode)
            const paths = files.map(f => window.api.getPathForFile ? window.api.getPathForFile(f) : f.path).filter(p => p);
            if (paths.length > 0) {
                const results = await window.api.mediaDrop(paths, this.#currentPath);
                this.refresh();
            }
        });
    }

    #setupButtons() {
        const btn = document.getElementById('media-upload-btn');
        if (btn) {
            btn.addEventListener('click', async () => {
                const result = await window.api.pickMedia('all');
                if (result) {
                    await window.api.mediaUpload([result]);
                    this.refresh();
                }
            });
        }

        const mkdirBtn = document.getElementById('media-mkdir-btn');
        if (mkdirBtn) {
            mkdirBtn.addEventListener('click', () => {
                // Show inline input for folder name
                const existing = this.#list.querySelector('.media-mkdir-input-row');
                if (existing) return; // Already showing

                const row = document.createElement('div');
                row.className = 'media-mkdir-input-row';

                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = 'Folder name...';
                input.className = 'media-mkdir-input';

                const createBtn = document.createElement('button');
                createBtn.textContent = '✓';
                createBtn.className = 'media-mkdir-confirm';

                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = '✕';
                cancelBtn.className = 'media-mkdir-cancel';

                const doCreate = async () => {
                    const name = input.value.trim();
                    if (name) {
                        const result = await window.api.mediaCreateDir(name, this.#currentPath);
                        if (!result.success) {
                            input.style.borderColor = 'var(--danger)';
                            return;
                        }
                    }
                    row.remove();
                    this.refresh();
                };

                createBtn.addEventListener('click', doCreate);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') doCreate();
                    if (e.key === 'Escape') row.remove();
                });
                cancelBtn.addEventListener('click', () => row.remove());

                row.appendChild(input);
                row.appendChild(createBtn);
                row.appendChild(cancelBtn);
                this.#list.insertBefore(row, this.#list.firstChild);
                input.focus();
            });
        }
    }
}
