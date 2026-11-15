import { useRef, useState } from 'react';
import { Activity, AlertTriangle, Download, FileCheck2, FileUp, LockKeyhole, ShieldCheck, Trash2, WifiOff } from 'lucide-react';
import type { DailyStepEntry } from './nativeAlarm';
import { getLocalDateKey, isValidDateOnly, type RiseFitProfile } from './Profile';

type Session = { id: string; title: string; kind: 'plan' | 'alarm' | 'exercise'; completedAt: string };
type Props = {
  profile: RiseFitProfile;
  sessions: Session[];
  dailySteps: DailyStepEntry[];
  lowImpactMode: boolean;
  restDayEnabled: boolean;
  onClearWorkoutHistory: () => void;
  onDeleteProfileAndTrainingData: () => void;
};

type BackupGoals = { dailySteps: number; weeklyWorkouts: number };
type BackupPayload = {
  app: 'RiseFit';
  version: 1;
  exportedAt: string;
  data: {
    profile: RiseFitProfile;
    fitnessGoals: BackupGoals;
    completedSessions: Session[];
    dailyStepHistory: DailyStepEntry[];
    lowImpactMode: boolean;
    restDayEnabled: boolean;
  };
};

const PROFILE_KEY = 'risefit-profile-v1';
const HISTORY_KEY = 'risefit-workout-history-v1';
const GOALS_KEY = 'risefit-fitness-goals-v1';
const LOW_IMPACT_KEY = 'risefit-low-impact-mode-v1';
const REST_DAY_KEY = 'risefit-rest-day-v1';

const todayKey = () => {
  const date = new Date();
  return String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
};

const safeGoals = (): BackupGoals => {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    if (!raw) return { dailySteps: 8000, weeklyWorkouts: 3 };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { dailySteps: 8000, weeklyWorkouts: 3 };
    const record = parsed as Record<string, unknown>;
    return {
      dailySteps: typeof record.dailySteps === 'number' && Number.isFinite(record.dailySteps)
        ? Math.max(1000, Math.min(30000, Math.round(record.dailySteps))) : 8000,
      weeklyWorkouts: typeof record.weeklyWorkouts === 'number' && Number.isFinite(record.weeklyWorkouts)
        ? Math.max(1, Math.min(7, Math.round(record.weeklyWorkouts))) : 3
    };
  } catch {
    return { dailySteps: 8000, weeklyWorkouts: 3 };
  }
};

const validProfile = (value: unknown): value is RiseFitProfile => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const profile = value as Record<string, unknown>;
  const validDate = isValidDateOnly(profile.dateOfBirth)
    && profile.dateOfBirth <= getLocalDateKey();
  return typeof profile.fullName === 'string' && !!profile.fullName.trim()
    && profile.fullName.length <= 80 && validDate
    && ['Beginner', 'Intermediate', 'Expert'].includes(String(profile.level))
    && ['glutes', 'lower-body', 'core', 'full-body', 'upper-body'].includes(String(profile.goal));
};

const validSession = (value: unknown): value is Session => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const session = value as Record<string, unknown>;
  return typeof session.id === 'string' && session.id.length <= 160
    && typeof session.title === 'string' && session.title.length <= 200
    && ['plan', 'alarm', 'exercise'].includes(String(session.kind))
    && typeof session.completedAt === 'string' && !Number.isNaN(Date.parse(session.completedAt));
};

const validStepEntry = (value: unknown): value is DailyStepEntry => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
    && typeof entry.steps === 'number' && Number.isFinite(entry.steps)
    && entry.steps >= 0 && entry.steps <= 300000;
};

const validateGoals = (value: unknown): BackupGoals => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The backup is missing your fitness goals.');
  const goals = value as Record<string, unknown>;
  if (typeof goals.dailySteps !== 'number' || !Number.isFinite(goals.dailySteps)
    || typeof goals.weeklyWorkouts !== 'number' || !Number.isFinite(goals.weeklyWorkouts)) {
    throw new Error('The backup contains invalid fitness targets.');
  }
  return {
    dailySteps: Math.max(1000, Math.min(30000, Math.round(goals.dailySteps))),
    weeklyWorkouts: Math.max(1, Math.min(7, Math.round(goals.weeklyWorkouts)))
  };
};

