if (!window.ImageDisplay) {

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

    /**
     * Called by the editor to register preview and simulation hooks.
     */
    editorRegister(register) {
        const self = this;
        const host = (typeof EditorPrefs !== 'undefined') ? EditorPrefs.get('serverHost', '127.0.0.1') : '127.0.0.1';
        const port = (typeof EditorPrefs !== 'undefined') ? EditorPrefs.get('serverPort', 31589) : 31589;

        register({
            preview: (container, settings, area) => {
                container.innerHTML = '';
                if (!settings?.src) {
                    container.innerHTML = '<div class="module-no-media"><span class="module-no-media-icon">⚠️</span><span class="module-no-media-text">No image selected</span></div>';
                    return;
                }
                const img = document.createElement('img');
                img.src = `http://${host}:${port}${settings.src}`;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = settings.objectFit || 'contain';
                img.style.pointerEvents = 'none';
                img.style.opacity = settings.opacity ?? 1;
                container.appendChild(img);
            },
            simulate: {
                start: (canvas, settings, area) => {},
                draw: (ctx, settings, area, dt) => {
                    if (!settings?.src) return;
                    const src = `http://${host}:${port}${settings.src}`;
                    const entry = self.#getImage(src);
                    if (!entry.ready) return;

                    const opacity = settings.opacity ?? 1;
                    const objectFit = settings.objectFit || 'contain';
                    ctx.save();
                    ctx.globalAlpha = opacity;

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
                        const scale = Math.min(area.width / iw, area.height / ih);
                        const dw = iw * scale;
                        const dh = ih * scale;
                        const dx = area.x + (area.width - dw) / 2;
                        const dy = area.y + (area.height - dh) / 2;
                        ctx.drawImage(entry.img, dx, dy, dw, dh);
                    }
                    ctx.restore();
                },
                stop: () => {}
            },
            dispose: () => {
                self.#cache.clear();
            }
        });
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

// ─── Export ──────────────────────────────────────────────────────────────────

window.ImageDisplay = {
    _main: ImageDisplay,
    _simulator: ImageDisplay  // Same class — editorRegister is on it
};

} // end if (!window.ImageDisplay)

// ─── Overlay registration ───────────────────────────────────────────────────

if (document.getElementById('canvas')) {
    const imageDisplay = new window.ImageDisplay._main();

    window.Modules.push({
        name: "image",
        draw: (ctx, settings, area) => {
            imageDisplay.draw(ctx, settings, area);
        }
    });
}
