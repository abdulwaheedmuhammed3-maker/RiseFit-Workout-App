import { useState } from 'react';
import { Dumbbell, Clock3, Weight, Info, ArrowLeftRight, Activity } from 'lucide-react';

type Period = 'Week' | 'Month' | 'Year' | 'All';
export default function Statistics({ sessions = 0 }: { sessions?: number }) {
 const [period, setPeriod] = useState<Period>('Month');
 const workouts = period === 'Week' ? sessions : period === 'Month' ? sessions : sessions;
 const minutes = workouts * 48;
 const weight = workouts * 120;
 return <section className="stats-screen">
  <div className="stats-heading"><h2>Statistics</h2><div className="avatar"><Activity size={23}/></div></div>
  <div className="stats-period">{(['Week','Month','Year','All'] as Period[]).map(p=><button key={p} className={period===p?'chosen':''} onClick={()=>setPeriod(p)}>{p}</button>)}</div>
  <div className="stats-metrics">
   <article className="stat-tile"><span className="stat-icon"><Dumbbell size={27}/></span><div><b>Workouts</b><strong>{workouts}</strong></div></article>
   <article className="stat-tile"><span className="stat-icon"><Clock3 size={27}/></span><div><b>Time</b><strong>{minutes} min</strong></div></article>
  </div>
  <article className="stat-tile weight-tile"><span className="stat-icon"><Weight size={31}/></span><div><b>Total Weight</b><strong>{weight.toLocaleString()} kg</strong></div></article>
  <article className="level-card"><div className="level-top"><div><span>Your Level</span><h3>Bronze</h3></div><div className="level-actions"><button><ArrowLeftRight size={20}/> Compare</button><button aria-label="Level information"><Info size={24}/></button></div></div>
   <div className="muscle-illustrations">
    <svg viewBox="0 0 130 260" role="img" aria-label="Front muscle group illustration"><g fill="#17191b" stroke="#85858b" strokeWidth="1.5"><circle cx="65" cy="21" r="16"/><path d="M48 42 Q30 48 25 70 L16 104 28 111 42 79 39 124 44 166 34 217 45 235 56 190 65 158 74 190 85 235 96 217 86 166 91 124 88 79 102 111 114 104 105 70 Q100 48 82 42Z"/></g><g fill="#d39b42" stroke="#efbd64" strokeWidth="1"><path d="M45 50 Q65 40 85 50 L79 75 65 83 51 75Z"/><path d="M51 88 L79 88 74 117 65 122 56 117Z"/><path d="M42 126 L58 126 54 157 43 177 36 159Z"/><path d="M72 126 L88 126 94 159 87 177 76 157Z"/><path d="M45 180 L58 180 48 217 38 211Z"/><path d="M72 180 L85 180 92 211 82 217Z"/></g><g fill="#e7c34b"><circle cx="28" cy="89" r="5"/><circle cx="102" cy="89" r="5"/></g></svg>
    <svg viewBox="0 0 130 260" role="img" aria-label="Back muscle group illustration"><g fill="#17191b" stroke="#85858b" strokeWidth="1.5"><circle cx="65" cy="21" r="16"/><path d="M48 42 Q30 48 25 70 L16 104 28 111 42 79 39 124 44 166 34 217 45 235 56 190 65 158 74 190 85 235 96 217 86 166 91 124 88 79 102 111 114 104 105 70 Q100 48 82 42Z"/></g><g fill="#b47b38" stroke="#d5a054" strokeWidth="1"><path d="M46 49 L65 42 84 49 78 83 65 96 52 83Z"/><path d="M52 100 L78 100 73 140 65 149 57 140Z"/><path d="M39 147 L58 147 54 178 40 190 34 170Z"/><path d="M72 147 L91 147 96 170 90 190 76 178Z"/><path d="M45 190 L58 190 48 218 38 211Z"/><path d="M72 190 L85 190 92 211 82 218Z"/></g><g fill="#e7c34b"><circle cx="28" cy="89" r="5"/><circle cx="102" cy="89" r="5"/></g></svg>
   </div>
   <div className="level-badges"><span>🟡 Gold: 2</span><span>🟤 Bronze: 4</span><span>🟠 Wood: 8</span></div>
  </article>
  <div className="stats-bottom-nav"><button><Dumbbell/>Training</button><button>▤<span>Exercises</span></button><button>★<span>Challenges</span></button><button>◴<span>History</span></button><button className="current">▥<span>Statistics</span></button></div>
 </section>;
}