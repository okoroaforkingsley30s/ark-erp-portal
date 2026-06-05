const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
const win = new BrowserWindow({
width: 1400,
height: 900,
minWidth: 1100,
minHeight: 700,
icon: path.join(__dirname, 'icon.ico'),
webPreferences: {
nodeIntegration: false,
contextIsolation: true,
},
});

if (app.isPackaged) {
win.loadFile(path.join(__dirname, '../dist/index.html'));
} else {
win.loadURL('http://localhost:5173');
}

win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
if (process.platform !== 'darwin') app.quit();
});
