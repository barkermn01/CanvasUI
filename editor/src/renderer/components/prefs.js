/**
 * EditorPrefs - Persists UI state (pinned panels, panel sizes, window state, etc.)
 * Auto-loads on startup, auto-saves on change.
 */
const EditorPrefs = {
    _key: 'canvasui-editor-prefs',
    _data: {},

    load() {
        try {
            const stored = localStorage.getItem(this._key);
            if (stored) {
                this._data = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Failed to load editor prefs:', e);
            this._data = {};
        }
    },

    save() {
        try {
            localStorage.setItem(this._key, JSON.stringify(this._data));
        } catch (e) {
            console.warn('Failed to save editor prefs:', e);
        }
    },

    get(key, defaultValue) {
        return this._data[key] !== undefined ? this._data[key] : defaultValue;
    },

    set(key, value) {
        this._data[key] = value;
        this.save();
    },

    // Convenience methods
    getPinnedPanels() {
        return this.get('pinnedPanels', ['modules', 'properties', 'layers']);
    },

    setPinnedPanels(panels) {
        this.set('pinnedPanels', panels);
    },

    getPanelSizes() {
        return this.get('panelSizes', {});
    },

    setPanelSize(panelId, height) {
        const sizes = this.getPanelSizes();
        sizes[panelId] = height;
        this.set('panelSizes', sizes);
    },

    getCanvasSize() {
        return this.get('canvasSize', { width: 1920, height: 1080 });
    },

    setCanvasSize(width, height) {
        this.set('canvasSize', { width, height });
    },

    getLastConfigPath() {
        return this.get('lastConfigPath', null);
    },

    setLastConfigPath(path) {
        this.set('lastConfigPath', path);
    },

    getAdminMode() {
        return this.get('adminMode', false);
    },

    setAdminMode(enabled) {
        this.set('adminMode', enabled);
    }
};

// Auto-load on script parse
EditorPrefs.load();
