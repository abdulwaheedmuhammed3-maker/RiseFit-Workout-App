import { useMemo, type CSSProperties } from 'react';
import { Award, Footprints, TrendingUp, CalendarDays, Flame } from 'lucide-react';
import type { DailyStepEntry } from './nativeAlarm';

type Session = { id: string; title: string; kind: 'plan' | 'alarm' | 'exercise'; completedAt: string };
type Props = { dailySteps: DailyStepEntry[]; sessions: Session[] };

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export default function ProgressInsights({ dailySteps, sessions }: Props) {
  const data = useMemo(() => {
    const today = startOfDay(new Date());
    const stepMap = new Map(dailySteps.map(item => [item.date, Math.max(0, item.steps)]));
    const week = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6-index));
      return { date, key: dayKey(date), steps: stepMap.get(dayKey(date)) ?? 0 };
    });
    const weekSteps = week.reduce((sum, item) => sum + item.steps, 0);
    const activeDays = week.filter(item => item.steps > 0 || sessions.some(session => dayKey(new Date(session.completedAt)) === item.key)).length;
    const weekSessions = sessions.filter(session => {
      const date = new Date(session.completedAt);
      return date >= week[0].date && date <= new Date(today.getTime()+86400000);
    });
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const previousStart = new Date(today.getFullYear(), today.getMonth()-1, 1);
    const previousEnd = monthStart;
    const previousComparableEnd = new Date(previousStart.getFullYear(), previousStart.getMonth(), Math.min(today.getDate(), new Date(previousStart.getFullYear(), previousStart.getMonth()+1, 0).getDate()));
    const thisMonthSteps = dailySteps.filter(item => item.date >= dayKey(monthStart) && item.date <= dayKey(today)).reduce((sum,item)=>sum+item.steps,0);
    const previousMonthSteps = dailySteps.filter(item => item.date >= dayKey(previousStart) && item.date <= dayKey(previousComparableEnd)).reduce((sum,item)=>sum+item.steps,0);
    const thisMonthSessions = sessions.filter(item => new Date(item.completedAt) >= monthStart && new Date(item.completedAt) <= new Date(today.getTime()+86400000)).length;
    const previousMonthSessions = sessions.filter(item => new Date(item.completedAt) >= previousStart && new Date(item.completedAt) < new Date(previousComparableEnd.getTime()+86400000)).length;
    const bestDay = [...dailySteps].sort((a,b)=>b.steps-a.steps)[0];
    const score = Math.min(100, Math.round((activeDays/7)*70 + Math.min(weekSessions.length,3)*10));
    const message = activeDays === 7 ? 'A full week of movement. Protect that consistency.' : activeDays >= 4 ? 'You are building a strong routine. Keep your rhythm steady.' : activeDays >= 1 ? 'You have started moving. A little consistency will compound.' : 'Your next win is simple: take the first walk or complete one short workout.';
    return { week, weekSteps, activeDays, weekSessions: weekSessions.length, thisMonthSteps, previousMonthSteps, thisMonthSessions, previousMonthSessions, bestDay, score, message };
  }, [dailySteps, sessions]);

  const delta = (current: number, previous: number) => previous === 0 ? (current > 0 ? 'Started this month' : 'No previous data') : `${current >= previous ? '+' : ''}${Math.round(((current-previous)/previous)*100)}% vs last month`;

  return (
    <section className="progress-insights" aria-label="Progress insights">
      <div className="progress-insights-heading">
        <div><span className="stats-eyebrow">YOUR CONSISTENCY</span><h3>Weekly activity</h3><p>Steps and completed workouts from your recorded history.</p></div>
        <span className="progress-insights-icon"><TrendingUp size={20}/></span>
      </div>
      <div className="progress-insights-score">
        <div><span className="stats-eyebrow">CONSISTENCY SCORE</span><strong>{data.score}<small>/100</small></strong><p>{data.message}</p></div>
        <div className="progress-score-ring" style={{'--score': `${data.score}%`} as CSSProperties}><Award size={25}/></div>
      </div>
      <div className="progress-week-chart">
        {data.week.map(item => {
          const max = Math.max(1, ...data.week.map(day=>day.steps));
          const height = item.steps > 0 ? Math.max(8, (item.steps/max)*100) : 3;
          return <div className="progress-week-day" key={item.key} title={`${item.steps.toLocaleString()} steps`}>
            <span className="progress-week-value">{item.steps ? item.steps.toLocaleString() : '—'}</span>
            <div className="progress-week-track"><i style={{height: `${height}%`}}/></div>
            <small>{item.date.toLocaleDateString(undefined,{weekday:'short'}).slice(0,1)}</small>
          </div>;
        })}
      </div>
      <div className="progress-insights-metrics">
        <article><Footprints size={17}/><strong>{data.weekSteps.toLocaleString()}</strong><span>Steps this week</span></article>
        <article><Flame size={17}/><strong>{data.activeDays}/7</strong><span>Active days</span></article>
        <article><CalendarDays size={17}/><strong>{data.weekSessions}</strong><span>Workouts this week</span></article>
      </div>
      <div className="progress-month-comparison">
        <div><span className="stats-eyebrow">MONTHLY COMPARISON</span><h4>This month vs last month</h4></div>
        <div className="progress-month-row"><span>Steps</span><strong>{data.thisMonthSteps.toLocaleString()}</strong><small>{delta(data.thisMonthSteps,data.previousMonthSteps)}</small></div>
        <div className="progress-month-row"><span>Workouts</span><strong>{data.thisMonthSessions}</strong><small>{delta(data.thisMonthSessions,data.previousMonthSessions)}</small></div>
      </div>
      {data.bestDay && <div className="progress-record"><Award size={18}/><div><span className="stats-eyebrow">PERSONAL STEP RECORD</span><strong>{data.bestDay.steps.toLocaleString()} steps</strong><small>{new Date(data.bestDay.date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</small></div></div>}
    </section>
  );
}
