/**
 * Webcam Module — supports multiple instances with different devices.
 * Each instance's device/mirror/mask settings come from the scene config.
 * Streams are cached by device name so the same camera isn't opened twice.
 */

if (!window.WebcamManager) {

window.WebcamManager = class WebcamManager {
    #streams = new Map(); // deviceName -> { video, stream, ready, error, refCount }

    getEntry(deviceName) {
        return this.#streams.get(deviceName || '_default');
    }

    async getStream(deviceName) {
        const key = deviceName || '_default';

        if (this.#streams.has(key)) {
            const entry = this.#streams.get(key);
            entry.refCount++;
            return entry;
        }

        const entry = { video: null, stream: null, ready: false, error: null, refCount: 1 };
        this.#streams.set(key, entry);

        try {
            let devices = await navigator.mediaDevices.enumerateDevices();
            let cameras = devices.filter(d => d.kind === 'videoinput');

            let constraints;
            if (deviceName) {
                const match = cameras.find(d => d.label === deviceName);
                if (match) {
                    constraints = { video: { deviceId: { exact: match.deviceId } } };
                } else {
                    constraints = { video: true };
                }
            } else {
                constraints = { video: true };
            }

            entry.stream = await navigator.mediaDevices.getUserMedia(constraints);

            entry.video = document.createElement('video');
            entry.video.srcObject = entry.stream;
            entry.video.autoplay = true;
            entry.video.playsInline = true;
            entry.video.muted = true;
            entry.video.style.position = 'absolute';
            entry.video.style.top = '-9999px';
            entry.video.style.left = '-9999px';
            entry.video.style.width = '1px';
            entry.video.style.height = '1px';
            document.body.appendChild(entry.video);

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Video load timeout')), 10000);
                if (entry.video.readyState >= 2) {
                    clearTimeout(timeout);
                    resolve();
                } else {
                    entry.video.addEventListener('loadeddata', () => { clearTimeout(timeout); resolve(); }, { once: true });
                    entry.video.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Video error')); }, { once: true });
                }
            });

            await entry.video.play();
            entry.ready = true;

        } catch (e) {
            entry.error = e.message;
            // Retry if device busy
            if (e.name === 'NotReadableError' || e.name === 'AbortError') {
                setTimeout(() => {
                    this.#streams.delete(key);
                }, 3000);
            }
        }

        return entry;
    }

    releaseStream(deviceName) {
        const key = deviceName || '_default';
        const entry = this.#streams.get(key);
        if (!entry) return;
        entry.refCount--;
        if (entry.refCount <= 0) {
            if (entry.stream) entry.stream.getTracks().forEach(t => t.stop());
            if (entry.video) entry.video.remove();
            this.#streams.delete(key);
        }
    }
};

}

/**
 * WebcamDisplay — editor-facing class for webcam instances.
 */
