/**
 * Gamepad D-Pad Module
 *
 * Displays D-pad directional input from a controller.
 * Supports both button-based D-pads (standard mapping) and axis-based
 * D-pads (some controllers report D-pad as axes 6/7).
 *
 * window.GamepadDpad = { _main: GamepadDpadMain, _simulator: GamepadDpadMain }
 */

if (!window.GamepadDpad) {

class GamepadDpadMain {
    #up = false;
    #down = false;
    #left = false;
    #right = false;

    constructor() {}

    #getGamepad(index) {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        return gamepads[index] || null;
    }

    update(dt, settings) {
        if (!settings) return;

        const gp = this.#getGamepad(settings.gamepadIndex ?? 0);
        if (!gp) {
            this.#up = this.#down = this.#left = this.#right = false;
            return;
        }

        const mode = settings.inputMode || 'buttons';

        if (mode === 'buttons') {
            const upIdx = settings.upButton ?? 12;
            const downIdx = settings.downButton ?? 13;
            const leftIdx = settings.leftButton ?? 14;
            const rightIdx = settings.rightButton ?? 15;

            this.#up = gp.buttons[upIdx]?.pressed || false;
            this.#down = gp.buttons[downIdx]?.pressed || false;
            this.#left = gp.buttons[leftIdx]?.pressed || false;
            this.#right = gp.buttons[rightIdx]?.pressed || false;
        } else {
            // Axis mode
            const hAxis = settings.horizontalAxis ?? 6;
            const vAxis = settings.verticalAxis ?? 7;
            const threshold = settings.axisThreshold ?? 0.5;

            const h = gp.axes[hAxis] ?? 0;
            const v = gp.axes[vAxis] ?? 0;

            this.#left = h < -threshold;
            this.#right = h > threshold;
            this.#up = v < -threshold;
            this.#down = v > threshold;
        }
    }

    draw(ctx, settings, area) {
        if (!area) return;

        const inactiveColor = settings?.inactiveColor || '#444444';
        const activeColor = settings?.activeColor || '#22d3ee';
        const borderColor = settings?.borderColor || '#666666';

        ctx.save();

        // Calculate D-pad dimensions to fit the area
        const size = Math.min(area.width, area.height);
        const armWidth = size * 0.3;
        const armLength = size * 0.35;
        const centerX = area.x + area.width / 2;
        const centerY = area.y + area.height / 2;
        const gap = 2;

        // Draw the four directional arms
        // Up
        this.#drawArm(ctx, centerX - armWidth / 2, centerY - armLength - gap, armWidth, armLength,
            this.#up ? activeColor : inactiveColor, borderColor);

        // Down
        this.#drawArm(ctx, centerX - armWidth / 2, centerY + gap, armWidth, armLength,
            this.#down ? activeColor : inactiveColor, borderColor);

        // Left
        this.#drawArm(ctx, centerX - armLength - gap, centerY - armWidth / 2, armLength, armWidth,
            this.#left ? activeColor : inactiveColor, borderColor);

        // Right
        this.#drawArm(ctx, centerX + gap, centerY - armWidth / 2, armLength, armWidth,
            this.#right ? activeColor : inactiveColor, borderColor);

        // Center square
        ctx.fillStyle = '#222222';
        ctx.fillRect(centerX - armWidth / 2, centerY - armWidth / 2, armWidth, armWidth);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(centerX - armWidth / 2, centerY - armWidth / 2, armWidth, armWidth);

        ctx.restore();
    }

    #drawArm(ctx, x, y, w, h, fillColor, strokeColor) {
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
    }

    editorRegister(register) {
        const self = this;
        register({
            preview: (container, settings) => {
                container.innerHTML = '';
                container.style.cssText = 'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; pointer-events:none;';
                const icon = document.createElement('div');
                icon.style.cssText = 'font-size:32px;';
                icon.textContent = '✚';
                container.appendChild(icon);
                const label = document.createElement('div');
                label.style.cssText = 'font-size:10px; color:#aaa;';
                label.textContent = `D-Pad | ${settings?.inputMode || 'buttons'}`;
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

window.GamepadDpad = {
    _main: GamepadDpadMain,
    _simulator: GamepadDpadMain
};

} // end if (!window.GamepadDpad)

if (document.getElementById('canvas')) {
    const instance = new window.GamepadDpad._main();
    let lastSettings = null;

    window.Modules.push({
        name: "gamepaddpad",
        draw: (ctx, settings, area) => {
            if (settings) lastSettings = settings;
            instance.draw(ctx, settings, area);
        },
        update: (dt) => {
            instance.update(dt, lastSettings || Config.gamepaddpad || {});
        }
    });
}
