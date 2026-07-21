# Electron Desktop Packaging

## Development

```bash
npm run electron:dev
```

This starts Vite on the loopback interface, waits until it is ready and then
opens Electron. DevTools are available only in this explicit development mode.
Closing Electron also stops the development server.

## Test the built desktop application

```bash
npm run electron
```

This creates a production renderer and loads `dist/index.html` directly. It does
not expect a Vite server and it does not enable DevTools.

## Build the Windows installer

Run on Windows or in a trusted Windows CI runner:

```bash
npm ci
npm run validate:electron
npm run dist:win
```

The NSIS installer is written to `dist-electron/`. It is a per-user, assisted
installer with optional installation location, desktop shortcut and Start menu
shortcut. The artifact name includes the application version and architecture.

Use `npm run dist:win:dir` to create an unpacked Windows application for smoke
testing without generating the installer.

## Release checklist

1. Update the version in `package.json` and lock file.
2. Complete the web, local Supabase and browser-test release gates.
3. Build on a clean Windows runner.
4. Sign the executable and installer with the organisation's code-signing
   certificate. Never commit certificate files or passwords.
5. Test installation, launch, OAuth external-browser handling, report printing,
   upgrade and uninstall on a non-production Windows machine.
6. Record the installer checksum with the release notes.

Production windows use renderer sandboxing, context isolation and no Node.js
integration. External HTTP(S) and email links open in the operating-system
browser instead of navigating the ERP window.
