const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, powerMonitor, session, shell } = require('electron');
const fs = require('fs');
const path = require('path');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const REFRESH_INTERVAL_MS = 60 * 1000;
const DEV_URL = 'http://localhost:5173';
let mainWindow;
let splashWindow;
let tray;
let refreshTimer;
let quitting = false;

const isTrustedRendererUrl = (value = '') =>
  value.startsWith('file://') || value.startsWith(DEV_URL);

const isTrustedExternalUrl = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const settingsPath = () => path.join(app.getPath('userData'), 'desktop-settings.json');

function readSettings() {
  try {
    return { launchAtStartup: true, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) };
  } catch {
    return { launchAtStartup: true };
  }
}

function writeSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf8');
}

function applyStartupSetting(enabled) {
  const value = Boolean(enabled);
  app.setLoginItemSettings({
    openAtLogin: value,
    path: process.execPath,
    args: app.isPackaged ? ['--background'] : [],
  });
  writeSettings({ ...readSettings(), launchAtStartup: value });
  return value;
}

function sendDataRefresh(reason = 'scheduled') {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ark:data-refresh', { reason, at: new Date().toISOString() });
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  sendDataRefresh('window-opened');
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 560,
    height: 390,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: false,
    },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.once('ready-to-show', () => splashWindow?.show());
}

function closeSplashAndShowMain() {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  splashWindow = undefined;
  showMainWindow();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#061943',
    autoHideMenuBar: true,
    title: 'ARK ONE Enterprise Portal',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.once('ready-to-show', closeSplashAndShowMain);
  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    console.error('ARK ONE renderer failed to load:', code, description);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedExternalUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url)) {
      event.preventDefault();
      if (isTrustedExternalUrl(url)) shell.openExternal(url);
    }
  });
  mainWindow.on('focus', () => sendDataRefresh('window-focus'));
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  if (!app.isPackaged && process.env.ARK_ELECTRON_DEV_SERVER === '1') {
  mainWindow.loadURL(DEV_URL);
} else {
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

mainWindow.webContents.once('did-finish-load', () => {
  mainWindow.webContents.openDevTools({ mode: 'detach' });
});

  if (process.env.ARK_ELECTRON_DEVTOOLS === '1') {
  mainWindow.webContents.openDevTools({ mode: 'detach' });
}

  setTimeout(closeSplashAndShowMain, 15000);
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'icon.ico'));
  tray.setToolTip('ARK ONE Enterprise Portal');

  const rebuildMenu = () => {
    const startupEnabled = readSettings().launchAtStartup;
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open ARK ONE', click: showMainWindow },
      { label: 'Refresh live data', click: () => sendDataRefresh('tray') },
      { type: 'separator' },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: startupEnabled,
        click: (item) => {
          applyStartupSetting(item.checked);
          rebuildMenu();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit ARK ONE',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]));
  };

  tray.on('double-click', showMainWindow);
  rebuildMenu();
}

function configurePermissions() {
  const allow = (webContents, permission, origin = '') =>
    permission === 'geolocation' &&
    isTrustedRendererUrl(origin || webContents?.getURL?.() || '');

  session.defaultSession.setPermissionCheckHandler((webContents, permission, origin) =>
    allow(webContents, permission, origin)
  );
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(allow(webContents, permission, details?.requestingUrl));
  });
}

function configureIpc() {
  ipcMain.handle('ark:get-desktop-settings', () => ({
    ...readSettings(),
    version: app.getVersion(),
    platform: process.platform,
  }));
  ipcMain.handle('ark:set-launch-at-startup', (_event, enabled) => applyStartupSetting(enabled));
  ipcMain.handle('ark:request-data-refresh', () => {
    sendDataRefresh('renderer-request');
    return true;
  });
}

function configureUpdates() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('error', (error) => console.error('ARK ONE update check failed:', error?.message || error));
    autoUpdater.on('update-downloaded', async (info) => {
      const choice = await dialog.showMessageBox({
        type: 'info',
        title: 'ARK ONE Update Ready',
        message: `ARK ONE Portal ${info.version} is ready to install.`,
        detail: 'Restart now to install the update, or choose Later. It will install when ARK ONE exits.',
        buttons: ['Restart and Update', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });
      if (choice.response === 0) {
        quitting = true;
        autoUpdater.quitAndInstall(false, true);
      }
    });
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 8000);
    setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 6 * 60 * 60 * 1000);
  } catch (error) {
    console.error('ARK ONE updater could not start:', error?.message || error);
  }
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.on('second-instance', showMainWindow);
  app.whenReady().then(() => {
    applyStartupSetting(readSettings().launchAtStartup);
    configurePermissions();
    configureIpc();
    createSplashWindow();
    createMainWindow();
    createTray();
    configureUpdates();
    refreshTimer = setInterval(() => sendDataRefresh('scheduled'), REFRESH_INTERVAL_MS);
    powerMonitor.on('resume', () => sendDataRefresh('system-resume'));
  });
}

app.on('activate', showMainWindow);
app.on('before-quit', () => {
  quitting = true;
  if (refreshTimer) clearInterval(refreshTimer);
});
app.on('window-all-closed', () => {
  mainWindow = undefined;
});
