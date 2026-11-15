import { useEffect, useMemo, useState } from 'react';
import { Award, CalendarCheck, ChevronRight, Dumbbell, Footprints, Flame, Sparkles, Target, Trophy } from 'lucide-react';
import type { DailyStepEntry } from './nativeAlarm';
import type { FitnessGoal } from './Profile';

type Session = { id: string; title: string; kind: 'plan' | 'alarm' | 'exercise'; completedAt: string };
type Goals = { dailySteps: number; weeklyWorkouts: number };
type Props = {
  dailySteps: DailyStepEntry[];
  stepsPermissionGranted: boolean;
  sessions: Session[];
  profileGoal: FitnessGoal;
  lowImpactMode: boolean;
  onLowImpactChange: (enabled: boolean) => void;
  restDayEnabled: boolean;
  onRestDayChange: (enabled: boolean) => void;
  onStartPlan: (planId: string) => void;
};

const STORAGE_KEY = 'risefit-fitness-goals-v1';
const DEFAULT_GOALS: Goals = { dailySteps: 8000, weeklyWorkouts: 3 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)));
const dayKey = (date: Date) => date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
const localDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate());
};
const loadGoals = (): Goals => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GOALS;
    const value: unknown = JSON.parse(raw);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_GOALS;
    const record = value as Record<string, unknown>;
    return {
      dailySteps: typeof record.dailySteps === 'number' && Number.isFinite(record.dailySteps)
        ? clamp(record.dailySteps, 1000, 30000) : DEFAULT_GOALS.dailySteps,
      weeklyWorkouts: typeof record.weeklyWorkouts === 'number' && Number.isFinite(record.weeklyWorkouts)
        ? clamp(record.weeklyWorkouts, 1, 7) : DEFAULT_GOALS.weeklyWorkouts
    };
  } catch {
    return DEFAULT_GOALS;
  }
};

const goalPlans: Record<FitnessGoal, { planId: string; title: string; reason: string }> = {
  'full-body': { planId: 'wake', title: 'Full Body Wake-up', reason: 'A balanced full-body session with controlled strength and cardio movements.' },
  glutes: { planId: 'glutes', title: 'Glutes & Lower Body', reason: 'A lower-body session built around bridges, squats and lunges.' },
  'lower-body': { planId: 'glutes', title: 'Glutes & Lower Body', reason: 'A lower-body session built around bridges, squats and lunges.' },
  core: { planId: 'core', title: 'Core Ignition', reason: 'A core-focused session using planks, sit-ups, dead bugs and bridges.' },
  'upper-body': { planId: 'upper', title: 'Upper Body & Core', reason: 'A controlled session using push-ups and core-stability movements.' }
};
const goalNames: Record<FitnessGoal, string> = {
  'full-body': 'full-body fitness',
  glutes: 'glutes and hips',
  'lower-body': 'lower-body strength',
  core: 'core strength',
  'upper-body': 'upper-body strength'
};

