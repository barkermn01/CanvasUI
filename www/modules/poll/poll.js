/**
 * Poll Display Module
 *
 * Messages:
 * { Module: "poll", Data: { Type: "Update", title: "Best game?", options: [{name:"A", votes:10},{name:"B", votes:5}] } }
 * { Module: "poll", Data: { Type: "End" } }
 */

if (!window.PollModule) {

class PollMain {
    #active = false;
    #title = '';
    #options = []; // [{name, votes}]
    #displayVotes = []; // smoothed

    constructor() {}

    update(dt, settings) {
        // Smooth vote bar animations
        for (let i = 0; i < this.#options.length; i++) {
            if (!this.#displayVotes[i]) this.#displayVotes[i] = 0;
            const target = this.#options[i].votes;
            const diff = target - this.#displayVotes[i];
            if (Math.abs(diff) > 0.1) {
                this.#displayVotes[i] += diff * Math.min(4 * dt, 1);
            } else {
                this.#displayVotes[i] = target;
            }
        }
    }

    draw(ctx, settings, area) {
        if (!area) return;
        if (!this.#active && (settings?.hideWhenInactive !== false)) return;

        const fontSize = settings?.fontSize || 16;
        const barColor = settings?.barColor || '#06b6d4';
        const bgColor = settings?.backgroundColor || '#1f2937';
        const textColor = settings?.textColor || '#ffffff';
        const showPct = settings?.showPercentage !== false;

        ctx.save();

        // Title
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(this.#title, area.x, area.y);

        const totalVotes = this.#displayVotes.reduce((a, b) => a + b, 0) || 1;
        const barStartY = area.y + fontSize + 8;
        const barHeight = Math.min(fontSize + 8, (area.height - fontSize - 8) / Math.max(this.#options.length, 1) - 4);

        for (let i = 0; i < this.#options.length; i++) {
            const opt = this.#options[i];
            const votes = this.#displayVotes[i] || 0;
            const pct = votes / totalVotes;
            const y = barStartY + i * (barHeight + 4);

            // Bar background
            ctx.fillStyle = bgColor;
            ctx.fillRect(area.x, y, area.width, barHeight);

            // Bar fill
            ctx.fillStyle = barColor;
            ctx.fillRect(area.x, y, area.width * pct, barHeight);

            // Option text
            ctx.font = `${fontSize * 0.85}px sans-serif`;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            let label = opt.name;
            if (showPct) label += ` (${Math.round(pct * 100)}%)`;
            ctx.fillText(label, area.x + 6, y + barHeight / 2);

            // Vote count on right
            ctx.textAlign = 'right';
            ctx.fillText(String(Math.floor(votes)), area.x + area.width - 6, y + barHeight / 2);
        }

        ctx.restore();
    }

    onMessage(data) {
        switch (data.Type) {
            case 'Update':
                this.#active = true;
                this.#title = data.title || this.#title;
                if (data.options) {
                    this.#options = data.options;
                    // Snap displayVotes to current values for immediate render
                    this.#displayVotes = data.options.map((o, i) => o.votes || this.#displayVotes[i] || 0);
                }
                break;
            case 'End':
                this.#active = false;
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
                // Set sample poll data for preview
                self.onMessage({ Type: 'Update', title: 'Favourite Game?', options: [
                    { name: 'Option A', votes: 42 },
                    { name: 'Option B', votes: 28 },
                    { name: 'Option C', votes: 15 }
                ]});
                const ctx = canvas.getContext('2d');
                const area = { x: 0, y: 0, width: w, height: h };
                self.draw(ctx, settings, area);
            },
            simulate: {
                _votes: [42, 28, 15],
                start: function() {
                    this._votes = [42, 28, 15];
                    self.onMessage({ Type: 'Update', title: 'Favourite Game?', options: [
                        { name: 'Option A', votes: 42 },
                        { name: 'Option B', votes: 28 },
                        { name: 'Option C', votes: 15 }
                    ]});
                },
                update: function(settings, area, dt) {
                    self.update(dt, settings);
                    // Randomly increment votes
                    const idx = Math.floor(Math.random() * 3);
                    this._votes[idx] += Math.random() < 0.3 ? 1 : 0;
                    self.onMessage({ Type: 'Update', title: 'Favourite Game?', options: [
                        { name: 'Option A', votes: this._votes[0] },
                        { name: 'Option B', votes: this._votes[1] },
                        { name: 'Option C', votes: this._votes[2] }
                    ]});
                },
                draw: (ctx, settings, area) => { self.draw(ctx, settings, area); },
                stop: () => {
                    self.onMessage({ Type: 'End' });
                }
            },
            dispose: () => {}
        });
    }
}

window.PollModule = {
    _main: PollMain,
    _simulator: PollMain
};

} // end if (!window.PollModule)

if (document.getElementById('canvas')) {
    const instance = new window.PollModule._main();
    let lastSettings = null;

    window.Modules.push({
        name: "poll",
        draw: (ctx, settings, area) => {
            if (settings) lastSettings = settings;
            instance.draw(ctx, settings, area);
        },
        update: (dt) => {
            instance.update(dt, lastSettings || Config.poll || {});
        },
        events: {
            "Twitch.PollCreated": (data) => {
                const options = (data.choices || data.options || []).map(c => ({ name: c.title || c.name, votes: c.votes || 0 }));
                instance.onMessage({ Type: 'Update', title: data.title || 'Poll', options });
            },
            "Twitch.PollUpdated": (data) => {
                const options = (data.choices || data.options || []).map(c => ({ name: c.title || c.name, votes: c.votes || 0 }));
                instance.onMessage({ Type: 'Update', title: data.title || 'Poll', options });
            },
            "Twitch.PollCompleted": () => {
                instance.onMessage({ Type: 'End' });
            }
        }
    });
}
