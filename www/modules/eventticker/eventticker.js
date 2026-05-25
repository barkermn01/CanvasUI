/**
 * Event Ticker Module
 * Scrolling ticker of recent stream events.
 *
 * Message: { Module: "eventticker", Data: { Type: "Event", text: "User123 followed!" } }
 * Or clear: { Module: "eventticker", Data: { Type: "Clear" } }
 */

if (!window.EventTickerModule) {

class EventTickerMain {
    #events = [];
    #scrollOffset = 0;
    #textWidth = 0;

    constructor() {}

    addEvent(text) {
        if (text) {
            this.#events.push(text);
            const max = 20;
            if (this.#events.length > max) {
                this.#events = this.#events.slice(-max);
            }
        }
    }

    update(dt, settings) {
        if (!settings) return;
        const speed = settings.speed || 60;
        this.#scrollOffset -= speed * dt;
    }

    draw(ctx, settings, area) {
        if (!area || this.#events.length === 0) return;

        const separator = settings?.separator || ' ★ ';
        const fontSize = settings?.fontSize || 18;
        const fontFamily = settings?.fontFamily || 'sans-serif';
        const color = settings?.color || '#ffffff';
        const bgColor = settings?.backgroundColor || 'rgba(0,0,0,0.5)';
        const padding = settings?.padding ?? 4;
        const borderRadius = settings?.borderRadius || 0;

        ctx.save();

        // Background
        if (bgColor && bgColor !== 'rgba(0,0,0,0)' && bgColor !== 'transparent') {
            if (borderRadius > 0) {
                this.#roundRect(ctx, area.x, area.y, area.width, area.height, borderRadius);
                ctx.fillStyle = bgColor;
                ctx.fill();
            } else {
                ctx.fillStyle = bgColor;
                ctx.fillRect(area.x, area.y, area.width, area.height);
            }
        }

        // Clip to area
        ctx.beginPath();
        ctx.rect(area.x, area.y, area.width, area.height);
        ctx.clip();

        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = color;
        ctx.textBaseline = 'middle';

        // Build the full ticker string
        const fullText = this.#events.join(separator) + separator;
        this.#textWidth = ctx.measureText(fullText).width;

        // Reset scroll when fully scrolled past
        if (this.#textWidth > 0 && this.#scrollOffset < -this.#textWidth) {
            this.#scrollOffset += this.#textWidth;
        }

        const y = area.y + area.height / 2;

        // Draw text twice for seamless loop
        let x = area.x + padding + this.#scrollOffset;
        ctx.fillText(fullText, x, y);
        ctx.fillText(fullText, x + this.#textWidth, y);

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
            case 'Event':
                this.addEvent(data.text);
                break;
            case 'Clear':
                this.#events = [];
                this.#scrollOffset = 0;
                break;
        }
    }

    editorRegister(register) {
        const self = this;

        // Add sample events for editor preview
        if (self.#events.length === 0) {
            self.addEvent('User123 followed!');
            self.addEvent('StreamFan subscribed!');
            self.addEvent('BigDonor cheered 500 bits!');
            self.addEvent('RaidLeader raided with 42 viewers!');
        }

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

window.EventTickerModule = {
    _main: EventTickerMain,
    _simulator: EventTickerMain
};

} // end if (!window.EventTickerModule)

if (document.getElementById('canvas')) {
    const instance = new window.EventTickerModule._main();
    let lastSettings = null;

    window.Modules.push({
        name: "eventticker",
        draw: (ctx, settings, area) => {
            if (settings) lastSettings = settings;
            instance.draw(ctx, settings, area);
        },
        update: (dt) => {
            instance.update(dt, lastSettings || Config.eventticker || {});
        },
        events: {
            "Twitch.Follow": (data) => {
                instance.addEvent(`${data.targetUser?.name || 'Someone'} followed!`);
            },
            "Twitch.Sub": (data) => {
                instance.addEvent(`${data.user?.name || 'Someone'} subscribed!`);
            },
            "Twitch.ReSub": (data) => {
                instance.addEvent(`${data.user?.name || 'Someone'} resubscribed (${data.cumulative_months || data.duration_months || '?'} months)!`);
            },
            "Twitch.GiftSub": (data) => {
                instance.addEvent(`${data.user?.name || 'Someone'} gifted a sub to ${data.recipient?.name || 'someone'}!`);
            },
            "Twitch.GiftBomb": (data) => {
                instance.addEvent(`${data.user?.name || 'Someone'} gifted ${data.total || '?'} subs!`);
            },
            "Twitch.Cheer": (data) => {
                const name = data.anonymous ? 'Anonymous' : (data.user?.name || 'Someone');
                instance.addEvent(`${name} cheered ${data.bits || '?'} bits!`);
            },
            "Twitch.Raid": (data) => {
                instance.addEvent(`${data.user?.name || 'Someone'} raided with ${data.viewers || '?'} viewers!`);
            },
            "Kick.Follow": (data) => {
                instance.addEvent(`${data.user?.name || 'Someone'} followed on Kick!`);
            },
            "Kick.Subscription": (data) => {
                instance.addEvent(`${data.user?.name || 'Someone'} subscribed on Kick!`);
            },
            "Kick.Resubscription": (data) => {
                instance.addEvent(`${data.user?.name || 'Someone'} resubscribed on Kick!`);
            },
            "Kick.GiftSubscription": (data) => {
                instance.addEvent(`${data.user?.name || 'Someone'} gifted a sub on Kick!`);
            },
            "Kick.MassGiftSubscription": (data) => {
                instance.addEvent(`${data.user?.name || 'Someone'} gifted ${data.count || '?'} subs on Kick!`);
            }
        }
    });
}
