import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [
  packageJsonText,
  capacitor,
  gradle,
  manifest,
  strings,
  filePaths,
  backup,
  extraction,
] = await Promise.all([
  read('package.json'),
  read('capacitor.config.ts'),
  read('android/app/build.gradle'),
  read('android/app/src/main/AndroidManifest.xml'),
  read('android/app/src/main/res/values/strings.xml'),
  read('android/app/src/main/res/xml/file_paths.xml'),
  read('android/app/src/main/res/xml/backup_rules.xml'),
  read('android/app/src/main/res/xml/data_extraction_rules.xml'),
]);

const packageJson = JSON.parse(packageJsonText);
const expectedName = 'ARK ONE Portal';

for (const source of [capacitor, strings]) {
  if (!source.includes(expectedName)) {
    throw new Error(`Android app name must be ${expectedName}.`);
  }
}

if (!gradle.includes("parseText(file('../../package.json').text).version")) {
  throw new Error('Android versionName must derive from package.json.');
}

for (const rule of [
  'minifyEnabled true',
  'shrinkResources true',
  'signingConfig signingConfigs.release',
  'manifestPlaceholders = [usesCleartextTraffic: "false"]',
]) {
  if (!gradle.includes(rule)) {
    throw new Error(`Android release configuration is missing: ${rule}`);
  }
}

for (const secret of [
  'ARK_ANDROID_KEYSTORE_FILE',
  'ARK_ANDROID_KEYSTORE_PASSWORD',
  'ARK_ANDROID_KEY_ALIAS',
  'ARK_ANDROID_KEY_PASSWORD',
]) {
  if (!gradle.includes(secret)) {
    throw new Error(`Android signing input is missing: ${secret}`);
  }
}

if (
  !manifest.includes('android:allowBackup="false"') ||
  !manifest.includes('android:usesCleartextTraffic="${usesCleartextTraffic}"')
) {
  throw new Error('Android backup or cleartext protection is incomplete.');
}

if (
  !backup.includes('<exclude domain="database" path="." />') ||
  !extraction.includes('<device-transfer>')
) {
  throw new Error('Android backup exclusion rules are incomplete.');
}

if (filePaths.includes('<external-path')) {
  throw new Error('Android FileProvider exposes unrestricted external storage.');
}

if (!packageJson.scripts?.['release:android:aab']?.includes('bundleRelease')) {
  throw new Error('Android release bundle command is missing.');
}

console.log(
  `Android release configuration is valid for ${expectedName} ${packageJson.version}.`
);