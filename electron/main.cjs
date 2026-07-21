const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');

const isTrustedExternalUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
};

function configureUpdates() {
  if (!app.isPackaged) return;

  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('error', (error) => {
      console.error('ARK ONE update check failed:', error?.message || error);
    });

    autoUpdater.on('update-downloaded', async (info) => {
      const choice = await dialog.showMessageBox({
        type: 'info',
        title: 'ARK ONE Update Ready',
        message: `ARK ONE Portal ${info.version} is ready to install.`,
        detail: 'Restart now to install the update, or choose Later. It will install when the app closes.',
        buttons: ['Restart and Update', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });
      if (choice.response === 0) autoUpdater.quitAndInstall(false, true);
    });

    setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 8000);
    setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 6 * 60 * 60 * 1000);
  } catch (error) {
    console.error('ARK ONE updater could not start:', error?.message || error);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedExternalUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL();
    if (url !== current && !url.startsWith('file://') && !url.startsWith('http://localhost:5173')) {
      event.preventDefault();
      if (isTrustedExternalUrl(url)) shell.openExternal(url);
    }
  });

  if (!app.isPackaged && process.env.ARK_ELECTRON_DEV_SERVER === '1') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  if (!app.isPackaged && process.env.ARK_ELECTRON_DEVTOOLS === '1') {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    configureUpdates();
  });
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
