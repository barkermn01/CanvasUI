const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const server = require('./server');

// Disable Media Foundation video capture to allow shared access to virtual cameras
// (XSplit VCam, OBS Virtual Camera). MF takes exclusive locks; DirectShow allows sharing.
app.commandLine.appendSwitch('disable-features', 'MediaFoundationVideoCapture');

// ─── Platform-aware path resolution ──────────────────────────────────────────
// Windows: user data lives inside the install directory (resources/www/)
// macOS/Linux: user data lives in the OS user data directory
function getWwwDir() {
    if (app.isPackaged) {
        if (process.platform === 'win32') {
            // Windows: www is inside the app resources
            return path.join(process.resourcesPath, 'www');
        } else {
            // macOS/Linux: www base is in resources, but user data is in userData
            return path.join(process.resourcesPath, 'www');
        }
    }
    // Dev mode: project root www/
    return path.resolve(__dirname, '..', '..', '..', 'www');
}

function getUserWwwDir() {
    if (app.isPackaged && process.platform !== 'win32') {
        // macOS/Linux: user-writable data goes in userData
        const userDir = path.join(app.getPath('userData'), 'www');
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        return userDir;
    }
    // Windows (packaged) or dev mode: same as wwwDir
    return getWwwDir();
}

function getModulesDir() {
    const userWww = getUserWwwDir();
    const modulesDir = path.join(userWww, 'modules');
    const builtInNames = ['chat', 'emote', 'audiovisualiser', 'webcam', 'image', 'video', 'pngtuber'];

    if (!fs.existsSync(modulesDir)) {
        // First run: copy all built-in modules to user directory
        const builtInModules = path.join(getWwwDir(), 'modules');
        if (fs.existsSync(builtInModules) && userWww !== getWwwDir()) {
            fs.cpSync(builtInModules, modulesDir, { recursive: true });
        } else {
            fs.mkdirSync(modulesDir, { recursive: true });
        }
    } else if (userWww !== getWwwDir()) {
        // Subsequent runs: sync only built-in modules (leave custom ones untouched)
        const builtInModules = path.join(getWwwDir(), 'modules');
        if (fs.existsSync(builtInModules)) {
            // Overwrite built-in module directories
            for (const name of builtInNames) {
                const src = path.join(builtInModules, name);
                const dest = path.join(modulesDir, name);
                if (fs.existsSync(src)) {
                    fs.cpSync(src, dest, { recursive: true });
                }
            }
            // Copy top-level files (modules.json, global.info.json, scene.js, config-validator.js)
            const topFiles = fs.readdirSync(builtInModules, { withFileTypes: true })
                .filter(e => e.isFile());
            for (const file of topFiles) {
                fs.copyFileSync(path.join(builtInModules, file.name), path.join(modulesDir, file.name));
            }
            // Merge modules.json: ensure built-in entries exist without removing custom ones
            const builtInManifest = path.join(builtInModules, 'modules.json');
            const userManifest = path.join(modulesDir, 'modules.json');
            if (fs.existsSync(builtInManifest) && fs.existsSync(userManifest)) {
                try {
                    const builtIn = JSON.parse(fs.readFileSync(builtInManifest, 'utf8'));
                    const user = JSON.parse(fs.readFileSync(userManifest, 'utf8'));
                    const merged = { ...user, ...builtIn };
                    fs.writeFileSync(userManifest, JSON.stringify(merged, null, 4), 'utf8');
                } catch (e) {}
            }
        }
    }
    return modulesDir;
}

function getModulesManifestPath() {
    return path.join(getModulesDir(), 'modules.json');
}

function getMediaDir() {
    const userWww = getUserWwwDir();
    const mediaDir = path.join(userWww, 'media');
    if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
    }
    return mediaDir;
}

function getConfigPath() {
    return path.join(getUserWwwDir(), 'config.js');
}

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
    const modulesDir = getModulesDir();

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

// ─── Module Management ────────────────────────────────────────────────────────

const crypto = require('crypto');
const AdmZip = require('adm-zip');

const BUILT_IN_MODULES = ['chat', 'emote', 'audiovisualiser', 'webcam', 'image', 'video', 'pngtuber'];

