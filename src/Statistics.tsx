import { useMemo, useState } from 'react';
import {
  Activity, Award, BarChart3, CalendarDays, ChevronRight, Clock3,
  Dumbbell, Flame, Info, TrendingUp, Weight
} from 'lucide-react';

type Period = 'Week' | 'Month' | 'Year' | 'All';

function MuscleFigure({ back = false }: { back?: boolean }) {
  return (
    <svg className="anatomy-figure" viewBox="0 0 180 390" role="img" aria-label={back ? 'Back muscle anatomy' : 'Front muscle anatomy'}>
      <defs>
        <linearGradient id={back ? 'muscleBack' : 'muscleFront'} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b8a5ff" />
          <stop offset=".52" stopColor="#8065f5" />
          <stop offset="1" stopColor="#4735a9" />
        </linearGradient>
        <linearGradient id={back ? 'bodyBack' : 'bodyFront'} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#555867" />
          <stop offset=".5" stopColor="#d2d3dc" />
          <stop offset="1" stopColor="#505362" />
        </linearGradient>
      </defs>
      <g fill="#171923" stroke="#9da1b6" strokeWidth="2.2" strokeLinejoin="round">
        <ellipse cx="90" cy="25" rx="18" ry="22" />
        <path d="M76 49 Q62 50 52 62 L35 75 24 119 13 164 Q10 177 22 182 L35 151 43 123 42 190 Q40 218 49 244 L39 305 27 358 Q25 370 39 373 L54 334 70 277 79 244 90 264 101 244 110 277 126 334 141 373 Q155 370 153 358 L141 305 131 244 Q140 218 138 190 L137 123 145 151 158 182 Q170 177 167 164 L156 119 145 75 128 62 Q118 50 104 49Z" />
        <path d="M76 48 Q90 58 104 48 L111 62 105 92 90 105 75 92 69 62Z" />
      </g>
      <g fill={`url(#${back ? 'muscleBack' : 'muscleFront'})`} stroke="#c8baff" strokeWidth="1.1" strokeLinejoin="round">
        {back ? <>
          <path d="M71 63 Q54 60 45 76 L58 103 78 119 87 103 87 72Z" />
          <path d="M109 63 Q126 60 135 76 L122 103 102 119 93 103 93 72Z" />
          <path d="M86 72 L94 72 99 135 90 160 81 135Z" />
          <path d="M55 111 Q70 119 87 126 L83 184 66 202 51 168Z" />
          <path d="M125 111 Q110 119 93 126 L97 184 114 202 129 168Z" />
          <path d="M70 190 Q90 200 110 190 L105 229 90 242 75 229Z" />
          <path d="M53 245 Q69 250 82 245 L72 300 57 329 45 302Z" />
          <path d="M127 245 Q111 250 98 245 L108 300 123 329 135 302Z" />
        </> : <>
          <path d="M57 70 Q70 61 86 70 L86 104 Q73 112 58 100 L48 81Z" />
          <path d="M123 70 Q110 61 94 70 L94 104 Q107 112 122 100 L132 81Z" />
          <path d="M87 112 L93 112 96 180 90 194 84 180Z" />
          <path d="M83 116 Q70 110 57 118 L62 163 80 174 87 160Z" />
          <path d="M97 116 Q110 110 123 118 L118 163 100 174 93 160Z" />
          <path d="M84 182 Q90 178 96 182 L101 218 90 230 79 218Z" />
          <path d="M48 194 Q62 190 77 199 L70 248 55 276 42 247Z" />
          <path d="M132 194 Q118 190 103 199 L110 248 125 276 138 247Z" />
          <path d="M55 282 L72 282 59 337 47 355 39 345Z" />
          <path d="M125 282 L108 282 121 337 133 355 141 345Z" />
        </>}
      </g>
      <g fill="none" stroke="#d9d9e4" strokeOpacity=".35" strokeWidth="1">
        <path d="M90 60 L90 242" />
        <path d="M45 82 Q65 93 82 105 M135 82 Q115 93 98 105" />
        <path d="M55 204 Q67 213 80 215 M125 204 Q113 213 100 215" />
      </g>
    </svg>
  );
}

