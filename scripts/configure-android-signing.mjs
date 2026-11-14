import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const gradlePath = join(root, 'android', 'app', 'build.gradle');
const keystorePath = process.env.RISEFIT_KEYSTORE_PATH;
const requiredEnv = [
  'RISEFIT_KEYSTORE_PATH',
  'RISEFIT_KEYSTORE_PASSWORD',
  'RISEFIT_KEY_ALIAS',
  'RISEFIT_KEY_PASSWORD',
];
for (const name of requiredEnv) {
  if (!process.env[name]) throw new Error('Missing required signing environment variable: ' + name);
}
try {
  const details = await stat(keystorePath);
  if (!details.isFile() || details.size < 1024) throw new Error('Keystore file is missing or unexpectedly small.');
} catch {
  throw new Error('The RiseFit release keystore could not be found at RISEFIT_KEYSTORE_PATH.');
}

let gradle = await readFile(gradlePath, 'utf8');
if (!/android\s*\{/.test(gradle)) throw new Error('Could not find the Android Gradle configuration.');
if (!/buildTypes\s*\{\s*release\s*\{/.test(gradle)) {
  throw new Error('Could not find the generated Android release build type.');
}
if (!gradle.includes('signingConfigs.release')) {
  const signing = [
    '    signingConfigs {',
    '        release {',
    "            storeFile file(System.getenv('RISEFIT_KEYSTORE_PATH'))",
    "            storePassword System.getenv('RISEFIT_KEYSTORE_PASSWORD')",
    "            keyAlias System.getenv('RISEFIT_KEY_ALIAS')",
    "            keyPassword System.getenv('RISEFIT_KEY_PASSWORD')",
    '        }',
    '    }',
    ''
  ].join('\n');
  gradle = gradle.replace(/(android\s*\{)/, '$1\n' + signing);
  gradle = gradle.replace(
    /(buildTypes\s*\{\s*release\s*\{)/,
    '$1\n            signingConfig signingConfigs.release'
  );
}

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const version = String(packageJson.version || '0.2.0');
const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
if (!match) throw new Error('package.json version must be semantic (x.y.z); got ' + version);
const [, major, minor, patch] = match;
const versionCode = Number(major) * 1_000_000 + Number(minor) * 1_000 + Number(patch) + 1;
if (!Number.isSafeInteger(versionCode) || versionCode > 2_100_000_000) {
  throw new Error('Calculated Android versionCode is outside the supported range.');
}
const defaultConfig = gradle.match(/defaultConfig\s*\{[\s\S]*?\n\s*\}/);
if (!defaultConfig) throw new Error('Could not locate Android defaultConfig.');
let configured = defaultConfig[0];
if (/versionCode\s+[^\r\n]+/.test(configured)) {
  configured = configured.replace(/versionCode\s+[^\r\n]+/, 'versionCode ' + versionCode);
} else {
  configured = configured.replace(/(defaultConfig\s*\{)/, '$1\n        versionCode ' + versionCode);
}
if (/versionName\s+[^\r\n]+/.test(configured)) {
  configured = configured.replace(/versionName\s+[^\r\n]+/, 'versionName "' + version + '"');
} else {
  configured = configured.replace(/(defaultConfig\s*\{)/, '$1\n        versionName "' + version + '"');
}
gradle = gradle.replace(defaultConfig[0], configured);

await writeFile(gradlePath, gradle);
console.log('Configured signed RiseFit release (version ' + version + ', versionCode ' + versionCode + ').');
