# RiseFit — Smart Fitness, Workout Alarm & Live Exercise Verification

RiseFit is an Android-first fitness app built around automatic daily activity tracking, a wake-up workout alarm, and a separate camera-verified workout library.

## Features in the current codebase

- **Home dashboard:** daily steps read directly from the phone's hardware step counter after one-time Activity Recognition permission; a foreground service keeps counting when RiseFit is closed.
- **Workout library:** guided workout plans and individual exercise sessions.
- **Live exercise verification:** MediaPipe Pose Landmarker analyses the live camera feed on-device and counts supported movements or verified hold time.
- **Wake-up alarms:** native Android exact-alarm scheduling, a foreground ringing service, and alarm recovery after device reboot.
- **Alarm challenge:** the first configured exercise is required to stop the ringing alarm; additional configured exercises are optional follow-on workouts.
- **Progress:** completed sessions and profile data are stored locally on the device; the calendar and statistics read the local workout history and available step history.

## Android requirements and behaviour

- Native alarms require the Android app. The browser build is a UI/development preview and cannot provide Android alarm behaviour.
- Automatic on-device step counting requires a phone with a hardware step-counter sensor. Android 10+ requires Activity Recognition permission. RiseFit uses a health foreground service with an ongoing notification to keep the sensor registered while the app is closed; daily totals stay in app-private storage.
- The native sensor reports cumulative step totals while RiseFit's background service is registered. The dashboard refreshes its local daily totals when RiseFit is open.
- Camera verification requires camera permission and a supported Android WebView. The video is processed locally; RiseFit does not upload or store the camera feed.
- Alarm delivery, full-screen presentation, DND behaviour, and camera detection must still be verified on physical Android devices across supported OS versions and manufacturer battery-management settings.

## Current limitations

- Profile, alarm settings, and completed workout history are device-local; there is no account or cloud sync in this version.
- Session duration and weight-based training volume are not measured yet.
- A successful CI build proves compilation, not that a device's camera, hardware step sensor, background service, notifications, or alarm behaviour works on every phone.

## Technology

- React, TypeScript, Vite
- Capacitor Android
- Android native AlarmManager, health foreground service, and hardware SensorManager step counter
- MediaPipe Tasks Vision Pose Landmarker
- Lucide icons

## Run locally

```bash
npm install
npm run dev
```

Build the web app:

```bash
npm run build
```

## Android build

The GitHub Actions workflow generates the Capacitor Android project, copies the native alarm integration, builds a debug APK, and uploads it as a workflow artifact.

A permanently signed release APK is built only when the four RISEFIT_* signing secrets documented in [docs/ANDROID_SIGNING.md](docs/ANDROID_SIGNING.md) are configured in the repository.
