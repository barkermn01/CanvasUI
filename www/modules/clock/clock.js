/**
 * Clock Module
 * Displays current time, date, or stream uptime.
 */

if (!window.ClockModule) {

class ClockModuleMain {
    #streamStartTime = null;

    constructor() {}

    update(dt, settings) {
        // Set stream start time if in uptime mode and not yet set
        if (settings?.mode === 'uptime' && !this.#streamStartTime) {
            if (settings.streamStartTime) {
                this.#streamStartTime = new Date(settings.streamStartTime);
            } else {
                // Default to now (will be overridden by Streamer.bot event)
                this.#streamStartTime = new Date();
            }
        }
    }

    draw(ctx, settings, area) {
        if (!area) return;

        const mode = settings?.mode || 'clock';
        const format24h = settings?.format24h !== false;
        const showSeconds = settings?.showSeconds !== false;
        const maxFontSize = settings?.fontSize || 48;
        const fontFamily = settings?.fontFamily || 'monospace';
        const color = settings?.color || '#ffffff';
        const align = settings?.align || 'center';

        const text = this.#formatTime(mode, format24h, showSeconds);

        // Auto-scale font to fit within the area
        let fontSize = maxFontSize;
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        let textWidth = ctx.measureText(text).width;
        if (textWidth > area.width) {
            fontSize = Math.floor(fontSize * (area.width / textWidth));
        }
        if (fontSize > area.height * 0.8) {
            fontSize = Math.floor(area.height * 0.8);
        }

        ctx.save();
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = color;
        ctx.textBaseline = 'middle';

        let x;
        if (align === 'left') {
            ctx.textAlign = 'left';
            x = area.x;
        } else if (align === 'right') {
            ctx.textAlign = 'right';
            x = area.x + area.width;
        } else {
            ctx.textAlign = 'center';
            x = area.x + area.width / 2;
        }

        const y = area.y + area.height / 2;
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    #formatTime(mode, format24h, showSeconds) {
        const now = new Date();

        switch (mode) {
            case 'clock': {
                let h = now.getHours();
                const m = String(now.getMinutes()).padStart(2, '0');
                const s = String(now.getSeconds()).padStart(2, '0');
                let suffix = '';
                if (!format24h) {
                    suffix = h >= 12 ? ' PM' : ' AM';
                    h = h % 12 || 12;
                }
                const hStr = String(h).padStart(2, '0');
                return showSeconds ? `${hStr}:${m}:${s}${suffix}` : `${hStr}:${m}${suffix}`;
            }
            case 'date': {
                const day = String(now.getDate()).padStart(2, '0');
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const year = now.getFullYear();
                return `${day}/${month}/${year}`;
            }
            case 'datetime': {
                let h = now.getHours();
                const m = String(now.getMinutes()).padStart(2, '0');
                const s = String(now.getSeconds()).padStart(2, '0');
                let suffix = '';
                if (!format24h) {
                    suffix = h >= 12 ? ' PM' : ' AM';
                    h = h % 12 || 12;
                }
                const hStr = String(h).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const time = showSeconds ? `${hStr}:${m}:${s}${suffix}` : `${hStr}:${m}${suffix}`;
                return `${day}/${month} ${time}`;
            }
            case 'uptime': {
                if (!this.#streamStartTime) return '00:00:00';
                const elapsed = Math.max(0, Math.floor((now - this.#streamStartTime) / 1000));
                const hours = Math.floor(elapsed / 3600);
                const mins = Math.floor((elapsed % 3600) / 60);
                const secs = elapsed % 60;
                const hStr = String(hours).padStart(2, '0');
                const mStr = String(mins).padStart(2, '0');
                const sStr = String(secs).padStart(2, '0');
                return showSeconds ? `${hStr}:${mStr}:${sStr}` : `${hStr}:${mStr}`;
            }
            default:
                return '';
        }
    }

    onMessage(data) {
        // Handle stream start event from Streamer.bot
        if (data.Type === 'StreamStart' || data.Type === 'StreamOnline') {
            this.#streamStartTime = new Date();
        }
    }

    editorRegister(register) {
        const self = this;
        register({
            preview: (container, settings) => {
                container.innerHTML = '';
                container.style.cssText = 'display:flex; align-items:center; justify-content:center; pointer-events:none;';
                const label = document.createElement('div');
                label.style.cssText = `font-size:14px; font-family:${settings?.fontFamily || 'monospace'}; color:${settings?.color || '#fff'}; opacity:0.6;`;
                label.textContent = '⏱ Clock (press ▶)';
                container.appendChild(label);
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

window.ClockModule = {
    _main: ClockModuleMain,
    _simulator: ClockModuleMain
};

} // end if (!window.ClockModule)

if (document.getElementById('canvas')) {
    const instance = new window.ClockModule._main();
    let lastSettings = null;

    window.Modules.push({
        name: "clock",
        draw: (ctx, settings, area) => {
            if (settings) lastSettings = settings;
            instance.draw(ctx, settings, area);
        },
        update: (dt) => {
            instance.update(dt, lastSettings || Config.clock || {});
        },
        events: {
            "Twitch.StreamOnline": () => {
                instance.onMessage({ Type: 'StreamStart' });
            },
            "Kick.StreamOnline": () => {
                instance.onMessage({ Type: 'StreamStart' });
            }
        }
    });
}