export default function DataPrivacy({
  profile, sessions, dailySteps, lowImpactMode, restDayEnabled,
  onClearWorkoutHistory, onDeleteProfileAndTrainingData
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const makeBackup = (): BackupPayload => ({
    app: 'RiseFit',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      profile,
      fitnessGoals: safeGoals(),
      completedSessions: sessions,
      dailyStepHistory: dailySteps,
      lowImpactMode,
      restDayEnabled
    }
  });

  const exportBackup = () => {
    setError('');
    setMessage('');
    try {
      const payload = JSON.stringify(makeBackup(), null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'risefit-backup-' + todayKey() + '.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Your RiseFit backup was prepared on this device. Keep the downloaded file somewhere safe.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'RiseFit could not prepare the backup.');
    }
  };

  const restoreBackup = async (file?: File) => {
    if (!file) return;
    setError('');
    setMessage('');
    if (file.size > 2 * 1024 * 1024) {
      setError('This backup is larger than 2 MB and cannot be imported.');
      return;
    }
    if (!window.confirm('Restore this backup? It will replace the current profile, fitness targets, workout history and training preferences on this device. Alarm schedules, Android permissions and native step-counter history are not changed.')) {
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setBusy(true);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('This file is not a valid RiseFit backup.');
      const outer = parsed as Record<string, unknown>;
      if (outer.app !== 'RiseFit' || outer.version !== 1 || !outer.data || typeof outer.data !== 'object' || Array.isArray(outer.data)) {
        throw new Error('This backup is not a supported RiseFit backup file.');
      }
      const data = outer.data as Record<string, unknown>;
      if (!validProfile(data.profile)) throw new Error('The backup profile is missing or invalid.');
      const goals = validateGoals(data.fitnessGoals);
      if (!Array.isArray(data.completedSessions) || data.completedSessions.length > 5000
        || !data.completedSessions.every(validSession)) {
        throw new Error('The backup contains invalid workout history.');
      }
      if (!Array.isArray(data.dailyStepHistory) || data.dailyStepHistory.length > 366
        || !data.dailyStepHistory.every(validStepEntry)) {
        throw new Error('The backup contains invalid step history.');
      }
      if (typeof data.lowImpactMode !== 'boolean' || typeof data.restDayEnabled !== 'boolean') {
        throw new Error('The backup contains invalid training preferences.');
      }

      localStorage.setItem(PROFILE_KEY, JSON.stringify(data.profile));
      localStorage.setItem(HISTORY_KEY, JSON.stringify(data.completedSessions));
      localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
      localStorage.setItem(LOW_IMPACT_KEY, data.lowImpactMode ? 'on' : 'off');
      if (data.restDayEnabled) localStorage.setItem(REST_DAY_KEY, todayKey());
      else localStorage.removeItem(REST_DAY_KEY);
      setMessage('Backup restored. RiseFit will reload with your saved profile and workout data.');
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'RiseFit could not restore this backup.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const deleteHistory = () => {
    if (!window.confirm('Delete all completed workout history saved by RiseFit on this device? This cannot be undone. Export a backup first if you may need these records.')) return;
    onClearWorkoutHistory();
    setMessage('Completed workout history deleted from this device.');
    setError('');
  };

  const deletePersonalData = () => {
    if (!window.confirm('Delete your saved profile, completed workouts, fitness targets and training preferences from this device? Alarm schedules, Android permissions and native step-counter history will remain unchanged. This cannot be undone.')) return;
    onDeleteProfileAndTrainingData();
  };

  return (
    <section className="data-privacy">
      <div className="data-privacy-heading">
        <div><span className="eyebrow">YOUR DATA · YOUR CHOICE</span><h2>Privacy & backup</h2><p>Manage the information RiseFit keeps on this phone.</p></div>
        <span className="data-privacy-mark"><LockKeyhole size={22}/></span>
      </div>

      <div className="privacy-facts">
        <article><ShieldCheck size={18}/><div><strong>Stored on this device</strong><small>Your profile, fitness targets and completed workout history use local app storage. This version has no RiseFit account or cloud sync.</small></div></article>
        <article><Activity size={18}/><div><strong>Camera stays local</strong><small>Camera frames are analysed on-device for exercise verification; RiseFit does not upload or save the video feed.</small></div></article>
        <article><WifiOff size={18}/><div><strong>Workout access offline</strong><small>Workout plans, movement guides, MediaPipe runtime files and the pose model are included in the app build. Once installed, workout guidance and on-device pose analysis are designed to work without an internet connection.</small></div></article>
      </div>

      <div className="privacy-actions">
        <button type="button" className="primary" onClick={exportBackup}><Download size={16}/> Export backup</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => fileRef.current?.click()}><FileUp size={16}/> Restore backup</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden disabled={busy} onChange={event => void restoreBackup(event.target.files?.[0])}/>
      </div>

      {message && <p className="data-privacy-message" role="status"><FileCheck2 size={16}/>{message}</p>}
      {error && <p className="data-privacy-error" role="alert"><AlertTriangle size={16}/>{error}</p>}

      <div className="privacy-scope">
        <span className="eyebrow">BACKUP SCOPE</span>
        <p>Export includes your profile, fitness targets, completed workouts, the step history currently available to RiseFit, and training preferences. Restore brings back the profile, targets, workouts and preferences.</p>
        <small>Alarm schedules, Android permissions and native step-counter history are not restored. Step history is included in the exported file for your records only.</small>
      </div>

      <div className="privacy-danger-zone">
        <div><span className="eyebrow">DATA REMOVAL</span><h3>Delete local data</h3><p>Removing app data cannot be undone. Keep an export first if you need a copy.</p></div>
        <button type="button" className="secondary privacy-delete-button" onClick={deleteHistory}><Trash2 size={15}/> Delete workout history</button>
        <button type="button" className="secondary privacy-delete-button danger" onClick={deletePersonalData}><AlertTriangle size={15}/> Delete profile & training data</button>
      </div>
      <p className="data-privacy-footnote">RiseFit cannot erase Android permissions, alarm schedules or native sensor records from this screen. Manage those separately in Android settings or the alarm controls.</p>
    </section>
  );
}
