class WebcamModule {
    #video = null;
    #stream = null;
    #initialized = false;
    #error = null;
    #initPromise = null;

    constructor() {
        this.#initPromise = this.initCamera();
    }

    async initCamera() {
        try {
            const config = Config.webcam || {};
            const deviceName = config.device || '';

            // Always enumerate to log available devices
            let devices = await navigator.mediaDevices.enumerateDevices();
            let cameras = devices.filter(d => d.kind === 'videoinput');
            console.log('[Webcam] Available cameras:', cameras.map(d => d.label || d.deviceId));

            let constraints;

            if (deviceName) {
                const match = cameras.find(d => d.label === deviceName);
                if (match) {
                    console.log('[Webcam] Using device:', match.label);
                    constraints = { video: { deviceId: { exact: match.deviceId } } };
                } else {
                    console.log('[Webcam] Device not found:', deviceName, '— using default');
                    constraints = { video: true };
                }
            } else {
                // No device specified — use first available or default
                if (cameras.length > 0 && cameras[0].deviceId) {
                    console.log('[Webcam] No device configured, using first:', cameras[0].label || cameras[0].deviceId);
                    constraints = { video: { deviceId: cameras[0].deviceId } };
                } else {
                    constraints = { video: true };
                }
            }

            this.#stream = await navigator.mediaDevices.getUserMedia(constraints);

            this.#video = document.createElement('video');
            this.#video.srcObject = this.#stream;
            this.#video.autoplay = true;
            this.#video.playsInline = true;
            this.#video.muted = true;
            this.#video.style.position = 'absolute';
            this.#video.style.top = '-9999px';
            this.#video.style.left = '-9999px';
            this.#video.style.width = '1px';
            this.#video.style.height = '1px';
            document.body.appendChild(this.#video);

            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Video load timeout')), 10000);
                if (this.#video.readyState >= 2) {
                    clearTimeout(timeout);
                    resolve();
                } else {
                    this.#video.addEventListener('loadeddata', () => {
                        clearTimeout(timeout);
                        resolve();
                    }, { once: true });
                    this.#video.addEventListener('error', () => {
                        clearTimeout(timeout);
                        reject(new Error('Video element error'));
                    }, { once: true });
                }
            });

            await this.#video.play();
            this.#initialized = true;
            this.#error = null;
            console.log('[Webcam] Initialized, video size:', this.#video.videoWidth, 'x', this.#video.videoHeight);

        } catch (e) {
            console.error('[Webcam] Init failed:', e.name, e.message);
            this.#error = e.message;

            // Retry after 3 seconds if device was busy
            if (e.name === 'NotReadableError' || e.name === 'AbortError') {
                console.log('[Webcam] Device busy, retrying in 3s...');
                setTimeout(() => this.initCamera(), 3000);
            }
        }
    }

    #getArea(canvasWidth, canvasHeight) {
        if (!Config.Scenes) return { x: 0, y: 0, width: canvasWidth, height: canvasHeight };

        const activeScene = Config.DefaultScene || Object.keys(Config.Scenes)[0];
        const scene = Config.Scenes[activeScene];
        if (!scene || !scene.modules) return { x: 0, y: 0, width: canvasWidth, height: canvasHeight };

        const key = Object.keys(scene.modules).find(k => k.toLowerCase().startsWith('webcam'));
        if (!key || !scene.modules[key].area) return { x: 0, y: 0, width: canvasWidth, height: canvasHeight };

        const a = scene.modules[key].area;
        return {
            x: typeof a.x === 'number' ? a.x : 0,
            y: typeof a.y === 'number' ? a.y : 0,
            width: typeof a.width === 'number' ? a.width : canvasWidth,
            height: typeof a.height === 'number' ? a.height : canvasHeight
        };
    }

    draw(ctx) {
        if (!this.#initialized || !this.#video) return;
        if (this.#video.readyState < 2) return;

        const config = Config.webcam || {};
        const mirror = config.mirror || false;
        const mask = config.mask || 'none';
        const borderRadius = config.borderRadius || '0';

        const area = this.#getArea(ctx.canvas.width, ctx.canvas.height);

        ctx.save();

        // Clip to area (scene system also clips, but this handles masks)
        if (mask === 'circle') {
            ctx.beginPath();
            const cx = area.x + area.width / 2;
            const cy = area.y + area.height / 2;
            const r = Math.min(area.width, area.height) / 2;
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
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
            // After flip, draw at mirrored x position
            const drawX = area.x;
            const vw = this.#video.videoWidth;
            const vh = this.#video.videoHeight;
            const scale = Math.max(area.width / vw, area.height / vh);
            const sw = area.width / scale;
            const sh = area.height / scale;
            const sx = (vw - sw) / 2;
            const sy = (vh - sh) / 2;
            ctx.drawImage(this.#video, sx, sy, sw, sh, drawX, area.y, area.width, area.height);
        } else {
            // Cover-fit: crop source to fill area without stretching
            const vw = this.#video.videoWidth;
            const vh = this.#video.videoHeight;
            const scale = Math.max(area.width / vw, area.height / vh);
            const sw = area.width / scale;
            const sh = area.height / scale;
            const sx = (vw - sw) / 2;
            const sy = (vh - sh) / 2;
            ctx.drawImage(this.#video, sx, sy, sw, sh, area.x, area.y, area.width, area.height);
        }

        ctx.restore();
    }
}

// Only auto-instantiate in overlay mode
if (document.getElementById('canvas')) {
    const webcamModule = new WebcamModule();

    window.Modules.push({
        name: "webcam",
        draw: (ctx) => {
            webcamModule.draw(ctx);
        }
    });
}
