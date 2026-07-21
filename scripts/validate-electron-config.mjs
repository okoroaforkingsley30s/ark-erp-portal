import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const mainSource = await readFile(new URL('electron/main.cjs', root), 'utf8');

for (const file of ['electron/icon.ico', 'electron/icon.png', 'build/icon.ico']) {
  await access(new URL(file, root));
}

const build = packageJson.build;
if (build?.appId !== 'com.arktechnologiesgroup.arkone') {
  throw new Error('Electron appId is missing or incorrect.');
}
if (build?.win?.icon !== 'build/icon.ico' || !build?.nsis?.installerIcon) {
  throw new Error('Windows application and installer icons are not configured.');
}
if (!packageJson.scripts?.['electron:dev']?.includes('--dev-server-url=')) {
  throw new Error('Electron development startup is not connected to the Vite server.');
}
if (!packageJson.scripts?.electron?.includes('build:production')) {
  throw new Error('Electron production startup must build the production renderer.');
}
if (!mainSource.includes('devTools: isDevelopment')) {
  throw new Error('Electron DevTools must be restricted to explicit development mode.');
}
if (/\.openDevTools\s*\(/.test(mainSource)) {
  throw new Error('Electron must not automatically open DevTools.');
}
if (!mainSource.includes('sandbox: true') || !mainSource.includes('contextIsolation: true')) {
  throw new Error('Electron renderer sandboxing is not enabled.');
}

console.log('Electron startup, security and packaging configuration are valid.');
