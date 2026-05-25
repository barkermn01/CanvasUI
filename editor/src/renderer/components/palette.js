/**
 * Palette — dynamically built from module .info.json files via IPC.
 * Stores discovered module metadata globally for canvas.js and layers.js to use.
 */

// Global module registry populated by discovery
window.ModuleRegistry = {
    modules: [],
    icons: {},
    gradients: {},
    displayNames: {},
    allowMultiple: {},
    editorClasses: {},

    getIcon(type) {
        return this.icons[type] || '📦';
    },

    getGradient(type) {
        return this.gradients[type] || { from: 'rgba(255,255,255,0.05)', to: 'rgba(255,255,255,0.15)' };
    },

    getDisplayName(type) {
        return this.displayNames[type] || type;
    },

    canAddMultiple(type) {
        return this.allowMultiple[type] ?? true;
    }
};

class Palette {
    constructor() {
        this.container = document.getElementById('palette');
        this.miniMode = EditorPrefs.get('paletteMiniMode', false);
        this.#addMiniToggle();
        this.init();
    }

    #addMiniToggle() {
        // Add toggle button to the modules panel header
        const panelHeader = this.container.closest('.sidebar-panel')?.querySelector('.panel-header');
        if (panelHeader) {
            const btn = document.createElement('button');
            btn.className = 'palette-mini-toggle';
            btn.title = 'Toggle compact view';
            btn.textContent = this.miniMode ? '☰' : '⊞';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.miniMode = !this.miniMode;
                EditorPrefs.set('paletteMiniMode', this.miniMode);
                btn.textContent = this.miniMode ? '☰' : '⊞';
                this.container.classList.toggle('palette-mini', this.miniMode);
                this.render(window.ModuleRegistry.modules);
            });
            // Insert before the pin button
            const pinBtn = panelHeader.querySelector('.panel-pin');
            if (pinBtn) {
                panelHeader.insertBefore(btn, pinBtn);
            } else {
                panelHeader.appendChild(btn);
            }
        }
        if (this.miniMode) {
            this.container.classList.add('palette-mini');
        }

        // Re-check overflow on resize
        const observer = new ResizeObserver(() => this.#checkOverflow());
        observer.observe(this.container);
    }

    async init() {
        try {
            const modules = await window.api.discoverModules();
            window.ModuleRegistry.modules = modules;

            // Populate lookup maps
            for (const mod of modules) {
                window.ModuleRegistry.icons[mod.name] = mod.icon;
                window.ModuleRegistry.displayNames[mod.name] = mod.displayName;
                window.ModuleRegistry.allowMultiple[mod.name] = mod.allowMultiple ?? true;
                if (mod.editorClass) {
                    window.ModuleRegistry.editorClasses[mod.name] = mod.editorClass;
                }
                if (mod.gradient) {
                    window.ModuleRegistry.gradients[mod.name] = mod.gradient;
                }
                if (mod.schema) {
                    window.ModuleRegistry.schemas = window.ModuleRegistry.schemas || {};
                    window.ModuleRegistry.schemas[mod.name] = mod.schema;
                }
            }

            this.render(modules);
        } catch (e) {
            console.error('Palette: module discovery failed', e);
        }
    }

    render(modules) {
        this.container.innerHTML = '';
        const hidden = EditorPrefs.get('hiddenModules', []);
        const revoked = EditorPrefs.get('revokedModules', []);
        for (const mod of modules) {
            // Skip non-module entries (like _global schema)
            if (!mod.icon || mod.name.startsWith('_')) continue;
            if (hidden.includes(mod.name)) continue;
            if (revoked.includes(mod.name)) continue;

            const item = document.createElement('div');
            item.className = 'palette-item';
            item.dataset.module = mod.name;
            item.draggable = true;

            const iconHtml = Palette.renderIcon(mod.icon, mod._dir || mod.name);
            if (this.miniMode) {
                item.innerHTML = `${iconHtml}<span class="palette-mini-name">${mod.displayName}</span>`;
            } else {
                item.innerHTML = `${iconHtml} ${mod.displayName}`;
            }
            item.title = mod.description || mod.displayName;

            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('module-type', mod.name);
                e.dataTransfer.effectAllowed = 'copy';
            });

            this.container.appendChild(item);
        }

        // Detect if scrollbar is present and adjust grid width
        this.#checkOverflow();
    }

    /**
     * Render a module icon — supports both UTF-8 emoji strings and image paths.
     * If the icon contains a file extension (.png, .svg, .jpg, etc.), renders as <img>.
     * Paths must be relative to the module directory — leading / is blocked.
     * Otherwise renders as a text span.
     */
    static renderIcon(icon, moduleName) {
        if (!icon) return '<span class="palette-icon">📦</span>';
        if (/\.\w{2,4}$/.test(icon)) {
            if (icon.startsWith('/') || icon.includes('..')) return '<span class="palette-icon">📦</span>';
            const src = `/modules/${moduleName}/${icon}`;
            return `<img class="palette-icon palette-icon-img" src="${src}" alt="">`;
        }
        return `<span class="palette-icon">${icon}</span>`;
    }

    #checkOverflow() {
        if (this.miniMode) {
            if (this.container.scrollHeight > this.container.clientHeight) {
                this.container.classList.add('palette-scrolling');
            } else {
                this.container.classList.remove('palette-scrolling');
            }
        } else {
            this.container.classList.remove('palette-scrolling');
        }
    }
}
