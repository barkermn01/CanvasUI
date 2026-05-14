let lastFrameTime = Date.now();
let currentFrameTime = Date.now();

class ModuleManager {
    modules;
    availableModules;

    constructor() {
        this.modules = new Map();
        this.availableModules = Config.Modules;
    }

    async initialize() {
        const enabledModules = window.enabledModules || 'all';
        
        let modulesToLoad;
        if (enabledModules === 'all') {
            modulesToLoad = this.availableModules;
        } else if (Array.isArray(enabledModules)) {
            modulesToLoad = enabledModules.filter(module => 
                this.availableModules.includes(module.toLowerCase())
            );
        }

        // Load each module
        for (const moduleName of modulesToLoad) {
            console.log("Loading Module", moduleName);
            await this.loadModule(moduleName);
        }
    }

    loadModule(name) {
        return new Promise((resolve, reject) => {
            loadJS(`/modules/${name}.js`, () => {
                // Assuming each module exports itself to window.Modules
                const module = window.Modules[window.Modules.length - 1];
                this.modules.set(name, module);
                resolve();
            });
        });
    }

    updateAll(deltaTime) {
        for (const [name, module] of this.modules) {
            if (typeof module.update === 'function') {
                module.update(deltaTime);
            }
        }
    }

    drawAll(ctx) {
        for (const [name, module] of this.modules) {
            if (typeof module.draw === 'function') {
                module.draw(ctx);
            }
        }
    }
}

// Keep your existing loadJS function
const loadJS = (src, cb) => {
    const srpt = document.createElement("script");
    srpt.setAttribute("src", src);
    srpt.setAttribute("type", "text/javascript");
    if(cb){
        srpt.addEventListener("load", cb);
    }
    document.head.appendChild(srpt);
}

(function(){
    loadJS("./lib/minmax.js");
    loadJS("./lib/libgif.js");
    loadJS("./lib/showerror.js");
    loadJS("./lib/livereload.js");
    loadJS("./lib/wsclient.js");
    window.Modules = [];
    document.addEventListener("DOMContentLoaded", async () => {
        const moduleManager = new ModuleManager();
        await moduleManager.initialize();
        
        document.getElementById("canvas").width = window.innerWidth;
        document.getElementById("canvas").height = window.innerHeight;

        function primaryLoop() {
            currentFrameTime = Date.now();
            const ctx = document.getElementById("canvas").getContext("2d");
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

            const deltaTime = (currentFrameTime - lastFrameTime) / 1000;
            
            moduleManager.updateAll(deltaTime);
            moduleManager.drawAll(ctx);
            
            lastFrameTime = currentFrameTime;
            window.requestAnimationFrame(primaryLoop);
        };

        window.requestAnimationFrame(primaryLoop);
    });

    window.onresize = () => {
        document.getElementById("canvas").width = window.innerWidth;
        document.getElementById("canvas").height = window.innerHeight;
    };
})();
