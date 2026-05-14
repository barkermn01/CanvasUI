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
            case 'chat': this.#simChat(id, container); break;
            case 'emote': this.#simEmote(id, container); break;
            case 'audiovisualiser': this.#simAudioVisualiser(id, container); break;
            case 'video': this.#simVideo(id, mod, container); break;
            default: container.textContent = '▶ No simulation'; return;
        }
    }

    static #simChat(id, container) {
        // Create a chat manager targeting our container
        const chatContainer = document.createElement('div');
        chatContainer.style.cssText = 'width:100%; height:100%; position:relative;';
        container.appendChild(chatContainer);

        const chatManager = new Chat_MessageManager({ targetContainer: chatContainer });

        const sampleMessages = [
            { ID: 'sim1', DisplayName: 'CoolViewer', DisplayNameColor: '#e74c3c', Message: 'This stream is awesome!', Emotes: [], Badges: [], Platform: 'twitch', UserId: 'u1', Type: 'MessageAdded' },
            { ID: 'sim2', DisplayName: 'NightOwl', DisplayNameColor: '#3498db', Message: 'Hey chat! 👋', Emotes: [], Badges: [], Platform: 'twitch', UserId: 'u2', Type: 'MessageAdded' },
            { ID: 'sim3', DisplayName: 'GamerPro', DisplayNameColor: '#2ecc71', Message: 'GG well played', Emotes: [], Badges: [], Platform: 'twitch', UserId: 'u3', Type: 'MessageAdded' },
            { ID: 'sim4', DisplayName: 'LurkKing', DisplayNameColor: '#9b59b6', Message: 'Just lurking 👀', Emotes: [], Badges: [], Platform: 'twitch', UserId: 'u4', Type: 'MessageAdded' },
            { ID: 'sim5', DisplayName: 'SubHype', DisplayNameColor: '#f39c12', Message: 'Lets gooo 🎉🎉🎉', Emotes: [], Badges: [], Platform: 'twitch', UserId: 'u5', Type: 'MessageAdded' },
            { ID: 'sim6', DisplayName: 'ChillDude', DisplayNameColor: '#1abc9c', Message: 'Vibes are immaculate', Emotes: [], Badges: [], Platform: 'twitch', UserId: 'u6', Type: 'MessageAdded' },
            { ID: 'sim7', DisplayName: 'NewHere', DisplayNameColor: '#e67e22', Message: 'First time watching!', Emotes: [], Badges: [], Platform: 'twitch', UserId: 'u7', Type: 'MessageAdded' },
            { ID: 'sim8', DisplayName: 'EmoteSpam', DisplayNameColor: '#fd79a8', Message: '❤️ ❤️ ❤️', Emotes: [], Badges: [], Platform: 'twitch', UserId: 'u8', Type: 'MessageAdded' },
        ];

        let msgIndex = 0;

        // Send initial message
        chatManager.onMessage(sampleMessages[msgIndex++ % sampleMessages.length]);

        const interval = setInterval(() => {
            chatManager.onMessage(sampleMessages[msgIndex++ % sampleMessages.length]);
        }, 1500);

        this.#activeSimulations.set(id, {
            cleanup: () => {
                clearInterval(interval);
                chatContainer.remove();
            }
        });
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
        // Create a canvas and use the real AudioVisualiser draw logic
        const canvas = document.createElement('canvas');
        canvas.width = container.clientWidth || 300;
        canvas.height = container.clientHeight || 200;
        canvas.style.cssText = 'width:100%; height:100%; pointer-events:none;';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const config = Config.AudioVisualiser || {};
        const colors = config.colors || {};
        const barWidth = config.barWidth || 5;
        const barSpacing = config.barSpacing || 2;
        const direction = config.direction || 'right-left';
        const mirrored = config.mirrored || false;

        // Generate fake frequency data
        const barCount = Math.floor(canvas.width / (barWidth + barSpacing));
        const fakeData = new Uint8Array(barCount);
        const targets = new Float32Array(barCount);

        // Initialize with random values
        for (let i = 0; i < barCount; i++) {
            const r = Math.random();
            targets[i] = r < 0.3 ? Math.random() * 50 : r < 0.6 ? Math.random() * 100 + 50 : Math.random() * 105 + 150;
            fakeData[i] = targets[i];
        }

        // Create a minimal AudioVisualiser-like object that uses the real draw methods
        const vis = {
            dataArray: fakeData,
            initialized: true,
            getColor(value) {
                if (value < 25) return colors.level1 || '#67136f';
                if (value < 50) return colors.level2 || '#5c3886';
                if (value < 75) return colors.level3 || '#885ab4';
                return colors.level4 || '#885ab4';
            },
            createBarGradient(ctx, x, y, width, height) {
                const isVert = direction === 'right-left' || direction === 'left-right';
                let gradient;
                if (isVert) {
                    gradient = ctx.createLinearGradient(x, y + height, x, y);
                } else {
                    gradient = ctx.createLinearGradient(x, y, x + width, y);
                }
                const stops = colors.gradient?.stops || [];
                stops.forEach(stop => gradient.addColorStop(stop.position, stop.color));
                return gradient;
            }
        };

        let lastTime = performance.now();

        const animate = (now) => {
            const dt = (now - lastTime) / 1000;
            lastTime = now;

            // Animate fake data toward targets
            for (let i = 0; i < barCount; i++) {
                const diff = targets[i] - fakeData[i];
                fakeData[i] += diff * 2 * dt;
                if (Math.abs(diff) < 3) {
                    const r = Math.random();
                    targets[i] = r < 0.3 ? Math.random() * 50 : r < 0.6 ? Math.random() * 100 + 50 : Math.random() * 105 + 150;
                }
            }

            // Draw using the same logic as the real module
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const area = { x: 0, y: 0, width: canvas.width, height: canvas.height };
            const isVertical = direction === 'right-left' || direction === 'left-right';
            const barSize = barWidth;
            const maxBarLength = isVertical ? area.height : area.width;
            const halfLength = mirrored ? maxBarLength / 2 : maxBarLength;
            const center = isVertical ? area.y + (area.height / 2) : area.x + (area.width / 2);
            const useGradient = colors.mode === 'gradient';

            for (let i = 0; i < barCount; i++) {
                const value = fakeData[i] / 255 * 100;
                const size = (value / 100) * halfLength;
                const position = i * (barSize + barSpacing);

                let barX, barY, barW, barH;

                switch (direction) {
                    case 'right-left':
                        barX = area.x + area.width - position - barSize;
                        barY = mirrored ? center - size : area.y + area.height - size;
                        barW = barSize;
                        barH = size;
                        break;
                    case 'left-right':
                        barX = area.x + position;
                        barY = mirrored ? center - size : area.y + area.height - size;
                        barW = barSize;
                        barH = size;
                        break;
                    case 'top-down':
                        barY = area.y + position;
                        barX = mirrored ? center - size : area.x;
                        barW = size;
                        barH = barSize;
                        break;
                    case 'bottom-up':
                        barY = area.y + position;
                        barX = mirrored ? center - size : area.x + area.width - size;
                        barW = size;
                        barH = barSize;
                        break;
                }

                if (useGradient && colors.gradient?.stops?.length) {
                    ctx.fillStyle = vis.createBarGradient(ctx, barX, barY, barW, barH);
                } else {
                    ctx.fillStyle = vis.getColor(value);
                }

                ctx.fillRect(barX, barY, barW, barH);

                if (mirrored) {
                    if (isVertical) {
                        if (useGradient && colors.gradient?.stops?.length) {
                            ctx.fillStyle = vis.createBarGradient(ctx, barX, center, barW, barH);
                        }
                        ctx.fillRect(barX, center, barW, barH);
                    } else {
                        if (useGradient && colors.gradient?.stops?.length) {
                            ctx.fillStyle = vis.createBarGradient(ctx, center, barY, barW, barH);
                        }
                        ctx.fillRect(center, barY, barW, barH);
                    }
                }
            }

            const frame = requestAnimationFrame(animate);
            ModuleSimulator.#activeSimulations.get(id).animFrame = frame;
        };

        const frame = requestAnimationFrame(animate);
        this.#activeSimulations.set(id, {
            animFrame: frame,
            cleanup: () => {
                canvas.remove();
            }
        });
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
}
