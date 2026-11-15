import type { ReactNode } from 'react';
import { AlarmClock, Bell, CheckCircle2, Footprints, RefreshCw, ShieldAlert, Smartphone } from 'lucide-react';
import type { NativeAlarmStatus } from './nativeAlarm';

type Props = {
  alarmStatus: NativeAlarmStatus | null;
  notificationAccess: boolean | null;
  stepsAvailable: boolean;
  stepsEnabled: boolean;
  stepsStatusLoaded: boolean;
  onRefresh: () => void;
  onReviewSetup: () => void;
};

type CheckRowProps = { label: string; detail: string; state: 'ready' | 'warning' | 'optional' | 'checking'; icon: ReactNode };

function CheckRow({ label, detail, state, icon }: CheckRowProps) {
  return (
    <div className="alarm-check-row">
      <span className="alarm-check-icon">{icon}</span>
      <span className="alarm-check-copy"><b>{label}</b><small>{detail}</small></span>
      <span className={`alarm-check-state ${state}`}>
        {state === 'ready' ? <CheckCircle2 size={15}/> : state === 'warning' ? <ShieldAlert size={15}/> : state === 'checking' ? 'Checking' : 'Optional'}
      </span>
    </div>
  );
}

export default function AlarmReliability({ alarmStatus, notificationAccess, stepsAvailable, stepsEnabled, stepsStatusLoaded, onRefresh, onReviewSetup }: Props) {
  const androidReady = Boolean(alarmStatus?.canScheduleExactAlarms && notificationAccess);
  const requiredChecksReady = androidReady && (!stepsAvailable || stepsEnabled);
  const checksHaveLoaded = Boolean(alarmStatus) && notificationAccess !== null && stepsStatusLoaded;
  // Full-screen presentation is optional; hide the centre once every required
  // permission is ready, and let it reappear automatically if access is revoked.
  if (checksHaveLoaded && requiredChecksReady) return null;
  return (
    <section className="alarm-reliability" aria-label="Alarm reliability centre">
      <div className="alarm-reliability-heading">
        <div><span className="eyebrow">DEVICE CHECKS</span><h3>Alarm reliability centre</h3><p>Review the Android settings RiseFit depends on.</p></div>
        <span className={`alarm-reliability-badge ${androidReady ? 'ready' : 'attention'}`}>{androidReady ? 'Core checks ready' : 'Check setup'}</span>
      </div>
      <div className="alarm-check-list">
        <CheckRow label="Exact alarm access" detail={alarmStatus ? alarmStatus.canScheduleExactAlarms ? 'Android can schedule alarms at the chosen time.' : 'Allow RiseFit under Alarms & reminders.' : 'Available on your Android phone.'} state={!alarmStatus ? 'checking' : alarmStatus.canScheduleExactAlarms ? 'ready' : 'warning'} icon={<AlarmClock size={17}/>} />
        <CheckRow label="Notifications" detail={notificationAccess === null ? 'Checking notification permission.' : notificationAccess ? 'Alarm alerts and service notifications are allowed.' : 'Allow notifications for alarm alerts and status.'} state={notificationAccess === null ? 'checking' : notificationAccess ? 'ready' : 'warning'} icon={<Bell size={17}/>} />
        <CheckRow label="Full-screen alarm" detail={alarmStatus ? alarmStatus.canUseFullScreenIntent ? 'Lock-screen alarm presentation is permitted.' : 'Optional: allow full-screen display for a more visible alarm.' : 'Android special access check.'} state={!alarmStatus ? 'checking' : alarmStatus.canUseFullScreenIntent ? 'ready' : 'optional'} icon={<Smartphone size={17}/>} />
        <CheckRow label="Automatic step tracking" detail={!stepsAvailable ? 'This phone may not expose a hardware step counter.' : stepsEnabled ? 'Step tracking permission and service setting are enabled.' : 'Enable automatic step tracking to count steps in the background.'} state={!stepsAvailable ? 'optional' : stepsEnabled ? 'ready' : 'warning'} icon={<Footprints size={17}/>} />
      </div>
      <div className="alarm-reliability-actions">
        <button type="button" className="secondary" onClick={onRefresh}><RefreshCw size={14}/> Check again</button>
        <button type="button" className="secondary" onClick={onReviewSetup}>Open setup</button>
      </div>
      <p className="alarm-reliability-note">These checks confirm permissions and configuration, not guaranteed delivery. Test an alarm with your phone locked and review battery restrictions on your device.</p>
    </section>
  );
}
