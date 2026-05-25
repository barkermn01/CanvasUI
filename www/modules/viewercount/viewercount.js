/**
 * Viewer Count Module
 * Combined viewer count across Twitch and Kick via native Streamer.bot events.
 */

if (!window.ViewerCountModule) {

class ViewerCountMain {
    #twitchCount = 0;
    #kickCount = 0;

    constructor() {}

    setTwitchCount(count) { this.#twitchCount = count; }
    setKickCount(count) { this.#kickCount = count; }

    update(dt, settings) {}

    draw(ctx, settings, area) {
        if (!area) return;

        const mode = settings?.displayMode || 'combined';
        const prefix = settings?.prefix ?? '👁️ ';
        const fontSize = settings?.fontSize || 32;
        const fontFamily = settings?.fontFamily || 'sans-serif';
        const color = settings?.color || '#ffffff';
        const align = settings?.align || 'center';

        let text;
        switch (mode) {
            case 'combined':
                text = `${prefix}${this.#twitchCount + this.#kickCount}`;
                break;
            case 'separate':
                text = `${prefix}T:${this.#twitchCount} K:${this.#kickCount}`;
                break;
            case 'twitch-only':
                text = `${prefix}${this.#twitchCount}`;
                break;
            case 'kick-only':
                text = `${prefix}${this.#kickCount}`;
                break;
            default:
                text = `${prefix}${this.#twitchCount + this.#kickCount}`;
        }

        ctx.save();

        // Auto-scale font to fit within the area
        let actualFontSize = fontSize;
        ctx.font = `bold ${actualFontSize}px ${fontFamily}`;
        let textWidth = ctx.measureText(text).width;
        if (textWidth > area.width) {
            actualFontSize = Math.floor(actualFontSize * (area.width / textWidth));
        }
        if (actualFontSize > area.height * 0.8) {
            actualFontSize = Math.floor(area.height * 0.8);
        }

        ctx.font = `bold ${actualFontSize}px ${fontFamily}`;
        ctx.fillStyle = color;
        ctx.textBaseline = 'middle';

        let x;
        if (align === 'left') { ctx.textAlign = 'left'; x = area.x; }
        else if (align === 'right') { ctx.textAlign = 'right'; x = area.x + area.width; }
        else { ctx.textAlign = 'center'; x = area.x + area.width / 2; }

        ctx.fillText(text, x, area.y + area.height / 2);
        ctx.restore();
    }

    onMessage(data) {
        // Handle custom action messages for viewer count
        if (data.Type === 'ViewerCount') {
            if (data.Platform === 'twitch' || data.Platform === 'Twitch') {
                this.#twitchCount = data.Count || 0;
            } else if (data.Platform === 'kick' || data.Platform === 'Kick') {
                this.#kickCount = data.Count || 0;
            }
        }
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
                // Set sample count for preview
                self.setTwitchCount(42);
                self.setKickCount(13);
                const ctx = canvas.getContext('2d');
                const area = { x: 0, y: 0, width: w, height: h };
                self.draw(ctx, settings, area);
            },
            simulate: {
                start: () => {},
                update: (settings, area, dt) => {},
                draw: (ctx, settings, area) => { self.draw(ctx, settings, area); },
                stop: () => {}
            },
            dispose: () => {}
        });
    }
}

window.ViewerCountModule = {
    _main: ViewerCountMain,
    _simulator: ViewerCountMain
};

} // end if (!window.ViewerCountModule)

if (document.getElementById('canvas')) {
    const instance = new window.ViewerCountModule._main();
    let lastSettings = null;

    window.Modules.push({
        name: "viewercount",
        draw: (ctx, settings, area) => {
            if (settings) lastSettings = settings;
            instance.draw(ctx, settings, area);
        },
        update: (dt) => {
            instance.update(dt, lastSettings || Config.viewercount || {});
        },
        events: {
            "Twitch.ViewerCountUpdate": (data) => {
                instance.setTwitchCount(data.viewers || data.viewerCount || 0);
            },
            "Kick.ViewerCountUpdate": (data) => {
                instance.setKickCount(data.viewers || data.viewerCount || 0);
            }
        }
    });
}
