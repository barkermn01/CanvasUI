/**
 * ModuleSimulator - Runs real overlay modules inside editor containers.
 * 
 * For canvas-based modules (emote, audiovisualiser): creates a <canvas> inside
 * the container and calls the real draw/update methods.
 * 
 * For DOM-based modules (chat): passes the container as targetContainer and
 * sends simulated messages.
 */
class ModuleSimulator {
    static #activeSimulations = new Map(); // id -> { cleanup, animFrame }

    static isPlaying(id) {
        return this.#activeSimulations.has(id);
    }

    static toggle(id, mod, container) {
        if (this.#activeSimulations.has(id)) {
            this.stop(id);
        } else {
            this.start(id, mod, container);
        }
    }

    static stop(id) {
        const sim = this.#activeSimulations.get(id);
        if (sim) {
            if (sim.animFrame) cancelAnimationFrame(sim.animFrame);
            if (sim.cleanup) sim.cleanup();
            this.#activeSimulations.delete(id);
        }
    }

    static stopAll() {
        for (const id of this.#activeSimulations.keys()) {
            this.stop(id);
        }
    }

    static start(id, mod, container) {
        container.innerHTML = '';
        container.style.overflow = 'hidden';

        // Ensure Config is set from editor state
        window.Config = EditorState.globalConfig;

        switch (mod.type) {
            case 'emote': this.#simEmote(id, container); break;
            case 'audiovisualiser': this.#simAudioVisualiser(id, container); break;
            case 'video': this.#simVideo(id, mod, container); break;
            case 'webcam': this.#simWebcam(id, mod, container); break;
            case 'image': this.#simImage(id, mod, container); break;
            default: return;
        }
    }

    static #simEmote(id, container) {
        // Create a canvas for emotes
        const canvas = document.createElement('canvas');
        canvas.width = container.clientWidth || 300;
        canvas.height = container.clientHeight || 200;
        canvas.style.cssText = 'width:100%; height:100%; pointer-events:none;';
        container.appendChild(canvas);

        // Use the real Emote class if available, otherwise simulate
        let emotes = [];
        const spawnEmote = () => {
            // Create a simple bouncing emoji since we can't load real emote URLs in editor
            const emoteIcons = ['😀', '🎉', '❤️', '🔥', '👀', '💀', '🤣', '✨', '🎮', '💜'];
            const icon = emoteIcons[Math.floor(Math.random() * emoteIcons.length)];
            const w = canvas.width;
            const h = canvas.height;

            emotes.push({
                icon,
                x: Math.random() * (w - 30),
                y: Math.random() * (h - 30),
                vx: (Math.random() - 0.5) * (Config.emote?.Speed?.Min || 100),
                vy: (Math.random() - 0.5) * (Config.emote?.Speed?.Max || 200),
                life: (Config.emote?.AnimationTime?.Min || 10) + Math.random() * ((Config.emote?.AnimationTime?.Max || 20) - (Config.emote?.AnimationTime?.Min || 10)),
                size: 24
            });
        };

        for (let i = 0; i < 4; i++) spawnEmote();
        const spawnInterval = setInterval(spawnEmote, 1200);

        let lastTime = performance.now();
        const ctx = canvas.getContext('2d');

        const animate = (now) => {
            const dt = (now - lastTime) / 1000;
            lastTime = now;
            const w = canvas.width;
            const h = canvas.height;

            ctx.clearRect(0, 0, w, h);

            emotes.forEach(e => {
                e.x += e.vx * dt;
                e.y += e.vy * dt;
                e.life -= dt;

                if (e.x <= 0 || e.x >= w - e.size) e.vx *= -1;
                if (e.y <= 0 || e.y >= h - e.size) e.vy *= -1;
                e.x = Math.max(0, Math.min(w - e.size, e.x));
                e.y = Math.max(0, Math.min(h - e.size, e.y));

                let alpha = 1;
                if (e.life <= 2) alpha = Math.max(0, e.life / 2);

                ctx.globalAlpha = alpha;
                ctx.font = `${e.size}px serif`;
                ctx.fillText(e.icon, e.x, e.y + e.size);
            });
            ctx.globalAlpha = 1;

            emotes = emotes.filter(e => e.life > 0);

            const frame = requestAnimationFrame(animate);
            ModuleSimulator.#activeSimulations.get(id).animFrame = frame;
        };