if (!window.WebcamDisplay) {

class WebcamDisplay {
    #manager = null;
    #stream = null;
    #deviceName = null;

    constructor() {
        // Use shared manager
        if (!window._webcamManagerInstance) {
            window._webcamManagerInstance = new window.WebcamManager();
        }
        this.#manager = window._webcamManagerInstance;
    }

    /**
     * Called by the editor to register preview and simulation hooks.
     */
    editorRegister(register) {
        const self = this;

        register({
            preview: (container, settings, area) => {
                container.innerHTML = '';
                container.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; background: rgba(0,0,0,0.3); position: relative; overflow: hidden; gap: 4px;';

                const icon = document.createElement('div');
                icon.style.cssText = 'font-size: 28px; opacity: 0.8;';
                icon.textContent = '📷';

                const label = document.createElement('div');
                label.style.cssText = 'font-size: 10px; color: #aaa;';
                label.textContent = settings?.device || 'Default camera';

                container.appendChild(icon);
                container.appendChild(label);
            },
            simulate: {
                start: (canvas, settings, area) => {
                    self.#deviceName = settings?.device || '';
                    self.#manager.getStream(self.#deviceName);
                },
                draw: (ctx, settings, area, dt) => {
                    const device = settings?.device || '';
                    const mirror = settings?.mirror ?? false;
                    const mask = settings?.mask || 'none';
                    const borderRadius = settings?.borderRadius || '0';
                    const chromaEnabled = settings?.chromaKey ?? false;
                    const chromaColor = settings?.chromaKeyColor || '#00ff00';
                    const chromaSimilarity = settings?.chromaKeySimilarity ?? 0.4;
                    const chromaSmoothness = settings?.chromaKeySmoothness ?? 0.08;
                    const chromaSpill = settings?.chromaKeySpill ?? 0.1;

                    const entry = self.#manager.getEntry(device);
                    if (!entry || !entry.ready || !entry.video || entry.video.readyState < 2) return;

                    // Determine source (video or chroma-keyed canvas)
                    let source = entry.video;
                    if (chromaEnabled && window.ChromaKey) {
                        if (!self._chromaKey) self._chromaKey = new window.ChromaKey();
                        if (self._chromaKey.isAvailable) {
                            self._chromaKey.setKey(chromaColor, chromaSimilarity, chromaSmoothness, chromaSpill);
                            const processed = self._chromaKey.process(entry.video);
                            if (processed) source = processed;
                        }
                    }

                    ctx.save();

                    // Mask clipping
                    if (mask === 'circle') {
                        ctx.beginPath();
                        ctx.arc(area.x + area.width / 2, area.y + area.height / 2, Math.min(area.width, area.height) / 2, 0, Math.PI * 2);
                        ctx.clip();
                    } else if (mask === 'rounded' && borderRadius !== '0') {
                        const r = Math.min(parseInt(borderRadius) || 16, area.width / 2, area.height / 2);
                        ctx.beginPath();
                        ctx.moveTo(area.x + r, area.y);
                        ctx.lineTo(area.x + area.width - r, area.y);
                        ctx.quadraticCurveTo(area.x + area.width, area.y, area.x + area.width, area.y + r);
                        ctx.lineTo(area.x + area.width, area.y + area.height - r);
                        ctx.quadraticCurveTo(area.x + area.width, area.y + area.height, area.x + area.width - r, area.y + area.height);
                        ctx.lineTo(area.x + r, area.y + area.height);
                        ctx.quadraticCurveTo(area.x, area.y + area.height, area.x, area.y + area.height - r);
                        ctx.lineTo(area.x, area.y + r);
                        ctx.quadraticCurveTo(area.x, area.y, area.x + r, area.y);
                        ctx.closePath();
                        ctx.clip();
                    }

                    // Mirror
                    if (mirror) {
                        ctx.translate(area.x + area.width, 0);
                        ctx.scale(-1, 1);
                    }

                    // Cover-fit draw
                    const vw = source === entry.video ? entry.video.videoWidth : source.width;
                    const vh = source === entry.video ? entry.video.videoHeight : source.height;
                    const scale = Math.max(area.width / vw, area.height / vh);
                    const sw = area.width / scale;
                    const sh = area.height / scale;
                    const sx = (vw - sw) / 2;
                    const sy = (vh - sh) / 2;
                    ctx.drawImage(source, sx, sy, sw, sh, mirror ? area.x : area.x, area.y, area.width, area.height);

                    ctx.restore();
                },
                stop: () => {
                    if (self.#deviceName !== null) {
                        self.#manager.releaseStream(self.#deviceName);
                        self.#deviceName = null;
                    }
                    if (self._chromaKey) {
                        self._chromaKey.dispose();
                        self._chromaKey = null;
                    }
                }
            },
            dispose: () => {
                if (self.#deviceName !== null) {
                    self.#manager.releaseStream(self.#deviceName);
                    self.#deviceName = null;
                }
                if (self._chromaKey) {
                    self._chromaKey.dispose();
                    self._chromaKey = null;
                }
            }
        });
    }
}

// ─── Export ──────────────────────────────────────────────────────────────────

window.WebcamDisplay = {
    _main: WebcamDisplay,
    _simulator: WebcamDisplay
};

} // end if (!window.WebcamDisplay)

