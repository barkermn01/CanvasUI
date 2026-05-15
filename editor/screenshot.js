/**
 * Screenshot capture script for wiki documentation.
 * 
 * Usage: npx electron screenshot.js
 * 
 * Launches the app in screenshot mode, navigates through states,
 * captures screenshots, and saves them to docs/screenshots/.
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots');
const DELAY = 1500;

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function capture(win, name) {
    await sleep(500);
    const image = await win.webContents.capturePage();
    const filePath = path.join(SCREENSHOT_DIR, name);
    fs.writeFileSync(filePath, image.toPNG());
    console.log(`  ✓ ${name}`);
}

app.whenReady().then(async () => {
    console.log('CanvasUI Screenshot Capture\n');

    // Start the embedded server
    const server = require('./src/main/server.js');
    const serverResult = await server.startServer({ port: 31589, host: '127.0.0.1', webroot: path.resolve(__dirname, '..', 'www') });
    console.log(`Server: ${serverResult.url}\n`);

    // Register IPC handlers (same as main.js)
    const { ipcMain, dialog } = require('electron');

    // Minimal IPC handlers needed for the app to function
    const getMediaDir = () => {
        const resourcesWww = path.join(process.resourcesPath || '', 'www', 'media');
        const projectWww = path.resolve(__dirname, '..', 'www', 'media');
        return fs.existsSync(resourcesWww) ? resourcesWww : projectWww;
    };

    const getWwwDir = () => {
        const resourcesWww = path.join(process.resourcesPath || '', 'www');
        const projectWww = path.resolve(__dirname, '..', 'www');
        return fs.existsSync(resourcesWww) ? resourcesWww : projectWww;
    };

    ipcMain.handle('module-discover', () => {
        const modulesDir = path.join(getWwwDir(), 'modules');
        try {
            const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
            const modules = [];
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                const infoPath = path.join(modulesDir, entry.name, 'info.json');
                if (!fs.existsSync(infoPath)) continue;
                try {
                    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                    info._dir = entry.name;
                    modules.push(info);
                } catch (e) {}
            }
            const globalInfoPath = path.join(modulesDir, 'global.info.json');
            if (fs.existsSync(globalInfoPath)) {
                try { modules.push(JSON.parse(fs.readFileSync(globalInfoPath, 'utf8'))); } catch (e) {}
            }
            return modules;
        } catch (e) { return []; }
    });

    ipcMain.handle('auto-load-config', () => {
        const configPath = path.resolve(__dirname, '..', 'www', 'config.js');
        if (!fs.existsSync(configPath)) return null;
        try {
            let content = fs.readFileSync(configPath, 'utf8');
            content = content.replace(/^const\s+Config\s*=\s*/, '').replace(/;\s*$/, '');
            const config = JSON.parse(content);
            return { config, path: configPath };
        } catch (e) {
            // Try eval fallback for non-JSON configs
            try {
                let content = fs.readFileSync(configPath, 'utf8');
                const fn = new Function(content + '; return Config;');
                return { config: fn(), path: configPath };
            } catch (e2) { return null; }
        }
    });

    ipcMain.handle('media-list', (event, subPath) => {
        const mediaDir = getMediaDir();
        const browsePath = subPath ? path.join(mediaDir, subPath) : mediaDir;
        if (!browsePath.startsWith(mediaDir)) return [];
        try {
            const entries = fs.readdirSync(browsePath, { withFileTypes: true });
            return entries.filter(e => e.isFile()).map(e => ({
                name: e.name,
                path: subPath ? `/media/${subPath}/${e.name}` : `/media/${e.name}`,
                fullPath: path.join(browsePath, e.name),
                type: ['.mp4','.webm','.ogg','.mov'].includes(path.extname(e.name).toLowerCase()) ? 'video' : 'image'
            }));
        } catch (e) { return []; }
    });

    ipcMain.handle('server-status', () => ({ running: true, clients: 0 }));
    ipcMain.handle('server-start', () => ({ success: true }));
    ipcMain.handle('server-stop', () => ({ success: true }));
    ipcMain.handle('server-reload', () => ({ success: true, clients: 0 }));
    ipcMain.handle('window-minimize', () => {});
    ipcMain.handle('window-maximize', () => {});
    ipcMain.handle('window-close', () => {});
    ipcMain.handle('quick-save', () => true);
    ipcMain.handle('media-drop', () => []);
    ipcMain.handle('media-delete', () => ({ success: true }));
    ipcMain.handle('media-delete-dir', () => ({ success: true }));
    ipcMain.handle('media-create-dir', () => ({ success: true }));
    ipcMain.handle('pick-media', () => null);
    ipcMain.handle('import-config', () => null);
    ipcMain.handle('export-config', () => true);
    ipcMain.handle('server-broadcast-raw', () => ({ success: true }));

    // Create window
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        show: true,
        frame: true,
        webPreferences: {
            preload: path.join(__dirname, 'src', 'main', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));
    await new Promise(resolve => win.webContents.once('did-finish-load', resolve));
    await sleep(DELAY);

    // ─── Screenshots ─────────────────────────────────────────────────────────

    console.log('Capturing screenshots...\n');

    // 1. First Launch
    console.log('1/8 First launch (empty state)');
    await capture(win, 'first-launch.png');

    // 2. Editor Overview (with config loaded)
    console.log('2/8 Editor overview');
    await win.webContents.executeJavaScript(`
        (async () => {
            const result = await window.api.autoLoadConfig();
            if (result && result.config) {
                EditorState.configPath = result.path;
                EditorState.loadConfig(result.config);
            }
        })()
    `);
    await sleep(DELAY);
    await capture(win, 'editor-overview.png');

    // 3. Audio Visualiser Settings
    console.log('3/8 Audio Visualiser settings');
    await win.webContents.executeJavaScript(`
        window.settingsPanel && window.settingsPanel.openTo('audiovisualiser');
    `);
    await sleep(DELAY);
    await capture(win, 'audio-device-select.png');

    // 4. Settings Panel (general)
    console.log('4/8 Settings panel');
    await win.webContents.executeJavaScript(`
        window.settingsPanel && window.settingsPanel.openTo('general');
    `);
    await sleep(DELAY);
    await capture(win, 'settings-panel.png');

    // Close settings
    await win.webContents.executeJavaScript(`
        window.settingsPanel && window.settingsPanel.close();
    `);
    await sleep(500);

    // 5. Preview Mode
    console.log('5/8 Preview mode (Play All)');
    await win.webContents.executeJavaScript(`
        document.getElementById('btn-play-all')?.click();
    `);
    await sleep(3000);
    await capture(win, 'preview-mode.png');
    await win.webContents.executeJavaScript(`
        document.getElementById('btn-stop-all')?.click();
    `);
    await sleep(500);

    // 6. Scene Editor (module selected)
    console.log('6/8 Scene editor');
    await win.webContents.executeJavaScript(`
        const mods = EditorState.getActiveSceneModules();
        const first = Object.keys(mods)[0];
        if (first) EditorState.selectModule(first);
    `);
    await sleep(DELAY);
    await capture(win, 'scene-editor.png');

    // 7. Media Library
    console.log('7/8 Media library');
    await capture(win, 'media-library.png');

    // 8. Annotated Editor Layout
    console.log('8/8 Annotated editor layout');
    await win.webContents.executeJavaScript(`
        EditorState.selectModule(null);
    `);
    await sleep(500);
    // Capture base image, then annotate it in-browser using canvas
    const annotatedPng = await win.webContents.executeJavaScript(`
        new Promise(async (resolve) => {
            // Get the current page as an image
            const img = new Image();
            const baseCanvas = document.createElement('canvas');
            baseCanvas.width = window.innerWidth;
            baseCanvas.height = window.innerHeight;
            const ctx = baseCanvas.getContext('2d');

            // Use html2canvas-style approach: draw current state
            // Actually we'll just draw annotations on top of a transparent overlay
            // and the screenshot script will composite them

            // Draw annotations directly
            ctx.fillStyle = 'rgba(0,0,0,0)';
            ctx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);

            const annotations = [
                { text: 'Toolbar', x: 700, y: 21, target: { x: 400, y: 21 } },
                { text: 'Scene Tabs', x: 700, y: 52, target: { x: 200, y: 52 } },
                { text: 'Layers Panel', x: 50, y: 300, target: { x: 120, y: 250 } },
                { text: 'Canvas', x: 700, y: 450, target: { x: 600, y: 400 } },
                { text: 'Modules Palette', x: 1200, y: 200, target: { x: 1280, y: 150 } },
                { text: 'Properties Panel', x: 1200, y: 500, target: { x: 1280, y: 450 } },
                { text: 'Media Library', x: 50, y: 600, target: { x: 120, y: 550 } },
                { text: 'Play/Stop', x: 500, y: 75, target: { x: 500, y: 65 } }
            ];

            // Draw labels with background pills and lines
            annotations.forEach(a => {
                // Line from label to target
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(a.target.x, a.target.y);
                ctx.strokeStyle = 'rgba(139, 92, 246, 0.8)';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Label background
                ctx.font = 'bold 13px "Segoe UI", sans-serif';
                const metrics = ctx.measureText(a.text);
                const pw = metrics.width + 12;
                const ph = 22;
                const px = a.x - pw / 2;
                const py = a.y - ph / 2;

                ctx.fillStyle = 'rgba(139, 92, 246, 0.9)';
                ctx.beginPath();
                ctx.roundRect(px, py, pw, ph, 4);
                ctx.fill();

                // Label text
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(a.text, a.x, a.y);
            });

            resolve(baseCanvas.toDataURL('image/png'));
        });
    `);

    // Save the base screenshot first
    await capture(win, 'editor-layout-annotated-base.png');

    // Now composite: load base + overlay in a hidden window
    const annotatedImage = await win.webContents.executeJavaScript(`
        new Promise(async (resolve) => {
            const baseImg = new Image();
            baseImg.src = 'file:///${SCREENSHOT_DIR.replace(/\\\\/g, '/')}/editor-layout-annotated-base.png';
            baseImg.onload = () => {
                const c = document.createElement('canvas');
                c.width = baseImg.width;
                c.height = baseImg.height;
                const ctx = c.getContext('2d');
                ctx.drawImage(baseImg, 0, 0);

                // Draw annotations on top
                const annotations = [
                    { text: 'Toolbar', x: 700, y: 21, target: { x: 400, y: 21 } },
                    { text: 'Scene Tabs', x: 350, y: 70, target: { x: 200, y: 52 } },
                    { text: 'Layers Panel', x: 180, y: 300, target: { x: 120, y: 200 } },
                    { text: 'Canvas', x: 700, y: 450, target: { x: 600, y: 400 } },
                    { text: 'Modules Palette', x: 1250, y: 200, target: { x: 1320, y: 120 } },
                    { text: 'Properties Panel', x: 1250, y: 550, target: { x: 1320, y: 450 } },
                    { text: 'Media Library', x: 180, y: 650, target: { x: 120, y: 600 } },
                    { text: 'Play/Stop', x: 600, y: 90, target: { x: 500, y: 68 } }
                ];

                annotations.forEach(a => {
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(a.target.x, a.target.y);
                    ctx.strokeStyle = 'rgba(139, 92, 246, 0.9)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([]);
                    ctx.stroke();

                    // Dot at target
                    ctx.beginPath();
                    ctx.arc(a.target.x, a.target.y, 4, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(139, 92, 246, 0.9)';
                    ctx.fill();

                    // Label pill
                    ctx.font = 'bold 13px "Segoe UI", sans-serif';
                    const metrics = ctx.measureText(a.text);
                    const pw = metrics.width + 14;
                    const ph = 24;
                    const px = a.x - pw / 2;
                    const py = a.y - ph / 2;

                    ctx.fillStyle = 'rgba(139, 92, 246, 0.95)';
                    ctx.beginPath();
                    ctx.roundRect(px, py, pw, ph, 5);
                    ctx.fill();

                    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.roundRect(px, py, pw, ph, 5);
                    ctx.stroke();

                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(a.text, a.x, a.y);
                });

                resolve(c.toDataURL('image/png'));
            };
            baseImg.onerror = () => resolve(null);
        });
    `);

    if (annotatedImage) {
        const base64Data = annotatedImage.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(path.join(SCREENSHOT_DIR, 'editor-layout-annotated.png'), Buffer.from(base64Data, 'base64'));
        console.log('  ✓ editor-layout-annotated.png');
    }

    // Clean up temp file
    const tempFile = path.join(SCREENSHOT_DIR, 'editor-layout-annotated-base.png');
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

    // 9. Gradient Editor
    console.log('9/9 Gradient editor');
    await win.webContents.executeJavaScript(`
        window.settingsPanel && window.settingsPanel.openTo('audiovisualiser');
    `);
    await sleep(DELAY);
    // Try to open the gradient editor if the button exists
    await win.webContents.executeJavaScript(`
        // Switch to gradient mode first
        const modeSelect = document.querySelector('#av-color-mode');
        if (modeSelect) {
            modeSelect.value = 'gradient';
            modeSelect.dispatchEvent(new Event('change'));
        }
    `);
    await sleep(500);
    await win.webContents.executeJavaScript(`
        const btn = document.getElementById('btn-open-gradient-editor');
        if (btn) btn.click();
    `);
    await sleep(DELAY);
    await capture(win, 'gradient-editor.png');

    // Close everything
    await win.webContents.executeJavaScript(`
        const cancelBtn = document.getElementById('gradient-editor-cancel');
        if (cancelBtn) cancelBtn.click();
        window.settingsPanel && window.settingsPanel.close();
    `);
    await sleep(500);

    // ─── Done ────────────────────────────────────────────────────────────────
    const count = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png')).length;
    console.log(`\n✓ Done! ${count} screenshots in docs/screenshots/`);
    console.log('  Note: editor-layout-annotated.png has auto-generated labels.');
    console.log('  Review and adjust annotation positions in screenshot.js if needed.');

    win.close();
    app.quit();
});
