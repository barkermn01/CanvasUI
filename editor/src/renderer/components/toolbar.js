class Toolbar {
    #canvasW;
    #canvasH;
    #lockCheckbox;

    constructor(canvasWorkspace) {
        this.#canvasW = document.getElementById('canvas-width');
        this.#canvasH = document.getElementById('canvas-height');
        this.#lockCheckbox = document.getElementById('canvas-lock');

        // Restore saved canvas size
        const savedSize = EditorPrefs.getCanvasSize();
        EditorState.canvasWidth = savedSize.width;
        EditorState.canvasHeight = savedSize.height;
        this.#canvasW.value = savedSize.width;
        this.#canvasH.value = savedSize.height;

        // Restore lock preference
        EditorState.lockToCanvas = EditorPrefs.get('canvasLock', true);
        this.#lockCheckbox.checked = EditorState.lockToCanvas;

        canvasWorkspace.updateSize();

        this.#canvasW.addEventListener('change', () => {
            EditorState.canvasWidth = parseInt(this.#canvasW.value) || 1920;
            EditorPrefs.setCanvasSize(EditorState.canvasWidth, EditorState.canvasHeight);
            canvasWorkspace.updateSize();
        });

        this.#canvasH.addEventListener('change', () => {
            EditorState.canvasHeight = parseInt(this.#canvasH.value) || 1080;
            EditorPrefs.setCanvasSize(EditorState.canvasWidth, EditorState.canvasHeight);
            canvasWorkspace.updateSize();
        });

        this.#lockCheckbox.addEventListener('change', () => {
            EditorState.lockToCanvas = this.#lockCheckbox.checked;
            EditorPrefs.set('canvasLock', this.#lockCheckbox.checked);
        });

        // Show labels toggle
        const showLabelsCheckbox = document.getElementById('canvas-show-labels');
        EditorState.showLabels = EditorPrefs.get('showLabels', true);
        showLabelsCheckbox.checked = EditorState.showLabels;
        showLabelsCheckbox.addEventListener('change', () => {
            EditorState.showLabels = showLabelsCheckbox.checked;
            EditorPrefs.set('showLabels', showLabelsCheckbox.checked);
            document.getElementById('canvas-container')?.classList.toggle('hide-labels', !showLabelsCheckbox.checked);
        });
        // Apply initial state
        if (!EditorState.showLabels) {
            document.getElementById('canvas-container')?.classList.add('hide-labels');
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('canvas-settings-dropdown');
            if (dropdown && dropdown.open && !dropdown.contains(e.target)) {
                dropdown.open = false;
            }
        });

        EditorState.onChange((what) => {
            if (what === 'load') {
                this.#canvasW.value = EditorState.canvasWidth;
                this.#canvasH.value = EditorState.canvasHeight;
            }
        });
    }
}
