class ImageDisplay {
    #cache = new Map(); // src -> Image element

    #getImage(src) {
        if (this.#cache.has(src)) return this.#cache.get(src);

        const img = new Image();
        img.src = src;
        const entry = { img, ready: false };
        img.addEventListener('load', () => { entry.ready = true; });
        this.#cache.set(src, entry);
        return entry;
    }

    draw(ctx, settings, area) {
        if (!settings || !settings.src) return;

        const entry = this.#getImage(settings.src);
        if (!entry.ready) return;

        const opacity = settings.opacity ?? 1;
        const objectFit = settings.objectFit || 'contain';

        ctx.save();
        ctx.globalAlpha = opacity;

        if (area) {
            const iw = entry.img.naturalWidth;
            const ih = entry.img.naturalHeight;

            if (objectFit === 'cover') {
                const scale = Math.max(area.width / iw, area.height / ih);
                const sw = area.width / scale;
                const sh = area.height / scale;
                const sx = (iw - sw) / 2;
                const sy = (ih - sh) / 2;
                ctx.drawImage(entry.img, sx, sy, sw, sh, area.x, area.y, area.width, area.height);
            } else if (objectFit === 'fill') {
                ctx.drawImage(entry.img, area.x, area.y, area.width, area.height);
            } else {
                // contain
                const scale = Math.min(area.width / iw, area.height / ih);
                const dw = iw * scale;
                const dh = ih * scale;
                const dx = area.x + (area.width - dw) / 2;
                const dy = area.y + (area.height - dh) / 2;
                ctx.drawImage(entry.img, dx, dy, dw, dh);
            }
        } else {
            ctx.drawImage(entry.img, 0, 0, ctx.canvas.width, ctx.canvas.height);
        }

        ctx.restore();
    }
}

if (document.getElementById('canvas')) {
    const imageDisplay = new ImageDisplay();

    window.Modules.push({
        name: "image",
        draw: (ctx, settings, area) => {
            imageDisplay.draw(ctx, settings, area);
        }
    });
}
