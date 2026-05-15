/**
 * ModuleSimulator - Registry-based simulation system.
 * 
 * Modules register their own preview/simulation logic via editorRegister().
 * The editor tracks registrations per instance ID and handles cleanup on
 * deletion, scene switch, or re-render.
 * 
 * Flow:
 * 1. Editor loads module entrypoint script from server
 * 2. Editor instantiates the module's editorClass
 * 3. Editor calls instance.editorRegister(register) if the method exists
 * 4. Module calls register({preview, simulate, dispose}) to provide its hooks
 * 5. Editor stores registration keyed by instance ID
 * 6. On delete/scene-switch: editor calls dispose() and removes entry
 */
class ModuleSimulator {
    // instanceId -> { type, classInstance, registration, animFrame, playing }
    static #registry = new Map();

    // type -> script loaded (prevents double-loading)
    static #loadedScripts = new Set();

    // type -> Promise that resolves when script is loaded
    static #loadingPromises = new Map();

    /**
     * Check if a specific instance is currently simulating.
     */
    static isPlaying(id) {
        const entry = this.#registry.get(id);
        return entry?.playing || false;
    }

    /**
     * Get the registration for an instance (for preview building).
     */
    static getRegistration(id) {
        return this.#registry.get(id)?.registration || null;
    }

    /**
     * Get the full entry for an instance (for accessing classInstance etc).
     */
    static getEntry(id) {
        return this.#registry.get(id) || null;
    }

    /**
     * Check if a module type has an editorClass defined (supports simulation).
     */
    static hasEditorSupport(type) {
        const mod = window.ModuleRegistry?.modules?.find(m => m.name === type);
        return !!mod?.editorClass;
    }

    /**
     * Ensure a module's script is loaded and its simulator class is available.
     * 
     * Modules expose: window[editorClass] = { _main: ClassA, _simulator: ClassB }
     * The editor instantiates _simulator which has editorRegister().
     * 
     * Returns the _simulator class constructor or null.
     */
    static async loadModuleClass(type) {
        const mod = window.ModuleRegistry?.modules?.find(m => m.name === type);
        if (!mod?.editorClass) return null;

        const className = mod.editorClass;

        // Already available
        if (window[className]?._simulator) return window[className]._simulator;

        // Already loading
        if (this.#loadingPromises.has(type)) {
            await this.#loadingPromises.get(type);
            return window[className]?._simulator || null;
        }

        // Already loaded script but class not found
        if (this.#loadedScripts.has(type)) return window[className]?._simulator || null;

        // Load the script
        const host = EditorPrefs.get('serverHost', '127.0.0.1');
        const port = EditorPrefs.get('serverPort', 31589);
        const dir = mod._dir || mod.name;

        const promise = new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = `http://${host}:${port}/modules/${dir}/${mod.entrypoint}`;
            script.dataset.moduleType = type;
            script.onload = () => {
                this.#loadedScripts.add(type);
                resolve();
            };
            script.onerror = () => {
                console.warn(`[ModuleSimulator] Failed to load script for ${type}`);
                resolve();
            };
            document.head.appendChild(script);
        });

        this.#loadingPromises.set(type, promise);
        await promise;
        this.#loadingPromises.delete(type);

