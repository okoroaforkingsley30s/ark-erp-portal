import fs from 'node:fs';
import path from 'node:path';

const target = process.argv[2] || 'all';
const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const androidGradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
const problems = [];

if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) problems.push('package.json version must use MAJOR.MINOR.PATCH.');
if (!androidGradle.includes(`'${pkg.version}'`)) problems.push('Android versionName default must match package.json.');
if (!fs.existsSync(path.join(root, 'electron/icon.ico'))) problems.push('electron/icon.ico is missing.');

const requireHttps = (name) => {
  const value = String(process.env[name] || '');
  if (!value.startsWith('https://')) problems.push(`${name} must be an HTTPS URL.`);
};

const requireNames = (names) => names.forEach((name) => {
  if (!String(process.env[name] || '').trim()) problems.push(`${name} is required.`);
});

if (target === 'windows') {
  requireHttps('ARK_WINDOWS_UPDATE_URL');
  requireNames(['CSC_LINK', 'CSC_KEY_PASSWORD']);
}

if (target === 'android') {
  requireNames([
    'ARK_ANDROID_VERSION_CODE', 'ARK_ANDROID_VERSION_NAME',
    'ARK_ANDROID_KEYSTORE_FILE', 'ARK_ANDROID_KEYSTORE_PASSWORD',
    'ARK_ANDROID_KEY_ALIAS', 'ARK_ANDROID_KEY_PASSWORD',
  ]);
  if (process.env.ARK_ANDROID_VERSION_NAME && process.env.ARK_ANDROID_VERSION_NAME !== pkg.version) {
    problems.push('ARK_ANDROID_VERSION_NAME must equal package.json version.');
  }
  if (process.env.ARK_ANDROID_KEYSTORE_FILE && !fs.existsSync(process.env.ARK_ANDROID_KEYSTORE_FILE)) {
    problems.push('ARK_ANDROID_KEYSTORE_FILE does not exist.');
  }
}

if (problems.length) {
  console.error(`Release validation failed (${problems.length} issue${problems.length === 1 ? '' : 's'}):`);
  problems.forEach((problem) => console.error(`- ${problem}`));
  process.exit(1);
}

console.log(`ARK ONE ${pkg.version} ${target} release configuration is valid.`);
