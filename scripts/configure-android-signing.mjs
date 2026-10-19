import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

for (const name of ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS'])
  assert.ok(process.env[name], `${name} must be set`);
assert.ok(existsSync(process.env.ANDROID_KEYSTORE_PATH), 'Signing keystore is missing');
const path = 'apps/mobile/android/app/build.gradle';
let source = readFileSync(path, 'utf8');
assert.ok(source.includes('signingConfigs {'), 'Unexpected Android signing configuration');
const release = /release\s*\{([\s\S]*?)signingConfig signingConfigs\.debug/;
assert.ok(release.test(source), 'Expected generated release signing block was not found');
source = source.replace('signingConfigs {', `signingConfigs {
        rastaRelease {
            storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
        }`);
source = source.replace(release, 'release {$1signingConfig signingConfigs.rastaRelease');
writeFileSync(path, source);
console.log('Release signing configured using environment credentials.');
