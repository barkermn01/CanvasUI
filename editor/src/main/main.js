const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const server = require('./server');

// Disable Media Foundation video capture to allow shared access to virtual cameras
// (XSplit VCam, OBS Virtual Camera). MF takes exclusive locks; DirectShow allows sharing.
app.commandLine.appendSwitch('disable-features', 'MediaFoundationVideoCapture');

let mainWindow;

function createWindow() {
    const isDev = !app.isPackaged;

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        title: 'CanvasUI Stream Manager',
        icon: path.join(__dirname, '..', '..', '..', 'icon.png'),
        frame: isDev,
        titleBarStyle: isDev ? 'default' : 'hidden',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: isDev
        }
    });

    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

    // Grant media permissions (camera, microphone) for the renderer
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
        // Always grant media-related permissions
        callback(true);
    });

    mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
        return true;
    });

    // Open DevTools in dev mode (detached)
    if (isDev) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
}

app.whenReady().then(() => {
    // Prevent multiple instances
    const gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
        app.quit();
        return;
    }

    app.on('second-instance', () => {
        // Focus the existing window if someone tries to open a second instance
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', async () => {
    await server.stopServer();
});

// ─── Module Discovery ─────────────────────────────────────────────────────────

ipcMain.handle('module-discover', () => {
    const resourcesWww = path.join(process.resourcesPath || '', 'www');
    const projectWww = path.resolve(__dirname, '..', '..', '..', 'www');
    const wwwDir = (process.resourcesPath && fs.existsSync(resourcesWww)) ? resourcesWww : projectWww;
    const modulesDir = path.join(wwwDir, 'modules');

    try {
        const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
        const modules = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const infoPath = path.join(modulesDir, entry.name, 'info.json');
            if (!fs.existsSync(infoPath)) continue;

            try {
                const content = fs.readFileSync(infoPath, 'utf8');
                const info = JSON.parse(content);
                // Add the directory path for the module loader
                info._dir = entry.name;
                modules.push(info);
            } catch (e) {
                console.warn(`Failed to parse module info: ${entry.name}/info.json`, e.message);
            }
        }

        // Also load global.info.json if present
        const globalInfoPath = path.join(modulesDir, 'global.info.json');
        if (fs.existsSync(globalInfoPath)) {
            try {
                const content = fs.readFileSync(globalInfoPath, 'utf8');
                modules.push(JSON.parse(content));
            } catch (e) {}
        }

        return modules;
    } catch (e) {
        console.warn('Module discovery failed:', e.message);
        return [];
    }
});

// ─── Config File Operations ───────────────────────────────────────────────────

// Auto-load default config on startup
ipcMain.handle('auto-load-config', () => {
    // Check packaged resources first, then project root (dev mode only)
    let configPath;

    if (app.isPackaged) {
        // Packaged app: only look in resources
        const resourcesWww = path.join(process.resourcesPath, 'www');
        configPath = path.join(resourcesWww, 'config.js');
    } else {
        // Dev mode: look in project www/
        const projectWww = path.resolve(__dirname, '..', '..', '..', 'www');
        configPath = path.join(projectWww, 'config.js');
    }

    try {
        if (!fs.existsSync(configPath)) return null;

        const content = fs.readFileSync(configPath, 'utf8');
        const match = content.match(/const\s+Config\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
        if (!match) return null;

        const configObj = new Function(`return ${match[1]}`)();
        return { config: configObj, path: configPath };
    } catch (e) {
        console.error('Auto-load config failed:', e.message);
        return null;
    }
});

ipcMain.handle('import-config', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Open Config',
        filters: [{ name: 'JavaScript', extensions: ['js'] }],
        properties: ['openFile']
    });
    if (result.canceled) return null;

    const content = fs.readFileSync(result.filePaths[0], 'utf8');
    const match = content.match(/const\s+Config\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (!match) return { error: 'Could not parse config file' };

    try {
        const configObj = new Function(`return ${match[1]}`)();
        return { config: configObj, path: result.filePaths[0] };
    } catch (e) {
        return { error: `Parse error: ${e.message}` };
    }
});

ipcMain.handle('export-config', async (event, configData) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Config As',
        defaultPath: 'config.js',
        filters: [{ name: 'JavaScript', extensions: ['js'] }]
    });
    if (result.canceled) return false;

    const output = `const Config  = ${JSON.stringify(configData, null, 4)}`;
    fs.writeFileSync(result.filePath, output, 'utf8');

    // Notify connected clients to reload
    if (server.isRunning()) {
        server.broadcastReload();
    }

    return true;
});

