/**
 * Canvas-based Chat Module
 * Renders chat messages directly to the canvas context.
 * Supports: badges, emotes (Twitch, BTTV, FFZ), colors, word wrap,
 * animations (fade/slide), auto-hide, message removal, configurable styles,
 * text-shadow, drop-shadow, gradients, borders, fit-content width, alignment.
 */

if (!window.CanvasChat) {

class CanvasChatMain {
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
        if (Config.chat?.ChatBoxes?.hideBots !== false && Config.Bots?.find(b => b.toLowerCase() === data.DisplayName.toLowerCase())) return;

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
        const hasBorderStyle = !!style['border-style'];
        const borderWidth = parseInt(style['border-width']) || (hasBorderStyle ? 3 : 0);
        const fitContent = style.width === 'fit-content';
        const alignRight = style['align-self'] === 'flex-end' || style['justify-content'] === 'right';
        const badgeSize = boxes.BadgeSettings?.width || 18;
        const emoteSize = fontSize + 4;
        const showBadges = boxes.ShowBadges !== false;
        const showColon = boxes.UserColon !== false;
        const nameOnNewLine = boxes.NameOnNewLine || false;

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

        const lineHeight = Math.max(fontSize + 6, badgeSize + 4);
        const maxTextWidth = area.width - padding * 2 - borderWidth * 2;

        // Measure all visible messages
        const rendered = [];
        for (const msg of this.#messages) {
            if (msg.hidden) continue;
            ctx.font = `bold ${fontSize}px ${fontFamily}`;

            const contentWidth = this.#measureMessageWidth(ctx, msg, maxTextWidth, fontSize, fontFamily, badgeSize, emoteSize, showBadges, showColon, nameOnNewLine);
            const contentHeight = this.#measureMessageHeight(ctx, msg, maxTextWidth, fontSize, fontFamily, badgeSize, emoteSize, showBadges, showColon, lineHeight, nameOnNewLine);

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
        const allowClipping = boxes.allowClipping !== false;
        for (const { msg, boxW, boxH, y: msgY } of rendered) {
            // Fully outside the area — skip
            if (msgY + boxH < area.y || msgY > area.y + area.height) continue;

            // Partially outside the area — if clipping is disabled, skip partial messages
            if (!allowClipping) {
                if (msgY < area.y || msgY + boxH > area.y + area.height) continue;
            }

            ctx.save();
            ctx.globalAlpha = msg.alpha;

            let boxX = area.x;
            if (alignRight) {
                boxX = area.x + area.width - boxW;
            }

            if (msg.slideOffset) {
                ctx.translate(msg.slideOffset, 0);
            }

            // Drop shadow on box — use a separate save/restore so shadow only affects the box outline
            if (dropShadow) {
                ctx.save();
                ctx.shadowColor = dropShadow.color;
                ctx.shadowBlur = dropShadow.blur;
                ctx.shadowOffsetX = dropShadow.x;
                ctx.shadowOffsetY = dropShadow.y;
                // Clip out the box area so only the shadow (outside the box) is visible
                ctx.beginPath();
                ctx.rect(boxX - 100, msgY - 100, boxW + 200, boxH + 200);
                this.#roundRect(ctx, boxX, msgY, boxW, boxH, borderRadius);
                // Use evenodd to cut out the inner shape — shadow renders outside
                ctx.clip('evenodd');
                ctx.fillStyle = 'rgba(0,0,0,1)';
                this.#roundRect(ctx, boxX, msgY, boxW, boxH, borderRadius);
                ctx.fill();
                ctx.restore();
                // Re-apply globalAlpha for the actual content
                ctx.globalAlpha = msg.alpha;
            }

            // Background + Border — rendered together via CSS for accurate styling
            this.#drawMessageBox(ctx, style, bgStyle, boxX, msgY, boxW, boxH, borderRadius, borderWidth, dropShadow);

            // Draw text content
            let drawX = boxX + padding + borderWidth;
            // Vertical position: account for the taller of badge or font
            const lineItemHeight = Math.max(badgeSize, fontSize);
            let drawY = msgY + padding + borderWidth + lineItemHeight;

            // Badges — vertically centered on the line
            if (showBadges && msg.badges.length > 0) {
                const badgeY = drawY - lineItemHeight + (lineItemHeight - badgeSize) / 2;
                for (const badge of msg.badges) {
                    if (badge.imageUrl) {
                        const entry = this.#getBadgeImage(badge.imageUrl);
                        if (entry.ready) {
                            ctx.drawImage(entry.img, drawX, badgeY, badgeSize, badgeSize);
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

            // Username — vertically centered on the line
            ctx.font = `bold ${fontSize}px ${fontFamily}`;
            ctx.fillStyle = msg.color;
            const textY = drawY - lineItemHeight + (lineItemHeight + fontSize) / 2 - 2;
            ctx.fillText(msg.display, drawX, textY);
            drawX += ctx.measureText(msg.display).width;

            // Separator
            ctx.fillStyle = textColor;
            ctx.font = `${fontSize}px ${fontFamily}`;
            const sep = showColon ? ': ' : ' ';
            ctx.fillText(sep, drawX, textY);
            drawX += ctx.measureText(sep).width;

            // If name on new line, move to next line for message content
            if (nameOnNewLine) {
                drawX = boxX + padding + borderWidth;
                drawY += lineHeight;
            }

            // Message content
            if (msg.removed) {
                const rmConfig = Config.chat?.RemovedMessage || {};
                ctx.fillStyle = rmConfig.color || '#ffffff';
                let rmFont = `${fontSize}px ${fontFamily}`;
                if (rmConfig.italics) rmFont = `italic ${rmFont}`;
                if (rmConfig.bold) rmFont = `bold ${rmFont}`;
                ctx.font = rmFont;
                ctx.fillText(msg.segments[0]?.value || '', drawX, nameOnNewLine ? drawY - lineItemHeight + (lineItemHeight + fontSize) / 2 - 2 : textY);
            } else {
                ctx.fillStyle = textColor;
                ctx.font = `${fontSize}px ${fontFamily}`;
                const msgDrawY = nameOnNewLine ? drawY - lineItemHeight + (lineItemHeight + fontSize) / 2 - 2 : textY;
                this.#drawSegments(ctx, msg.segments, drawX, msgDrawY, maxTextWidth, boxX + padding + borderWidth, lineHeight, fontSize, fontFamily, textColor, emoteSize);
            }

            ctx.restore();
        }

        ctx.restore();
    }

    #measureMessageWidth(ctx, msg, maxWidth, fontSize, fontFamily, badgeSize, emoteSize, showBadges, showColon, nameOnNewLine) {
        let x = 0;
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        if (showBadges && msg.badges.length > 0) {
            x += msg.badges.length * (badgeSize + 3);
        }
        x += ctx.measureText(msg.display).width;
        ctx.font = `${fontSize}px ${fontFamily}`;
        x += ctx.measureText(showColon ? ': ' : ' ').width;

        // If name on new line, width is max of name line and message line
        if (nameOnNewLine) {
            const nameWidth = x;
            let msgWidth = 0;
            for (const seg of msg.segments) {
                if (seg.type === 'emote') {
                    msgWidth += emoteSize + 4;
                } else {
                    msgWidth += ctx.measureText(seg.value).width;
                }
            }
            return Math.min(Math.max(nameWidth, msgWidth), maxWidth);
        }

        for (const seg of msg.segments) {
            if (seg.type === 'emote') {
                x += emoteSize + 4;
            } else {
                x += ctx.measureText(seg.value).width;
            }
        }
        return Math.min(x, maxWidth);
    }

    #measureMessageHeight(ctx, msg, maxWidth, fontSize, fontFamily, badgeSize, emoteSize, showBadges, showColon, lineHeight, nameOnNewLine) {
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        let x = 0;
        let lines = 1;

        if (nameOnNewLine) {
            // Name line is always 1 line, then message starts on next line
            lines = 2; // name line + at least one message line
            x = 0; // message starts fresh on new line
            ctx.font = `${fontSize}px ${fontFamily}`;
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

        if (showBadges && msg.badges.length > 0) {
            x += msg.badges.length * (badgeSize + 3);
        }
        x += ctx.measureText(msg.display).width;
        ctx.font = `${fontSize}px ${fontFamily}`;
        x += ctx.measureText(showColon ? ': ' : ' ').width;

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

    // Cache for rendered message box images (style hash -> { canvas, ready })
    #bgCache = new Map();
    #bgCacheDiv = null;
    #lastStyleHash = '';

    #drawMessageBox(ctx, style, bgStyle, x, y, w, h, borderRadius, borderWidth, dropShadow) {
        // Build a CSS string that captures background, border, and drop-shadow
        let css = `width:${Math.ceil(w)}px;height:${Math.ceil(h)}px;box-sizing:border-box;`;
        css += `background:${bgStyle};`;
        css += `border-radius:${borderRadius}px;`;

        if (borderWidth > 0) {
            const borderStyle = style['border-style'] || 'solid';
            const borderColor = style['border-color'] || 'rgba(255,255,255,0.5)';
            css += `border-width:${borderWidth}px;`;
            css += `border-style:${borderStyle};`;
            css += `border-color:${borderColor};`;
        }

        if (dropShadow) {
            css += `filter:drop-shadow(${dropShadow.x}px ${dropShadow.y}px ${dropShadow.blur}px ${dropShadow.color});`;
        }

        // Invalidate cache if style config changed
        const styleHash = JSON.stringify(style) + bgStyle;
        if (styleHash !== this.#lastStyleHash) {
            this.#bgCache.clear();
            this.#lastStyleHash = styleHash;
        }

        const cacheKey = `${css}`;
        const rw = Math.ceil(w) + (dropShadow ? Math.abs(dropShadow.x) + dropShadow.blur * 2 : 0);
        const rh = Math.ceil(h) + (dropShadow ? Math.abs(dropShadow.y) + dropShadow.blur * 2 : 0);
        const offsetX = dropShadow ? dropShadow.blur : 0;
        const offsetY = dropShadow ? dropShadow.blur : 0;

        // Check cache
        if (this.#bgCache.has(cacheKey)) {
            const cached = this.#bgCache.get(cacheKey);
            if (cached.ready) {
                ctx.drawImage(cached.canvas, x - offsetX, y - offsetY);
                return;
            }
            // Still loading — draw fallback and wait
            const fallbackColor = this.#extractFallbackColor(bgStyle);
            if (fallbackColor) {
                ctx.fillStyle = fallbackColor;
                this.#roundRect(ctx, x, y, w, h, borderRadius);
                ctx.fill();
            }
            return;
        }

        // Build SVG with foreignObject to render the CSS natively
        // Add padding around the div for drop-shadow overflow
        const divCss = css + `margin:${offsetY}px 0 0 ${offsetX}px;`;
        const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${rw}" height="${rh}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="${divCss}"></div></foreignObject></svg>`;

        const entry = { canvas: null, ready: false };
        this.#bgCache.set(cacheKey, entry);

        const img = new Image();
        // Use data URL for faster (potentially synchronous) loading
        const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);

        img.onload = () => {
            const offscreen = document.createElement('canvas');
            offscreen.width = rw;
            offscreen.height = rh;
            const offCtx = offscreen.getContext('2d');
            offCtx.drawImage(img, 0, 0);
            entry.canvas = offscreen;
            entry.ready = true;
        };
        img.onerror = () => {};
        img.src = dataUrl;

        // First frame fallback: draw a simple filled rect
        const fallbackColor = this.#extractFallbackColor(bgStyle);
        if (fallbackColor) {
            ctx.fillStyle = fallbackColor;
            this.#roundRect(ctx, x, y, w, h, borderRadius);
            ctx.fill();
        }
    }

    #extractFallbackColor(bgStyle) {
        // Try to find a solid color in the background string as a rough first-frame fallback
        const match = bgStyle.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})\s*$/);
        return match ? match[1] : 'rgba(0,0,0,0.3)';
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

    /**
     * Called by the editor to register preview and simulation hooks.
     */
    editorRegister(register) {
        const self = this;

        register({
            preview: (container, settings, area) => {
                // Chat preview is a live canvas that renders messages
                container.innerHTML = '';
                container.style.cssText = 'position: relative; overflow: hidden;';

                const canvas = document.createElement('canvas');
                canvas.style.cssText = 'width: 100%; height: 100%; pointer-events: none;';
                container.appendChild(canvas);
                container._chatInstance = self;
                container._chatCanvas = canvas;
            },
            simulate: {
                start: (canvas, settings, area) => {
                    // Spawn test messages periodically during simulation
                    const names = ['Viewer42', 'NightOwl', 'GamerPro', 'LurkKing', 'SubHype', 'ChillDude'];
                    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c'];
                    const msgs = ['Hello! 👋', 'GG well played', 'Lets gooo 🎉', 'Nice stream!', 'First time here!', '❤️❤️❤️', 'LOL 😂', 'Hype!', 'Good vibes only', 'PogChamp'];

                    const spawnMessage = () => {
                        const i = Math.floor(Math.random() * names.length);
                        const m = Math.floor(Math.random() * msgs.length);
                        self.onMessage({
                            Type: 'MessageAdded',
                            ID: 'sim_' + Date.now() + '_' + Math.random(),
                            DisplayName: names[i],
                            DisplayNameColor: colors[i],
                            Message: msgs[m],
                            Emotes: [],
                            Badges: [],
                            Platform: 'twitch',
                            UserId: 'sim_' + i
                        });
                    };

                    // Send a few initial messages
                    for (let i = 0; i < 3; i++) setTimeout(spawnMessage, i * 300);

                    // Then periodically
                    self._simInterval = setInterval(spawnMessage, 2000);
                },
                draw: (ctx, settings, area, dt) => {
                    window.Config = window.Config || {};
                    self.update(dt);
                    self.draw(ctx, settings, area);
                },
                stop: () => {
                    if (self._simInterval) {
                        clearInterval(self._simInterval);
                        self._simInterval = null;
                    }
                }
            },
            dispose: () => {
                // Chat persists messages in localStorage, no cleanup needed
            }
        });
    }
}

// ─── Export ──────────────────────────────────────────────────────────────────

window.CanvasChat = {
    _main: CanvasChatMain,
    _simulator: CanvasChatMain  // Same class — editorRegister is on it
};

if (document.getElementById('canvas')) {
    const canvasChat = new CanvasChatMain();

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