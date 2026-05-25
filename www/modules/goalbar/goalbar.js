/**
 * Goal Bar Module
 * Progress bar toward a configurable target.
 *
 * Message format: { Module: "goalbar", Data: { Type: "GoalUpdate", current: 50 } }
 * Or increment:   { Module: "goalbar", Data: { Type: "GoalIncrement", amount: 1 } }
 * Or reset:       { Module: "goalbar", Data: { Type: "GoalReset" } }
 */

if (!window.GoalBarModule) {

class GoalBarMain {
    #currentValue = 0;
    #displayValue = 0; // Smoothly animated

    constructor() {}

    update(dt, settings) {
        if (!settings) return;
        // Initialize from settings if not yet set
        if (this.#currentValue === 0 && settings.current) {
            this.#currentValue = settings.current;
            this.#displayValue = settings.current;
        }
        // Smooth animation toward current value
        const diff = this.#currentValue - this.#displayValue;
        if (Math.abs(diff) > 0.01) {
            this.#displayValue += diff * Math.min(5 * dt, 1);
        } else {
            this.#displayValue = this.#currentValue;
        }
    }

    draw(ctx, settings, area) {
        if (!area) return;

        const title = settings?.title || 'Goal';
        const target = settings?.target || 100;
        const showNumbers = settings?.showNumbers !== false;
        const showPercentage = settings?.showPercentage || false;
        const barColor = settings?.barColor || '#10b981';
        const bgColor = settings?.backgroundColor || '#1f2937';
        const textColor = settings?.textColor || '#ffffff';
        const fontSize = settings?.fontSize || 16;
        const borderRadius = settings?.borderRadius || 6;
        const textPosition = settings?.textPosition || 'center';

        const progress = Math.min(this.#displayValue / target, 1);

        ctx.save();

        // Bar background (full area)
        this.#roundRect(ctx, area.x, area.y, area.width, area.height, borderRadius);
        ctx.fillStyle = bgColor;
        ctx.fill();

        // Bar fill
        if (progress > 0) {
            const fillWidth = area.width * progress;
            ctx.save();
            this.#roundRect(ctx, area.x, area.y, area.width, area.height, borderRadius);
            ctx.clip();
            ctx.fillStyle = barColor;
            ctx.fillRect(area.x, area.y, fillWidth, area.height);
            ctx.restore();
        }

        // Text
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = textColor;

        let textY;
        if (textPosition === 'top') {
            ctx.textBaseline = 'top';
            textY = area.y + 4;
        } else if (textPosition === 'bottom') {
            ctx.textBaseline = 'bottom';
            textY = area.y + area.height - 4;
        } else {
            ctx.textBaseline = 'middle';
            textY = area.y + area.height / 2;
        }

        // Title on left
        ctx.textAlign = 'left';
        ctx.fillText(title, area.x + 8, textY);

        // Numbers / percentage on right
        if (showNumbers || showPercentage) {
            ctx.textAlign = 'right';
            let infoText = '';
            if (showNumbers) infoText = `${Math.floor(this.#displayValue)} / ${target}`;
            if (showPercentage) infoText += ` (${Math.floor(progress * 100)}%)`;
            ctx.fillText(infoText.trim(), area.x + area.width - 8, textY);
        }

        ctx.restore();
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
            case 'GoalUpdate':
                this.#currentValue = data.current ?? this.#currentValue;
                break;
            case 'GoalIncrement':
                this.#currentValue += data.amount ?? 1;
                break;
            case 'GoalReset':
                this.#currentValue = 0;
                this.#displayValue = 0;
                break;
        }
    }

    editorRegister(register) {
        const self = this;
        register({
            preview: (container, settings) => {
                container.innerHTML = '';
                container.style.cssText = 'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; pointer-events:none;';
                const icon = document.createElement('div');
                icon.style.cssText = 'font-size:24px;';
                icon.textContent = '📊';
                container.appendChild(icon);
                const label = document.createElement('div');
                label.style.cssText = 'font-size:10px; color:#aaa;';
                label.textContent = `${settings?.title || 'Goal'} (${settings?.target || 100})`;
                container.appendChild(label);
            },
            simulate: {
                start: (canvas, settings) => {
                    // Start at 35% for preview
                    const target = settings?.target || 100;
                    self.onMessage({ Type: 'GoalUpdate', current: Math.floor(target * 0.35) });
                },
                update: (settings, area, dt) => {
                    self.update(dt, settings);
                    // Slowly increment during simulation
                    self.onMessage({ Type: 'GoalIncrement', amount: ((settings?.target || 100) * 0.03) * dt });
                },
                draw: (ctx, settings, area) => { self.draw(ctx, settings, area); },
                stop: () => {
                    self.onMessage({ Type: 'GoalReset' });
                }
            },
            dispose: () => {}
        });
    }
}

window.GoalBarModule = {
    _main: GoalBarMain,
    _simulator: GoalBarMain
};

} // end if (!window.GoalBarModule)

if (document.getElementById('canvas')) {
    const instance = new window.GoalBarModule._main();
    let lastSettings = null;

    window.Modules.push({
        name: "goalbar",
        draw: (ctx, settings, area) => {
            if (settings) lastSettings = settings;
            instance.draw(ctx, settings, area);
        },
        update: (dt) => {
            instance.update(dt, lastSettings || Config.goalbar || {});
        },
        events: {
            "Twitch.GoalBegin": (data) => {
                // New goal started — could set target from data
                if (data.targetAmount) {
                    instance.onMessage({ Type: 'GoalUpdate', current: data.currentAmount || 0 });
                }
            },
            "Twitch.GoalProgress": (data) => {
                instance.onMessage({ Type: 'GoalUpdate', current: data.currentAmount || 0 });
            },
            "Twitch.GoalEnd": () => {
                // Goal ended
            },
            "Twitch.CommunityGoalContribution": (data) => {
                instance.onMessage({ Type: 'GoalIncrement', amount: data.totalContribution || 1 });
            }
        }
    });
}
