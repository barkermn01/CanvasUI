/**
 * Spritesheet Module
 * Animated spritesheet player for borders, frames, and effects.
 */

if (!window.SpritesheetModule) {

class SpritesheetMain {
    #imageCache = new Map();
    #currentFrame = 0;
    #elapsed = 0;

    constructor() {}

    #getImage(src) {
        if (!src) return null;
        let resolvedSrc = src;
        if (typeof EditorPrefs !== 'undefined' && src.startsWith('/')) {
            const host = EditorPrefs.get('serverHost', '127.0.0.1');
            const port = EditorPrefs.get('serverPort', 31589);
            resolvedSrc = `http://${host}:${port}${src}`;
        }
        if (this.#imageCache.has(resolvedSrc)) return this.#imageCache.get(resolvedSrc);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = resolvedSrc;
        const entry = { img, ready: false };
        img.onload = () => {
            entry.ready = true;
            if (typeof EditorState !== 'undefined') {
                EditorState.notify('module-settings');
            }
        };
        this.#imageCache.set(resolvedSrc, entry);
        return entry;
    }

    update(dt, settings) {
        if (!settings) return;
        const fps = settings.fps || 12;
        const frameCount = settings.frameCount || 8;
        const loop = settings.loop !== false;

        this.#elapsed += dt;
        const frameDuration = 1 / fps;

        if (this.#elapsed >= frameDuration) {
            this.#elapsed -= frameDuration;
            this.#currentFrame++;
            if (this.#currentFrame >= frameCount) {
                this.#currentFrame = loop ? 0 : frameCount - 1;
            }
        }
    }

    draw(ctx, settings, area) {
        if (!area) return;

        const src = settings?.src;
        if (!src) return;

        const entry = this.#getImage(src);
        if (!entry || !entry.ready) return;

        const frameWidth = settings?.frameWidth || 128;
        const frameHeight = settings?.frameHeight || 128;
        const columns = settings?.columns || 8;
        const offsetX = settings?.offsetX || 0;
        const offsetY = settings?.offsetY || 0;

        const col = this.#currentFrame % columns;
        const row = Math.floor(this.#currentFrame / columns);
        const sx = offsetX + col * frameWidth;
        const sy = offsetY + row * frameHeight;

        ctx.drawImage(entry.img, sx, sy, frameWidth, frameHeight, area.x, area.y, area.width, area.height);
    }

    editorRegister(register) {
        const self = this;
        register({
            preview: (container, settings) => {
                container.innerHTML = '';
                container.style.cssText = 'position:relative; pointer-events:none;';
                const canvas = document.createElement('canvas');
                canvas.style.cssText = 'width:100%; height:100%; display:block;';
                container.appendChild(canvas);
                const moduleEl = container.closest('[data-module-id]');
                const moduleId = moduleEl?.dataset.moduleId;
                const mod = moduleId ? EditorState.getActiveSceneModules()[moduleId] : null;
                const w = mod ? mod.area.width : 300;
                const h = mod ? mod.area.height : 200;
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                const area = { x: 0, y: 0, width: w, height: h };
                self.draw(ctx, settings, area);
            },
            simulate: {
                start: () => {},
                update: (settings, area, dt) => { self.update(dt, settings); },
                draw: (ctx, settings, area) => { self.draw(ctx, settings, area); },
                stop: () => {}
            },
            dispose: () => {}
        });
    }
}

window.SpritesheetModule = {
    _main: SpritesheetMain,
    _simulator: SpritesheetMain
};

} // end if (!window.SpritesheetModule)

if (document.getElementById('canvas')) {
    const instance = new window.SpritesheetModule._main();
    let lastSettings = null;

    window.Modules.push({
        name: "spritesheet",
        draw: (ctx, settings, area) => {
            if (settings) lastSettings = settings;
            instance.draw(ctx, settings, area);
        },
        update: (dt) => {
            instance.update(dt, lastSettings || Config.spritesheet || {});
        }
    });
}
