# Android Release

The Android application ID remains
`com.arktechnologiesgroup.arkone`, while the user-facing application name is
**ARK ONE Portal** across Capacitor and Android resources.

## Data protection

Application backup and device-transfer extraction are disabled. Explicit backup
rules also exclude files, databases, preferences and external app data. Cleartext
HTTP traffic is prohibited. The sharing provider exposes only app cache, the
private `shared/` directory and the app-specific Pictures directory.

## Versioning

`versionName` is read from `package.json`. The default numeric `versionCode` is:

```text
major × 1,000,000 + minor × 1,000 + patch
```

Version `1.0.15` therefore produces version code `1000015`. Every Play upload
must use a higher version. For an exceptional Play build, override with Gradle
properties `ARK_ANDROID_VERSION_NAME` and `ARK_ANDROID_VERSION_CODE`.

## Release signing

Create and protect an organisation-owned upload keystore outside this repository.
Supply all four settings as environment variables or private Gradle properties:

```text
ARK_RELEASE_STORE_FILE=/absolute/path/to/ark-one-upload.jks
ARK_RELEASE_STORE_PASSWORD=...
ARK_RELEASE_KEY_ALIAS=...
ARK_RELEASE_KEY_PASSWORD=...
```

The release task fails when signing is missing or partially configured. Keystores,
private keys and passwords must never be committed. Store an encrypted backup and
recovery instructions under dual organisational control.

## Build and verify

```bash
npm ci
npm run validate:android
npm run android:release
```

The command builds the production web application, synchronises Capacitor and
creates a signed, minified Android App Bundle. The bundle is under
`android/app/build/outputs/bundle/release/`.

Before Play Console upload:

1. Run local Supabase, unit and browser release gates.
2. Test a debug build on a non-production Android device.
3. Install and test the release build, including login, camera/evidence sharing,
   geolocation, signed downloads and logout cleanup.
4. Inspect the signed artifact with `apksigner verify --verbose` or Play Console.
5. Confirm mapping files are archived for crash de-obfuscation.
6. Use staged rollout and monitor authentication, crashes and API failures before
   expanding availability.