function hashFile(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

function getAllFiles(dir, base = '') {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const rel = base ? `${base}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            results.push(...getAllFiles(path.join(dir, entry.name), rel));
        } else {
            results.push(rel);
        }
    }
    return results;
}

// List installed modules with built-in flag
ipcMain.handle('module-list-installed', () => {
    const modulesDir = getModulesDir();

    try {
        const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
        const modules = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const infoPath = path.join(modulesDir, entry.name, 'info.json');
            if (!fs.existsSync(infoPath)) continue;

            try {
                const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                modules.push({
                    name: info.name || entry.name,
                    displayName: info.displayName || entry.name,
                    icon: info.icon || '📦',
                    description: info.description || '',
                    dir: entry.name,
                    builtIn: BUILT_IN_MODULES.includes(entry.name)
                });
            } catch (e) {}
        }

        return modules;
    } catch (e) {
        return [];
    }
});

// Install module from zip
ipcMain.handle('module-install', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Install Module Package',
        filters: [{ name: 'Module Package', extensions: ['zip'] }],
        properties: ['openFile']
    });

    if (canceled || !filePaths[0]) return { success: false, error: 'Cancelled' };

    const zipPath = filePaths[0];
    const modulesDir = getModulesDir();

    try {
        const tempDir = path.join(require('os').tmpdir(), 'canvasui_module_install_' + Date.now());
        fs.mkdirSync(tempDir, { recursive: true });

        // Extract zip using adm-zip (cross-platform)
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(tempDir, true);

        // Check for manifest.json
        const manifestPath = path.join(tempDir, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
            fs.rmSync(tempDir, { recursive: true });
            return { success: false, error: 'No manifest.json found in package' };
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (!manifest.name || !manifest.files) {
            fs.rmSync(tempDir, { recursive: true });
            return { success: false, error: 'Invalid manifest: missing name or files' };
        }

        // Verify file integrity
        for (const file of manifest.files) {
            const filePath = path.join(tempDir, file.path);
            if (!fs.existsSync(filePath)) {
                fs.rmSync(tempDir, { recursive: true });
                return { success: false, error: `Missing file: ${file.path}` };
            }
            const hash = hashFile(filePath);
            if (hash !== file.hash) {
                fs.rmSync(tempDir, { recursive: true });
                return { success: false, error: `Integrity check failed for: ${file.path}` };
            }
        }

        // Check info.json exists
        const infoPath = path.join(tempDir, 'info.json');
        if (!fs.existsSync(infoPath)) {
            fs.rmSync(tempDir, { recursive: true });
            return { success: false, error: 'No info.json found in package' };
        }

        // Install: copy to modules directory
        const destDir = path.join(modulesDir, manifest.name);
        if (fs.existsSync(destDir)) {
            fs.rmSync(destDir, { recursive: true });
        }
        fs.mkdirSync(destDir, { recursive: true });

        // Copy all files (except manifest.json itself)
        for (const file of manifest.files) {
            const src = path.join(tempDir, file.path);
            const dest = path.join(destDir, file.path);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(src, dest);
        }

        // Update modules.json
        const modulesJsonPath = getModulesManifestPath();
        let modulesJson = {};
        if (fs.existsSync(modulesJsonPath)) {
            modulesJson = JSON.parse(fs.readFileSync(modulesJsonPath, 'utf8'));
        }
        modulesJson[manifest.name] = `${manifest.name}/info.json`;
        fs.writeFileSync(modulesJsonPath, JSON.stringify(modulesJson, null, 4), 'utf8');

        // Cleanup temp
        fs.rmSync(tempDir, { recursive: true });

        return { success: true, name: manifest.name, displayName: manifest.displayName || manifest.name };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Export module as zip
ipcMain.handle('module-export', async (event, moduleName) => {
    const modulesDir = getModulesDir();
    const moduleDir = path.join(modulesDir, moduleName);

    if (!fs.existsSync(moduleDir)) {
        return { success: false, error: 'Module not found' };
    }

    // Pick save location
    const { canceled, filePath: savePath } = await dialog.showSaveDialog({
        title: 'Export Module Package',
        defaultPath: `${moduleName}.zip`,
        filters: [{ name: 'Module Package', extensions: ['zip'] }]
    });

    if (canceled || !savePath) return { success: false, error: 'Cancelled' };

    try {
        // Read info.json for metadata
        const infoPath = path.join(moduleDir, 'info.json');
        const info = fs.existsSync(infoPath) ? JSON.parse(fs.readFileSync(infoPath, 'utf8')) : {};

        // Get all files in the module directory
        const files = getAllFiles(moduleDir);

        // Generate manifest with hashes
        const manifest = {
            name: moduleName,
            displayName: info.displayName || moduleName,
            version: info.version || '1.0.0',
            description: info.description || '',
            files: files.map(f => ({
                path: f,
                hash: hashFile(path.join(moduleDir, f))
            }))
        };

        // Create temp directory for packaging
        const tempDir = path.join(require('os').tmpdir(), 'canvasui_module_export_' + Date.now());
        fs.mkdirSync(tempDir, { recursive: true });

        // Copy module files to temp
        for (const file of files) {
            const src = path.join(moduleDir, file);
            const dest = path.join(tempDir, file);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(src, dest);
        }

        // Write manifest
        fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

        // Create zip using adm-zip (cross-platform)
        const zip = new AdmZip();
        const addDirRecursive = (dir, zipPath) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const entryZipPath = zipPath ? `${zipPath}/${entry.name}` : entry.name;
                if (entry.isDirectory()) {
                    addDirRecursive(fullPath, entryZipPath);
                } else {
                    zip.addLocalFile(fullPath, zipPath || '');
                }
            }
        };
        addDirRecursive(tempDir, '');
        zip.writeZip(savePath);

        // Cleanup
        fs.rmSync(tempDir, { recursive: true });

        return { success: true, path: savePath };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Uninstall a module
ipcMain.handle('module-uninstall', (event, moduleName) => {
    if (BUILT_IN_MODULES.includes(moduleName)) {
        return { success: false, error: 'Cannot uninstall built-in modules' };
    }

    const modulesDir = getModulesDir();
    const moduleDir = path.join(modulesDir, moduleName);

    if (!fs.existsSync(moduleDir)) {
        return { success: false, error: 'Module not found' };
    }

    try {
        // Remove directory
        fs.rmSync(moduleDir, { recursive: true });

        // Remove from modules.json
        const modulesJsonPath = getModulesManifestPath();
        if (fs.existsSync(modulesJsonPath)) {
            const modulesJson = JSON.parse(fs.readFileSync(modulesJsonPath, 'utf8'));
            delete modulesJson[moduleName];
            fs.writeFileSync(modulesJsonPath, JSON.stringify(modulesJson, null, 4), 'utf8');
        }

        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// ─── Config File Operations ───────────────────────────────────────────────────

// Open modules directory in file explorer
ipcMain.handle('open-modules-dir', () => {
    const modulesDir = getModulesDir();
    require('electron').shell.openPath(modulesDir);
});

// Auto-load default config on startup
ipcMain.handle('auto-load-config', () => {
    const configPath = getConfigPath();

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
