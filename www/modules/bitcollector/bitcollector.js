/**
 * Bit Collector Module
 * Glass that fills with bits/kicks and bursts at threshold.
 *
 * Messages:
 * { Module: "bitcollector", Data: { Type: "Add", amount: 100 } }
 * { Module: "bitcollector", Data: { Type: "Burst" } }  — trigger burst manually
 * { Module: "bitcollector", Data: { Type: "Reset" } }
 * { Module: "bitcollector", Data: { Type: "Set", amount: 500 } }
 */

if (!window.BitCollectorModule) {

class BitCollectorMain {
    #current = 0;
    #displayLevel = 0;
    #bursting = false;
    #burstTimer = 0;
    #burstParticles = [];

    constructor() {}

    update(dt, settings) {
        if (!settings) return;
        const threshold = settings.threshold || 1000;

        // Smooth fill animation
        const target = Math.min(this.#current / threshold, 1);
        const diff = target - this.#displayLevel;
        if (Math.abs(diff) > 0.001) {
            this.#displayLevel += diff * Math.min(3 * dt, 1);
        } else {
            this.#displayLevel = target;
        }

        // Auto-burst when threshold reached
        if (this.#current >= threshold && !this.#bursting) {
            this.#triggerBurst();
        }

        // Burst animation
        if (this.#bursting) {
            this.#burstTimer += dt;
            for (const p of this.#burstParticles) {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += 400 * dt; // gravity
                p.life -= dt;
            }
            this.#burstParticles = this.#burstParticles.filter(p => p.life > 0);
            if (this.#burstTimer > 2) {
                this.#bursting = false;
                this.#burstTimer = 0;
            }
        }
    }

    draw(ctx, settings, area) {
        if (!area) return;

        const fillColor = settings?.fillColor || '#8b5cf6';
        const glassColor = settings?.glassColor || '#ffffff';
        const bgColor = settings?.backgroundColor || '#1f1f3a';
        const burstColor = settings?.burstColor || '#fbbf24';
        const showAmount = settings?.showAmount !== false;
        const fontSize = settings?.fontSize || 16;
        const textColor = settings?.textColor || '#ffffff';
        const thickness = settings?.glassThickness || 3;
        const borderRadius = settings?.borderRadius || 4;
        const threshold = settings?.threshold || 1000;

        ctx.save();

        const padding = thickness;
        const innerX = area.x + padding;
        const innerY = area.y + padding;
        const innerW = area.width - padding * 2;
        const innerH = area.height - padding * 2;

        // Glass background
        this.#roundRect(ctx, area.x, area.y, area.width, area.height, borderRadius);
        ctx.fillStyle = bgColor;
        ctx.fill();

        // Fill level (from bottom)
        const fillH = innerH * this.#displayLevel;
        if (fillH > 0) {
            ctx.save();
            this.#roundRect(ctx, innerX, innerY, innerW, innerH, Math.max(0, borderRadius - padding));
            ctx.clip();
            ctx.fillStyle = fillColor;
            ctx.fillRect(innerX, innerY + innerH - fillH, innerW, fillH);
            ctx.restore();
        }

        // Glass border
        this.#roundRect(ctx, area.x, area.y, area.width, area.height, borderRadius);
        ctx.strokeStyle = glassColor;
        ctx.lineWidth = thickness;
        ctx.stroke();

        // Amount text
        if (showAmount) {
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.floor(this.#current)} / ${threshold}`, area.x + area.width / 2, area.y + area.height / 2);
        }

        // Burst particles
        if (this.#bursting) {
            for (const p of this.#burstParticles) {
                ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
                ctx.fillStyle = burstColor;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    #triggerBurst() {
        this.#bursting = true;
        this.#burstTimer = 0;
        this.#current = 0;
        this.#displayLevel = 0;

        // Generate particles from the top of the glass
        this.#burstParticles = [];
        for (let i = 0; i < 30; i++) {
            this.#burstParticles.push({
                x: 0, y: 0, // Will be set relative to area in draw — use center
                vx: (Math.random() - 0.5) * 300,
                vy: -Math.random() * 400 - 100,
                size: Math.random() * 4 + 2,
                life: Math.random() * 1.5 + 0.5,
                maxLife: Math.random() * 1.5 + 0.5
            });
        }
        // Position particles — we'll offset them in draw based on area
        // For simplicity, store them as offsets from center
    }

    #roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    onMessage(data) {
        switch (data.Type) {
            case 'Add':
                this.#current += data.amount ?? 1;
                break;
            case 'Set':
                this.#current = data.amount ?? 0;
                break;
            case 'Burst':
                this.#triggerBurst();
                break;
            case 'Reset':
                this.#current = 0;
                this.#displayLevel = 0;
                this.#bursting = false;
                break;
        }
    }

    editorRegister(register) {
        const self = this;
        register({
            preview: (container, settings) => {
                container.innerHTML = '';
                container.style.cssText = 'position:relative; pointer-events:none;';
                const canvas = document.createElement('canvas');
                canvas.style.cssText = 'width:100%; height:100%; display:block;';
                container.appendChild(canvas);
                const moduleEl = container.closest('[data-module-id]');
                const moduleId = moduleEl?.dataset.moduleId;
                const mod = moduleId ? EditorState.getActiveSceneModules()[moduleId] : null;
                const w = mod ? mod.area.width : 300;
                const h = mod ? mod.area.height : 200;
                canvas.width = w;
                canvas.height = h;
                // Show at 40% fill for preview
                self.onMessage({ Type: 'Set', amount: (settings?.threshold || 1000) * 0.4 });
                self.update(0.5, settings);
                const ctx = canvas.getContext('2d');
                const area = { x: 0, y: 0, width: w, height: h };
                self.draw(ctx, settings, area);
            },
            simulate: {
                start: (canvas, settings) => {
                    self.onMessage({ Type: 'Set', amount: (settings?.threshold || 1000) * 0.2 });
                },
                update: (settings, area, dt) => {
                    self.update(dt, settings);
                    // Slowly add bits during simulation
                    self.onMessage({ Type: 'Add', amount: ((settings?.threshold || 1000) * 0.08) * dt });
                },
                draw: (ctx, settings, area) => { self.draw(ctx, settings, area); },
                stop: () => {
                    self.onMessage({ Type: 'Reset' });
                }
            },
            dispose: () => {}
        });
    }
}

window.BitCollectorModule = {
    _main: BitCollectorMain,
    _simulator: BitCollectorMain
};

} // end if (!window.BitCollectorModule)

if (document.getElementById('canvas')) {
    const instance = new window.BitCollectorModule._main();
    let lastSettings = null;

    window.Modules.push({
        name: "bitcollector",
        draw: (ctx, settings, area) => {
            if (settings) lastSettings = settings;
            instance.draw(ctx, settings, area);
        },
        update: (dt) => {
            instance.update(dt, lastSettings || Config.bitcollector || {});
        },
        message: (data) => {
            instance.onMessage(data);
        },
        events: {
            "Twitch.Cheer": (data) => {
                instance.onMessage({ Type: 'Add', amount: data.bits || 0 });
            },
            "Kick.sGifted": (data) => {
                instance.onMessage({ Type: 'Add', amount: parseInt(data.amount || data.kicksAmount || 0) });
            }
        }
    });
}
