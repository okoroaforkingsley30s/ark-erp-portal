import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const mainSource = await readFile(new URL('electron/main.cjs', root), 'utf8');
const preloadSource = await readFile(new URL('electron/preload.cjs', root), 'utf8');
const splashSource = await readFile(new URL('electron/splash.html', root), 'utf8');
const builderSource = await readFile(new URL('electron-builder.config.cjs', root), 'utf8');

for (const file of [
  'electron/icon.ico',
  'electron/icon.png',
  'electron/splash-logo.gif',
  'electron/preload.cjs',
  'electron/splash.html',
]) {
  await access(new URL(file, root));
}

if (!builderSource.includes("appId: 'com.arktechnologiesgroup.arkone'")) {
  throw new Error('Electron appId is missing or incorrect.');
}
if (!builderSource.includes("icon: 'electron/icon.ico'")) {
  throw new Error('Windows application icon is not configured.');
}
if (!builderSource.includes("target: 'nsis'")) {
  throw new Error('Windows NSIS installer target is not configured.');
}
for (const option of ['installerIcon', 'uninstallerIcon', 'installerHeaderIcon', 'runAfterFinish']) {
  if (!builderSource.includes(option)) throw new Error(`Windows installer branding is missing ${option}.`);
}
if (!packageJson.scripts?.['electron:dev']?.includes('ARK_ELECTRON_DEV_SERVER=1')) {
  throw new Error('Electron development startup is not connected to Vite.');
}
if (!packageJson.scripts?.electron?.includes('npm run build')) {
  throw new Error('Electron startup must build the production renderer.');
}
if (!mainSource.includes('devTools: !app.isPackaged') || !mainSource.includes("process.env.ARK_ELECTRON_DEVTOOLS === '1'")) {
  throw new Error('Electron DevTools are not restricted to development mode.');
}
for (const control of ['sandbox: true', 'contextIsolation: true', 'nodeIntegration: false', 'webSecurity: true']) {
  if (!mainSource.includes(control)) throw new Error(`Electron renderer security is missing ${control}.`);
}
for (const feature of ['new Tray(', 'setLoginItemSettings', "permission === 'geolocation'", 'ark:data-refresh', 'backgroundThrottling: false', "autoplay-policy', 'no-user-gesture-required"]) {
  if (!mainSource.includes(feature)) throw new Error(`Windows desktop feature is missing: ${feature}.`);
}
if (!mainSource.includes("preload: path.join(__dirname, 'preload.cjs')")) {
  throw new Error('Secure desktop preload bridge is not configured.');
}
if (!preloadSource.includes('contextBridge.exposeInMainWorld') || !preloadSource.includes('arkDesktop')) {
  throw new Error('Desktop preload API is incomplete.');
}
if (!splashSource.includes('splash-logo.gif') || !splashSource.includes('ARK ONE')) {
  throw new Error('Branded animated startup screen is incomplete.');
}

console.log('Electron branding, startup, tray, refresh, sound, GPS, security and packaging configuration are valid.');
