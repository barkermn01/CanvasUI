/**
 * Gamepad Buttons Module
 *
 * Displays controller button states with press highlighting.
 * Uses the Gamepad API to poll button states each frame.
 *
 * window.GamepadButtons = { _main: GamepadButtonsMain, _simulator: GamepadButtonsMain }
 */

if (!window.GamepadButtons) {

class GamepadButtonsMain {
    #buttonStates = [];

    constructor() {}

    #getButtonStates(gamepadIndex) {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = gamepads[gamepadIndex];
        if (!gp || !gp.buttons) return [];
        return gp.buttons.map((b, i) => ({
            index: i,
            pressed: b.pressed,
            value: b.value
        }));
    }

    update(dt, settings) {
        if (!settings) return;
        const gamepadIndex = settings.gamepadIndex ?? 0;
        this.#buttonStates = this.#getButtonStates(gamepadIndex);
    }

    draw(ctx, settings, area) {
        if (!area) return;

        const layout = settings?.layout || 'grid';
        const buttonSize = settings?.buttonSize || 32;
        const spacing = settings?.spacing || 4;
        const inactiveColor = settings?.inactiveColor || '#333333';
        const activeColor = settings?.activeColor || '#ff4488';
        const borderColor = settings?.borderColor || '#888888';
        const showLabels = settings?.showLabels !== false;
        const showOnlyPressed = settings?.showOnlyPressed || false;

        let buttons = this.#buttonStates;
        if (showOnlyPressed) {
            buttons = buttons.filter(b => b.pressed);
        }

        if (buttons.length === 0) {
            if (showOnlyPressed) return; // Nothing pressed, nothing to show
            // No gamepad connected
            ctx.save();
            ctx.font = '12px sans-serif';
            ctx.fillStyle = '#888888';
            ctx.textAlign = 'center';
            ctx.fillText('No gamepad', area.x + area.width / 2, area.y + area.height / 2);
            ctx.restore();
            return;
        }

        ctx.save();

        const cellSize = buttonSize + spacing;
        let cols, rows;

        if (layout === 'row') {
            cols = buttons.length;
            rows = 1;
        } else if (layout === 'column') {
            cols = 1;
            rows = buttons.length;
        } else {
            // Grid: fit as many columns as the area allows
            cols = Math.max(1, Math.floor(area.width / cellSize));
            rows = Math.ceil(buttons.length / cols);
        }

        // Center the grid in the area
        const gridWidth = cols * cellSize - spacing;
        const gridHeight = rows * cellSize - spacing;
        const offsetX = area.x + (area.width - gridWidth) / 2;
        const offsetY = area.y + (area.height - gridHeight) / 2;

        for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = offsetX + col * cellSize;
            const y = offsetY + row * cellSize;

            // Button circle
            const cx = x + buttonSize / 2;
            const cy = y + buttonSize / 2;
            const radius = buttonSize / 2 - 2;

            // Fill based on press state (supports analog with value)
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            if (btn.pressed) {
                ctx.fillStyle = activeColor;
            } else if (btn.value > 0) {
                // Partial press (analog triggers)
                ctx.fillStyle = this.#lerpColor(inactiveColor, activeColor, btn.value);
            } else {
                ctx.fillStyle = inactiveColor;
            }
            ctx.fill();

            // Border
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = btn.pressed ? activeColor : borderColor;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label
            if (showLabels) {
                ctx.font = `${Math.max(10, buttonSize * 0.35)}px sans-serif`;
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(btn.index), cx, cy);
            }
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
                label.textContent = `Buttons | ${settings?.layout || 'grid'}`;
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
