/**
 * Alert Module
 * Queued alert popups for follows, subs, raids, and custom events.
 * Alerts play one at a time with configurable animations.
 *
 * Message format from Streamer.bot:
 * { Module: "alert", Data: { Type: "Alert", title: "New Follow!", message: "User123", image: "/media/follow.png" } }
 */

if (!window.AlertModule) {

class AlertMain {
    #queue = [];
    #current = null;
    #state = 'idle'; // idle, animating-in, showing, animating-out
    #stateTimer = 0;
    #imageCache = new Map();

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
        img.onload = () => { entry.ready = true; };
        this.#imageCache.set(resolvedSrc, entry);
        return entry;
    }

    update(dt, settings) {
        if (!settings) return;
        const animSpeed = settings.animationSpeed || 0.3;
        const duration = settings.duration || 5;

        switch (this.#state) {
            case 'idle':
                if (this.#queue.length > 0) {
                    this.#current = this.#queue.shift();
                    this.#state = 'animating-in';
                    this.#stateTimer = 0;
                }
                break;
            case 'animating-in':
                this.#stateTimer += dt;
                if (this.#stateTimer >= animSpeed) {
                    this.#state = 'showing';
                    this.#stateTimer = 0;
                }
                break;
            case 'showing':
                this.#stateTimer += dt;
                if (this.#stateTimer >= duration) {
                    this.#state = 'animating-out';
                    this.#stateTimer = 0;
                }
                break;
            case 'animating-out':
                this.#stateTimer += dt;
                if (this.#stateTimer >= animSpeed) {
                    this.#current = null;
                    this.#state = 'idle';
                    this.#stateTimer = 0;
                }
                break;
        }
    }

    draw(ctx, settings, area) {
        if (!area || !this.#current) return;

        const animSpeed = settings?.animationSpeed || 0.3;
        const animIn = settings?.animationIn || 'scale';
        const animOut = settings?.animationOut || 'fade';
        const fontSize = settings?.fontSize || 24;
        const fontFamily = settings?.fontFamily || 'sans-serif';
        const textColor = settings?.textColor || '#ffffff';
        const bgColor = settings?.backgroundColor || '#1a1a2e';
        const borderColor = settings?.borderColor || '#f59e0b';
        const borderWidth = settings?.borderWidth ?? 2;
        const borderRadius = settings?.borderRadius || 8;
        const bgImageSrc = settings?.backgroundImage;
        const messageFontSize = settings?.messageFontSize || 18;
        const messageColor = settings?.messageColor || '#cccccc';

        // Text positioning (0 = auto-center)
        const titleX = settings?.titleX || 0;
        const titleY = settings?.titleY || 0;
        const titleAlign = settings?.titleAlign || 'center';
        const messageX = settings?.messageX || 0;
        const messageY = settings?.messageY || 0;
        const messageAlign = settings?.messageAlign || 'center';

        // Image positioning
        const imageX = settings?.imageX || 0;
        const imageY = settings?.imageY ?? 12;
        const imageMaxHeight = (settings?.imageMaxHeight || 50) / 100;

        // Calculate animation progress
        let progress = 1;
        let alpha = 1;
        let scale = 1;
        let offsetY = 0;

        if (this.#state === 'animating-in') {
            const t = Math.min(this.#stateTimer / animSpeed, 1);
            progress = this.#easeOut(t);
            if (animIn === 'fade') alpha = progress;
            else if (animIn === 'scale') scale = progress;
            else if (animIn === 'slide-down') offsetY = -(1 - progress) * area.height;
            else if (animIn === 'slide-up') offsetY = (1 - progress) * area.height;
        } else if (this.#state === 'animating-out') {
            const t = Math.min(this.#stateTimer / animSpeed, 1);
            progress = 1 - this.#easeOut(t);
            if (animOut === 'fade') alpha = progress;
            else if (animOut === 'scale') scale = progress;
            else if (animOut === 'slide-down') offsetY = (1 - progress) * area.height;
            else if (animOut === 'slide-up') offsetY = -(1 - progress) * area.height;
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(area.x + area.width / 2, area.y + area.height / 2 + offsetY);
        ctx.scale(scale, scale);
        ctx.translate(-(area.width / 2), -(area.height / 2));

        // Background color
        this.#roundRect(ctx, 0, 0, area.width, area.height, borderRadius);
        ctx.fillStyle = bgColor;
        ctx.fill();

        // Background image
        if (bgImageSrc) {
            const bgEntry = this.#getImage(bgImageSrc);
            if (bgEntry && bgEntry.ready) {
                ctx.save();
                this.#roundRect(ctx, 0, 0, area.width, area.height, borderRadius);
                ctx.clip();
                ctx.drawImage(bgEntry.img, 0, 0, area.width, area.height);
                ctx.restore();
            }
        }

        // Border
        if (borderWidth > 0) {
            this.#roundRect(ctx, 0, 0, area.width, area.height, borderRadius);
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = borderWidth;
            ctx.stroke();
        }

        // Alert image
        const imgSrc = this.#current.image || settings?.defaultImage;
        if (imgSrc) {
            const entry = this.#getImage(imgSrc);
            if (entry && entry.ready) {
                const maxImgH = area.height * imageMaxHeight;
                const iw = entry.img.naturalWidth;
                const ih = entry.img.naturalHeight;
                const imgScale = Math.min((area.width - 24) / iw, maxImgH / ih);
                const dw = iw * imgScale;
                const dh = ih * imgScale;
                const dx = imageX || (area.width - dw) / 2;
                ctx.drawImage(entry.img, dx, imageY, dw, dh);
            }
        }

        // Title
        if (this.#current.title) {
            ctx.font = `bold ${fontSize}px ${fontFamily}`;
            ctx.fillStyle = textColor;
            ctx.textBaseline = 'top';
            let tx;
            if (titleAlign === 'left') { ctx.textAlign = 'left'; tx = titleX || 12; }
            else if (titleAlign === 'right') { ctx.textAlign = 'right'; tx = titleX || area.width - 12; }
            else { ctx.textAlign = 'center'; tx = titleX || area.width / 2; }
            const ty = titleY || (area.height / 2 - fontSize);
            ctx.fillText(this.#current.title, tx, ty);
        }

        // Message
        if (this.#current.message) {
            ctx.font = `${messageFontSize}px ${fontFamily}`;
            ctx.fillStyle = messageColor;
            ctx.textBaseline = 'top';
            let mx;
            if (messageAlign === 'left') { ctx.textAlign = 'left'; mx = messageX || 12; }
            else if (messageAlign === 'right') { ctx.textAlign = 'right'; mx = messageX || area.width - 12; }
            else { ctx.textAlign = 'center'; mx = messageX || area.width / 2; }
            const my = messageY || (area.height / 2 + 4);
            ctx.fillText(this.#current.message, mx, my);
        }

        ctx.restore();
    }

    #easeOut(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    #roundRect(ctx, x, y, w, h, r) {
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
        if (data.Type === 'Alert') {
            this.#queue.push({
                title: data.title || '',
                message: data.message || '',
                image: data.image || null
            });
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
                // Show sample alert in preview
                self.onMessage({ Type: 'Alert', title: 'New Follower!', message: 'SampleUser', image: null });
                self.update(1, settings); // advance past fade-in
                const ctx = canvas.getContext('2d');
                const area = { x: 0, y: 0, width: w, height: h };
                self.draw(ctx, settings, area);
            },
            simulate: {
                start: () => {
                    self.onMessage({ Type: 'Alert', title: 'New Follower!', message: 'SampleUser just followed', image: null });
                },
                update: (settings, area, dt) => { self.update(dt, settings); },
                draw: (ctx, settings, area) => { self.draw(ctx, settings, area); },
                stop: () => {}
            },
            dispose: () => {}
        });
    }
}

window.AlertModule = {
    _main: AlertMain,
    _simulator: AlertMain
};

} // end if (!window.AlertModule)

if (document.getElementById('canvas')) {
    const instance = new window.AlertModule._main();
    let lastSettings = null;

    window.Modules.push({
        name: "alert",
        draw: (ctx, settings, area) => {
            if (settings) lastSettings = settings;
            instance.draw(ctx, settings, area);
        },
        update: (dt) => {
            instance.update(dt, lastSettings || Config.alert || {});
        },
        message: (data) => {
            instance.onMessage(data);
        }
    });
}
