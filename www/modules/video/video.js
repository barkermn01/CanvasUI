class VideoDisplay {
    #cache = new Map(); // src -> { video, ready }

    #getVideo(src, settings) {
        if (this.#cache.has(src)) return this.#cache.get(src);

        const video = document.createElement('video');
        video.src = src;
        video.muted = settings.muted ?? true;
        video.loop = settings.loop ?? true;
        video.playsInline = true;
        video.style.display = 'none';
        document.body.appendChild(video);

        const entry = { video, ready: false };
        video.addEventListener('canplay', () => {
            entry.ready = true;
            video.play();
        }, { once: true });

        this.#cache.set(src, entry);
        return entry;
    }

    draw(ctx, settings, area) {
        if (!settings || !settings.src) return;

        const entry = this.#getVideo(settings.src, settings);
        if (!entry.ready || entry.video.paused) return;

        const opacity = settings.opacity ?? 1;
        const objectFit = settings.objectFit || 'contain';

        ctx.save();
        ctx.globalAlpha = opacity;

        if (area) {
            const vw = entry.video.videoWidth;
            const vh = entry.video.videoHeight;

            if (objectFit === 'cover') {
                const scale = Math.max(area.width / vw, area.height / vh);
                const sw = area.width / scale;
                const sh = area.height / scale;
                const sx = (vw - sw) / 2;
                const sy = (vh - sh) / 2;
                ctx.drawImage(entry.video, sx, sy, sw, sh, area.x, area.y, area.width, area.height);
            } else if (objectFit === 'fill') {
                ctx.drawImage(entry.video, area.x, area.y, area.width, area.height);
            } else {
                // contain
                const scale = Math.min(area.width / vw, area.height / vh);
                const dw = vw * scale;
                const dh = vh * scale;
                const dx = area.x + (area.width - dw) / 2;
                const dy = area.y + (area.height - dh) / 2;
                ctx.drawImage(entry.video, dx, dy, dw, dh);
            }
        } else {
            ctx.drawImage(entry.video, 0, 0, ctx.canvas.width, ctx.canvas.height);
        }

        ctx.restore();
    }
}

if (document.getElementById('canvas')) {
    const videoDisplay = new VideoDisplay();

    window.Modules.push({
        name: "video",
        draw: (ctx, settings, area) => {
            videoDisplay.draw(ctx, settings, area);
        }
    });
}
