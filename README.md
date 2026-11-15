# RiseFit — Smart Fitness, Workout Alarm & Live Exercise Verification

RiseFit is an Android-first fitness app built around automatic daily activity tracking, a wake-up workout alarm, and a separate camera-verified workout library.

## Features in the current codebase

- **Home dashboard:** daily steps read directly from the phone's hardware step counter after one-time Activity Recognition permission; a foreground service keeps counting when RiseFit is closed.
- **Workout library:** guided workout plans and individual exercise sessions.
- **Live exercise verification:** MediaPipe Pose Landmarker analyses the live camera feed on-device and counts supported movements or verified hold time.
- **Guided workout coaching:** step-by-step illustrated movement guides, live pose-landmark movement cues, and optional spoken coaching when Android WebView speech synthesis is available.
- **Recovery timer:** a 30-second rest break between workout rounds and exercises, with pause, +15 seconds, and skip controls.
- **Wake-up alarms:** native Android exact-alarm scheduling, a foreground ringing service, and alarm recovery after device reboot.
- **Alarm challenge:** the first configured exercise is required to stop the ringing alarm; additional configured exercises are optional follow-on workouts.
- **Progress:** completed sessions and profile data are stored locally on the device; the calendar and statistics read the local workout history and available step history.
- **Personal goals:** adjustable daily step and weekly workout targets, activity streaks, milestone badges, personal records, and a goal-aligned workout suggestion based on the saved fitness goal.
- **Recovery and accessibility:** a daily rest-day setting suppresses workout suggestions until the next day; low-impact mode recommends a separate no-jump strength and mobility plan with shorter targets.
- **Privacy and backup:** export/import of the local profile, fitness targets, workout history and preferences; controls to delete saved workout data and profile information.
- **Offline workout access:** workout plans, illustrated guides, MediaPipe runtime files and the pose model are bundled into the installed app for local use without a runtime internet connection.
- **Device health monitor:** reads Android battery percentage/charging state, power-saver mode, standard battery-optimisation exemption, hardware step-sensor details, Activity Recognition permission and the last recorded sensor update.

## Android requirements and behaviour

- Native alarms require the Android app. The browser build is a UI/development preview and cannot provide Android alarm behaviour.
- Automatic on-device step counting requires a phone with a hardware step-counter sensor. Android 10+ requires Activity Recognition permission. RiseFit uses a health foreground service with an ongoing notification to keep the sensor registered while the app is closed; daily totals stay in app-private storage.
- The native sensor reports a cumulative total since device boot. RiseFit stores the last raw value and adds only new deltas while tracking is registered. On first registration or after a reboot, an existing cumulative total is imported only when the device booted on the same local date; otherwise RiseFit starts from a safe baseline rather than assigning steps from earlier dates to today. The dashboard refreshes its local daily totals when RiseFit is open.
- The device health monitor refreshes when opened, when the app resumes and when manually requested. Its last sensor update is the last hardware step-counter event; a quiet period without steps does not prove the service has stopped. Standard battery-optimisation status may not cover all manufacturer-specific power controls.
- Camera verification requires camera permission and a supported Android WebView. The video is processed locally; RiseFit does not upload or store the camera feed.
- Alarm delivery, full-screen presentation, DND behaviour, and camera detection must still be verified on physical Android devices across supported OS versions and manufacturer battery-management settings.

## Current limitations

- Profile, alarm settings, fitness targets, achievements, and completed workout history are device-local; there is no account or cloud sync in this version.
- Daily step goal progress and step-based badges/records require Android step-counter access. Step records and activity streaks are limited by the step history available on the device.
- Session duration and weight-based training volume are not measured yet.
- A successful CI build proves compilation, not that a device's camera, hardware step sensor, background service, notifications, or alarm behaviour works on every phone.

- Low-impact mode is an introductory lower-impact option, not a personalised rehabilitation plan or a guarantee that every movement is suitable for every user. Use the displayed modifications and stop if a movement causes pain.

- Backup restore does not reschedule native Android alarms, restore permissions or write native step-counter history back to the phone. Step history is included in exports for reference only.
- Offline camera verification still requires camera permission and a compatible Android WebView; device speech output depends on the available speech engine.

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
