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
        this.init();
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
        for (const mod of modules) {
            // Skip non-module entries (like _global schema)
            if (!mod.icon || mod.name.startsWith('_')) continue;

            const item = document.createElement('div');
            item.className = 'palette-item';
            item.dataset.module = mod.name;
            item.draggable = true;
            item.innerHTML = `<span class="palette-icon">${mod.icon}</span> ${mod.displayName}`;
            item.title = mod.description || mod.displayName;

            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('module-type', mod.name);
                e.dataTransfer.effectAllowed = 'copy';
            });

            this.container.appendChild(item);
        }
    }
}
