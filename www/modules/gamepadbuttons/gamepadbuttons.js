/**
 * Gamepad Button Module
 *
 * Displays a single controller button with idle/active images or
 * a drawn circle that lights up when pressed.
 *
 * window.GamepadButtons = { _main: GamepadButtonsMain, _simulator: GamepadButtonsMain }
 */

if (!window.GamepadButtons) {

class GamepadButtonsMain {
    #pressed = false;
    #value = 0;
    #imageCache = new Map();

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

    update(dt, settings) {
        if (!settings) return;

        const gamepadIndex = settings.gamepadIndex ?? 0;
        const buttonIndex = settings.buttonIndex ?? 0;

        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = gamepads[gamepadIndex];

        if (gp && gp.buttons && buttonIndex < gp.buttons.length) {
            this.#pressed = gp.buttons[buttonIndex].pressed;
            this.#value = gp.buttons[buttonIndex].value;
        } else {
            this.#pressed = false;
            this.#value = 0;
        }
    }

    draw(ctx, settings, area) {
        if (!area) return;

        const idleSrc = settings?.idleImage;
        const activeSrc = settings?.activeImage;
        const showLabel = settings?.showLabel !== false;
        const buttonIndex = settings?.buttonIndex ?? 0;

        // If images are provided, use them
        const src = this.#pressed ? (activeSrc || idleSrc) : idleSrc;
        if (src) {
            const entry = this.#getImage(src);
            if (entry && entry.ready) {
                const iw = entry.img.naturalWidth;
                const ih = entry.img.naturalHeight;
                const scale = Math.min(area.width / iw, area.height / ih);
                const dw = iw * scale;
                const dh = ih * scale;
                const dx = area.x + (area.width - dw) / 2;
                const dy = area.y + (area.height - dh) / 2;
                ctx.drawImage(entry.img, dx, dy, dw, dh);
                return;
            }
        }

        // Fallback: draw a circle button
        const inactiveColor = settings?.inactiveColor || '#333333';
        const activeColor = settings?.activeColor || '#ff4488';
        const borderColor = settings?.borderColor || '#888888';

        const centerX = area.x + area.width / 2;
        const centerY = area.y + area.height / 2;
        const radius = Math.min(area.width, area.height) / 2 - 4;

        ctx.save();

        // Fill
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        if (this.#pressed) {
            ctx.fillStyle = activeColor;
        } else if (this.#value > 0) {
            ctx.fillStyle = this.#lerpColor(inactiveColor, activeColor, this.#value);
        } else {
            ctx.fillStyle = inactiveColor;
        }
        ctx.fill();

        // Border
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.#pressed ? activeColor : borderColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Label
        if (showLabel) {
            ctx.font = `bold ${Math.max(12, radius * 0.5)}px sans-serif`;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(buttonIndex), centerX, centerY);
        }

        ctx.restore();
    }

    #lerpColor(colorA, colorB, t) {
        const a = this.#hexToRgb(colorA);
        const b = this.#hexToRgb(colorB);
        const r = Math.round(a.r + (b.r - a.r) * t);
        const g = Math.round(a.g + (b.g - a.g) * t);
        const bl = Math.round(a.b + (b.b - a.b) * t);
        return `rgb(${r},${g},${bl})`;
    }

    #hexToRgb(hex) {
        const h = hex.replace('#', '');
        return {
            r: parseInt(h.substring(0, 2), 16) || 0,
            g: parseInt(h.substring(2, 4), 16) || 0,
            b: parseInt(h.substring(4, 6), 16) || 0
        };
    }

    editorRegister(register) {
        const self = this;
        register({
            preview: (container, settings) => {
                container.innerHTML = '';
                container.style.cssText = 'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; pointer-events:none;';
                const icon = document.createElement('div');
                icon.style.cssText = 'font-size:32px;';
                icon.textContent = '🔘';
                container.appendChild(icon);
                const label = document.createElement('div');
                label.style.cssText = 'font-size:10px; color:#aaa;';
                label.textContent = `Button ${settings?.buttonIndex ?? 0}`;
                container.appendChild(label);
            },
            simulate: {
                start: () => {},
                update: (settings, area, dt) => { self.update(dt, settings); },
                draw: (ctx, settings, area) => { self.draw(ctx, settings, area); },
                stop: () => {}
            },
            dispose: () => {}
        });
    }
}

window.GamepadButtons = {
    _main: GamepadButtonsMain,
    _simulator: GamepadButtonsMain
};

} // end if (!window.GamepadButtons)

if (document.getElementById('canvas')) {
    const instance = new window.GamepadButtons._main();
    let lastSettings = null;

    window.Modules.push({
        name: "gamepadbuttons",
        draw: (ctx, settings, area) => {
            if (settings) lastSettings = settings;
            instance.draw(ctx, settings, area);
        },
        update: (dt) => {
            instance.update(dt, lastSettings || Config.gamepadbuttons || {});
        }
    });
}
