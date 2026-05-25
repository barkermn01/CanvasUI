/**
 * Hype Train Module
 *
 * Messages:
 * { Module: "hypetrain", Data: { Type: "Update", level: 3, progress: 0.65, total: 5 } }
 * { Module: "hypetrain", Data: { Type: "End" } }
 */

if (!window.HypeTrainModule) {

class HypeTrainMain {
    #active = false;
    #level = 0;
    #progress = 0;
    #totalLevels = 5;
    #displayProgress = 0;

    constructor() {}

    update(dt, settings) {
        const diff = this.#progress - this.#displayProgress;
        if (Math.abs(diff) > 0.001) {
            this.#displayProgress += diff * Math.min(5 * dt, 1);
        } else {
            this.#displayProgress = this.#progress;
        }
    }

    draw(ctx, settings, area) {
        if (!area) return;
        if (!this.#active && (settings?.hideWhenInactive !== false)) return;

        const fontSize = settings?.fontSize || 28;
        const barColor = settings?.barColor || '#f43f5e';
        const bgColor = settings?.backgroundColor || '#1f2937';
        const textColor = settings?.textColor || '#ffffff';

        ctx.save();

        // Level text
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`🚂 HYPE TRAIN — Level ${this.#level}`, area.x + area.width / 2, area.y);

        // Progress bar
        const barY = area.y + fontSize + 8;
        const barH = area.height - fontSize - 8;
        const barRadius = Math.min(barH / 2, 8);

        // Background
        this.#roundRect(ctx, area.x, barY, area.width, barH, barRadius);
        ctx.fillStyle = bgColor;
        ctx.fill();

        // Fill
        const fillW = area.width * this.#displayProgress;
        if (fillW > 0) {
            this.#roundRect(ctx, area.x, barY, fillW, barH, barRadius);
            ctx.fillStyle = barColor;
            ctx.fill();
        }

        // Progress text
        ctx.font = `bold ${Math.max(12, barH * 0.6)}px sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.floor(this.#displayProgress * 100)}%`, area.x + area.width / 2, barY + barH / 2);

        ctx.restore();
    }

    #roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    onMessage(data) {
        switch (data.Type) {
            case 'Update':
                this.#active = true;
                this.#level = data.level ?? this.#level;
                this.#progress = data.progress ?? this.#progress;
                this.#displayProgress = this.#progress; // Snap for immediate render
                this.#totalLevels = data.total ?? this.#totalLevels;
                break;
            case 'End':
                this.#active = false;
                this.#progress = 0;
                this.#displayProgress = 0;
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
                const moduleEl = container.closest('[data-module-id]');
                const moduleId = moduleEl?.dataset.moduleId;
                const mod = moduleId ? EditorState.getActiveSceneModules()[moduleId] : null;
                const w = mod ? mod.area.width : 300;
                const h = mod ? mod.area.height : 200;
                canvas.width = w;
                canvas.height = h;
                // Force active for preview
                self.onMessage({ Type: 'Update', level: 2, progress: 0.45, total: 5 });
                const ctx = canvas.getContext('2d');
                const area = { x: 0, y: 0, width: w, height: h };
                self.draw(ctx, settings, area);
            },
            simulate: {
                _simProgress: 0.2,
                _simLevel: 1,
                start: function() {
                    this._simProgress = 0.2;
                    this._simLevel = 1;
                    self.onMessage({ Type: 'Update', level: 1, progress: 0.2, total: 5 });
                },
                update: function(settings, area, dt) {
                    self.update(dt, settings);
                    this._simProgress += 0.05 * dt;
                    if (this._simProgress >= 1) {
                        this._simLevel++;
                        this._simProgress = 0;
                        if (this._simLevel > 5) this._simLevel = 1;
                    }
                    self.onMessage({ Type: 'Update', level: this._simLevel, progress: this._simProgress, total: 5 });
                },
                draw: (ctx, settings, area) => { self.draw(ctx, settings, area); },
                stop: () => {
                    self.onMessage({ Type: 'End' });
                }
            },
            dispose: () => {}
        });
    }
}

window.HypeTrainModule = {
    _main: HypeTrainMain,
    _simulator: HypeTrainMain
};

} // end if (!window.HypeTrainModule)

if (document.getElementById('canvas')) {
    const instance = new window.HypeTrainModule._main();
    let lastSettings = null;

    window.Modules.push({
        name: "hypetrain",
        draw: (ctx, settings, area) => {
            if (settings) lastSettings = settings;
            instance.draw(ctx, settings, area);
        },
        update: (dt) => {
            instance.update(dt, lastSettings || Config.hypetrain || {});
        },
        events: {
            "Twitch.HypeTrainStart": (data) => {
                instance.onMessage({ Type: 'Update', level: data.level ?? 1, progress: data.goal ? (data.progress / data.goal) : 0, total: 5 });
            },
            "Twitch.HypeTrainUpdate": (data) => {
                instance.onMessage({ Type: 'Update', level: data.level ?? 1, progress: data.goal ? (data.progress / data.goal) : 0, total: 5 });
            },
            "Twitch.HypeTrainLevelUp": (data) => {
                instance.onMessage({ Type: 'Update', level: data.level ?? 1, progress: data.goal ? (data.progress / data.goal) : 0, total: 5 });
            },
            "Twitch.HypeTrainEnd": () => {
                instance.onMessage({ Type: 'End' });
            }
        }
    });
}
