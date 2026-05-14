const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Module discovery
    discoverModules: () => ipcRenderer.invoke('module-discover'),

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
