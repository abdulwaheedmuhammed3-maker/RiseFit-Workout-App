import { useEffect, useState } from 'react';
import { Activity, Footprints, Play, Square, Timer, ShieldCheck, AlertCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { NativeAlarm, type StepTrackingStatus } from './nativeAlarm';

export type WalkSessionResult = {
  steps: number;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
};

type Props = {
  onSaved: (session: WalkSessionResult) => void;
};

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remaining = safe % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, '0')}m`
    : `${minutes}m ${String(remaining).padStart(2, '0')}s`;
}

export default function Walking({ onSaved }: Props) {
  const [status, setStatus] = useState<StepTrackingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const refresh = async () => {
    try {
      const current = await NativeAlarm.getStepTrackingStatus();
      setStatus(current);
      setError('');
    } catch {
      setError('RiseFit could not read the phone step sensor. Reopen the app and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!status?.tracking) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [status?.tracking]);

  const startWalk = async () => {
    setBusy(true);
    setError('');
    try {
      const current = await NativeAlarm.startStepTracking();
      setStatus(current);
      setNow(Date.now());
      if (!current.tracking) {
        await refresh();
        setError('RiseFit could not start the walking sensor. Check the permission and try again.');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start walking step tracking.');
    } finally {
      setBusy(false);
    }
  };

  const finishWalk = async () => {
    if (!status?.tracking) return;
    setBusy(true);
    setError('');
    try {
      const finished = await NativeAlarm.stopStepTracking();
      const endedAt = Date.now();
      const startedAt = finished.startedAt ?? status.startedAt ?? endedAt;
      onSaved({
        steps: Math.max(0, finished.steps),
        startedAt,
        endedAt,
        durationSeconds: Math.max(0, Math.round((endedAt - startedAt) / 1000)),
      });
      setStatus(finished);
      setNow(endedAt);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not finish and save this walk.');
    } finally {
      setBusy(false);
    }
  };

  const elapsed = status?.startedAt
    ? Math.max(0, Math.floor((now - status.startedAt) / 1000))
    : 0;

  if (Capacitor.getPlatform() !== 'android') {
    return <section className="panel walking-panel">
      <span className="eyebrow">MOVE OUTSIDE</span>
      <h2>Walking tracker</h2>
      <p className="muted">Step counting currently uses the built-in Android motion sensor and is available in the RiseFit Android app.</p>
    </section>;
  }

  if (loading) {
    return <section className="panel walking-panel"><p className="muted">Checking your phone's step sensor…</p></section>;
  }

  return <section className="panel walking-panel">
    <div className="walking-heading">
      <div>
        <span className="eyebrow">MOVE AT YOUR PACE</span>
        <h2>Walking tracker</h2>
        <p className="muted">Track a walk, see your steps live, and save the session to your RiseFit record.</p>
      </div>
      <span className="walking-icon"><Footprints size={24}/></span>
    </div>

    {!status?.sensorAvailable ? <div className="walking-message"><AlertCircle size={18}/><span>This phone does not expose a compatible step-counting sensor, so RiseFit cannot count steps on this device.</span></div> : <>
      <div className="walking-counter">
        <span className="eyebrow">{status.tracking ? 'WALK IN PROGRESS' : 'LAST TRACKED SESSION'}</span>
        <strong>{status.steps.toLocaleString()}</strong>
        <span>steps</span>
      </div>
      <div className="walking-metrics">
        <div><Timer size={16}/><span>{formatDuration(elapsed)}</span><small>Duration</small></div>
        <div><Activity size={16}/><span>{status.sensorType === 'detector' ? 'Live step detector' : 'Step counter'}</span><small>Phone sensor</small></div>
      </div>

      {status.tracking ? <button className="primary full walking-action" onClick={()=>void finishWalk()} disabled={busy}>
        <Square size={16} fill="currentColor"/> {busy ? 'Saving walk…' : 'Finish and save walk'}
      </button> : <button className="primary full walking-action" onClick={()=>void startWalk()} disabled={busy}>
        <Play size={16} fill="currentColor"/> {busy ? 'Starting…' : 'Start walking'}
      </button>}

      {status.tracking && <div className="walking-message"><ShieldCheck size={17}/><span>Step counting continues with the screen off. Keep the RiseFit walking notification active until you finish your walk.</span></div>}
      {!status.tracking && <p className="muted walking-permission-note">RiseFit will ask for physical activity permission the first time you start. Your phone's sensor counts steps; no location access is required.</p>}
    </>}

    {error && <p className="walking-error" role="alert">{error}</p>}
  </section>;
}
