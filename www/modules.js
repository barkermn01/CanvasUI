let lastFrameTime = Date.now();
let currentFrameTime = Date.now();

class ModuleManager {
    modules;
    availableModules;
    moduleMap;

    constructor() {
        this.modules = new Map();
        this.availableModules = Config.Modules;
        this.moduleMap = {};
    }

    async initialize() {
        // Load the module manifest
        try {
            const resp = await fetch('/modules/modules.json');
            this.moduleMap = await resp.json();
        } catch (e) {
            console.error('Failed to load modules.json:', e);
            return;
        }

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
            const infoPath = this.moduleMap[moduleName];
            if (!infoPath) {
                console.warn("No entry in modules.json for:", moduleName);
                continue;
            }

            console.log("Loading Module", moduleName);

            // If it points directly to a .js file (like scene.js), load it directly
            if (infoPath.endsWith('.js')) {
                await this.loadModuleScript(moduleName, `/modules/${infoPath}`);
                continue;
            }

            // Otherwise it's an info.json — fetch it to get the entrypoint
            try {
                const infoResp = await fetch(`/modules/${infoPath}`);
                const info = await infoResp.json();
                const dir = infoPath.substring(0, infoPath.lastIndexOf('/'));

                // Load additional scripts first (e.g. dependencies like chromakey.js)
                if (info.scripts && Array.isArray(info.scripts)) {
                    for (const script of info.scripts) {
                        await this.loadModuleScript(null, `/modules/${dir}/${script}`);
                    }
                }

                const scriptPath = `/modules/${dir}/${info.entrypoint}`;
                await this.loadModuleScript(moduleName, scriptPath);
            } catch (e) {
                console.error(`Failed to load module info for ${moduleName}:`, e);
            }
        }
    }

    loadModuleScript(name, scriptPath) {
        return new Promise((resolve, reject) => {
            loadJS(scriptPath, () => {
                if (name) {
                    const module = window.Modules[window.Modules.length - 1];
                    this.modules.set(name, module);
                }
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

        // Notify wsclient that modules are ready
        if (typeof window.initWebSocket === 'function') {
            window.initWebSocket();
        }
        
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