ipcMain.handle('pick-media', async (event, type) => {
    let filters;
    if (type === 'image') {
        filters = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }];
    } else if (type === 'video') {
        filters = [{ name: 'Videos', extensions: ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi'] }];
    } else {
        filters = [
            { name: 'All Media', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi'] },
            { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
            { name: 'Videos', extensions: ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi'] }
        ];
    }

    const result = await dialog.showOpenDialog(mainWindow, {
        title: `Select ${type === 'all' ? 'Media' : type}`,
        filters,
        properties: ['openFile']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
});

ipcMain.handle('quick-save', async (event, { configData, savePath }) => {
    try {
        const output = `const Config  = ${JSON.stringify(configData, null, 4)}`;
        fs.writeFileSync(savePath, output, 'utf8');

        // Notify connected clients to reload
        if (server.isRunning()) {
            const count = server.broadcastReload();
            console.log(`Config saved, notified ${count} client(s) to reload`);
        }

        return true;
    } catch (e) {
        return false;
    }
});

// ─── Media Operations ─────────────────────────────────────────────────────────

function getMediaDir() {
    const resourcesWww = path.join(process.resourcesPath || '', 'www');
    const projectWww = path.resolve(__dirname, '..', '..', '..', 'www');
    const wwwDir = (process.resourcesPath && fs.existsSync(resourcesWww)) ? resourcesWww : projectWww;
    const mediaDir = path.join(wwwDir, 'media');
    if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
    }
    return mediaDir;
}

ipcMain.handle('media-list', (event, subPath) => {
    const mediaDir = getMediaDir();
    const browsePath = subPath ? path.join(mediaDir, subPath) : mediaDir;

    // Security: ensure we stay inside media dir
    if (!browsePath.startsWith(mediaDir)) return [];

    try {
        const entries = fs.readdirSync(browsePath, { withFileTypes: true });
        const items = [];

        // Add directories first
        entries.filter(e => e.isDirectory()).forEach(e => {
            const relativePath = subPath ? `${subPath}/${e.name}` : e.name;
            items.push({
                name: e.name,
                path: relativePath,
                type: 'directory'
            });
        });

        // Then files
        entries.filter(e => e.isFile()).forEach(e => {
            const ext = path.extname(e.name).toLowerCase();
            if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi'].includes(ext)) return;

            const filePath = path.join(browsePath, e.name);
            const stat = fs.statSync(filePath);
            const isVideo = ['.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi'].includes(ext);
            const webPath = subPath ? `/media/${subPath}/${e.name}` : `/media/${e.name}`;

            items.push({
                name: e.name,
                path: webPath,
                fullPath: filePath,
                size: stat.size,
                type: isVideo ? 'video' : 'image',
                modified: stat.mtimeMs
            });
        });

        return items;
    } catch (e) {
        return [];
    }
});

ipcMain.handle('media-create-dir', (event, dirName, subPath) => {
    const mediaDir = getMediaDir();
    const parentDir = subPath ? path.join(mediaDir, subPath) : mediaDir;
    const newDir = path.join(parentDir, dirName);

    // Security
    if (!newDir.startsWith(mediaDir)) return { success: false, error: 'Invalid path' };

    try {
        fs.mkdirSync(newDir, { recursive: true });
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Watch media folder for external changes
let mediaWatcher = null;
function startMediaWatcher() {
    const mediaDir = getMediaDir();
    try {
        if (mediaWatcher) mediaWatcher.close();
        mediaWatcher = fs.watch(mediaDir, { recursive: true }, () => {
            // Notify renderer to refresh media panel
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('media-changed');
            }
        });
    } catch (e) {
        console.warn('Could not watch media folder:', e.message);
    }
}

// Start watcher after app is ready
app.whenReady().then(() => {
    setTimeout(startMediaWatcher, 2000);
});

ipcMain.handle('media-upload', async (event, filePaths) => {
    const mediaDir = getMediaDir();
    const results = [];
    for (const src of filePaths) {
        const name = path.basename(src);
        const dest = path.join(mediaDir, name);
        try {
            fs.copyFileSync(src, dest);
            results.push({ success: true, name, path: `/media/${name}` });
        } catch (e) {
            results.push({ success: false, name, error: e.message });
        }
    }
    return results;
});

ipcMain.handle('media-delete', (event, fileName) => {
    const mediaDir = getMediaDir();
    const filePath = path.join(mediaDir, fileName);
    // Security: ensure it's inside media dir
    if (!filePath.startsWith(mediaDir)) return { success: false, error: 'Invalid path' };
    try {
        fs.unlinkSync(filePath);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('media-delete-dir', (event, dirPath) => {
    const mediaDir = getMediaDir();
    const fullPath = path.join(mediaDir, dirPath);
    // Security: ensure it's inside media dir and not the media dir itself
    if (!fullPath.startsWith(mediaDir) || fullPath === mediaDir) return { success: false, error: 'Invalid path' };
    try {
        fs.rmSync(fullPath, { recursive: true, force: true });
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('media-drop', async (event, fileDataArray, subPath) => {
    const mediaDir = getMediaDir();
    const targetDir = subPath ? path.join(mediaDir, subPath) : mediaDir;
    if (!targetDir.startsWith(mediaDir)) return [];

    const results = [];
    for (const filePath of fileDataArray) {
        const name = path.basename(filePath);
        const dest = path.join(targetDir, name);
        try {
            fs.copyFileSync(filePath, dest);
            const webPath = subPath ? `/media/${subPath}/${name}` : `/media/${name}`;
            results.push({ success: true, name, path: webPath });
        } catch (e) {
            results.push({ success: false, name, error: e.message });
        }
    }
    return results;
});

// ─── Server Operations ────────────────────────────────────────────────────────

ipcMain.handle('server-start', async (event, options) => {
    try {
        const result = await server.startServer(options);
        return { success: true, ...result };
    } catch (e) {
        console.warn('Server start failed:', e.message);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('server-stop', async () => {
    await server.stopServer();
    return { success: true };
});

ipcMain.handle('server-status', () => {
    return {
        running: server.isRunning(),
        clients: server.getClientCount()
    };
});

ipcMain.handle('server-reload', () => {
    if (!server.isRunning()) return { success: false, error: 'Server not running' };
    const count = server.broadcastReload();
    return { success: true, clients: count };
});

ipcMain.handle('server-broadcast-raw', (event, data) => {
    if (!server.isRunning()) return { success: false, error: 'Server not running' };
    const count = server.broadcastRaw(data);
    return { success: true, clients: count };
});

// ─── Window Controls ──────────────────────────────────────────────────────────

ipcMain.handle('window-minimize', () => { mainWindow?.minimize(); });
ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});
ipcMain.handle('window-close', () => { mainWindow?.close(); });