export default function Statistics({ sessions = 0 }: { sessions?: number }) {
  const [period, setPeriod] = useState<Period>('Week');
  // Date-specific workout history is not yet stored, so the current session total
  // is shown consistently for every period rather than inventing period breakdowns.
  const workouts = sessions;
  const minutes = workouts * 48;
  const volume = workouts * 120;
  const levelProgress = Math.min(workouts * 10, 100);
  const nextLevel = workouts >= 10 ? 'Silver' : 'Silver';
  const muscleGroups = useMemo(() => ['Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Legs'], []);

  return (
    <section className="stats-screen-v2">
      <div className="stats-v2-heading">
        <div>
          <span className="stats-eyebrow">YOUR TRAINING OVERVIEW</span>
          <h2>Statistics</h2>
          <p>See your consistency, celebrate progress, and keep building.</p>
        </div>
        <span className="stats-v2-avatar"><Activity size={22} /></span>
      </div>

      <div className="stats-v2-period" aria-label="Statistics period">
        {(['Week', 'Month', 'Year', 'All'] as Period[]).map(item => (
          <button key={item} className={period === item ? 'active' : ''} onClick={() => setPeriod(item)}>{item}</button>
        ))}
      </div>

      <div className="stats-v2-metrics">
        <article className="stats-v2-card">
          <span className="stats-v2-icon"><Dumbbell /></span>
          <div><span>Workouts</span><strong>{workouts}</strong><small><TrendingUp size={13} /> Sessions completed</small></div>
        </article>
        <article className="stats-v2-card">
          <span className="stats-v2-icon"><Clock3 /></span>
          <div><span>Time trained</span><strong>{minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`}</strong><small><CalendarDays size={13} /> Approx. 48 min / session</small></div>
        </article>
        <article className="stats-v2-card stats-v2-volume">
          <span className="stats-v2-icon"><Weight /></span>
          <div><span>Training volume</span><strong>{volume.toLocaleString()} kg</strong><small>Estimated session volume</small></div>
        </article>
      </div>

      <article className="stats-v2-level">
        <div className="stats-v2-medal"><Award size={43} /><span>BRONZE</span></div>
        <div className="stats-v2-level-content">
          <span className="stats-eyebrow">YOUR CURRENT LEVEL</span>
          <h3>Bronze</h3>
          <p>Every completed workout moves you forward.</p>
          <div className="stats-v2-progress"><i style={{ width: `${levelProgress}%` }} /></div>
          <div className="stats-v2-progress-label"><span>{workouts} / 10 sessions</span><b>Next: {nextLevel}</b></div>
        </div>
        <span className="stats-v2-level-percent">{levelProgress}%</span>
      </article>

      <article className="stats-v2-anatomy-card">
        <div className="stats-v2-section-heading">
          <div><span className="stats-eyebrow">TRAINING COVERAGE</span><h3>Muscle groups</h3></div>
          <span className="stats-v2-info" title="Your current workout plans include full-body, strength and core movements."><Info size={18} /></span>
        </div>
        <div className="stats-v2-anatomy-layout">
          <div className="stats-v2-figures">
            <div><MuscleFigure /><span>FRONT</span></div>
            <div><MuscleFigure back /><span>BACK</span></div>
          </div>
          <div className="stats-v2-muscle-list">
            {muscleGroups.map((name, index) => (
              <div className="stats-v2-muscle-item" key={name}>
                <span className={`muscle-dot muscle-dot-${index}`} />
                <span>{name}</span>
                <small>{index === 0 || index === 1 || index === 4 ? 'Targeted' : 'Included'}</small>
              </div>
            ))}
            <p>Illustration highlights common full-body training areas, not measured muscle activation.</p>
          </div>
        </div>
      </article>

      <div className="stats-v2-footer-card">
        <span className="stats-v2-icon"><Flame /></span>
        <div><span>Keep your momentum</span><strong>{workouts} {workouts === 1 ? 'workout' : 'workouts'} completed</strong><small>Finish another session to build your record.</small></div>
        <BarChart3 className="stats-v2-trend-icon" size={28} />
      </div>
      <p className="stats-v2-disclaimer">Statistics are based on the workout sessions currently recorded on this device. Date-based history and measured muscle analytics are not yet available.</p>
    </section>
  );
}
