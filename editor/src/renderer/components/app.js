// Initialize all components
document.addEventListener('DOMContentLoaded', async () => {
    const canvasWorkspace = new CanvasWorkspace();
    const undoHistory = new UndoHistory();
    window.undoHistory = undoHistory;
    const palette = new Palette();
    const properties = new PropertiesPanel();
    const sceneTabs = new SceneTabs();
    const layers = new LayerPanel();
    const toolbar = new Toolbar(canvasWorkspace);
    const configIO = new ConfigIO();
    const settings = new SettingsPanel();
    const sidebar = new Sidebar();
    const mediaPanel = new MediaPanel();
    window.mediaPanel = mediaPanel; // Expose for properties panel
    const serverPanel = new ServerPanel();

    // Auto-load www/config.js
    const result = await window.api.autoLoadConfig();
    if (result && result.config) {
        EditorState.configPath = result.path;
        EditorState.loadConfig(result.config);
        document.getElementById('btn-save').disabled = false;
        EditorPrefs.setLastConfigPath(result.path);
    } else {
        // No config found, start with a default scene
        EditorState.addScene('Default');
    }

    // Expose Config globally for module simulation
    window.Config = EditorState.globalConfig;
    EditorState.onChange(() => { window.Config = EditorState.globalConfig; });

    // Load real module scripts for simulation (after Config is set)
    const chatScript = document.createElement('script');
    chatScript.src = '../../../www/modules/chat.js';
    document.head.appendChild(chatScript);

    // Play All / Stop All buttons
    document.getElementById('btn-play-all').addEventListener('click', () => {
        const modules = EditorState.getActiveSceneModules();
        for (const [id, mod] of Object.entries(modules)) {
            if (!ModuleSimulator.isPlaying(id)) {
                const el = document.querySelector(`[data-module-id="${id}"] .module-preview`);
                if (el) ModuleSimulator.start(id, mod, el);
            }
        }
        // Update play button states
        document.querySelectorAll('.module-play-btn').forEach(btn => {
            btn.textContent = '⏹';
        });
    });

    document.getElementById('btn-stop-all').addEventListener('click', () => {
        ModuleSimulator.stopAll();
        // Re-render to restore static previews
        canvasWorkspace.render();
    });

    // Window controls (functional in frameless/built mode)
    document.getElementById('win-minimize')?.addEventListener('click', () => window.api.windowMinimize());
    document.getElementById('win-maximize')?.addEventListener('click', () => window.api.windowMaximize());
    document.getElementById('win-close')?.addEventListener('click', () => window.api.windowClose());
});
