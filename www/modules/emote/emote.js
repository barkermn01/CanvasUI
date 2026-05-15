/**
 * Emote Module
 * 
 * window.Emote = {
 *   _main: EmoteInstance — the core emote class (single bouncing emote)
 *   _simulator: EmoteSimulator — editor simulation class with editorRegister()
 * }
 */

if (!window.Emote) {

// ─── _main: Individual bouncing emote (used by overlay) ─────────────────────

class EmoteInstance {
    isFinished = false;
    isReady = false;
    Expires = new Date(Date.now() + 30000)

    width = 96;
    height = 96;
    top = rndInt(this.width, window.innerHeight)-this.width;
    left = rndInt(this.height, window.innerWidth)-this.height;

    #moveVertical;
    #moveHorizontal;
    #animationTimeLeft;

    #gif;
    #frameBuffer = [];
    #IsAnimated = false;
    #currentFrame = 0;
    #framesReady = 0;
    #frameUpdateTime = 1000/25;
    #currentFrameTime = 0;

    constructor(path) {
        this.#gif = document.createElement("img");
        this.#gif.setAttribute("id", "gifRender");
        this.#gif.src = path;
        this.#gif.style.position = "absolute";
        this.#gif.style.right = "-72px";
        this.#gif.style.width="72px"
        document.body.appendChild(this.#gif);
        
        const sgif = new SuperGif({ gif: this.#gif, auto_play: false} );
        sgif.load(() => {
            const len = sgif.get_length();
            if(len > 0){
                this.#IsAnimated = true;
                for (let i = 0; i < sgif.get_length(); i++)
                {
                    sgif.move_to(i);
                    const frame = new Image();
                    frame.src = sgif.get_canvas().toDataURL('image/png')
                    frame.addEventListener("load", () => { 
                        this.#framesReady++;
                        if(this.#framesReady == this.#frameBuffer.length-1){
                            this.isReady = true;
                        }else{
                            this.isReady = false;
                        }
                    });
                    this.#frameBuffer.push(frame);
                }
            }
        });

        this.#frameBuffer[0] = new Image();
        this.#frameBuffer[0].src = path;
        this.#frameBuffer[0].addEventListener("load", () => { this.isReady = true; });

        try{
            const speedType = typeof(Config.emote.Speed);
            if( speedType == "object" && typeof Config.emote.Speed.Min == 'number' && typeof Config.emote.Speed.Max == 'number'){
                this.#moveVertical = MinMax.FromObject(Config.emote.Speed).GetValueInRange();
                this.#moveHorizontal = MinMax.FromObject(Config.emote.Speed).GetValueInRange();
            }else if(speedType == "number"){
                this.#moveVertical = MinMax.FromStatic(Config.emote.Speed).GetValueInRange();
                this.#moveHorizontal = MinMax.FromStatic(Config.emote.Speed).GetValueInRange();
            }

            const animationTimeType = typeof(Config.emote.AnimationTime);
            if( animationTimeType == "object" && typeof Config.emote.AnimationTime.Min == 'number' && typeof Config.emote.AnimationTime.Max == 'number'){
                this.#animationTimeLeft = MinMax.FromObject(Config.emote.AnimationTime).GetValueInRange();
            }else if(animationTimeType == "number"){
                this.#animationTimeLeft = MinMax.FromStatic(Config.emote.AnimationTime).GetValueInRange();
            }

            if(Config.emote.RandomDirectionsFromStart){
                const flipVert = rndInt(0, 100), flipHori = rndInt(0,100);
                if(flipVert <= 50){
                    this.#moveVertical = 0-this.#moveVertical
                }
                if(flipHori <= 50){
                    this.#moveHorizontal = 0-this.#moveHorizontal
                }
            }
        }catch(err){ console.error(err); ShowError(err, true); }
    }

    update(dt) {
        this.#currentFrameTime += dt * 1000;

        if(this.#animationTimeLeft <= 2){
            if(this.width >= 0 || this.height >= 0){
                this.width -= 50*dt;
                this.height -= 50*dt;
                this.top += 25*dt;
                this.left += 25*dt;
            }else{
                this.isFinished = true;
            }
        }
        this.top += this.#moveVertical * dt;
        this.left += this.#moveHorizontal * dt;
        if (this.top + this.height >= window.innerHeight || this.top <= 0) {
            this.#moveVertical = 0 - this.#moveVertical;
        }
        if (this.left + this.width >= window.innerWidth || this.left <= 0) {
            this.#moveHorizontal = 0 - this.#moveHorizontal;
        }
        this.#animationTimeLeft -= dt;

        if(this.#IsAnimated){
            if(this.#currentFrameTime >= this.#frameUpdateTime){
                this.#currentFrameTime -= this.#frameUpdateTime;
                this.#currentFrame++;
            }
            if(this.#currentFrame > this.#frameBuffer.length-1){
                this.#currentFrame = 0;
            }
        }
    }

    draw(ctx) {
        if(this.isReady){
            ctx.drawImage(this.#frameBuffer[this.#currentFrame], this.left, this.top, this.width, this.height);
        }else{
            if(new Date() > this.Expires){
                this.isFinished = true;
            }
        }
    }
}

// ─── _simulator: Editor simulation (bouncing emoji preview) ─────────────────

class EmoteSimulator {
    #emotes = [];
    #spawnInterval = null;

    editorRegister(register) {
        const self = this;

        register({
            preview: (container, settings, area) => {
                container.innerHTML = '';
                container.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 24px; pointer-events: none;';
                container.textContent = '😀 🎉 ❤️ 🔥 👀';
            },
            simulate: {
                start: (canvas, settings, area) => {
                    self.#emotes = [];
                    const spawn = () => {
                        const icons = ['😀', '🎉', '❤️', '🔥', '👀', '💀', '🤣', '✨', '🎮', '💜'];
                        const icon = icons[Math.floor(Math.random() * icons.length)];
                        const w = area.width || 300;
                        const h = area.height || 200;
                        const config = window.Config?.emote || {};

                        self.#emotes.push({
                            icon,
                            x: Math.random() * (w - 30),
                            y: Math.random() * (h - 30),
                            vx: (Math.random() - 0.5) * (config.Speed?.Min || 100),
                            vy: (Math.random() - 0.5) * (config.Speed?.Max || 200),
                            life: (config.AnimationTime?.Min || 10) + Math.random() * ((config.AnimationTime?.Max || 20) - (config.AnimationTime?.Min || 10)),
                            size: 24
                        });
                    };
                    for (let i = 0; i < 4; i++) spawn();
                    self.#spawnInterval = setInterval(spawn, 1200);
                },
                update: (settings, area, dt) => {
                    const w = area.width || 300;
                    const h = area.height || 200;

                    self.#emotes.forEach(e => {
                        e.x += e.vx * dt;
                        e.y += e.vy * dt;
                        e.life -= dt;

                        if (e.x <= 0 || e.x >= w - e.size) e.vx *= -1;
                        if (e.y <= 0 || e.y >= h - e.size) e.vy *= -1;
                        e.x = Math.max(0, Math.min(w - e.size, e.x));
                        e.y = Math.max(0, Math.min(h - e.size, e.y));
                    });

                    self.#emotes = self.#emotes.filter(e => e.life > 0);
                },
                draw: (ctx, settings, area, dt) => {
                    self.#emotes.forEach(e => {
                        let alpha = 1;
                        if (e.life <= 2) alpha = Math.max(0, e.life / 2);

                        ctx.globalAlpha = alpha;
                        ctx.font = `${e.size}px serif`;
                        ctx.fillText(e.icon, e.x, e.y + e.size);
                    });
                    ctx.globalAlpha = 1;
                },
                stop: () => {
                    if (self.#spawnInterval) {
                        clearInterval(self.#spawnInterval);
                        self.#spawnInterval = null;
                    }
                    self.#emotes = [];
                }
            },
            dispose: () => {
                if (self.#spawnInterval) {
                    clearInterval(self.#spawnInterval);
                    self.#spawnInterval = null;
                }
                self.#emotes = [];
            }
        });
    }
}

// ─── Export ──────────────────────────────────────────────────────────────────

window.Emote = {
    _main: EmoteInstance,
    _simulator: EmoteSimulator
};

} // end if (!window.Emote)

// ─── Overlay registration ───────────────────────────────────────────────────

if (document.getElementById('canvas')) {
    let Emotes = [];

    window.Modules.push({
        name: "Emote",
        draw: (ctx) => {
            Emotes.forEach(emote => { 
                if(!emote.isFinished){
                    emote.draw(ctx);  
                }
            });
        },
        update: (dt) => {
            Emotes.forEach(emote => { 
                emote.update(dt); 
            });
            Emotes = Emotes.filter(emote => !emote.isFinished);
        },
        message: (data) => {
            Emotes.push(new window.Emote._main(data.imageUrl));
        }
    });
}
