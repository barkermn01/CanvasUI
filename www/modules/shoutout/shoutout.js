/**
 * Shoutout Card Module
 *
 * Message: { Module: "shoutout", Data: { Type: "Shoutout", name: "User", game: "Playing X", avatar: "https://..." } }
 */

if (!window.ShoutoutModule) {

class ShoutoutMain {
    #queue = [];
    #current = null;
    #timer = 0;
    #imageCache = new Map();

    constructor() {}

    #getImage(url) {
        if (!url) return null;
        let resolvedSrc = url;
        if (typeof EditorPrefs !== 'undefined' && url.startsWith('/')) {
            const host = EditorPrefs.get('serverHost', '127.0.0.1');
            const port = EditorPrefs.get('serverPort', 31589);
            resolvedSrc = `http://${host}:${port}${url}`;
        }
        if (this.#imageCache.has(resolvedSrc)) return this.#imageCache.get(resolvedSrc);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = resolvedSrc;
        const entry = { img, ready: false };
        img.onload = () => {
            entry.ready = true;
            // Trigger a settings notification to re-render preview when image loads
            if (typeof EditorState !== 'undefined') {
                EditorState.notify('module-settings');
            }
        };
        this.#imageCache.set(resolvedSrc, entry);
        return entry;
    }

    update(dt, settings) {
        if (!settings) return;
        const duration = settings.duration || 8;

        if (this.#current) {
            this.#timer += dt;
            if (this.#timer >= duration) {
                this.#current = null;
                this.#timer = 0;
            }
        }

        if (!this.#current && this.#queue.length > 0) {
            this.#current = this.#queue.shift();
            this.#timer = 0;
        }
    }

    draw(ctx, settings, area) {
        if (!area || !this.#current) return;

        const bgColor = settings?.backgroundColor || '#1a1a2e';
        const borderColor = settings?.borderColor || '#f97316';
        const borderWidth = settings?.borderWidth ?? 3;
        const borderRadius = settings?.borderRadius || 10;
        const bgImageSrc = settings?.backgroundImage;
        const duration = settings?.duration || 8;

        // Avatar settings
        const avatarX = settings?.avatarX ?? 12;
        const avatarY = settings?.avatarY ?? 12;
        const avatarSize = settings?.avatarSize || 80;
        const avatarRound = settings?.avatarRound !== false;

        // Name settings
        const nameX = settings?.nameX ?? 100;
        const nameY = settings?.nameY ?? 30;
        const nameFontSize = settings?.nameFontSize || 24;
        const nameColor = settings?.nameColor || '#f97316';

        // Game settings
        const gameX = settings?.gameX ?? 100;
        const gameY = settings?.gameY ?? 60;
        const gameFontSize = settings?.gameFontSize || 16;
        const gameColor = settings?.gameColor || '#ffffff';

        // Fade in/out
        const fadeTime = 0.4;
        let alpha = 1;
        if (this.#timer < fadeTime) alpha = this.#timer / fadeTime;
        else if (this.#timer > duration - fadeTime) alpha = (duration - this.#timer) / fadeTime;
        alpha = Math.max(0, Math.min(1, alpha));

        ctx.save();
        ctx.globalAlpha = alpha;

        // Background
        this.#roundRect(ctx, area.x, area.y, area.width, area.height, borderRadius);
        ctx.fillStyle = bgColor;
        ctx.fill();

        // Background image
        if (bgImageSrc) {
            const bgEntry = this.#getImage(bgImageSrc);
            if (bgEntry && bgEntry.ready) {
                ctx.save();
                this.#roundRect(ctx, area.x, area.y, area.width, area.height, borderRadius);
                ctx.clip();
                ctx.drawImage(bgEntry.img, area.x, area.y, area.width, area.height);
                ctx.restore();
            }
        }

        // Border
        if (borderWidth > 0) {
            this.#roundRect(ctx, area.x, area.y, area.width, area.height, borderRadius);
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = borderWidth;
            ctx.stroke();
        }

        // Avatar
        const avatarSrc = this.#current.avatar || settings?.defaultAvatar;
        if (avatarSrc) {
            const entry = this.#getImage(avatarSrc);
            if (entry && entry.ready) {
                ctx.save();
                if (avatarRound) {
                    ctx.beginPath();
                    ctx.arc(area.x + avatarX + avatarSize / 2, area.y + avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                    ctx.clip();
                }
                ctx.drawImage(entry.img, area.x + avatarX, area.y + avatarY, avatarSize, avatarSize);
                ctx.restore();
            }
        }

        // Name
        if (this.#current.name) {
            ctx.font = `bold ${nameFontSize}px sans-serif`;
            ctx.fillStyle = nameColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(this.#current.name, area.x + nameX, area.y + nameY);
        }

        // Game
        if (this.#current.game) {
            ctx.font = `${gameFontSize}px sans-serif`;
            ctx.fillStyle = gameColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(this.#current.game, area.x + gameX, area.y + gameY);
        }

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
        if (data.Type === 'Shoutout') {
            this.#queue.push({
                name: data.name || '',
                game: data.game || '',
                avatar: data.avatar || null
            });
        }
    }

    editorRegister(register) {
        const self = this;

        // Set sample data for editor
        self.#current = { name: 'SampleUser', game: 'Playing a cool game', avatar: null };
        self.#timer = 0;

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
                const w = mod ? mod.area.width : 400;
                const h = mod ? mod.area.height : 120;
                canvas.width = w;
                canvas.height = h;
                // Ensure sample data is set
                if (!self.#current) {
                    self.#current = { name: 'SampleUser', game: 'Playing a cool game', avatar: null };
                    self.#timer = 1; // past fade-in
                }
                self.#timer = 1;
                const ctx = canvas.getContext('2d');
                const area = { x: 0, y: 0, width: w, height: h };
                self.draw(ctx, settings, area);
            },
            simulate: {
                start: () => {
                    self.#current = { name: 'SampleUser', game: 'Playing a cool game', avatar: null };
                    self.#timer = 0;
                },
                update: (settings, area, dt) => { self.update(dt, settings); },
                draw: (ctx, settings, area) => { self.draw(ctx, settings, area); },
                stop: () => {
                    self.#current = null;
                    self.#timer = 0;
                }
            },
            dispose: () => {}
        });
    }
}

window.ShoutoutModule = {
    _main: ShoutoutMain,
    _simulator: ShoutoutMain
};

} // end if (!window.ShoutoutModule)

if (document.getElementById('canvas')) {
    const instance = new window.ShoutoutModule._main();
    let lastSettings = null;

    window.Modules.push({
        name: "shoutout",
        draw: (ctx, settings, area) => {
            if (settings) lastSettings = settings;
            instance.draw(ctx, settings, area);
        },
        update: (dt) => {
            instance.update(dt, lastSettings || Config.shoutout || {});
        },
        message: (data) => {
            instance.onMessage(data);
        },
        events: {
            "Twitch.ShoutoutCreated": (data) => {
                instance.onMessage({
                    Type: 'Shoutout',
                    name: data.targetUser?.name || data.targetUserDisplayName || '',
                    game: data.targetUserGameName || '',
                    avatar: data.targetUser?.profilePicture || data.targetProfileImageUrl || ''
                });
            }
        }
    });
}
