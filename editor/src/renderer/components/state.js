const EditorState = {
    canvasWidth: 1920,
    canvasHeight: 1080,
    lockToCanvas: true,
    showLabels: true,
    scenes: {},
    activeScene: null,
    selectedModule: null,
    configPath: null,
    dirty: false,

    // Full config fields that aren't scene-related
    globalConfig: {
        Name: "",
        StreamerBot: {},
        ChannelName: "",
        TwitchID: "",
        Modules: [],
        Bots: [],
        DefaultScene: "",
        AudioVisualiser: {},
        emote: {},
        chat: {},
        webcam: {}
    },

    listeners: [],

    onChange(fn) {
        this.listeners.push(fn);
    },

    notify(what) {
        this.dirty = true;
        this.listeners.forEach(fn => fn(what));
    },

    addScene(name) {
        if (this.scenes[name]) return false;
        this.scenes[name] = {
            obsScene: '',
            transition: { type: "fade", duration: 0.5 },
            modules: {}
        };
        if (!this.activeScene) this.activeScene = name;
        if (!this.globalConfig.DefaultScene) this.globalConfig.DefaultScene = name;
        this.notify('scenes');
        return true;
    },

    removeScene(name) {
        if (!this.scenes[name]) return;
        // Can't remove the default scene
        if (name === this.globalConfig.DefaultScene) return;
        delete this.scenes[name];
        if (this.activeScene === name) {
            this.activeScene = this.globalConfig.DefaultScene || Object.keys(this.scenes)[0] || null;
        }
        this.selectedModule = null;
        this.notify('scenes');
    },

    renameScene(oldName, newName) {
        if (!this.scenes[oldName] || this.scenes[newName]) return false;
        this.scenes[newName] = this.scenes[oldName];
        delete this.scenes[oldName];
        if (this.activeScene === oldName) this.activeScene = newName;
        if (this.globalConfig.DefaultScene === oldName) this.globalConfig.DefaultScene = newName;
        this.notify('scenes');
        return true;
    },

    reorderSceneTo(sceneName, targetIndex) {
        const keys = Object.keys(this.scenes);
        const currentIndex = keys.indexOf(sceneName);
        if (currentIndex === -1 || targetIndex < 0 || targetIndex >= keys.length) return;
        if (currentIndex === targetIndex) return;

        keys.splice(currentIndex, 1);
        keys.splice(targetIndex, 0, sceneName);

        const reordered = {};
        keys.forEach(k => { reordered[k] = this.scenes[k]; });
        this.scenes = reordered;
        this.notify('scenes');
    },

    switchScene(name) {
        if (!this.scenes[name]) return;
        this.activeScene = name;
        localStorage.setItem('editorActiveScene', name);
        this.selectedModule = null;
        this.notify('scene-switch');
    },

    getActiveSceneModules() {
        if (!this.activeScene || !this.scenes[this.activeScene]) return {};
        return this.scenes[this.activeScene].modules;
    },

    addModuleToScene(moduleType, area) {
        if (!this.activeScene) return null;
        const modules = this.scenes[this.activeScene].modules;

        // Check if this module type allows multiple instances
        const canMultiple = window.ModuleRegistry ? window.ModuleRegistry.canAddMultiple(moduleType) : true;
        if (!canMultiple) {
            // Check if one already exists in this scene
            const exists = Object.values(modules).some(m => m.type === moduleType);
            if (exists) return null;
        }

        // Generate unique ID for duplicate module types
        let id = moduleType;
        let counter = 1;
        while (modules[id]) {
            id = `${moduleType}_${counter++}`;
        }

        modules[id] = {
            type: moduleType,
            area: area || { x: 100, y: 100, width: 300, height: 200 },
            settings: this.getDefaultSettings(moduleType)
        };

        this.lastAddedModule = id;
        this.notify('module-added');
        return id;
    },

    removeModuleFromScene(id) {
        if (!this.activeScene) return;
        delete this.scenes[this.activeScene].modules[id];
        if (this.selectedModule === id) this.selectedModule = null;
        this.notify('modules');
    },

    renameModule(oldId, newId) {
        if (!this.activeScene) return false;
        const modules = this.scenes[this.activeScene].modules;
        if (!modules[oldId] || modules[newId]) return false; // doesn't exist or new name taken
        if (oldId === newId) return true;

        // Rebuild object preserving order with new key
        const newModules = {};
        for (const [key, val] of Object.entries(modules)) {
            if (key === oldId) {
                newModules[newId] = val;
            } else {
                newModules[key] = val;
            }
        }
        this.scenes[this.activeScene].modules = newModules;
        if (this.selectedModule === oldId) this.selectedModule = newId;
        this.notify('modules');
        return true;
    },

    reorderModule(id, direction) {
        if (!this.activeScene) return;
        const modules = this.scenes[this.activeScene].modules;
        const keys = Object.keys(modules);
        const index = keys.indexOf(id);
        if (index === -1) return;

        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= keys.length) return;

        // Swap
        [keys[index], keys[newIndex]] = [keys[newIndex], keys[index]];

        // Rebuild modules object in new order
        const reordered = {};
        keys.forEach(k => { reordered[k] = modules[k]; });
        this.scenes[this.activeScene].modules = reordered;
        this.notify('modules');
    },

    reorderModuleTo(id, targetIndex) {
        if (!this.activeScene) return;
        const modules = this.scenes[this.activeScene].modules;
        const keys = Object.keys(modules);
        const currentIndex = keys.indexOf(id);
        if (currentIndex === -1 || targetIndex < 0 || targetIndex >= keys.length) return;
        if (currentIndex === targetIndex) return;

        // Remove from current position and insert at target
        keys.splice(currentIndex, 1);
        keys.splice(targetIndex, 0, id);

        // Rebuild modules object in new order
        const reordered = {};
        keys.forEach(k => { reordered[k] = modules[k]; });
        this.scenes[this.activeScene].modules = reordered;
        this.notify('modules');
    },

    updateModuleArea(id, area) {
        if (!this.activeScene) return;
        const mod = this.scenes[this.activeScene].modules[id];
        if (mod) {
            mod.area = { ...mod.area, ...area };
            this.notify('module-area');
        }
    },

    updateModuleSetting(id, key, value) {
        if (!this.activeScene) return;
        const mod = this.scenes[this.activeScene].modules[id];
        if (mod) {
            mod.settings[key] = value;
            this.notify('module-settings');
        }
    },

    selectModule(id) {
        if (this.selectedModule === id) return;
        this.selectedModule = id;
        this.notify('selection');
    },

    getSelectedModule() {
        if (!this.activeScene || !this.selectedModule) return null;
        return this.scenes[this.activeScene].modules[this.selectedModule] || null;
    },

    getDefaultSettings(type) {
        switch (type) {
            case 'image': return { src: '', opacity: 1, objectFit: 'contain' };
            case 'video': return { src: '', loop: true, muted: true, opacity: 1, objectFit: 'contain' };
            case 'chat': return {};
            case 'emote': return {};
            case 'audiovisualiser': return { device: '', direction: 'right-left', mirrored: true, barWidth: 5, barSpacing: 2 };
            case 'webcam': return { device: '', mirror: false, mask: 'none', borderRadius: '0', chromaKey: false, chromaKeyColor: '#00ff00', chromaKeySimilarity: 0.4, chromaKeySmoothness: 0.08, chromaKeySpill: 0.1 };
            case 'pngtuber': return { device: '', threshold: 30, holdTime: 200, frequencyMin: 85, frequencyMax: 300, idleImage: '', talkingImage: '', blinkImage: '', blinkInterval: 4, blinkDuration: 150, bounce: true, bounceAmount: 5 };
            default: return {};
        }
    },

    // Convert CSS-style area (percentages, left/top/right/bottom) to pixel-based x/y/width/height
    parseArea(area) {
        if (!area) return { x: 0, y: 0, width: 300, height: 200 };

        const w = this.canvasWidth;
        const h = this.canvasHeight;

        // If already has numeric x/y/width/height, use directly
        if (typeof area.x === 'number' && typeof area.y === 'number' &&
            typeof area.width === 'number' && typeof area.height === 'number') {
            return { x: area.x, y: area.y, width: area.width, height: area.height };
        }

        // Parse a value that could be a number, "50%", or "100px"
        const parseVal = (val, dimension) => {
            if (val === undefined || val === null) return null;
            if (typeof val === 'number') return val;
            const str = String(val);
            if (str.endsWith('%')) return (parseFloat(str) / 100) * dimension;
            if (str.endsWith('px')) return parseFloat(str);
            return parseFloat(str) || 0;
        };

        let x = 0, y = 0, width = 300, height = 200;

        // Handle x/y style
        if (area.x !== undefined) x = parseVal(area.x, w) || 0;
        if (area.y !== undefined) y = parseVal(area.y, h) || 0;

        // Handle left/top/right/bottom style
        if (area.left !== undefined) x = parseVal(area.left, w) || 0;
        if (area.top !== undefined) y = parseVal(area.top, h) || 0;

        // Handle width/height
        if (area.width !== undefined) {
            width = parseVal(area.width, w);
            if (width === null || width <= 0) width = 300;
        }
        if (area.height !== undefined) {
            height = parseVal(area.height, h);
            if (height === null || height <= 0) height = 200;
        }

        // If right is specified and width isn't a percentage, calculate width
        if (area.right !== undefined && area.width === undefined) {
            const right = parseVal(area.right, w) || 0;
            width = w - x - right;
        }
        if (area.bottom !== undefined && area.height === undefined) {
            const bottom = parseVal(area.bottom, h) || 0;
            height = h - y - bottom;
        }

        return {
            x: Math.round(Math.max(0, x)),
            y: Math.round(Math.max(0, y)),
            width: Math.round(Math.max(30, width)),
            height: Math.round(Math.max(30, height))
        };
    },

    // Build the full config object for export
    buildConfig() {
        const config = { ...this.globalConfig };

        // Always save canvas size
        config.CanvasWidth = this.canvasWidth;
        config.CanvasHeight = this.canvasHeight;
        // Ensure scene module is in the modules list
        if (!config.Modules.includes('scene')) {
            config.Modules = [...config.Modules];
            if (!config.Modules.includes('scene')) config.Modules.push('scene');
        }

        // Ensure ALL module types used in any scene are in the Modules list
        const usedTypes = new Set();
        Object.values(this.scenes).forEach(scene => {
            Object.values(scene.modules).forEach(mod => usedTypes.add(mod.type));
        });
        for (const t of usedTypes) {
            if (t && !config.Modules.includes(t)) {
                // Insert before 'scene' (which should always be last)
                const idx = config.Modules.indexOf('scene');
                config.Modules.splice(idx >= 0 ? idx : config.Modules.length, 0, t);
            }
        }

        config.DefaultScene = this.globalConfig.DefaultScene || Object.keys(this.scenes)[0] || "";

        // Convert scenes — translate pixel areas to the format config.js expects
        config.Scenes = {};
        for (const [sceneName, scene] of Object.entries(this.scenes)) {
            const sceneConfig = {
                obsScene: scene.obsScene || '',
                transition: scene.transition,
                modules: {}
            };

            for (const [id, mod] of Object.entries(scene.modules)) {
                // Use the user-set ID as the config key
                let configKey = id;

                // Handle collision (shouldn't happen, but safety)
                if (sceneConfig.modules[configKey]) {
                    let c = 1;
                    while (sceneConfig.modules[`${configKey}_${c}`]) c++;
                    configKey = `${configKey}_${c}`;
                }

                const area = {
                    x: Math.round(mod.area.x),
                    y: Math.round(mod.area.y),
                    width: Math.round(mod.area.width),
                    height: Math.round(mod.area.height)
                };

                sceneConfig.modules[configKey] = { area, _type: mod.type };

                // Add visibility if hidden
                if (mod.visible === false) {
                    sceneConfig.modules[configKey].visible = false;
                }

                // Add media settings if applicable
                if (mod.settings && Object.keys(mod.settings).length > 0) {
                    sceneConfig.modules[configKey].settings = mod.settings;
                }
            }

            config.Scenes[sceneName] = sceneConfig;
        }

        return config;
    },

    // Load from imported config
    loadConfig(config) {
        // Canvas size from config (persists across installs)
        this.canvasWidth = config.CanvasWidth || 1920;
        this.canvasHeight = config.CanvasHeight || 1080;

        this.globalConfig = {
            Name: config.Name || "",
            CanvasWidth: this.canvasWidth,
            CanvasHeight: this.canvasHeight,
            StreamerBot: config.StreamerBot || {},
            ChannelName: config.ChannelName || "",
            TwitchID: config.TwitchID || "",
            Modules: config.Modules || [],
            Bots: config.Bots || [],
            DefaultScene: config.DefaultScene || "",
            AudioVisualiser: config.AudioVisualiser || {},
            emote: config.emote || {},
            chat: config.chat || {},
            webcam: config.webcam || {}
        };

        this.scenes = {};
        if (config.Scenes) {
            for (const [sceneName, scene] of Object.entries(config.Scenes)) {
                this.scenes[sceneName] = {
                    obsScene: scene.obsScene || '',
                    transition: scene.transition || { type: "fade", duration: 0.5 },
                    modules: {}
                };

                if (scene.modules) {
                    for (const [modKey, modData] of Object.entries(scene.modules)) {
                        // Use _type field if present, otherwise determine type from key (strip _N suffix)
                        const type = modData._type || modKey.replace(/_\d+$/, '');
                        this.scenes[sceneName].modules[modKey] = {
                            type,
                            area: this.parseArea(modData.area),
                            settings: modData.settings || this.getDefaultSettings(type),
                            visible: modData.visible !== false
                        };
                    }
                }
            }
        }

        // Ensure scenes exist — handle old configs without Scenes property
        if (Object.keys(this.scenes).length === 0) {
            this.scenes['Default'] = {
                obsScene: '',
                transition: { type: "fade", duration: 0.5 },
                modules: {}
            };
            this.globalConfig.DefaultScene = 'Default';
        }

        // Ensure default scene exists
        if (!this.globalConfig.DefaultScene) {
            this.globalConfig.DefaultScene = 'Default';
        }

        if (!this.scenes[this.globalConfig.DefaultScene]) {
            // DefaultScene points to a non-existent scene — reset to "Default"
            this.globalConfig.DefaultScene = 'Default';
            if (!this.scenes['Default']) {
                this.scenes['Default'] = {
                    obsScene: '',
                    transition: { type: "fade", duration: 0.5 },
                    modules: {}
                };
            }
        }

        this.activeScene = this.globalConfig.DefaultScene;

        // Restore last active scene from localStorage if it still exists
        const savedScene = localStorage.getItem('editorActiveScene');
        if (savedScene && this.scenes[savedScene]) {
            this.activeScene = savedScene;
        }

        this.selectedModule = null;
        this.dirty = false;
        this.notify('load');
    }
};