        return window[className]?._simulator || null;
    }

    /**
     * Register an instance. Loads the module script, instantiates the class,
     * calls editorRegister if available, and stores the registration.
     * Returns the registration object or null if the module doesn't support editor hooks.
     */
    static async register(id, type) {
        // Don't double-register
        if (this.#registry.has(id)) return this.#registry.get(id).registration;

        const ModuleClass = await this.loadModuleClass(type);
        if (!ModuleClass) return null;

        const classInstance = new ModuleClass();
        let registration = null;

        if (typeof classInstance.editorRegister === 'function') {
            classInstance.editorRegister((reg) => {
                registration = reg;
            });
        }

        const entry = {
            type,
            classInstance,
            registration,
            animFrame: null,
            playing: false
        };

        this.#registry.set(id, entry);
        return registration;
    }

    /**
     * Unregister a specific instance — calls dispose and cleans up.
     */
    static unregister(id) {
        const entry = this.#registry.get(id);
        if (!entry) return;

        // Stop simulation if running
        if (entry.playing) {
            this.stop(id);
        }

        // Call dispose
        if (entry.registration?.dispose) {
            try { entry.registration.dispose(); } catch (e) {
                console.warn(`[ModuleSimulator] dispose error for ${id}:`, e);
            }
        }

        this.#registry.delete(id);
    }

    /**
     * Unregister all instances — used on scene switch or full re-render.
     */
    static unregisterAll() {
        for (const id of [...this.#registry.keys()]) {
            this.unregister(id);
        }
    }

    /**
     * Toggle simulation for an instance.
     */
    static toggle(id, container) {
        const entry = this.#registry.get(id);
        if (!entry) return;

        if (entry.playing) {
            this.stop(id);
        } else {
            this.start(id, container);
        }
    }

    /**
     * Start simulation for an instance.
     */
    static start(id, container) {
        const entry = this.#registry.get(id);
        if (!entry || !entry.registration?.simulate) return;

        const sim = entry.registration.simulate;

        // Create canvas for simulation
        container.innerHTML = '';
        container.style.overflow = 'hidden';

        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'width:100%; height:100%; pointer-events:none;';
        container.appendChild(canvas);

        // Get module data for dimensions
        const moduleEl = container.closest('[data-module-id]');
        const moduleId = moduleEl?.dataset.moduleId;
        const mod = moduleId ? EditorState.getActiveSceneModules()[moduleId] : null;

        const getArea = () => {
            const currentMod = moduleId ? EditorState.getActiveSceneModules()[moduleId] : null;
            const w = currentMod ? currentMod.area.width : (container.clientWidth || 300);
            const h = currentMod ? currentMod.area.height : (container.clientHeight || 200);
            return { x: 0, y: 0, width: w, height: h };
        };

        const getSettings = () => {
            const currentMod = moduleId ? EditorState.getActiveSceneModules()[moduleId] : null;
            return currentMod?.settings || {};
        };

        // Call start if provided
        if (sim.start) {
            window.Config = EditorState.globalConfig;
            sim.start(canvas, getSettings(), getArea());
        }

        entry.playing = true;

        let lastTime = performance.now();
        const animate = (now) => {
            if (!container.isConnected) {
                entry.playing = false;
                return;
            }

            const dt = (now - lastTime) / 1000;
            lastTime = now;

            const area = getArea();
            const settings = getSettings();

            if (canvas.width !== area.width || canvas.height !== area.height) {
                canvas.width = area.width;
                canvas.height = area.height;
            }

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, area.width, area.height);

            window.Config = EditorState.globalConfig;

            if (sim.update) {
                sim.update(settings, area, dt);
            }
            if (sim.draw) {
                sim.draw(ctx, settings, area, dt);
            }

            entry.animFrame = requestAnimationFrame(animate);
        };

        entry.animFrame = requestAnimationFrame(animate);
        entry._simCanvas = canvas;
        entry._simContainer = container;
    }

    /**
     * Stop simulation for an instance (but keep registration alive).
     */
    static stop(id) {
        const entry = this.#registry.get(id);
        if (!entry) return;

        if (entry.animFrame) {
            cancelAnimationFrame(entry.animFrame);
            entry.animFrame = null;
        }

        if (entry.registration?.simulate?.stop) {
            try { entry.registration.simulate.stop(); } catch (e) {
                console.warn(`[ModuleSimulator] simulate.stop error for ${id}:`, e);
            }
        }

        if (entry._simCanvas) {
            entry._simCanvas.remove();
            entry._simCanvas = null;
        }

        entry.playing = false;
    }

    /**
     * Stop all running simulations (but keep registrations).
     */
    static stopAll() {
        for (const [id, entry] of this.#registry) {
            if (entry.playing) {
                this.stop(id);
            }
        }
    }

    /**
     * Reload a specific module type — unregisters all instances of that type,
     * removes the cached script, deletes the window class, so it can be re-loaded fresh.
     */
    static reloadModuleType(type) {
        // Unregister all instances of this type
        for (const [id, entry] of [...this.#registry]) {
            if (entry.type === type) {
                this.unregister(id);
            }
        }

        // Remove the script tag
        const script = document.querySelector(`script[data-module-type="${type}"]`);
        if (script) script.remove();

        // Clear from loaded set
        this.#loadedScripts.delete(type);

        // Delete the window class so the guard check passes on re-load
        const mod = window.ModuleRegistry?.modules?.find(m => m.name === type);
        if (mod?.editorClass && window[mod.editorClass]) {
            delete window[mod.editorClass];
        }
    }

    /**
     * Reload all modules — full reset.
     */
    static reloadAll() {
        this.unregisterAll();

        // Remove all module script tags
        document.querySelectorAll('script[data-module-type]').forEach(s => s.remove());

        // Clear loaded tracking
        this.#loadedScripts.clear();

        // Delete all module window classes
        if (window.ModuleRegistry?.modules) {
            for (const mod of window.ModuleRegistry.modules) {
                if (mod.editorClass && window[mod.editorClass]) {
                    delete window[mod.editorClass];
                }
            }
        }
    }
}
