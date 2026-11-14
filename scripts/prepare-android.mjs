import { cp, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

const root = process.cwd();
const generatedAndroid = join(root, 'android');
const nativeRoot = join(root, 'native', 'android', 'app', 'src', 'main');
const sourceJava = join(nativeRoot, 'java', 'com', 'risefit', 'app', 'alarm');
const targetJava = join(generatedAndroid, 'app', 'src', 'main', 'java', 'com', 'risefit', 'app', 'alarm');

async function exists(path) {
  try { await readFile(path); return true; } catch { return false; }
}
if (!(await exists(join(generatedAndroid, 'app', 'src', 'main', 'AndroidManifest.xml')))) {
  throw new Error('Android project not found. Run npx cap add android before preparing native alarm files.');
}

await cp(sourceJava, targetJava, { recursive: true });
const manifestPath = join(generatedAndroid, 'app', 'src', 'main', 'AndroidManifest.xml');
let manifest = await readFile(manifestPath, 'utf8');
const permissions = [
  'android.permission.CAMERA',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.WAKE_LOCK',
  'android.permission.USE_FULL_SCREEN_INTENT',
];
const missingPermissions = permissions
  .filter(permission => !manifest.includes(permission))
  .map(permission => `    <uses-permission android:name="${permission}" />`)
  .join('\n');
if (missingPermissions) manifest = manifest.replace(/<application\b/, `${missingPermissions}\n\n    <application`);

if (!manifest.includes('com.risefit.app.alarm.WakeAlarmService')) {
  const components = `
        <service
            android:name="com.risefit.app.alarm.WakeAlarmService"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback" />
        <receiver
            android:name="com.risefit.app.alarm.WakeAlarmReceiver"
            android:exported="false" />
        <receiver
            android:name="com.risefit.app.alarm.BootAlarmReceiver"
            android:exported="true"
            android:permission="android.permission.RECEIVE_BOOT_COMPLETED">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>
`;
  manifest = manifest.replace(/<application\b[^>]*>/, match => `${match}\n${components}`);
}
await writeFile(manifestPath, manifest);

async function findMainActivity(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const result = await findMainActivity(path);
      if (result) return result;
    } else if (entry.name === 'MainActivity.java') return path;
  }
  return null;
}
const javaRoot = join(generatedAndroid, 'app', 'src', 'main', 'java');
const mainActivityPath = await findMainActivity(javaRoot);
if (!mainActivityPath) throw new Error('Generated Android MainActivity.java was not found.');
let mainActivity = await readFile(mainActivityPath, 'utf8');
if (!mainActivity.includes('NativeAlarmPlugin.class')) {
  mainActivity = mainActivity.replace(
    /import com\.getcapacitor\.BridgeActivity;/,
    'import com.getcapacitor.BridgeActivity;\nimport android.content.Intent;\nimport android.os.Bundle;\nimport com.risefit.app.alarm.NativeAlarmPlugin;'
  );
  mainActivity = mainActivity.replace(
    /public class MainActivity extends BridgeActivity\s*\{/,
    `public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }`
  );
}
if (!mainActivity.includes('setIntent(intent)')) {
  mainActivity = mainActivity.replace(
    /\}\s*$/,
    `    @Override
    public void onNewIntent(Intent intent) {
        setIntent(intent);
        super.onNewIntent(intent);
    }
}
`
  );
}
await writeFile(mainActivityPath, mainActivity);
console.log(`Prepared RiseFit native alarm in ${relative(root, dirname(mainActivityPath))}`);
