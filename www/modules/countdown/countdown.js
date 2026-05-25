/**
 * Countdown Timer Module
 *
 * Messages:
 * { Module: "countdown", Data: { Type: "Start" } }
 * { Module: "countdown", Data: { Type: "Start", minutes: 10, seconds: 0 } }
 * { Module: "countdown", Data: { Type: "Stop" } }
 * { Module: "countdown", Data: { Type: "Reset" } }
 */

if (!window.CountdownModule) {

class CountdownMain {
    #remaining = 0; // seconds remaining
    #running = false;
    #finished = false;

    constructor() {}

    update(dt, settings) {
        if (!settings) return;

        // Auto-start on first update if configured
        if (!this.#running && !this.#finished && settings.autoStart && this.#remaining === 0) {
            this.#remaining = (settings.minutes ?? 5) * 60 + (settings.seconds ?? 0);
            this.#running = true;
        }

        if (this.#running && this.#remaining > 0) {
            this.#remaining -= dt;
            if (this.#remaining <= 0) {
                this.#remaining = 0;
                this.#running = false;
                this.#finished = true;
            }
        }
    }

    draw(ctx, settings, area) {
        if (!area) return;

        const fontSize = settings?.fontSize || 64;
        const fontFamily = settings?.fontFamily || 'monospace';
        const color = settings?.color || '#ffffff';
        const endColor = settings?.endColor || '#10b981';
        const endText = settings?.endText || 'LIVE!';
        const align = settings?.align || 'center';

        let text;
        let textColor;

        if (this.#finished) {
            text = endText;
            textColor = endColor;
        } else if (this.#remaining > 0 || this.#running) {
            const totalSecs = Math.ceil(this.#remaining);
            const mins = Math.floor(totalSecs / 60);
            const secs = totalSecs % 60;
            text = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            textColor = color;
        } else {
            // Not started yet — show initial time
            const mins = settings?.minutes ?? 5;
            const secs = settings?.seconds ?? 0;
            text = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            textColor = color;
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
        ctx.fillStyle = textColor;
        ctx.textBaseline = 'middle';

        let x;
        if (align === 'left') { ctx.textAlign = 'left'; x = area.x; }
        else if (align === 'right') { ctx.textAlign = 'right'; x = area.x + area.width; }
        else { ctx.textAlign = 'center'; x = area.x + area.width / 2; }

        ctx.fillText(text, x, area.y + area.height / 2);
        ctx.restore();
    }

    onMessage(data) {
        switch (data.Type) {
            case 'Start':
                if (data.minutes !== undefined || data.seconds !== undefined) {
                    this.#remaining = (data.minutes || 0) * 60 + (data.seconds || 0);
                }
                this.#running = true;
                this.#finished = false;
                break;
            case 'Stop':
                this.#running = false;
                break;
            case 'Reset':
                this.#running = false;
                this.#finished = false;
                this.#remaining = 0;
                break;
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
                // Get module area for correct resolution
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
                start: (canvas, settings) => {
                    // Start the countdown when simulation begins
                    self.onMessage({ Type: 'Start', minutes: settings?.minutes ?? 5, seconds: settings?.seconds ?? 0 });
                },
                update: (settings, area, dt) => { self.update(dt, settings); },
                draw: (ctx, settings, area) => { self.draw(ctx, settings, area); },
                stop: () => {
                    self.onMessage({ Type: 'Reset' });
                }
            },
            dispose: () => {}
        });
    }
}

window.CountdownModule = {
    _main: CountdownMain,
    _simulator: CountdownMain
};

} // end if (!window.CountdownModule)

if (document.getElementById('canvas')) {
    const instance = new window.CountdownModule._main();
    let lastSettings = null;

    window.Modules.push({
        name: "countdown",
        draw: (ctx, settings, area) => {
            if (settings) lastSettings = settings;
            instance.draw(ctx, settings, area);
        },
        update: (dt) => {
            instance.update(dt, lastSettings || Config.countdown || {});
        },
        message: (data) => {
            instance.onMessage(data);
        }
    });
}
