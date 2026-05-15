const { contextBridge, ipcRenderer } = require('electron');

let getPathForFile = null;
try {
    const { webUtils } = require('electron');
    if (webUtils && webUtils.getPathForFile) {
        getPathForFile = (file) => webUtils.getPathForFile(file);
    }
} catch (e) {}

contextBridge.exposeInMainWorld('api', {
    // Module discovery
    discoverModules: () => ipcRenderer.invoke('module-discover'),

    // Module management
    moduleListInstalled: () => ipcRenderer.invoke('module-list-installed'),
    moduleInstall: () => ipcRenderer.invoke('module-install'),
    moduleExport: (name) => ipcRenderer.invoke('module-export', name),
    moduleUninstall: (name) => ipcRenderer.invoke('module-uninstall', name),
    openModulesDir: () => ipcRenderer.invoke('open-modules-dir'),

    // File path helper (for drag-drop from OS in sandboxed mode)
    getPathForFile: getPathForFile,

    // Config operations
    autoLoadConfig: () => ipcRenderer.invoke('auto-load-config'),
    importConfig: () => ipcRenderer.invoke('import-config'),
    exportConfig: (data) => ipcRenderer.invoke('export-config', data),
    pickMedia: (type) => ipcRenderer.invoke('pick-media', type),
    quickSave: (data) => ipcRenderer.invoke('quick-save', data),

    // Media library
    mediaList: (subPath) => ipcRenderer.invoke('media-list', subPath),
    mediaUpload: (paths) => ipcRenderer.invoke('media-upload', paths),
    mediaDelete: (name) => ipcRenderer.invoke('media-delete', name),
    mediaDeleteDir: (dirPath) => ipcRenderer.invoke('media-delete-dir', dirPath),
    mediaDrop: (paths, subPath) => ipcRenderer.invoke('media-drop', paths, subPath),
    mediaCreateDir: (name, subPath) => ipcRenderer.invoke('media-create-dir', name, subPath),
    onMediaChanged: (callback) => ipcRenderer.on('media-changed', callback),

    // Server operations
    serverStart: (options) => ipcRenderer.invoke('server-start', options),
    serverStop: () => ipcRenderer.invoke('server-stop'),
    serverStatus: () => ipcRenderer.invoke('server-status'),
    serverReload: () => ipcRenderer.invoke('server-reload'),
    serverBroadcastRaw: (data) => ipcRenderer.invoke('server-broadcast-raw', data),

    // Window controls
    windowMinimize: () => ipcRenderer.invoke('window-minimize'),
    windowMaximize: () => ipcRenderer.invoke('window-maximize'),
    windowClose: () => ipcRenderer.invoke('window-close')
});
