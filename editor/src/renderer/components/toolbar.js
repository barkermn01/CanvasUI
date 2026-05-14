class Toolbar {
    #canvasW;
    #canvasH;

    constructor(canvasWorkspace) {
        this.#canvasW = document.getElementById('canvas-width');
        this.#canvasH = document.getElementById('canvas-height');

        // Restore saved canvas size
        const savedSize = EditorPrefs.getCanvasSize();
        EditorState.canvasWidth = savedSize.width;
        EditorState.canvasHeight = savedSize.height;
        this.#canvasW.value = savedSize.width;
        this.#canvasH.value = savedSize.height;
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

        EditorState.onChange((what) => {
            if (what === 'load') {
                this.#canvasW.value = EditorState.canvasWidth;
                this.#canvasH.value = EditorState.canvasHeight;
            }
        });
    }
}
