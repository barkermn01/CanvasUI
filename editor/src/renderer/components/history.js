/**
 * UndoHistory - Manages undo/redo state snapshots for EditorState.
 * Takes a JSON snapshot of scenes + globalConfig on each meaningful change.
 */
class UndoHistory {
    #stack = [];
    #index = -1;
    #maxSize = 50;
    #ignoreNext = false;
    #debounceTimer = null;
    #batchMode = false;

    constructor() {
        EditorState.onChange((what) => {
            if (['modules', 'module-added', 'module-settings', 'scenes', 'settings', 'load'].includes(what)) {
                if (this.#ignoreNext) {
                    this.#ignoreNext = false;
                    return;
                }
                if (this.#batchMode) return; // Don't snapshot during batch
                this.#push();
            }
            if (what === 'module-area') {
                if (this.#ignoreNext) {
                    this.#ignoreNext = false;
                    return;
                }
                this.#debouncePush();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                const active = document.activeElement;
                const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
                if (!isInput) {
                    this.undo();
                }
            }
            if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                const active = document.activeElement;
                const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
                if (!isInput) {
                    this.redo();
                }
            }
        });

        setTimeout(() => this.#push(), 100);
    }

    // Call batch() before multiple related changes, then endBatch() after
    batch() {
        this.#batchMode = true;
    }

    endBatch() {
        this.#batchMode = false;
        this.#push();
    }

    #debouncePush() {
        if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
        this.#debounceTimer = setTimeout(() => {
            this.#debounceTimer = null;
            this.#push();
        }, 300);
    }

    #push() {
        const snapshot = this.#takeSnapshot();
        if (!snapshot) return;

        // If we're not at the end of the stack, truncate forward history
        if (this.#index < this.#stack.length - 1) {
            this.#stack = this.#stack.slice(0, this.#index + 1);
        }

        // Don't push if identical to current
        if (this.#stack.length > 0) {
            const current = this.#stack[this.#index];
            if (current === snapshot) return;
        }

        this.#stack.push(snapshot);
        if (this.#stack.length > this.#maxSize) {
            this.#stack.shift();
        }
        this.#index = this.#stack.length - 1;
    }

    #takeSnapshot() {
        try {
            return JSON.stringify({
                scenes: EditorState.scenes,
                globalConfig: EditorState.globalConfig,
                activeScene: EditorState.activeScene
            });
        } catch {
            return null;
        }
    }

    #restore(snapshot) {
        try {
            const data = JSON.parse(snapshot);
            this.#ignoreNext = true;
            EditorState.scenes = data.scenes;
            EditorState.globalConfig = data.globalConfig;
            EditorState.activeScene = data.activeScene;
            EditorState.selectedModule = null;
            EditorState.notify('load');
        } catch (e) {
            console.warn('Failed to restore snapshot:', e);
        }
    }

    undo() {
        if (this.#index <= 0) return;
        this.#index--;
        this.#restore(this.#stack[this.#index]);
    }

    redo() {
        if (this.#index >= this.#stack.length - 1) return;
        this.#index++;
        this.#restore(this.#stack[this.#index]);
    }
}
