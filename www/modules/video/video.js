if (!window.VideoDisplay) {

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

    /**
     * Called by the editor to register preview and simulation hooks.
     */
    editorRegister(register) {
        const self = this;
        const host = (typeof EditorPrefs !== 'undefined') ? EditorPrefs.get('serverHost', '127.0.0.1') : '127.0.0.1';
        const port = (typeof EditorPrefs !== 'undefined') ? EditorPrefs.get('serverPort', 31589) : 31589;
        let simVideo = null;

        register({
            preview: (container, settings, area) => {
                container.innerHTML = '';
                if (!settings?.src) {
                    container.innerHTML = '<div class="module-no-media"><span class="module-no-media-icon">⚠️</span><span class="module-no-media-text">No video selected</span></div>';
                    return;
                }
                const vid = document.createElement('video');
                vid.src = `http://${host}:${port}${settings.src}`;
                vid.muted = true;
                vid.loop = true;
                vid.style.width = '100%';
                vid.style.height = '100%';
                vid.style.objectFit = settings.objectFit || 'contain';
                vid.style.pointerEvents = 'none';
                container.appendChild(vid);
            },
            simulate: {
                start: (canvas, settings, area) => {
                    if (!settings?.src) return;
                    const vid = document.createElement('video');
                    vid.src = `http://${host}:${port}${settings.src}`;
                    vid.muted = true;
                    vid.loop = true;
                    vid.autoplay = true;
                    vid.playsInline = true;
                    vid.style.display = 'none';
                    document.body.appendChild(vid);
                    vid.play().catch(() => {});
                    simVideo = vid;
                },
                draw: (ctx, settings, area, dt) => {
                    if (!simVideo || simVideo.readyState < 2) return;

                    const opacity = settings.opacity ?? 1;
                    const objectFit = settings.objectFit || 'contain';
                    ctx.save();
                    ctx.globalAlpha = opacity;

                    const vw = simVideo.videoWidth;
                    const vh = simVideo.videoHeight;

                    if (objectFit === 'cover') {
                        const scale = Math.max(area.width / vw, area.height / vh);
                        const sw = area.width / scale;
                        const sh = area.height / scale;
                        const sx = (vw - sw) / 2;
                        const sy = (vh - sh) / 2;
                        ctx.drawImage(simVideo, sx, sy, sw, sh, area.x, area.y, area.width, area.height);
                    } else if (objectFit === 'fill') {
                        ctx.drawImage(simVideo, area.x, area.y, area.width, area.height);
                    } else {
                        const scale = Math.min(area.width / vw, area.height / vh);
                        const dw = vw * scale;
                        const dh = vh * scale;
                        const dx = area.x + (area.width - dw) / 2;
                        const dy = area.y + (area.height - dh) / 2;
                        ctx.drawImage(simVideo, dx, dy, dw, dh);
                    }
                    ctx.restore();
                },
                stop: () => {
                    if (simVideo) {
                        simVideo.pause();
                        simVideo.src = '';
                        simVideo.remove();
                        simVideo = null;
                    }
                }
            },
            dispose: () => {
                if (simVideo) {
                    simVideo.pause();
                    simVideo.src = '';
                    simVideo.remove();
                    simVideo = null;
                }
                // Clean up cached videos
                for (const [, entry] of self.#cache) {
                    entry.video.pause();
                    entry.video.src = '';
                    entry.video.remove();
                }
                self.#cache.clear();
            }
        });
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

// ─── Export ──────────────────────────────────────────────────────────────────

window.VideoDisplay = {
    _main: VideoDisplay,
    _simulator: VideoDisplay  // Same class — editorRegister is on it
};

} // end if (!window.VideoDisplay)

// ─── Overlay registration ───────────────────────────────────────────────────

if (document.getElementById('canvas')) {
    const videoDisplay = new window.VideoDisplay._main();

    window.Modules.push({
        name: "video",
        draw: (ctx, settings, area) => {
            videoDisplay.draw(ctx, settings, area);
        }
    });
}
