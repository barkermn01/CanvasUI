class Sidebar {
    #resizing = null;

    constructor() {
        this.#bindActivityButtons();
        this.#bindPinButtons();
        this.#bindPanelResize();
        this.#updateAllSidebars();
        this.#restorePanelSizes();

        // Auto-show properties when a module is selected
        EditorState.onChange((what) => {
            if (what === 'selection' && EditorState.selectedModule) {
                this.#showPanel('properties');
            }
        });
    }

    #bindActivityButtons() {
        document.querySelectorAll('.activity-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const panel = btn.dataset.panel;
                const panelEl = document.querySelector(`.sidebar-panel[data-panel="${panel}"]`);
                const pinBtn = panelEl.querySelector('.panel-pin');
                const isVisible = panelEl.classList.contains('visible');

                if (isVisible) {
                    panelEl.classList.remove('visible');
                    pinBtn.classList.remove('pinned');
                    btn.classList.remove('active');
                } else {
                    panelEl.classList.add('visible');
                    pinBtn.classList.add('pinned');
                    btn.classList.add('active');
                }

                this.#updateSidebarWidth(panelEl.closest('.sidebar'));
                this.#savePinnedState();
            });
        });
    }

    #bindPinButtons() {
        document.querySelectorAll('.panel-pin').forEach(btn => {
            btn.addEventListener('click', () => {
                const panel = btn.dataset.panel;
                const panelEl = document.querySelector(`.sidebar-panel[data-panel="${panel}"]`);
                const activityBtn = document.querySelector(`.activity-btn[data-panel="${panel}"]`);
                const isPinned = btn.classList.contains('pinned');

                if (isPinned) {
                    btn.classList.remove('pinned');
                    panelEl.classList.remove('visible');
                    activityBtn.classList.remove('active');
                } else {
                    btn.classList.add('pinned');
                    panelEl.classList.add('visible');
                    activityBtn.classList.add('active');
                }

                this.#updateSidebarWidth(panelEl.closest('.sidebar'));
                this.#savePinnedState();
            });
        });
    }

    #showPanel(name) {
        const panelEl = document.querySelector(`.sidebar-panel[data-panel="${name}"]`);
        const pinBtn = panelEl?.querySelector('.panel-pin');
        const activityBtn = document.querySelector(`.activity-btn[data-panel="${name}"]`);

        if (panelEl && !panelEl.classList.contains('visible')) {
            panelEl.classList.add('visible');
            pinBtn?.classList.add('pinned');
            activityBtn?.classList.add('active');
            this.#updateSidebarWidth(panelEl.closest('.sidebar'));
            this.#savePinnedState();
        }
    }

    #updateAllSidebars() {
        const pinned = EditorPrefs.getPinnedPanels();

        document.querySelectorAll('.sidebar').forEach(sidebar => {
            sidebar.querySelectorAll('.sidebar-panel').forEach(panel => {
                const name = panel.dataset.panel;
                const pinBtn = panel.querySelector('.panel-pin');
                const activityBtn = document.querySelector(`.activity-btn[data-panel="${name}"]`);

                if (pinned.includes(name)) {
                    panel.classList.add('visible');
                    pinBtn?.classList.add('pinned');
                    activityBtn?.classList.add('active');
                } else {
                    panel.classList.remove('visible');
                    pinBtn?.classList.remove('pinned');
                    activityBtn?.classList.remove('active');
                }
            });
            this.#updateSidebarWidth(sidebar);
        });
    }

    #savePinnedState() {
        const pinned = [];
        document.querySelectorAll('.sidebar-panel.visible').forEach(panel => {
            pinned.push(panel.dataset.panel);
        });
        EditorPrefs.setPinnedPanels(pinned);
    }

    #restorePanelSizes() {
        const sizes = EditorPrefs.getPanelSizes();
        for (const [panelName, height] of Object.entries(sizes)) {
            const panel = document.querySelector(`.sidebar-panel[data-panel="${panelName}"]`);
            if (panel && height && typeof height === 'number') {
                panel.style.height = height + 'px';
            }
        }
    }

    #updateSidebarWidth(sidebar) {
        if (!sidebar) return;
        const hasVisible = sidebar.querySelector('.sidebar-panel.visible');
        const panelsContainer = sidebar.querySelector('.sidebar-panels');
        if (hasVisible) {
            panelsContainer.classList.remove('collapsed');
        } else {
            panelsContainer.classList.add('collapsed');
        }
        // Trigger canvas resize after sidebar width transition completes (0.2s)
        setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
    }

    #bindPanelResize() {
        document.querySelectorAll('.panel-header').forEach(header => {
            header.addEventListener('mousedown', (e) => {
                if (e.target.closest('.panel-pin')) return;

                const panel = header.closest('.sidebar-panel');
                const sidebar = panel.closest('.sidebar');
                const panels = [...sidebar.querySelectorAll('.sidebar-panel.visible')];

                if (panels.length < 2) return;

                const panelIndex = panels.indexOf(panel);
                const targetPanel = panelIndex > 0 ? panels[panelIndex - 1] : null;
                if (!targetPanel) return;

                e.preventDefault();
                e.stopPropagation();
                this.#resizing = {
                    panel: targetPanel,
                    nextPanel: panel,
                    startY: e.clientY,
                    startHeight: targetPanel.getBoundingClientRect().height,
                    startNextHeight: panel.getBoundingClientRect().height
                };

                document.body.style.cursor = 'ns-resize';
            });
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.#resizing) return;

            const { panel, nextPanel, startY, startHeight, startNextHeight } = this.#resizing;
            const delta = e.clientY - startY;
            const minHeight = 60;

            const newHeight = Math.max(minHeight, startHeight + delta);
            const newNextHeight = Math.max(minHeight, startNextHeight - delta);

            panel.style.height = newHeight + 'px';
            nextPanel.style.height = newNextHeight + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (this.#resizing) {
                // Save panel sizes
                const { panel, nextPanel } = this.#resizing;
                const panelName = panel.dataset.panel;
                const nextPanelName = nextPanel.dataset.panel;
                if (panelName) EditorPrefs.setPanelSize(panelName, panel.getBoundingClientRect().height);
                if (nextPanelName) EditorPrefs.setPanelSize(nextPanelName, nextPanel.getBoundingClientRect().height);

                this.#resizing = null;
                document.body.style.cursor = '';
            }
        });
    }
}
