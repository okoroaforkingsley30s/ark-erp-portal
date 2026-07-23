const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arkDesktop', Object.freeze({
  getSettings: () => ipcRenderer.invoke('ark:get-desktop-settings'),
  setLaunchAtStartup: (enabled) => ipcRenderer.invoke('ark:set-launch-at-startup', Boolean(enabled)),
  requestDataRefresh: () => ipcRenderer.invoke('ark:request-data-refresh'),
  onDataRefresh: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('ark:data-refresh', listener);
    return () => ipcRenderer.removeListener('ark:data-refresh', listener);
  },
}));
