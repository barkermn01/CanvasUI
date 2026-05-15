class SceneManager {
    #scenes = {};
    #activeScene = null;
    #transitioning = false;
    #transitionProgress = 0;
    #transitionDuration = 0.5;
    #transitionType = "fade";

    // Store original draw/update refs so we can wrap them
    #wrappedModules = new Map();

    constructor() {
        if (!Config.Scenes) {
            console.warn("No Scenes defined in Config, SceneManager disabled");
            return;
        }

        this.#scenes = Config.Scenes;
        let defaultScene = Config.DefaultScene;

        // If default scene doesn't exist, fall back to first available scene
        if (!defaultScene || !this.#scenes[defaultScene]) {
            defaultScene = Object.keys(this.#scenes)[0] || null;
            console.warn("DefaultScene not found, falling back to:", defaultScene);
        }

        if (defaultScene && this.#scenes[defaultScene]) {
            this.#activeScene = defaultScene;
        }

        // Wrap other modules' draw/update after a tick so they're all registered
        setTimeout(() => {
            this.#wrapModules();
        }, 0);

        console.log("SceneManager initialized, active scene:", this.#activeScene);
    }

    get isEnabled() { return Object.keys(this.#scenes).length > 0; }

    #wrapModules() {
        window.Modules.forEach(mod => {
            if (mod.name.toLowerCase() === "scene") return;

            const originalDraw = mod.draw;
            const originalUpdate = mod.update;
            const self = this;

            this.#wrappedModules.set(mod.name.toLowerCase(), { originalDraw, originalUpdate });

            // Suppress individual module draw calls — scene system handles draw order
            if (typeof originalDraw === 'function') {
                mod.draw = (ctx) => {
                    if (!self.isEnabled || !self.#activeScene) {
                        originalDraw(ctx);
                    }
                    // When scene is active, drawing is handled by scene's own draw pass
                };
            }

            if (typeof originalUpdate === 'function') {
                mod.update = (dt) => {
                    if (!self.isEnabled || !self.#activeScene) {
                        originalUpdate(dt);
                        return;
                    }
                    if (!self.#isModuleInScene(mod.name)) return;
                    originalUpdate(dt);
                };
            }
        });
    }

    #getModuleInstances(moduleName) {
        const scene = this.#scenes[this.#activeScene];
        if (!scene || !scene.modules) return [];

        const instances = [];
        const nameLower = moduleName.toLowerCase();

        for (const [key, mod] of Object.entries(scene.modules)) {
            // Use _type field if present, otherwise fall back to key-based matching
            const modType = (mod._type || key.replace(/_\d+$/, '')).toLowerCase();
            if (modType !== nameLower) continue;

            const area = mod.area ? {
                x: this.#parseValue(mod.area.x, 1920) || 0,
                y: this.#parseValue(mod.area.y, 1080) || 0,
                width: this.#parseValue(mod.area.width, 1920) || 1920,
                height: this.#parseValue(mod.area.height, 1080) || 1080
            } : null;
            instances.push({
                key,
                area,
                settings: mod.settings || {}
            });
        }

        return instances;
    }

    #isModuleInScene(moduleName) {
        const scene = this.#scenes[this.#activeScene];
        if (!scene || !scene.modules) return true;
        const nameLower = moduleName.toLowerCase();
        return Object.entries(scene.modules).some(([key, mod]) => {
            const modType = (mod._type || key.replace(/_\d+$/, '')).toLowerCase();
            return modType === nameLower;
        });
    }

    #getModuleArea(moduleName, canvasWidth, canvasHeight) {
        const scene = this.#scenes[this.#activeScene];
        if (!scene || !scene.modules) return null;

        const key = Object.keys(scene.modules).find(k => k.toLowerCase() === moduleName.toLowerCase());
        if (!key || !scene.modules[key].area) return null;

        const layout = scene.modules[key].area;
        return {
            x: this.#parseValue(layout.x, canvasWidth) || 0,
            y: this.#parseValue(layout.y, canvasHeight) || 0,
            width: this.#parseValue(layout.width, canvasWidth) || canvasWidth,
            height: this.#parseValue(layout.height, canvasHeight) || canvasHeight
        };
    }

    #parseValue(value, dimension) {
        if (value === undefined || value === null) return null;
        if (typeof value === 'number') return value;
        if (typeof value !== 'string') return 0;
        if (value.endsWith('%')) return (parseInt(value) / 100) * dimension;
        if (value.endsWith('px')) return parseInt(value);
        return parseInt(value) || 0;
    }

    switchScene(sceneName, transition) {
        if (!this.#scenes[sceneName]) {
            // Fall back to default scene if requested scene not found
            const defaultScene = Config.DefaultScene || Object.keys(this.#scenes)[0];
            if (defaultScene && this.#scenes[defaultScene] && sceneName !== defaultScene) {
                console.warn("Scene not found:", sceneName, "— falling back to default:", defaultScene);
                sceneName = defaultScene;
            } else {
                console.warn("Scene not found:", sceneName);
                return;
            }
        }
        if (sceneName === this.#activeScene) return;

        const t = transition || this.#scenes[sceneName].transition || {};
        this.#transitionType = t.type || "fade";
        this.#transitionDuration = t.duration || 0.5;
        this.#transitionProgress = 0;
        this.#transitioning = true;

        this.#activeScene = sceneName;

        console.log("Scene switched to:", sceneName);
    }

    update(dt) {
        if (!this.#transitioning) return;
        this.#transitionProgress += dt / this.#transitionDuration;
        if (this.#transitionProgress >= 1) {
            this.#transitionProgress = 1;
            this.#transitioning = false;
        }
    }

    draw(ctx) {
        if (!this.isEnabled || !this.#activeScene) return;

        const scene = this.#scenes[this.#activeScene];
        if (!scene || !scene.modules) return;

        // Draw all modules in scene config order (this IS the z-order)
        for (const [key, mod] of Object.entries(scene.modules)) {
            // Skip hidden modules
            if (mod.visible === false) continue;

            const modType = (mod._type || key.replace(/_\d+$/, '')).toLowerCase();
            const wrapped = this.#wrappedModules.get(modType);
            if (!wrapped || !wrapped.originalDraw) continue;

            const area = mod.area ? {
                x: this.#parseValue(mod.area.x, ctx.canvas.width) || 0,
                y: this.#parseValue(mod.area.y, ctx.canvas.height) || 0,
                width: this.#parseValue(mod.area.width, ctx.canvas.width) || ctx.canvas.width,
                height: this.#parseValue(mod.area.height, ctx.canvas.height) || ctx.canvas.height
            } : null;

            ctx.save();
            if (area) {
                ctx.beginPath();
                ctx.rect(area.x, area.y, area.width, area.height);
                ctx.clip();
            }
            wrapped.originalDraw(ctx, mod.settings || {}, area);
            ctx.restore();
        }

        // Draw transition overlay
        if (this.#transitioning && this.#transitionType === "fade") {
            ctx.save();
            ctx.globalAlpha = (1 - this.#transitionProgress) * 0.5;
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.restore();
        }
    }

    onMessage(data) {
        if (data.Type === "SceneChange" && data.Scene) {
            // Look up by obsScene property first, fall back to scene name, then default
            const sceneName = this.#findSceneByObs(data.Scene) || data.Scene;
            this.switchScene(sceneName, data.Transition);
        }
    }

    #findSceneByObs(obsSceneName) {
        for (const [name, scene] of Object.entries(this.#scenes)) {
            if (scene.obsScene && scene.obsScene === obsSceneName) {
                return name;
            }
        }
        return null;
    }
}

const sceneManagerInstance = new SceneManager();

window.Modules.push({
    name: "scene",
    update: (dt) => {
        sceneManagerInstance.update(dt);
    },
    draw: (ctx) => {
        sceneManagerInstance.draw(ctx);
    },
    message: (data) => {
        sceneManagerInstance.onMessage(data);
    }
});
