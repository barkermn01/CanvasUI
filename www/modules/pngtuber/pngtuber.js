/**
 * PNGTuber Module
 * 
 * Audio-reactive PNG avatar that switches between idle/talking poses
 * based on microphone input levels in a configurable frequency range.
 * 
 * window.PNGTuber = { _main: PNGTuberMain, _simulator: PNGTuberSimulator }
 */

if (!window.PNGTuber) {

class PNGTuberMain {
    #audioContext = null;
    #analyser = null;
    #dataArray = null;
    #mediaStream = null;
    #initialized = false;
    #error = null;

    #state = 'idle'; // 'idle' or 'talking'
    #lastTalkTime = 0;
    #blinkTimer = 0;
    #isBlinking = false;
    #bounceOffset = 0;
    #bounceVelocity = 0;

    #imageCache = new Map();

    constructor() {
        // Audio init happens per-instance based on settings
    }

    async initAudio(deviceName) {
        if (this.#initialized) return;

        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
            if (permissionStatus.state === 'denied') {
                this.#error = 'permission';
                return;
            }

            if (permissionStatus.state === 'prompt') {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(t => t.stop());
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(d => d.kind === 'audioinput');

            if (!deviceName) {
                this.#error = 'no-device';
                return;
            }

            const device = audioInputs.find(d => d.label === deviceName);
            if (!device) {
                this.#error = 'device-not-found';
                return;
            }

            this.#audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.#analyser = this.#audioContext.createAnalyser();
            this.#analyser.fftSize = 2048;

            this.#mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: { exact: device.deviceId },
                    autoGainControl: false,
                    echoCancellation: false,
                    noiseSuppression: false
                }
            });

            const source = this.#audioContext.createMediaStreamSource(this.#mediaStream);
            source.connect(this.#analyser);

            this.#dataArray = new Uint8Array(this.#analyser.frequencyBinCount);
            this.#initialized = true;

        } catch (e) {
            this.#error = 'init-failed';
            console.error('[PNGTuber] Audio init error:', e);
        }
    }

    #getImage(src) {
        if (!src) return null;

        // In the editor context, resolve relative paths against the server
        let resolvedSrc = src;
        if (typeof EditorPrefs !== 'undefined' && src.startsWith('/')) {
            const host = EditorPrefs.get('serverHost', '127.0.0.1');
            const port = EditorPrefs.get('serverPort', 31589);
            resolvedSrc = `http://${host}:${port}${src}`;
        }

        if (this.#imageCache.has(resolvedSrc)) return this.#imageCache.get(resolvedSrc);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = resolvedSrc;
        const entry = { img, ready: false };
        img.onload = () => { entry.ready = true; };
        img.onerror = () => { console.warn('[PNGTuber] Failed to load image:', resolvedSrc); };
        this.#imageCache.set(resolvedSrc, entry);
        return entry;
    }

    #getAverageLevel(freqMin, freqMax) {
        if (!this.#initialized || !this.#analyser) return 0;

        this.#analyser.getByteFrequencyData(this.#dataArray);

        const sampleRate = this.#audioContext.sampleRate;
        const binSize = sampleRate / this.#analyser.fftSize;

        const startBin = Math.floor(freqMin / binSize);
        const endBin = Math.min(Math.ceil(freqMax / binSize), this.#dataArray.length - 1);

        if (startBin >= endBin) return 0;

        let sum = 0;
        for (let i = startBin; i <= endBin; i++) {
            sum += this.#dataArray[i];
        }
        return sum / (endBin - startBin + 1);
    }

    update(dt, settings) {
        if (!settings) return;

        // Init audio on first update if not done
        if (!this.#initialized && !this.#error) {
            this.initAudio(settings.device || Config.pngtuber?.device);
        }

        const threshold = settings.threshold ?? Config.pngtuber?.threshold ?? 30;
        const holdTime = settings.holdTime ?? Config.pngtuber?.holdTime ?? 200;
        const freqMin = settings.frequencyMin ?? Config.pngtuber?.frequencyMin ?? 85;
        const freqMax = settings.frequencyMax ?? Config.pngtuber?.frequencyMax ?? 300;
        const bounce = settings.bounce ?? Config.pngtuber?.bounce ?? false;
        const bounceAmount = settings.bounceAmount ?? Config.pngtuber?.bounceAmount ?? 5;

        // Check audio level
        const level = this.#getAverageLevel(freqMin, freqMax);
        const now = performance.now();

        if (level >= threshold) {
            if (this.#state !== 'talking') {
                this.#state = 'talking';
                if (bounce) this.#bounceVelocity = -bounceAmount * 10;
            }
            this.#lastTalkTime = now;
        } else if (this.#state === 'talking' && (now - this.#lastTalkTime) > holdTime) {
            this.#state = 'idle';
        }

        // Bounce physics
        if (bounce && this.#bounceOffset !== 0 || this.#bounceVelocity !== 0) {
            this.#bounceVelocity += 300 * dt; // gravity
            this.#bounceOffset += this.#bounceVelocity * dt;
            if (this.#bounceOffset > 0) {
                this.#bounceOffset = 0;
                this.#bounceVelocity = 0;
            }
        }

        // Blink timer
        const blinkInterval = settings.blinkInterval ?? Config.pngtuber?.blinkInterval ?? 4;
        const blinkDuration = settings.blinkDuration ?? Config.pngtuber?.blinkDuration ?? 150;

        if (blinkInterval > 0) {
            this.#blinkTimer += dt * 1000;
            if (!this.#isBlinking && this.#blinkTimer >= blinkInterval * 1000) {
                this.#isBlinking = true;
                this.#blinkTimer = 0;
            }
            if (this.#isBlinking && this.#blinkTimer >= blinkDuration) {
                this.#isBlinking = false;
                this.#blinkTimer = 0;
            }
        }
    }

    draw(ctx, settings, area) {
        if (!area) return;

        const idleSrc = settings?.idleImage || Config.pngtuber?.idleImage;
        const idleBlinkSrc = settings?.idleBlinkImage || Config.pngtuber?.idleBlinkImage;
        const talkSrc = settings?.talkingImage || Config.pngtuber?.talkingImage;
        const talkBlinkSrc = settings?.talkingBlinkImage || Config.pngtuber?.talkingBlinkImage;

        // Pick the right image based on state and blink
        let src;
        if (this.#state === 'talking') {
            src = this.#isBlinking && talkBlinkSrc ? talkBlinkSrc : (talkSrc || idleSrc);
        } else {
            src = this.#isBlinking && idleBlinkSrc ? idleBlinkSrc : idleSrc;
        }
        if (!src) return;

        const entry = this.#getImage(src);
        if (!entry || !entry.ready) return;

        const yOffset = this.#bounceOffset;

        // Draw the avatar (contain fit)
        ctx.save();
        const iw = entry.img.naturalWidth;
        const ih = entry.img.naturalHeight;
        const scale = Math.min(area.width / iw, area.height / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = area.x + (area.width - dw) / 2;
        const dy = area.y + (area.height - dh) / 2 + yOffset;

        ctx.drawImage(entry.img, dx, dy, dw, dh);
        ctx.restore();
    }

    /**
     * Editor registration for preview and simulation.
     */
    editorRegister(register) {
        const self = this;

        register({
            preview: (container, settings, area) => {
                container.innerHTML = '';
                container.style.cssText = 'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; pointer-events:none; overflow:hidden;';

                const idleSrc = settings?.idleImage;
                if (idleSrc) {
                    const host = (typeof EditorPrefs !== 'undefined') ? EditorPrefs.get('serverHost', '127.0.0.1') : '127.0.0.1';
                    const port = (typeof EditorPrefs !== 'undefined') ? EditorPrefs.get('serverPort', 31589) : 31589;
                    const resolvedSrc = idleSrc.startsWith('/') ? `http://${host}:${port}${idleSrc}` : idleSrc;

                    const img = document.createElement('img');
                    img.src = resolvedSrc;
                    img.style.cssText = 'max-width:100%; max-height:100%; object-fit:contain;';
                    container.appendChild(img);
                } else {
                    const icon = document.createElement('div');
                    icon.style.cssText = 'font-size:32px;';
                    icon.textContent = '🎭';
                    container.appendChild(icon);

                    const label = document.createElement('div');
                    label.style.cssText = 'font-size:10px; color:#aaa;';
                    label.textContent = settings?.device || 'No device set';
                    container.appendChild(label);
                }
            },
            simulate: {
                start: (canvas, settings, area) => {
                    // Init audio for simulation
                    const device = settings?.device || Config?.pngtuber?.device;
                    if (device) self.initAudio(device);
                },
                update: (settings, area, dt) => {
                    self.update(dt, settings);
                },
                draw: (ctx, settings, area, dt) => {
                    self.draw(ctx, settings, area);
                },
                stop: () => {
                    // Don't close audio — keep for restart
                }
            },
            dispose: () => {
                if (self.#mediaStream) {
                    self.#mediaStream.getTracks().forEach(t => t.stop());
                }
                if (self.#audioContext) {
                    self.#audioContext.close();
                }
            }
        });
    }
}

// ─── Simulator (same class — needs real audio) ──────────────────────────────

// ─── Export ──────────────────────────────────────────────────────────────────

window.PNGTuber = {
    _main: PNGTuberMain,
    _simulator: PNGTuberMain
};

} // end if (!window.PNGTuber)

// ─── Overlay registration ───────────────────────────────────────────────────

if (document.getElementById('canvas')) {
    const instance = new window.PNGTuber._main();
    let lastSettings = null;

    window.Modules.push({
        name: "pngtuber",
        draw: (ctx, settings, area) => {
            // Store settings from scene draw call for use in update
            if (settings) lastSettings = settings;
            instance.draw(ctx, settings, area);
        },
        update: (dt) => {
            // Use per-instance settings from last draw call, fall back to global config
            instance.update(dt, lastSettings || Config.pngtuber || {});
        }
    });
}