if (document.getElementById('canvas')) {
    const manager = new window.WebcamManager();
    // Track which devices have been requested
    const requestedDevices = new Set();
    // ChromaKey instances per device
    const chromaKeys = new Map();

    function getChromaKey(device) {
        const key = device || '_default';
        if (!chromaKeys.has(key)) {
            chromaKeys.set(key, new window.ChromaKey());
        }
        return chromaKeys.get(key);
    }

    window.Modules.push({
        name: "webcam",
        draw: (ctx, settings, area) => {
            if (!area) return;

            const device = settings?.device || '';
            const mirror = settings?.mirror ?? false;
            const mask = settings?.mask || 'none';
            const borderRadius = settings?.borderRadius || '0';
            const chromaEnabled = settings?.chromaKey ?? false;
            const chromaColor = settings?.chromaKeyColor || '#00ff00';
            const chromaSimilarity = settings?.chromaKeySimilarity ?? 0.4;
            const chromaSmoothness = settings?.chromaKeySmoothness ?? 0.08;
            const chromaSpill = settings?.chromaKeySpill ?? 0.1;

            // Request stream if not already done
            const key = device || '_default';
            if (!requestedDevices.has(key)) {
                requestedDevices.add(key);
                manager.getStream(device);
            }

            // Get cached entry
            const entry = manager.getEntry(device);
            if (!entry || !entry.ready || !entry.video || entry.video.readyState < 2) return;

            // Determine the source to draw (video or chroma-keyed canvas)
            let source = entry.video;
            if (chromaEnabled && window.ChromaKey) {
                const ck = getChromaKey(device);
                if (ck.isAvailable) {
                    ck.setKey(chromaColor, chromaSimilarity, chromaSmoothness, chromaSpill);
                    const processed = ck.process(entry.video);
                    if (processed) source = processed;
                }
            }

            ctx.save();

            // Mask clipping
            if (mask === 'circle') {
                ctx.beginPath();
                ctx.arc(area.x + area.width / 2, area.y + area.height / 2, Math.min(area.width, area.height) / 2, 0, Math.PI * 2);
                ctx.clip();
            } else if (mask === 'rounded' && borderRadius !== '0') {
                const r = Math.min(parseInt(borderRadius) || 16, area.width / 2, area.height / 2);
                ctx.beginPath();
                ctx.moveTo(area.x + r, area.y);
                ctx.lineTo(area.x + area.width - r, area.y);
                ctx.quadraticCurveTo(area.x + area.width, area.y, area.x + area.width, area.y + r);
                ctx.lineTo(area.x + area.width, area.y + area.height - r);
                ctx.quadraticCurveTo(area.x + area.width, area.y + area.height, area.x + area.width - r, area.y + area.height);
                ctx.lineTo(area.x + r, area.y + area.height);
                ctx.quadraticCurveTo(area.x, area.y + area.height, area.x, area.y + area.height - r);
                ctx.lineTo(area.x, area.y + r);
                ctx.quadraticCurveTo(area.x, area.y, area.x + r, area.y);
                ctx.closePath();
                ctx.clip();
            }

            // Mirror
            if (mirror) {
                ctx.translate(area.x + area.width, 0);
                ctx.scale(-1, 1);
            }

            // Cover-fit draw
            const vw = source === entry.video ? entry.video.videoWidth : source.width;
            const vh = source === entry.video ? entry.video.videoHeight : source.height;
            const scale = Math.max(area.width / vw, area.height / vh);
            const sw = area.width / scale;
            const sh = area.height / scale;
            const sx = (vw - sw) / 2;
            const sy = (vh - sh) / 2;
            ctx.drawImage(source, sx, sy, sw, sh, mirror ? area.x : area.x, area.y, area.width, area.height);

            ctx.restore();
        }
    });
}
