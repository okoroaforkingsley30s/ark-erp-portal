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
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: 'always',
    createStartMenuShortcut: true,
    runAfterFinish: true,
    installerIcon: 'electron/icon.ico',
    uninstallerIcon: 'electron/icon.ico',
    installerHeaderIcon: 'electron/icon.ico',
    shortcutName: 'ARK ONE Portal',
    uninstallDisplayName: 'ARK ONE Enterprise Portal',
    deleteAppDataOnUninstall: false,
  },
  publish: [{ provider: 'generic', url: updateUrl, channel: 'latest' }],
};