        const frame = requestAnimationFrame(animate);
        this.#activeSimulations.set(id, {
            animFrame: frame,
            cleanup: () => {
                clearInterval(spawnInterval);
                canvas.remove();
            }
        });
    }

    static #simAudioVisualiser(id, container) {
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'width:100%; height:100%; pointer-events:none;';
        container.appendChild(canvas);

        // Load real AudioVisualiser module from server
        const host = EditorPrefs.get('serverHost', '127.0.0.1');
        const port = EditorPrefs.get('serverPort', 31589);

        const startSim = () => {
            if (!window.AudioVisualiser) return;

            window.Config = EditorState.globalConfig;
            const avInstance = new window.AudioVisualiser();

            const animate = () => {
                if (!container.isConnected) return;

                const moduleId = container.closest('[data-module-id]')?.dataset.moduleId;
                const modData = moduleId ? EditorState.getActiveSceneModules()[moduleId] : null;
                const w = modData ? modData.area.width : (container.clientWidth || 300);
                const h = modData ? modData.area.height : (container.clientHeight || 80);

                if (canvas.width !== w || canvas.height !== h) {
                    canvas.width = w;
                    canvas.height = h;
                }

                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, w, h);

                window.Config = EditorState.globalConfig;

                if (avInstance.initialized) {
                    avInstance.analyser.getByteFrequencyData(avInstance.dataArray);
                    avInstance.drawBars(ctx, { x: 0, y: 0, width: w, height: h });
                }

                const frame = requestAnimationFrame(animate);
                const sim = ModuleSimulator.#activeSimulations.get(id);
                if (sim) sim.animFrame = frame;
            };

            const frame = requestAnimationFrame(animate);
            this.#activeSimulations.set(id, {
                animFrame: frame,
                cleanup: () => {
                    if (avInstance.mediaStream) {
                        avInstance.mediaStream.getTracks().forEach(t => t.stop());
                    }
                    if (avInstance.audioContext) {
                        avInstance.audioContext.close();
                    }
                    canvas.remove();
                }
            });
        };

        if (window.AudioVisualiser) {
            startSim();
        } else if (document.querySelector('script[data-av-module]')) {
            const check = setInterval(() => {
                if (window.AudioVisualiser) { clearInterval(check); startSim(); }
            }, 100);
            this.#activeSimulations.set(id, { cleanup: () => { clearInterval(check); canvas.remove(); } });
        } else {
            const script = document.createElement('script');
            script.src = `http://${host}:${port}/modules/audiovisualiser/audiovisualiser.js`;
            script.dataset.avModule = 'true';
            script.onload = startSim;
            script.onerror = () => {
                container.innerHTML = '<div class="module-no-media"><span class="module-no-media-icon">🎵</span><span class="module-no-media-text">Start server to simulate</span></div>';
            };
            document.head.appendChild(script);
            this.#activeSimulations.set(id, { cleanup: () => { canvas.remove(); } });
        }
    }

    static #simVideo(id, mod, container) {
        if (!mod.settings.src) {
            container.innerHTML = '<div class="module-no-media"><span class="module-no-media-icon">⚠️</span><span class="module-no-media-text">No video selected</span></div>';
            return;
        }

        const host = EditorPrefs.get('serverHost', '127.0.0.1');
        const port = EditorPrefs.get('serverPort', 31589);

        const vid = document.createElement('video');
        vid.src = `http://${host}:${port}${mod.settings.src}`;
        vid.muted = true;
        vid.loop = true;
        vid.autoplay = true;
        vid.style.width = '100%';
        vid.style.height = '100%';
        vid.style.objectFit = mod.settings.objectFit || 'contain';
        vid.style.pointerEvents = 'none';
        container.appendChild(vid);

        vid.play().catch(() => {});

        this.#activeSimulations.set(id, {
            cleanup: () => {
                vid.pause();
                vid.src = '';
                vid.remove();
            }
        });
    }

    static #simImage(id, mod, container) {
        if (!mod.settings.src) {
            container.innerHTML = '<div class="module-no-media"><span class="module-no-media-icon">⚠️</span><span class="module-no-media-text">No image selected</span></div>';
            return;
        }

        const host = EditorPrefs.get('serverHost', '127.0.0.1');
        const port = EditorPrefs.get('serverPort', 31589);

        const img = document.createElement('img');
        img.src = `http://${host}:${port}${mod.settings.src}`;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = mod.settings.objectFit || 'contain';
        img.style.pointerEvents = 'none';
        img.style.opacity = mod.settings.opacity ?? 1;
        container.appendChild(img);

        this.#activeSimulations.set(id, {
            cleanup: () => {
                img.remove();
            }
        });
    }

    static #simWebcam(id, mod, container) {
        const settings = mod.settings || {};

        const vid = document.createElement('video');
        vid.autoplay = true;
        vid.playsInline = true;
        vid.muted = true;
        vid.style.width = '100%';
        vid.style.height = '100%';
        vid.style.objectFit = 'cover';
        vid.style.pointerEvents = 'none';

        if (settings.mirror) {
            vid.style.transform = 'scaleX(-1)';
        }
        if (settings.mask === 'circle') {
            vid.style.borderRadius = '50%';
        } else if (settings.mask === 'rounded') {
            vid.style.borderRadius = settings.borderRadius || '16px';
        }

        container.appendChild(vid);

        navigator.mediaDevices.enumerateDevices().then(devices => {
            const cameras = devices.filter(d => d.kind === 'videoinput');
            let deviceId;
            if (settings.device) {
                const match = cameras.find(d => d.label === settings.device);
                if (match) deviceId = match.deviceId;
            }
            const constraints = { video: deviceId ? { deviceId: { exact: deviceId } } : true };
            return navigator.mediaDevices.getUserMedia(constraints);
        }).then(stream => {
            vid.srcObject = stream;
            vid.play().catch(() => {});
            const sim = this.#activeSimulations.get(id);
            if (sim) sim._stream = stream;
        }).catch(err => {
            container.innerHTML = `<div class="module-no-media"><span class="module-no-media-icon">📷</span><span class="module-no-media-text">Camera unavailable</span></div>`;
            console.error('[Webcam Sim]', err.name, err.message);
        });

        this.#activeSimulations.set(id, {
            _stream: null,
            cleanup: () => {
                const sim = this.#activeSimulations.get(id);
                if (sim && sim._stream) {
                    sim._stream.getTracks().forEach(t => t.stop());
                }
                vid.srcObject = null;
                vid.remove();
            }
        });
    }
}
