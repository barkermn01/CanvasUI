/**
 * Canvas-based Chat Module
 * Renders chat messages directly to the canvas context.
 * Supports: badges, emotes (Twitch, BTTV, FFZ), colors, word wrap,
 * animations (fade/slide), auto-hide, message removal, configurable styles,
 * text-shadow, drop-shadow, gradients, borders, fit-content width, alignment.
 */

if (!window.CanvasChat) {

window.CanvasChat = class CanvasChat {
    #messages = [];
    #bttvEmotes = [];
    #ffzEmotes = [];
    #emoteCache = new Map();
    #badgeCache = new Map();
    #maxMessages = 500;

    constructor() {
        this.#loadExtendedEmotes();
        this.#loadFromStorage();
    }

    #loadFromStorage() {
        try {
            const saved = localStorage.getItem('chatMessages');
            if (!saved) return;
            const data = JSON.parse(saved);
            const now = performance.now();
            data.forEach(msg => {
                this.#messages.push({
                    id: msg.ID,
                    userId: msg.UserId,
                    display: msg.DisplayName,
                    color: msg.DisplayNameColor || '#ffffff',
                    badges: msg.Badges || [],
                    platform: msg.Platform || 'twitch',
                    segments: this.#parseSegments(msg.Message || '', msg.Emotes),
                    removed: msg.isRemoved || false,
                    createdAt: now,
                    alpha: 1,
                    slideOffset: 0,
                    hidden: false,
                    hideStartedAt: null
                });
            });
        } catch (e) {}
    }

    #saveToStorage() {
        try {
            const visible = this.#messages.filter(m => !m.hidden).slice(-50);
            const data = visible.map(m => ({
                ID: m.id,
                UserId: m.userId,
                DisplayName: m.display,
                DisplayNameColor: m.color,
                Message: m.segments.filter(s => s.type === 'text').map(s => s.value).join(''),
                Emotes: [],
                Badges: m.badges,
                Platform: m.platform,
                isRemoved: m.removed
            }));
            localStorage.setItem('chatMessages', JSON.stringify(data));
        } catch (e) {}
    }

    async #loadExtendedEmotes() {
        if (Config.chat?.ExtendedEmotesServices?.BTTV) {
            try {
                const global = await fetch('https://api.betterttv.net/3/cached/emotes/global').then(r => r.json());
                this.#bttvEmotes = global.map(e => ({ name: e.code, url: `https://cdn.betterttv.net/emote/${e.id}/3x` }));
                if (Config.TwitchID) {
                    const channel = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${Config.TwitchID}`).then(r => r.json());
                    if (channel.channelEmotes) {
                        this.#bttvEmotes.push(...channel.channelEmotes.map(e => ({ name: e.code, url: `https://cdn.betterttv.net/emote/${e.id}/3x` })));
                    }
                }
            } catch (e) {}
        }
        if (Config.chat?.ExtendedEmotesServices?.FFZ) {
            try {
                const data = await fetch('https://api.frankerfacez.com/v1/set/global').then(r => r.json());
                Object.values(data.sets).forEach(set => {
                    set.emoticons.forEach(e => {
                        this.#ffzEmotes.push({ name: e.name, url: `https://cdn.frankerfacez.com/emote/${e.id}/4` });
                    });
                });
            } catch (e) {}
        }
    }

    #getImage(url) {
        if (this.#emoteCache.has(url)) return this.#emoteCache.get(url);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        const entry = { img, ready: false };
        img.onload = () => { entry.ready = true; };
        this.#emoteCache.set(url, entry);
        return entry;
    }

    #getBadgeImage(url) {
        if (this.#badgeCache.has(url)) return this.#badgeCache.get(url);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        const entry = { img, ready: false };
        img.onload = () => { entry.ready = true; };
        this.#badgeCache.set(url, entry);
        return entry;
    }

    #parseSegments(text, twitchEmotes) {
        const segments = [];
        const emotePositions = [];

        if (twitchEmotes && Array.isArray(twitchEmotes)) {
            twitchEmotes.forEach(e => {
                if (e.startIndex !== undefined && e.endIndex !== undefined) {
                    emotePositions.push({ start: e.startIndex, end: e.endIndex, url: e.imageUrl });
                }
            });
        }
        emotePositions.sort((a, b) => a.start - b.start);

        let cursor = 0;
        for (const ep of emotePositions) {
            if (ep.start > cursor) {
                segments.push(...this.#parseTextForExtendedEmotes(text.substring(cursor, ep.start)));
            }
            segments.push({ type: 'emote', value: text.substring(ep.start, ep.end + 1), url: ep.url });
            cursor = ep.end + 1;
        }
        if (cursor < text.length) {
            segments.push(...this.#parseTextForExtendedEmotes(text.substring(cursor)));
        }
        if (emotePositions.length === 0) {
            return this.#parseTextForExtendedEmotes(text);
        }
        return segments;
    }

    #parseTextForExtendedEmotes(text) {
        const segments = [];
        const words = text.split(' ');
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const bttv = this.#bttvEmotes.find(e => e.name === word);
            const ffz = this.#ffzEmotes.find(e => e.name === word);
            if (bttv) {
                segments.push({ type: 'emote', value: word, url: bttv.url });
            } else if (ffz) {
                segments.push({ type: 'emote', value: word, url: ffz.url });
            } else {
                if (segments.length > 0 && segments[segments.length - 1].type === 'text') {
                    segments[segments.length - 1].value += ' ' + word;
                } else {
                    segments.push({ type: 'text', value: (i > 0 ? ' ' : '') + word });
                }
            }
        }
        return segments;
    }

    onMessage(data) {
        if (!data?.Type) return;
        switch (data.Type) {
            case 'MessageAdded': this.#addMessage(data); break;
            case 'MessageRemoved': this.#removeMessage(data.ID); break;
            case 'MessageRemoveUser': this.#removeUserMessages(data.UserId); break;
            case 'ClearChat': this.#messages = []; localStorage.removeItem('chatMessages'); break;
        }
    }

    #addMessage(data) {
        if (!data.DisplayName) return;
        if (Config.Bots?.find(b => b.toLowerCase() === data.DisplayName.toLowerCase())) return;

        const now = performance.now();
        const segments = this.#parseSegments(data.Message || '', data.Emotes);

        this.#messages.push({
            id: data.ID,
            userId: data.UserId,
            display: data.DisplayName,
            color: data.DisplayNameColor || '#ffffff',
            badges: data.Badges || [],
            platform: data.Platform || 'twitch',
            segments,
            removed: false,
            createdAt: now,
            alpha: 0,
            slideOffset: 0,
            hidden: false,
            hideStartedAt: null
        });

        if (this.#messages.length > this.#maxMessages) {
            this.#messages.shift();
        }

        this.#saveToStorage();
    }

    #removeMessage(id) {
        const msg = this.#messages.find(m => m.id === id);
        if (msg) {
            if (Config.chat?.RemovedMessage?.hideMessage) {
                this.#messages = this.#messages.filter(m => m.id !== id);
            } else {
                msg.removed = true;
                msg.segments = [{ type: 'text', value: Config.chat?.RemovedMessage?.Text || 'Message removed' }];
            }
            this.#saveToStorage();
        }
    }

    #removeUserMessages(userId) {
        if (Config.chat?.RemovedMessage?.hideMessage) {
            this.#messages = this.#messages.filter(m => m.userId !== userId);
        } else {
            this.#messages.forEach(msg => {
                if (msg.userId === userId) {
                    msg.removed = true;
                    msg.segments = [{ type: 'text', value: Config.chat?.RemovedMessage?.Text || 'Message removed' }];
                }
            });
        }
        this.#saveToStorage();
    }

    update(dt) {
        const now = performance.now();
        const autoHide = Config.chat?.AutoHide || {};
        const animType = Config.chat?.ChatBoxes?.animationType || 'fade';

        for (const msg of this.#messages) {
            if (msg.alpha < 1 && !msg.hidden) {
                msg.alpha = Math.min(1, msg.alpha + dt * 4);
            }
            if (animType === 'slide' && msg.slideOffset !== 0 && !msg.hideStartedAt) {
                msg.slideOffset *= Math.max(0, 1 - dt * 8);
                if (Math.abs(msg.slideOffset) < 0.5) msg.slideOffset = 0;
            }
            if (autoHide.enabled && !msg.hidden && !msg.hideStartedAt) {
                if ((now - msg.createdAt) / 1000 > autoHide.time) {
                    msg.hideStartedAt = now;
                }
            }
            if (msg.hideStartedAt) {
                const elapsed = (now - msg.hideStartedAt) / 1000;
                if (autoHide.animation === 'fade') {
                    msg.alpha = Math.max(0, 1 - elapsed * 2);
                } else if (autoHide.animation === 'slide') {
                    const dir = autoHide.direction === 'left' ? -1 : 1;
                    msg.slideOffset = elapsed * 800 * dir;
                    msg.alpha = Math.max(0, 1 - elapsed * 2);
                }
                if (msg.alpha <= 0) msg.hidden = true;
            }
        }
        this.#messages = this.#messages.filter(m => !m.hidden);
    }

    draw(ctx, settings, area) {
        if (!area) return;

        const chatConfig = Config.chat || {};
        const boxes = chatConfig.ChatBoxes || {};
        const style = boxes.style || {};
        const position = boxes.position || 'bottom';

        // Parse style properties
        const padding = parseInt(style.padding) || 8;
        const fontSize = parseInt(style['font-size']) || 14;
        const fontFamily = style['font-family'] || 'Arial, sans-serif';
        const textColor = style.color || '#ffffff';
        const borderRadius = parseInt(style['border-radius']) || 3;
        const marginBottom = parseInt(style['margin-bottom']) || 3;
        const borderWidth = parseInt(style['border-width']) || 0;
        const fitContent = style.width === 'fit-content';
        const alignRight = style['align-self'] === 'flex-end' || style['justify-content'] === 'right';
        const badgeSize = boxes.BadgeSettings?.width || 18;
        const emoteSize = fontSize + 4;
        const showBadges = boxes.ShowBadges !== false;
        const showColon = boxes.UserColon !== false;

        // Parse text-shadow: "3px 3px 3px #000000"
        const textShadow = this.#parseTextShadow(style['text-shadow']);

        // Parse drop-shadow filter: "drop-shadow(15px 15px 7px rgba(0,0,0,1))"
        const dropShadow = this.#parseDropShadow(style.filter);

        // Parse background (supports linear-gradient or solid color)
        const bgStyle = style.background || 'rgba(0,0,0,0.3)';

        ctx.save();
        ctx.beginPath();
        ctx.rect(area.x, area.y, area.width, area.height);
        ctx.clip();

        const lineHeight = fontSize + 6;
        const maxTextWidth = area.width - padding * 2 - borderWidth * 2;

        // Measure all visible messages
        const rendered = [];
        for (const msg of this.#messages) {
            if (msg.hidden) continue;
            ctx.font = `bold ${fontSize}px ${fontFamily}`;

            const contentWidth = this.#measureMessageWidth(ctx, msg, maxTextWidth, fontSize, fontFamily, badgeSize, emoteSize, showBadges, showColon);
            const contentHeight = this.#measureMessageHeight(ctx, msg, maxTextWidth, fontSize, fontFamily, badgeSize, emoteSize, showBadges, showColon, lineHeight);

            const boxW = fitContent ? Math.min(contentWidth + padding * 2 + borderWidth * 2, area.width) : area.width;
            const boxH = contentHeight + padding * 2 + borderWidth * 2;

            rendered.push({ msg, boxW, boxH });
        }

        // Position messages
        let y;
        if (position === 'bottom') {
            y = area.y + area.height;
            for (let i = rendered.length - 1; i >= 0; i--) {
                y -= rendered[i].boxH + marginBottom;
                rendered[i].y = y;
            }
        } else {
            y = area.y;
            for (let i = 0; i < rendered.length; i++) {
                rendered[i].y = y;
                y += rendered[i].boxH + marginBottom;
            }
        }

        // Draw messages
        for (const { msg, boxW, boxH, y: msgY } of rendered) {
            if (msgY + boxH < area.y || msgY > area.y + area.height) continue;

            ctx.save();
            ctx.globalAlpha = msg.alpha;

            let boxX = area.x;
            if (alignRight) {
                boxX = area.x + area.width - boxW;
            }

            if (msg.slideOffset) {
                ctx.translate(msg.slideOffset, 0);
            }

            // Drop shadow on box
            if (dropShadow) {
                ctx.shadowColor = dropShadow.color;
                ctx.shadowBlur = dropShadow.blur;
                ctx.shadowOffsetX = dropShadow.x;
                ctx.shadowOffsetY = dropShadow.y;
            }

            // Background (supports multiple gradients layered)
            this.#drawBackground(ctx, bgStyle, boxX, msgY, boxW, boxH, borderRadius);

            // Reset shadow after background
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // Border
            if (borderWidth > 0) {
                ctx.strokeStyle = style['border-color'] || 'rgba(255,255,255,0.3)';
                ctx.lineWidth = borderWidth;
                this.#roundRect(ctx, boxX, msgY, boxW, boxH, borderRadius);
                ctx.stroke();
            }

            // Draw text content
            let drawX = boxX + padding + borderWidth;
            let drawY = msgY + padding + borderWidth + fontSize;

            // Badges
            if (showBadges && msg.badges.length > 0) {
                for (const badge of msg.badges) {
                    if (badge.imageUrl) {
                        const entry = this.#getBadgeImage(badge.imageUrl);
                        if (entry.ready) {
                            ctx.drawImage(entry.img, drawX, drawY - badgeSize + 2, badgeSize, badgeSize);
                        }
                        drawX += badgeSize + 3;
                    }
                }
            }

            // Text shadow setup
            if (textShadow) {
                ctx.shadowColor = textShadow.color;
                ctx.shadowBlur = textShadow.blur;
                ctx.shadowOffsetX = textShadow.x;
                ctx.shadowOffsetY = textShadow.y;
            }

            // Username
            ctx.font = `bold ${fontSize}px ${fontFamily}`;
            ctx.fillStyle = msg.color;
            ctx.fillText(msg.display, drawX, drawY);
            drawX += ctx.measureText(msg.display).width;

            // Separator
            ctx.fillStyle = textColor;
            ctx.font = `${fontSize}px ${fontFamily}`;
            const sep = showColon ? ': ' : ' ';
            ctx.fillText(sep, drawX, drawY);
            drawX += ctx.measureText(sep).width;

            // Message content
            if (msg.removed) {
                const rmConfig = Config.chat?.RemovedMessage || {};
                ctx.fillStyle = rmConfig.color || '#ffffff';
                let rmFont = `${fontSize}px ${fontFamily}`;
                if (rmConfig.italics) rmFont = `italic ${rmFont}`;
                if (rmConfig.bold) rmFont = `bold ${rmFont}`;
                ctx.font = rmFont;
                ctx.fillText(msg.segments[0]?.value || '', drawX, drawY);
            } else {
                ctx.fillStyle = textColor;
                ctx.font = `${fontSize}px ${fontFamily}`;
                this.#drawSegments(ctx, msg.segments, drawX, drawY, maxTextWidth, boxX + padding + borderWidth, lineHeight, fontSize, fontFamily, textColor, emoteSize);
            }

            ctx.restore();
        }

        ctx.restore();
    }

    #measureMessageWidth(ctx, msg, maxWidth, fontSize, fontFamily, badgeSize, emoteSize, showBadges, showColon) {
        let x = 0;
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        if (showBadges && msg.badges.length > 0) {
            x += msg.badges.length * (badgeSize + 3);
        }
        x += ctx.measureText(msg.display).width;
        ctx.font = `${fontSize}px ${fontFamily}`;
        x += ctx.measureText(showColon ? ': ' : ' ').width;
        for (const seg of msg.segments) {
            if (seg.type === 'emote') {
                x += emoteSize + 4;
            } else {
                x += ctx.measureText(seg.value).width;
            }
        }
        return Math.min(x, maxWidth);
    }

    #measureMessageHeight(ctx, msg, maxWidth, fontSize, fontFamily, badgeSize, emoteSize, showBadges, showColon, lineHeight) {
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        let x = 0;
        if (showBadges && msg.badges.length > 0) {
            x += msg.badges.length * (badgeSize + 3);
        }
        x += ctx.measureText(msg.display).width;
        ctx.font = `${fontSize}px ${fontFamily}`;
        x += ctx.measureText(showColon ? ': ' : ' ').width;

        let lines = 1;
        for (const seg of msg.segments) {
            if (seg.type === 'emote') {
                if (x + emoteSize + 4 > maxWidth && x > 0) { lines++; x = 0; }
                x += emoteSize + 4;
            } else {
                const words = seg.value.split(' ');
                for (const word of words) {
                    const w = ctx.measureText(word + ' ').width;
                    if (x + w > maxWidth && x > 0) { lines++; x = 0; }
                    x += w;
                }
            }
        }
        return lines * lineHeight;
    }

    #drawSegments(ctx, segments, startX, startY, maxWidth, leftEdge, lineHeight, fontSize, fontFamily, textColor, emoteSize) {
        let x = startX;
        let y = startY;
        for (const seg of segments) {
            if (seg.type === 'emote') {
                if (x + emoteSize > leftEdge + maxWidth) { x = leftEdge; y += lineHeight; }
                const entry = this.#getImage(seg.url);
                if (entry.ready) {
                    ctx.drawImage(entry.img, x, y - emoteSize + 4, emoteSize, emoteSize);
                }
                x += emoteSize + 4;
            } else {
                ctx.font = `${fontSize}px ${fontFamily}`;
                ctx.fillStyle = textColor;
                const words = seg.value.split(' ');
                for (const word of words) {
                    const text = word + ' ';
                    const w = ctx.measureText(text).width;
                    if (x + w > leftEdge + maxWidth && x > leftEdge) { x = leftEdge; y += lineHeight; }
                    ctx.fillText(text, x, y);
                    x += w;
                }
            }
        }
    }

    #parseTextShadow(value) {
        if (!value) return null;
        // "3px 3px 3px #000000"
        const match = value.match(/([-\d.]+)px\s+([-\d.]+)px\s+([-\d.]+)px\s+(.+)/);
        if (!match) return null;
        return { x: parseFloat(match[1]), y: parseFloat(match[2]), blur: parseFloat(match[3]), color: match[4].trim() };
    }

    #parseDropShadow(value) {
        if (!value) return null;
        // "drop-shadow(15px 15px 7px rgba(0, 0, 0, 1))"
        const match = value.match(/drop-shadow\(\s*([-\d.]+)px\s+([-\d.]+)px\s+([-\d.]+)px\s+(.+?)\s*\)/);
        if (!match) return null;
        return { x: parseFloat(match[1]), y: parseFloat(match[2]), blur: parseFloat(match[3]), color: match[4].trim() };
    }

    #drawBackground(ctx, bgStyle, x, y, w, h, borderRadius) {
        // Parse all background layers from the CSS background value
        // CSS background can have: linear-gradient(...), linear-gradient(...) color
        // Layers are comma-separated at the top level (outside parentheses)
        const layers = this.#parseBackgroundLayers(bgStyle);

        // CSS draws last layer first (bottom), first layer on top
        // So we draw in reverse order
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i].trim();
            if (!layer) continue;

            const gradMatch = layer.match(/linear-gradient\(\s*(.+)\)/);
            if (gradMatch) {
                const fill = this.#createGradient(ctx, gradMatch[1], x, y, w, h);
                if (fill) {
                    ctx.fillStyle = fill;
                    this.#roundRect(ctx, x, y, w, h, borderRadius);
                    ctx.fill();
                }
            } else {
                // Solid color
                ctx.fillStyle = layer;
                this.#roundRect(ctx, x, y, w, h, borderRadius);
                ctx.fill();
            }
        }
    }

    #parseBackgroundLayers(bgStyle) {
        // Split by commas that are NOT inside parentheses
        // e.g. "linear-gradient(to top left, rgba(0,0,32,0.5), ...), linear-gradient(...) rgba(0,0,128,0.5)"
        const layers = [];
        let depth = 0, current = '';

        for (const ch of bgStyle) {
            if (ch === '(') depth++;
            if (ch === ')') depth--;
            // Split on comma only at depth 0, but only if followed by a gradient or color
            // Actually CSS background layers are separated by commas at depth 0
            if (ch === ',' && depth === 0) {
                layers.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        if (current.trim()) layers.push(current.trim());

        return layers;
    }

    #createGradient(ctx, gradientContent, x, y, w, h) {
        // Parse direction and stops from gradient content
        // e.g. "to top left, rgba(0,0,32,0.5), rgba(0,0,255,0), rgba(0,0,176,0.5)"
        // First part before first color is the direction

        // Split content respecting parentheses
        const parts = [];
        let depth = 0, current = '';
        for (const ch of gradientContent) {
            if (ch === '(') depth++;
            if (ch === ')') depth--;
            if (ch === ',' && depth === 0) {
                parts.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        if (current.trim()) parts.push(current.trim());

        if (parts.length < 2) return null;

        // First part is direction
        const direction = parts[0];
        const stopParts = parts.slice(1);

        // Calculate gradient coordinates from direction
        let x0 = x, y0 = y + h, x1 = x, y1 = y; // default: to top

        if (direction.startsWith('to ')) {
            const dir = direction.substring(3).trim();
            if (dir === 'top') { x0 = x; y0 = y + h; x1 = x; y1 = y; }
            else if (dir === 'bottom') { x0 = x; y0 = y; x1 = x; y1 = y + h; }
            else if (dir === 'left') { x0 = x + w; y0 = y; x1 = x; y1 = y; }
            else if (dir === 'right') { x0 = x; y0 = y; x1 = x + w; y1 = y; }
            else if (dir === 'top left') { x0 = x + w; y0 = y + h; x1 = x; y1 = y; }
            else if (dir === 'top right') { x0 = x; y0 = y + h; x1 = x + w; y1 = y; }
            else if (dir === 'bottom left') { x0 = x + w; y0 = y; x1 = x; y1 = y + h; }
            else if (dir === 'bottom right') { x0 = x; y0 = y; x1 = x + w; y1 = y + h; }
        } else if (direction.match(/^[\d.]+deg$/)) {
            const angle = parseFloat(direction) * Math.PI / 180;
            const cx = x + w / 2, cy = y + h / 2;
            const len = Math.max(w, h);
            x0 = cx - Math.sin(angle) * len / 2;
            y0 = cy + Math.cos(angle) * len / 2;
            x1 = cx + Math.sin(angle) * len / 2;
            y1 = cy - Math.cos(angle) * len / 2;
        }

        const gradient = ctx.createLinearGradient(x0, y0, x1, y1);

        // Parse stops
        for (let i = 0; i < stopParts.length; i++) {
            const stop = stopParts[i].trim();
            const percentMatch = stop.match(/^(.+?)\s+([\d.]+)%\s*$/);
            let color, pos;
            if (percentMatch) {
                color = percentMatch[1].trim();
                pos = parseFloat(percentMatch[2]) / 100;
            } else {
                color = stop;
                pos = i / (stopParts.length - 1);
            }
            try {
                gradient.addColorStop(Math.max(0, Math.min(1, pos)), color);
            } catch (e) {
                // Invalid color — skip
            }
        }

        return gradient;
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
};

if (document.getElementById('canvas')) {
    const canvasChat = new window.CanvasChat();

    window.Modules.push({
        name: "chat",
        draw: (ctx, settings, area) => {
            canvasChat.draw(ctx, settings, area);
        },
        update: (dt) => {
            canvasChat.update(dt);
        },
        message: (data) => {
            canvasChat.onMessage(data);
        }
    });
}

} // end if (!window.CanvasChat)