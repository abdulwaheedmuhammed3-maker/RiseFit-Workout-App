import { Footprints, RefreshCw, ShieldCheck, Smartphone, TrendingUp, AlertCircle } from 'lucide-react';
import type { DailyStepStats } from './nativeAlarm';

type Props = {
  stats: DailyStepStats | null;
  loading: boolean;
  error?: string;
  onConnect: () => void;
  onRefresh: () => void;
};

function dayLabel(date: string) {
  const parsed = new Date(date + 'T12:00:00');
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function StepCounter({ stats, loading, error, onConnect, onRefresh }: Props) {
  if (loading && !stats) {
    return <section className="panel step-counter-panel"><p className="muted">Reading your phone's daily step count…</p></section>;
  }

  if (!stats?.available) {
    return <section className="panel step-counter-panel">
      <div className="step-counter-heading">
        <div><span className="eyebrow">DAILY ACTIVITY</span><h2>Steps today</h2></div>
        <span className="step-counter-icon"><Footprints size={24}/></span>
      </div>
      <div className="step-counter-unavailable"><AlertCircle size={20}/><span>{stats?.message ?? 'Automatic step reading is not available on this Android device.'}</span></div>
      <p className="muted">RiseFit needs Android Health Connect's daily step data to display an automatic counter.</p>
      {error && <p className="step-counter-error" role="alert">{error}</p>}
    </section>;
  }

  if (!stats.permissionGranted) {
    return <section className="panel step-counter-panel">
      <div className="step-counter-heading">
        <div><span className="eyebrow">AUTOMATIC DAILY TRACKING</span><h2>Your steps, all day</h2></div>
        <span className="step-counter-icon"><Footprints size={24}/></span>
      </div>
      <div className="step-counter-permission">
        <span className="step-counter-permission-icon"><Smartphone size={22}/></span>
        <div><b>Connect your phone's step counter</b><p>Allow RiseFit to read daily steps from Android Health Connect. This is a one-time permission, not a walking session.</p></div>
      </div>
      <button className="primary full step-counter-connect" onClick={onConnect}>Allow automatic step counting</button>
      <p className="muted step-counter-note">After permission is granted, Android counts steps in the background. You do not need to start or stop anything.</p>
      {error && <p className="step-counter-error" role="alert">{error}</p>}
    </section>;
  }

  const days = [...(stats.days ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  return <section className="panel step-counter-panel">
    <div className="step-counter-heading">
      <div><span className="eyebrow">YOUR DAILY ACTIVITY</span><h2>Steps today</h2></div>
      <button type="button" className="step-counter-refresh" onClick={onRefresh} aria-label="Refresh daily steps" disabled={loading}><RefreshCw size={17}/></button>
    </div>
    <div className="step-counter-total">
      <span className="step-counter-total-icon"><Footprints size={27}/></span>
      <strong>{stats.stepsToday.toLocaleString()}</strong>
      <span>steps recorded today</span>
    </div>
    <div className="step-counter-status"><ShieldCheck size={16}/><span>Automatic counting is enabled. Your phone records steps throughout the day, even when RiseFit is closed.</span></div>
    <div className="step-history-heading"><div><span className="eyebrow">RECENT RECORD</span><h3>Daily step history</h3></div><span className="step-history-period">LAST 30 DAYS</span></div>
    {days.length===0 ? <p className="muted">No step records have reached Health Connect yet. The count will appear after your phone records steps.</p> :
      <div className="step-history-list">{days.map(day=><div className="step-history-row" key={day.date}>
        <span>{dayLabel(day.date)}</span>
        <div className="step-history-track"><i style={{width:`${Math.min(100,(day.steps/10000)*100)}%`}}/></div>
        <b>{day.steps.toLocaleString()}</b>
      </div>)}</div>}
    <div className="step-counter-footer"><TrendingUp size={15}/><span>Daily totals are read from Android Health Connect and may refresh about once per minute.</span></div>
    {error && <p className="step-counter-error" role="alert">{error}</p>}
  </section>;
}
