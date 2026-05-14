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
};

}

if (document.getElementById('canvas')) {
    const manager = new window.WebcamManager();
    // Track which devices have been requested
    const requestedDevices = new Set();

    window.Modules.push({
        name: "webcam",
        draw: (ctx, settings, area) => {
            if (!area) return;

            const device = settings?.device || '';
            const mirror = settings?.mirror ?? false;
            const mask = settings?.mask || 'none';
            const borderRadius = settings?.borderRadius || '0';

            // Debug: log what settings each instance receives
            if (!window._webcamDebugLogged) window._webcamDebugLogged = {};
            const debugKey = `${area.x},${area.y}`;
            if (!window._webcamDebugLogged[debugKey]) {
                console.log('[Webcam Draw]', debugKey, 'device:', JSON.stringify(device), 'settings:', JSON.stringify(settings));
                window._webcamDebugLogged[debugKey] = true;
            }

            // Request stream if not already done
            const key = device || '_default';
            if (!requestedDevices.has(key)) {
                requestedDevices.add(key);
                console.log('[Webcam] Requesting stream for key:', JSON.stringify(key), 'device:', JSON.stringify(device));
                manager.getStream(device);
            }

            // Get cached entry
            const entry = manager.getEntry(device);
            if (!entry || !entry.ready || !entry.video || entry.video.readyState < 2) return;

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
            const vw = entry.video.videoWidth;
            const vh = entry.video.videoHeight;
            const scale = Math.max(area.width / vw, area.height / vh);
            const sw = area.width / scale;
            const sh = area.height / scale;
            const sx = (vw - sw) / 2;
            const sy = (vh - sh) / 2;
            ctx.drawImage(entry.video, sx, sy, sw, sh, mirror ? area.x : area.x, area.y, area.width, area.height);

            ctx.restore();
        }
    });
}
