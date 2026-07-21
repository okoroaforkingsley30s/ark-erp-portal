import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const packageJson = JSON.parse(
  await readFile(new URL('package.json', root), 'utf8')
);
const mainSource = await readFile(
  new URL('electron/main.cjs', root),
  'utf8'
);
const builderSource = await readFile(
  new URL('electron-builder.config.cjs', root),
  'utf8'
);

for (const file of ['electron/icon.ico', 'electron/icon.png']) {
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

if (!packageJson.scripts?.['electron:dev']?.includes('ARK_ELECTRON_DEV_SERVER=1')) {
  throw new Error('Electron development startup is not connected to Vite.');
}

if (!packageJson.scripts?.electron?.includes('npm run build')) {
  throw new Error('Electron startup must build the production renderer.');
}

if (
  !mainSource.includes('devTools: !app.isPackaged') ||
  !mainSource.includes("process.env.ARK_ELECTRON_DEVTOOLS === '1'")
) {
  throw new Error('Electron DevTools are not restricted to development mode.');
}

if (
  !mainSource.includes('sandbox: true') ||
  !mainSource.includes('contextIsolation: true') ||
  !mainSource.includes('nodeIntegration: false')
) {
  throw new Error('Electron renderer security controls are incomplete.');
}

console.log(
  'Electron startup, security and packaging configuration are valid.'
);