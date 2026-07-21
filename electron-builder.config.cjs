const updateUrl = process.env.ARK_WINDOWS_UPDATE_URL || 'https://updates.invalid/ark-one/windows';

module.exports = {
  appId: 'com.arktechnologiesgroup.arkone',
  productName: 'ARK ONE Portal',
  artifactName: 'ARK-ONE-Portal-${version}-${arch}.${ext}',
  directories: { output: 'dist-electron' },
  files: ['dist/**/*', 'electron/**/*', 'package.json'],
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'electron/icon.ico',
    publisherName: process.env.ARK_WINDOWS_PUBLISHER || 'ARK Technologies Group',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'ARK ONE Portal',
    deleteAppDataOnUninstall: false,
  },
  publish: [{ provider: 'generic', url: updateUrl, channel: 'latest' }],
};
