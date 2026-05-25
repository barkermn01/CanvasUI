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
        this.container.classList.add('palette-mini');
        this.init();
    }

    #addMiniToggle() {
        // No toggle needed — always grid mode
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
            item.innerHTML = `${iconHtml}<span class="palette-mini-name">${mod.displayName}</span>`;
            item.title = mod.description || mod.displayName;

            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('module-type', mod.name);
                e.dataTransfer.effectAllowed = 'copy';
            });

            this.container.appendChild(item);
        }
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
}
