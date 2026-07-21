# ARK ONE desktop and Android releases

Version `1.0.16` establishes the permanent update identity:

- Windows application ID: `com.arktechnologiesgroup.arkone`
- Windows package: signed NSIS installer plus `latest.yml` and block map
- Android application ID: `com.arktechnologiesgroup.arkone`
- Android version code: `10016`
- Android version name: `1.0.16`

Never change either application ID or either signing identity after the first
live release. Future versions must increase `package.json`/versionName and use a
higher Android versionCode. Every Android update must be signed with the same
keystore. Keep the keystore and passwords outside the repository with at least
two encrypted backups.

## Windows

Set `ARK_WINDOWS_UPDATE_URL` to an HTTPS directory and provide the standard
electron-builder `CSC_LINK` and `CSC_KEY_PASSWORD` signing variables. Run:

    npm run release:windows

Upload the generated EXE, `latest.yml`, and block map from `dist-electron` to
the exact update directory. The installed application checks on startup and
every six hours, downloads a valid update, then offers a safe restart.

## Android

Create the release keystore once. Never generate a replacement for later
updates. Set all `ARK_ANDROID_*` signing/version variables and run either:

    npm run release:android:apk
    npm run release:android:aab

Use APK for controlled direct distribution or AAB for Google Play. A future
update must keep the same application ID/signing certificate and increase the
versionCode. The portal release manifest displays an in-app Android update
notice and links to the signed APK.

## Shared release manifest

Publish a JSON file shaped like `docs/release-manifest.example.json` over HTTPS.
Set `VITE_RELEASE_MANIFEST_URL` before building the web, Windows and Android
clients. The Welcome buttons and Android update notice read this same file.

Never place certificate passwords, keystores, Supabase service keys or signing
files in source control or in the public downloads directory.
