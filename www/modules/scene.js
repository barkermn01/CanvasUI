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
            this.#applyChatLayout();
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

            if (typeof originalDraw === 'function') {
                mod.draw = (ctx) => {
                    if (!self.isEnabled || !self.#activeScene) {
                        originalDraw(ctx);
                        return;
                    }
                    if (!self.#isModuleInScene(mod.name)) return;

                    const area = self.#getModuleArea(mod.name, ctx.canvas.width, ctx.canvas.height);
                    if (area) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(area.x, area.y, area.width, area.height);
                        ctx.clip();
                        originalDraw(ctx);
                        ctx.restore();
                    } else {
                        originalDraw(ctx);
                    }
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

    #isModuleInScene(moduleName) {
        const scene = this.#scenes[this.#activeScene];
        if (!scene || !scene.modules) return true;
        return Object.keys(scene.modules).some(k => k.toLowerCase() === moduleName.toLowerCase());
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
        this.#applyChatLayout();

        console.log("Scene switched to:", sceneName);
    }

    #applyChatLayout() {
        const scene = this.#scenes[this.#activeScene];
        const containers = [
            document.getElementById('chatMessageArea'),
            document.getElementById('chatMainContainer')
        ];

        if (!scene || !scene.modules) {
            containers.forEach(c => { if (c) c.style.display = ''; });
            return;
        }

        const chatKey = Object.keys(scene.modules).find(k => k.toLowerCase() === "chat");

        // If chat is not in this scene, hide it
        if (!chatKey) {
            containers.forEach(c => { if (c) c.style.display = 'none'; });
            return;
        }

        // Chat is in the scene — show and position it
        containers.forEach(c => { if (c) c.style.display = ''; });

        if (!scene.modules[chatKey].area) return;

        const a = scene.modules[chatKey].area;
        containers.forEach(container => {
            if (!container) return;

            // Handle pixel-based x/y format (from editor)
            if (a.x !== undefined || a.y !== undefined) {
                container.style.left = (a.x || 0) + 'px';
                container.style.top = (a.y || 0) + 'px';
                container.style.width = (a.width || 300) + 'px';
                container.style.height = (a.height || 200) + 'px';
                container.style.right = '';
                container.style.bottom = '';
            } else {
                // Handle CSS-style format (legacy)
                if (a.left !== undefined) container.style.left = a.left;
                if (a.top !== undefined) container.style.top = a.top;
                if (a.width !== undefined) container.style.width = a.width;
                if (a.height !== undefined) container.style.height = a.height;
                if (a.right !== undefined) container.style.right = a.right;
                if (a.bottom !== undefined) container.style.bottom = a.bottom;
            }
        });
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
        if (!this.#transitioning) return;
        if (this.#transitionType === "fade") {
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