export default function FitnessGoals({ dailySteps, stepsPermissionGranted, sessions, profileGoal, lowImpactMode, onLowImpactChange, restDayEnabled, onRestDayChange, onStartPlan }: Props) {
  const [goals, setGoals] = useState<Goals>(loadGoals);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(goals)); } catch { /* Keep the screen usable if storage is unavailable. */ }
  }, [goals]);

  const data = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = dayKey(today);
    const stepMap = new Map<string, number>();
    for (const item of dailySteps) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(item.date) && Number.isFinite(item.steps)) {
        stepMap.set(item.date, Math.max(0, item.steps));
      }
    }
    const sessionCounts = new Map<string, number>();
    for (const session of sessions) {
      const date = localDate(session.completedAt);
      if (date) {
        const key = dayKey(date);
        sessionCounts.set(key, (sessionCounts.get(key) ?? 0) + 1);
      }
    }
    const activeDays = new Set<string>();
    for (const [key, steps] of stepMap) if (steps > 0) activeDays.add(key);
    for (const key of sessionCounts.keys()) activeDays.add(key);

    let streakCursor = new Date(today);
    if (!activeDays.has(dayKey(streakCursor))) streakCursor.setDate(streakCursor.getDate() - 1);
    let currentStreak = 0;
    while (currentStreak < activeDays.size && activeDays.has(dayKey(streakCursor))) {
      currentStreak += 1;
      streakCursor.setDate(streakCursor.getDate() - 1);
    }

    let longestRecentStreak = 0;
    let runningStreak = 0;
    for (let offset = 29; offset >= 0; offset -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      if (activeDays.has(dayKey(date))) {
        runningStreak += 1;
        longestRecentStreak = Math.max(longestRecentStreak, runningStreak);
      } else {
        runningStreak = 0;
      }
    }

    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const weeklyWorkouts = sessions.filter(session => {
      const date = new Date(session.completedAt);
      return !Number.isNaN(date.getTime()) && date >= monday && date <= new Date();
    }).length;
    const todayWorkouts = sessionCounts.get(todayKey) ?? 0;
    const bestStepDay = dailySteps.reduce<DailyStepEntry | null>((best, item) =>
      Number.isFinite(item.steps) && item.steps > 0 && item.date <= todayKey
        && (!best || item.steps > best.steps) ? item : best, null);
    const bestWorkoutDay = Array.from(sessionCounts.entries()).reduce<{ date: string; count: number } | null>(
      (best, entry) => !best || entry[1] > best.count ? { date: entry[0], count: entry[1] } : best, null
    );
    const recentActiveDays = Array.from({ length: 30 }, (_, offset) => {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      return activeDays.has(dayKey(date));
    }).filter(Boolean).length;
    return {
      todaySteps: stepMap.get(todayKey) ?? 0,
      weeklyWorkouts,
      todayWorkouts,
      currentStreak,
      longestRecentStreak,
      recentActiveDays,
      totalWorkouts: sessions.length,
      bestStepDay,
      bestWorkoutDay,
      hasAnyStepRecord: dailySteps.length > 0
    };
  }, [dailySteps, sessions]);

  const stepProgress = Math.min(100, Math.round((data.todaySteps / goals.dailySteps) * 100));
  const workoutProgress = Math.min(100, Math.round((data.weeklyWorkouts / goals.weeklyWorkouts) * 100));
  const recommendation = lowImpactMode ? { planId: 'low-impact', title: 'Low-impact Strength & Mobility', reason: 'A shorter session using controlled movements without jumping.' } : goalPlans[profileGoal];
  const bothGoalsComplete = stepsPermissionGranted && data.todaySteps >= goals.dailySteps && data.weeklyWorkouts >= goals.weeklyWorkouts;
  const badges = [
    { title: 'First steps', description: 'Recorded movement on your phone', unlocked: dailySteps.some(item => item.steps > 0), icon: Footprints },
    { title: 'First workout', description: 'Complete your first workout', unlocked: data.totalWorkouts >= 1, icon: Dumbbell },
    { title: 'Three workouts', description: 'Log three completed sessions', unlocked: data.totalWorkouts >= 3, icon: CalendarCheck },
    { title: '10K day', description: 'Record 10,000 steps in one day', unlocked: dailySteps.some(item => item.steps >= 10000), icon: Target },
    { title: 'Week of movement', description: 'Stay active seven days in a row', unlocked: data.longestRecentStreak >= 7, icon: Flame },
    { title: '10 sessions', description: 'Complete ten workout sessions', unlocked: data.totalWorkouts >= 10, icon: Trophy }
  ];
  const unlockedBadges = badges.filter(item => item.unlocked).length;

  return (
    <section className="fitness-goals" aria-label="Fitness goals and achievements">
      <div className="fitness-goals-heading">
        <div>
          <span className="stats-eyebrow">YOUR PERSONAL TARGETS</span>
          <h2>Daily goals</h2>
          <p>Targets are saved on this device and can be adjusted any time.</p>
        </div>
        <span className="fitness-goals-mark"><Target size={21} /></span>
      </div>

      <article className="fitness-mode-controls">
        <div>
          <span className="stats-eyebrow">RECOVERY & ACCESSIBILITY</span>
          <h3>Choose how you want to move</h3>
          <p>These settings affect workout suggestions. They do not change alarm challenges or medical advice.</p>
        </div>
        <div className="fitness-mode-row">
          <div><strong>Low-impact mode</strong><small>Suggests a separate plan without jumping, using shorter targets and two rounds.</small></div>
          <button type="button" className={'fitness-mode-switch' + (lowImpactMode ? ' enabled' : '')} aria-pressed={lowImpactMode} onClick={() => onLowImpactChange(!lowImpactMode)}>{lowImpactMode ? 'On' : 'Off'}</button>
        </div>
        <div className="fitness-mode-row">
          <div><strong>Rest day mode</strong><small>Pauses workout prompts for today. This resets automatically tomorrow.</small></div>
          <button type="button" className={'fitness-mode-switch' + (restDayEnabled ? ' enabled' : '')} aria-pressed={restDayEnabled} onClick={() => onRestDayChange(!restDayEnabled)}>{restDayEnabled ? 'On' : 'Off'}</button>
        </div>
      </article>

      <div className="fitness-goal-grid">
        <article className="fitness-goal-card">
          <div className="fitness-goal-title"><span><Footprints size={17} /> Daily steps</span><b>{stepsPermissionGranted ? stepProgress + '%' : '—'}</b></div>
          <strong>{stepsPermissionGranted ? data.todaySteps.toLocaleString() : 'Not connected'}<small>{stepsPermissionGranted ? ' / ' + goals.dailySteps.toLocaleString() + ' steps' : ' · Android step tracking required'}</small></strong>
          <div className="fitness-goal-track"><i style={{ width: stepProgress + '%' }} /></div>
          <div className="fitness-goal-controls">
            <span>{stepsPermissionGranted ? (data.todaySteps >= goals.dailySteps ? 'Daily step goal reached' : (goals.dailySteps - data.todaySteps).toLocaleString() + ' steps to go') : 'Connect your phone step counter from the Steps Today card'}</span>
            <div>
              <button type="button" aria-label="Decrease daily step goal by 500" disabled={goals.dailySteps <= 1000} onClick={() => setGoals(value => ({ ...value, dailySteps: clamp(value.dailySteps - 500, 1000, 30000) }))}>−</button>
              <button type="button" aria-label="Increase daily step goal by 500" disabled={goals.dailySteps >= 30000} onClick={() => setGoals(value => ({ ...value, dailySteps: clamp(value.dailySteps + 500, 1000, 30000) }))}>+</button>
            </div>
          </div>
        </article>

        <article className="fitness-goal-card">
          <div className="fitness-goal-title"><span><Dumbbell size={17} /> Weekly workouts</span><b>{workoutProgress}%</b></div>
          <strong>{data.weeklyWorkouts}<small> / {goals.weeklyWorkouts} completed</small></strong>
          <div className="fitness-goal-track"><i style={{ width: workoutProgress + '%' }} /></div>
          <div className="fitness-goal-controls">
            <span>{data.weeklyWorkouts >= goals.weeklyWorkouts ? 'Weekly workout goal reached' : Math.max(0, goals.weeklyWorkouts - data.weeklyWorkouts) + ' sessions to go'}</span>
            <div>
              <button type="button" aria-label="Decrease weekly workout goal" disabled={goals.weeklyWorkouts <= 1} onClick={() => setGoals(value => ({ ...value, weeklyWorkouts: clamp(value.weeklyWorkouts - 1, 1, 7) }))}>−</button>
              <button type="button" aria-label="Increase weekly workout goal" disabled={goals.weeklyWorkouts >= 7} onClick={() => setGoals(value => ({ ...value, weeklyWorkouts: clamp(value.weeklyWorkouts + 1, 1, 7) }))}>+</button>
            </div>
          </div>
        </article>
      </div>

      <div className="fitness-goals-row">
        <article className="fitness-insight-card">
          <span className="fitness-insight-icon"><Flame size={19} /></span>
          <div><span className="stats-eyebrow">CURRENT ACTIVITY STREAK</span><strong>{data.currentStreak} {data.currentStreak === 1 ? 'day' : 'days'}</strong><small>Any recorded steps or completed workout keeps the streak going.</small></div>
        </article>
        <article className="fitness-insight-card">
          <span className="fitness-insight-icon"><CalendarCheck size={19} /></span>
          <div><span className="stats-eyebrow">ACTIVE DAYS · LAST 30 DAYS</span><strong>{data.recentActiveDays} / 30</strong><small>Longest recent streak: {data.longestRecentStreak} days.</small></div>
        </article>
      </div>

      <article className="fitness-recommendation">
        <div className="fitness-recommendation-top"><span className="fitness-recommendation-icon"><Sparkles size={18} /></span><span className="stats-eyebrow">TODAY’S SUGGESTION</span></div>
        {restDayEnabled ? (
          <>
            <h3>Today is set aside for recovery.</h3>
            <p>Rest day mode pauses workout suggestions for today. Gentle movement is optional. Your scheduled wake-up alarms and automatic step tracking continue normally.</p>
          </>
        ) : bothGoalsComplete ? (
          <>
            <h3>Goals reached. Make recovery count.</h3>
            <p>You have reached your step target and logged a workout today. Gentle movement or rest is a sensible next choice; there is no need to add another hard session.</p>
          </>
        ) : data.todayWorkouts > 0 ? (
          <>
            <h3>You have already trained today.</h3>
            <p>Consider a relaxed walk or recovery. Your saved goal is {goalNames[profileGoal]}; return to its suggested plan on a day you feel ready to train.</p>
          </>
        ) : (
          <>
            <h3>{recommendation.title}</h3>
            <p>{recommendation.reason} Suggested from your saved profile goal: {goalNames[profileGoal]}.</p>
            <button type="button" className="fitness-recommendation-action" onClick={() => onStartPlan(recommendation.planId)}>Start suggested workout <ChevronRight size={15} /></button>
          </>
        )}
      </article>

      <article className="fitness-achievements">
        <div className="fitness-achievements-heading">
          <div><span className="stats-eyebrow">MILESTONES</span><h3>Achievements</h3><p>{unlockedBadges} of {badges.length} badges unlocked</p></div>
          <span className="fitness-goals-mark"><Award size={21} /></span>
        </div>
        <div className="fitness-badge-grid">
          {badges.map(item => {
            const Icon = item.icon;
            return <div className={'fitness-badge' + (item.unlocked ? ' unlocked' : ' locked')} key={item.title}>
              <span><Icon size={21} /></span><div><strong>{item.title}</strong><small>{item.description}</small></div>
              <b>{item.unlocked ? 'UNLOCKED' : 'LOCKED'}</b>
            </div>;
          })}
        </div>
      </article>

      <article className="fitness-records">
        <div className="fitness-achievements-heading">
          <div><span className="stats-eyebrow">YOUR BEST SO FAR</span><h3>Personal records</h3><p>Based on data RiseFit has actually recorded.</p></div>
          <span className="fitness-goals-mark"><Trophy size={21} /></span>
        </div>
        <div className="fitness-record-grid">
          <div><span>Highest recorded day</span><strong>{data.bestStepDay ? data.bestStepDay.steps.toLocaleString() + ' steps' : 'No record yet'}</strong><small>{data.bestStepDay ? new Date(data.bestStepDay.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · available phone history' : 'Enable step tracking to begin recording'}</small></div>
          <div><span>Most workouts in one day</span><strong>{data.bestWorkoutDay ? data.bestWorkoutDay.count + (data.bestWorkoutDay.count === 1 ? ' session' : ' sessions') : 'No record yet'}</strong><small>{data.bestWorkoutDay ? new Date(data.bestWorkoutDay.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Complete a workout to set a record'}</small></div>
        </div>
      </article>
      <p className="fitness-goals-footnote">Streaks and badges use saved phone steps and completed workouts. Step records are limited to the history available from this device; workout history remains local and does not sync to an account.</p>
    </section>
  );
}
