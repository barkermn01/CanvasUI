/**
 * Steering Wheel Module
 *
 * Displays a rotating steering wheel driven by a gamepad axis via the
 * Gamepad API. Supports custom wheel images or draws a simple wheel graphic.
 *
 * window.SteeringWheel = { _main: SteeringWheelMain, _simulator: SteeringWheelMain }
 */

if (!window.SteeringWheel) {

class SteeringWheelMain {
    #imageCache = new Map();
    #currentRotation = 0;
    #targetRotation = 0;

    constructor() {}

    #getImage(src) {
        if (!src) return null;

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
        this.#imageCache.set(resolvedSrc, entry);
        return entry;
    }

    #getAxisValue(gamepadIndex, axisIndex, deadzone, invert) {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = gamepads[gamepadIndex];
        if (!gp || !gp.axes || axisIndex >= gp.axes.length) return 0;

        let value = gp.axes[axisIndex];

        // Apply deadzone
        if (Math.abs(value) < deadzone) value = 0;

        // Invert if requested
        if (invert) value = -value;

        return value;
    }

    #getGamepadInfo(gamepadIndex) {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = gamepads[gamepadIndex];
        if (!gp) return null;
        return {
            id: gp.id,
            axes: gp.axes ? [...gp.axes] : [],
            buttons: gp.buttons ? gp.buttons.length : 0
        };
    }

    update(dt, settings) {
        if (!settings) return;

        const gamepadIndex = settings.gamepadIndex ?? 0;
        const axisIndex = settings.axisIndex ?? 0;
        const deadzone = settings.deadzone ?? 0.02;
        const invert = settings.invertAxis ?? false;
        const maxRotation = settings.maxRotation ?? 450;

        const axisValue = this.#getAxisValue(gamepadIndex, axisIndex, deadzone, invert);

        // Map axis (-1 to 1) to rotation degrees
        this.#targetRotation = axisValue * maxRotation;

        // Smooth interpolation
        const smoothing = 12;
        this.#currentRotation += (this.#targetRotation - this.#currentRotation) * Math.min(smoothing * dt, 1);
    }

    draw(ctx, settings, area) {
        if (!area) return;

        const rotationOffset = settings?.rotationOffset ?? 0;
        const wheelImageSrc = settings?.wheelImage;
        const showDebug = settings?.showAxisDebug ?? false;
        const gamepadIndex = settings?.gamepadIndex ?? 0;

        const centerX = area.x + area.width / 2;
        const centerY = area.y + area.height / 2;
        const radius = Math.min(area.width, area.height) / 2 - 4;
        const angleDeg = this.#currentRotation + rotationOffset;
        const angleRad = angleDeg * (Math.PI / 180);

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angleRad);

        if (wheelImageSrc) {
            const entry = this.#getImage(wheelImageSrc);
            if (entry && entry.ready) {
                const iw = entry.img.naturalWidth;
                const ih = entry.img.naturalHeight;
                const scale = Math.min((radius * 2) / iw, (radius * 2) / ih);
                const dw = iw * scale;
                const dh = ih * scale;
                ctx.drawImage(entry.img, -dw / 2, -dh / 2, dw, dh);
            }
        } else {
            // Draw a simple steering wheel graphic
            this.#drawDefaultWheel(ctx, radius, settings);
        }

        ctx.restore();

        // Debug overlay: show all axis values
        if (showDebug) {
            this.#drawAxisDebug(ctx, area, gamepadIndex);
        }
    }

    #drawDefaultWheel(ctx, radius, settings) {
        const color = settings?.wheelColor || '#ffffff';
        const thickness = settings?.wheelThickness || 6;

        // Outer ring
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.stroke();

        // Inner ring (smaller)
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.35, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness * 0.6;
        ctx.stroke();

        // Three spokes (120° apart)
        for (let i = 0; i < 3; i++) {
            const angle = (i * 120 - 90) * (Math.PI / 180);
            const innerR = radius * 0.35;
            const outerR = radius;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
            ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
            ctx.strokeStyle = color;
            ctx.lineWidth = thickness * 0.8;
            ctx.stroke();
        }

        // Center dot
        ctx.beginPath();
        ctx.arc(0, 0, thickness, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Top marker (so you can see rotation)
        ctx.beginPath();
        ctx.arc(0, -radius + thickness, thickness * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4444';
        ctx.fill();
    }

    #drawAxisDebug(ctx, area, gamepadIndex) {
        const info = this.#getGamepadInfo(gamepadIndex);
        if (!info) {
            ctx.save();
            ctx.font = '12px monospace';
            ctx.fillStyle = '#ff6666';
            ctx.fillText('No gamepad detected', area.x + 4, area.y + area.height - 8);
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.font = '11px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.8;

        const lineHeight = 14;
        let y = area.y + 14;

        // Gamepad name (truncated)
        const name = info.id.length > 40 ? info.id.substring(0, 40) + '...' : info.id;
        ctx.fillText(name, area.x + 4, y);
        y += lineHeight + 2;

        // Axes
        for (let i = 0; i < info.axes.length; i++) {
            const val = info.axes[i];
            const barWidth = 60;
            const barHeight = 8;
            const barX = area.x + 70;
            const barY = y - barHeight + 2;

            // Label
            ctx.fillStyle = '#aaaaaa';
            ctx.fillText(`Axis ${i}:`, area.x + 4, y);

            // Value text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(val.toFixed(3), area.x + 140, y);

            // Bar background
            ctx.fillStyle = '#333333';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Bar fill (centered, extends left/right from middle)
            const mid = barX + barWidth / 2;
            const fillWidth = (val * barWidth) / 2;
            ctx.fillStyle = val >= 0 ? '#4488ff' : '#ff4444';
            if (fillWidth >= 0) {
                ctx.fillRect(mid, barY, fillWidth, barHeight);
            } else {
                ctx.fillRect(mid + fillWidth, barY, -fillWidth, barHeight);
            }

            // Center line
            ctx.fillStyle = '#888888';
            ctx.fillRect(mid - 0.5, barY, 1, barHeight);

            y += lineHeight;
        }

        ctx.restore();
    }

    editorRegister(register) {
        const self = this;

        register({
            preview: (container, settings, area) => {
                container.innerHTML = '';
                container.style.cssText = 'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; pointer-events:none; overflow:hidden;';

                const icon = document.createElement('div');
                icon.style.cssText = 'font-size:32px;';
                icon.textContent = '🎮';
                container.appendChild(icon);

                const label = document.createElement('div');
                label.style.cssText = 'font-size:10px; color:#aaa;';
                label.textContent = `Axis ${settings?.axisIndex ?? 0} | ±${settings?.maxRotation ?? 450}°`;
                container.appendChild(label);
            },
            simulate: {
                start: (canvas, settings, area) => {},
                update: (settings, area, dt) => {
                    self.update(dt, settings);
                },
                draw: (ctx, settings, area, dt) => {
                    self.draw(ctx, settings, area);
                },
                stop: () => {}
            },
            dispose: () => {}
        });
    }
}

window.SteeringWheel = {
    _main: SteeringWheelMain,
    _simulator: SteeringWheelMain
};

} // end if (!window.SteeringWheel)

// ─── Overlay registration ───────────────────────────────────────────────────

if (document.getElementById('canvas')) {
    const instance = new window.SteeringWheel._main();
    let lastSettings = null;

    window.Modules.push({
        name: "steeringwheel",
        draw: (ctx, settings, area) => {
            if (settings) lastSettings = settings;
            instance.draw(ctx, settings, area);
        },
        update: (dt) => {
            instance.update(dt, lastSettings || Config.steeringwheel || {});
        }
    });
}
