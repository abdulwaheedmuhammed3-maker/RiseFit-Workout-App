import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AlarmClock, Bell, Camera, CheckCircle2, ChevronRight, Footprints, ShieldCheck, Smartphone } from 'lucide-react';
import { NativeAlarm } from './nativeAlarm';

type Props = { onComplete: () => void };
type SetupState = {
  notifications: boolean;
  steps: boolean;
  exactAlarms: boolean;
  fullScreen: boolean;
  sensorAvailable: boolean;
};

const initialState: SetupState = {
  notifications: false,
  steps: false,
  exactAlarms: false,
  fullScreen: false,
  sensorAvailable: true,
};

export default function DeviceSetup({ onComplete }: Props) {
  const [state, setState] = useState<SetupState>(initialState);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (Capacitor.getPlatform() !== 'android') {
      setLoading(false);
      return;
    }
    try {
      const [notificationStatus, alarmStatus, stepStats] = await Promise.all([
        LocalNotifications.checkPermissions(),
        NativeAlarm.getStatus(),
        NativeAlarm.getDailyStepStats(),
      ]);
      setState({
        notifications: notificationStatus.display === 'granted',
        steps: stepStats.permissionGranted,
        exactAlarms: alarmStatus.canScheduleExactAlarms,
        fullScreen: alarmStatus.canUseFullScreenIntent,
        sensorAvailable: stepStats.available,
      });
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'RiseFit could not check Android permissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError('');
    try {
      await action();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'RiseFit could not enable this permission. Please check Android settings and try again.');
    } finally {
      setBusy('');
    }
  };

  const enableNotifications = () => run('notifications', async () => {
    const result = await LocalNotifications.requestPermissions();
    if (result.display !== 'granted') throw new Error('Notifications are needed for alarm alerts and the ongoing step-tracking notification.');
  });

  const enableSteps = () => run('steps', async () => {
    if (!state.notifications) {
      const notificationResult = await LocalNotifications.requestPermissions();
      if (notificationResult.display !== 'granted') throw new Error('Allow notifications first so Android can show the step-tracking service notification.');
    }
    await NativeAlarm.requestStepTrackingPermission();
  });

  const enableExactAlarms = () => run('exact', async () => {
    if (!state.notifications) {
      const result = await LocalNotifications.requestPermissions();
      if (result.display !== 'granted') throw new Error('Allow notifications before setting up alarms.');
    }
    await NativeAlarm.requestExactAlarmAccess();
  });

  const enableFullScreen = () => run('fullscreen', async () => {
    await NativeAlarm.requestFullScreenAccess();
  });

  const isAndroid = Capacitor.getPlatform() === 'android';

  return (
    <main className="device-setup-shell">
      <section className="device-setup-card">
        <span className="eyebrow">RISEFIT · FIRST-TIME SETUP</span>
        <div className="device-setup-mark"><ShieldCheck size={25} /></div>
        <h1>Let's get RiseFit ready.</h1>
        <p className="device-setup-intro">A few Android permissions let RiseFit count your steps in the background and deliver your wake-up alarms. We only ask for access needed by these features.</p>

        {!isAndroid && <div className="device-setup-notice"><Smartphone size={18}/><span>Install RiseFit on an Android phone to enable automatic step tracking and native wake-up alarms. You can still preview the app here.</span></div>}

        {isAndroid && <div className="device-setup-list">
          <article className="device-permission-row">
            <span className="device-permission-icon"><Footprints size={19}/></span>
            <div className="device-permission-copy"><b>Automatic step counting</b><p>Uses your phone's built-in step sensor and Activity Recognition permission. No GPS or location access.</p><small>{loading ? 'Checking access…' : !state.sensorAvailable ? 'Not supported by this phone' : state.steps ? 'Enabled in RiseFit · sensor available' : 'Needed for automatic daily steps'}</small></div>
            <span className={state.steps ? 'device-permission-status done' : 'device-permission-status'}>{state.steps ? <CheckCircle2 size={18}/> : 'Needed'}</span>
            {!state.steps && state.sensorAvailable && <button className="secondary device-permission-action" disabled={loading || !!busy} onClick={enableSteps}>{busy === 'steps' ? 'Enabling…' : 'Enable'}</button>}
          </article>

          <article className="device-permission-row">
            <span className="device-permission-icon"><Bell size={19}/></span>
            <div className="device-permission-copy"><b>Notifications</b><p>Shows alarm alerts and the ongoing notification while your phone counts steps in the background.</p><small>{loading ? 'Checking access…' : state.notifications ? 'Allowed' : 'Needed for reliable background status and alerts'}</small></div>
            <span className={state.notifications ? 'device-permission-status done' : 'device-permission-status'}>{state.notifications ? <CheckCircle2 size={18}/> : 'Needed'}</span>
            {!state.notifications && <button className="secondary device-permission-action" disabled={loading || !!busy} onClick={enableNotifications}>{busy === 'notifications' ? 'Requesting…' : 'Allow'}</button>}
          </article>

          <article className="device-permission-row">
            <span className="device-permission-icon"><AlarmClock size={19}/></span>
            <div className="device-permission-copy"><b>Exact alarms</b><p>Lets RiseFit ring at the time you schedule, rather than at an unpredictable delay.</p><small>{loading ? 'Checking access…' : state.exactAlarms ? 'Allowed' : 'Enable in Android Alarms & reminders settings'}</small></div>
            <span className={state.exactAlarms ? 'device-permission-status done' : 'device-permission-status'}>{state.exactAlarms ? <CheckCircle2 size={18}/> : 'Needed for alarms'}</span>
            {!state.exactAlarms && <button className="secondary device-permission-action" disabled={loading || !!busy} onClick={enableExactAlarms}>{busy === 'exact' ? 'Opening…' : 'Set up'}</button>}
          </article>

          <article className="device-permission-row optional">
            <span className="device-permission-icon"><Camera size={19}/></span>
            <div className="device-permission-copy"><b>Camera for workout verification</b><p>RiseFit asks for camera access only when you start a camera-verified workout. Camera processing stays on your device.</p><small>Not requested during setup</small></div>
            <span className="device-permission-status">Later</span>
          </article>

          <article className="device-permission-row optional">
            <span className="device-permission-icon"><Smartphone size={19}/></span>
            <div className="device-permission-copy"><b>Full-screen alarm display</b><p>Recommended on Android 14+ so an alarm can open over the lock screen. You can still use RiseFit without it.</p><small>{loading ? 'Checking access…' : state.fullScreen ? 'Allowed' : 'Optional special app access'}</small></div>
            <span className={state.fullScreen ? 'device-permission-status done' : 'device-permission-status'}>{state.fullScreen ? <CheckCircle2 size={18}/> : 'Optional'}</span>
            {!state.fullScreen && <button className="secondary device-permission-action" disabled={loading || !!busy} onClick={enableFullScreen}>{busy === 'fullscreen' ? 'Opening…' : 'Set up'}</button>}
          </article>
        </div>}

        {error && <p className="device-setup-error" role="alert">{error}</p>}
        <div className="device-setup-footer">
          <button className="primary full" disabled={loading} onClick={onComplete}>Continue to RiseFit <ChevronRight size={16}/></button>
          <small>You can review these permissions later in Android Settings. RiseFit does not need GPS location, contacts, SMS or microphone access.</small>
        </div>
      </section>
    </main>
  );
}
