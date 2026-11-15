import { ArrowDown, ArrowUp, MoveHorizontal, UserRound } from 'lucide-react';
import type { ExerciseType } from './WorkoutVerification';

type Step = { title: string; detail: string; action: 'start' | 'lower' | 'lift' | 'move' };
type Props = { exercise: ExerciseType };

const GUIDES: Record<ExerciseType, [Step, Step, Step]> = {
  squat: [
    { title: 'Set your stance', detail: 'Stand with feet around shoulder-width apart. Keep your chest lifted and brace your core.', action: 'start' },
    { title: 'Sit back', detail: 'Bend your hips and knees. Lower only as far as feels comfortable while keeping control.', action: 'lower' },
    { title: 'Stand tall', detail: 'Press through your feet and return to a steady standing position.', action: 'lift' },
  ],
  pushup: [
    { title: 'Build your line', detail: 'Place hands just wider than your shoulders. Keep your head, hips and heels aligned.', action: 'start' },
    { title: 'Lower steadily', detail: 'Bend your elbows and lower your chest with control. Keep your middle from sagging.', action: 'lower' },
    { title: 'Press away', detail: 'Push the floor away until your arms return to the starting position.', action: 'lift' },
  ],
  'jumping-jack': [
    { title: 'Start tall', detail: 'Stand upright with feet together and arms by your sides.', action: 'start' },
    { title: 'Open out', detail: 'Step or jump feet apart while raising both arms overhead.', action: 'move' },
    { title: 'Return together', detail: 'Bring feet back in and lower your arms smoothly.', action: 'lift' },
  ],
  situp: [
    { title: 'Set up', detail: 'Lie on your back with knees bent and feet supported. Keep your neck relaxed.', action: 'start' },
    { title: 'Lift your chest', detail: 'Raise your upper body using your core. Avoid pulling on your head or neck.', action: 'lift' },
    { title: 'Lower with control', detail: 'Return your shoulders towards the floor slowly and reset.', action: 'lower' },
  ],
  plank: [
    { title: 'Set your base', detail: 'Place elbows under shoulders. Extend your legs or use the knee-supported variation.', action: 'start' },
    { title: 'Brace and align', detail: 'Engage your core and keep shoulders, hips and ankles in one comfortable line.', action: 'move' },
    { title: 'Breathe steadily', detail: 'Hold without letting your hips drop or rise. Stop if you feel pain.', action: 'lift' },
  ],
  lunge: [
    { title: 'Stand balanced', detail: 'Begin upright with feet about hip-width apart. Keep your torso tall.', action: 'start' },
    { title: 'Step back', detail: 'Step one foot behind you and lower both knees only as far as comfortable.', action: 'lower' },
    { title: 'Return to stand', detail: 'Press through the front foot and come back upright. Alternate sides.', action: 'lift' },
  ],
  highknees: [
    { title: 'Stand tall', detail: 'Face the camera with your torso upright and your core gently braced.', action: 'start' },
    { title: 'Drive one knee', detail: 'Lift one knee towards hip height while keeping your chest lifted.', action: 'lift' },
    { title: 'Alternate', detail: 'Lower that foot and lift the other knee. March instead of running for a low-impact option.', action: 'move' },
  ],
  deadbug: [
    { title: 'Set your position', detail: 'Lie on your back with arms raised and knees bent. Keep your lower back comfortable.', action: 'start' },
    { title: 'Extend opposite limbs', detail: 'Slowly reach one arm overhead while extending the opposite leg.', action: 'move' },
    { title: 'Return and switch', detail: 'Bring both limbs back with control, then alternate sides.', action: 'lift' },
  ],
  bridge: [
    { title: 'Set up', detail: 'Lie on your back with knees bent and feet flat about hip-width apart.', action: 'start' },
    { title: 'Lift your hips', detail: 'Press through your feet and squeeze your glutes to raise your hips comfortably.', action: 'lift' },
    { title: 'Lower slowly', detail: 'Bring your hips back down under control without forcing your lower back.', action: 'lower' },
  ],
};

function StepIcon({ action }: { action: Step['action'] }) {
  if (action === 'lower') return <ArrowDown size={22}/>;
  if (action === 'lift') return <ArrowUp size={22}/>;
  if (action === 'move') return <MoveHorizontal size={22}/>;
  return <UserRound size={22}/>;
}

export default function ExerciseDemonstration({ exercise }: Props) {
  const steps = GUIDES[exercise];
  return (
    <section className="exercise-demo" aria-label="Exercise demonstration">
      <div className="exercise-demo-heading">
        <div><span className="eyebrow">MOVEMENT GUIDE</span><h3>How the movement works</h3></div>
        <span className="exercise-demo-label">3 steps</span>
      </div>
      <div className="exercise-demo-steps">
        {steps.map((step, index) => (
          <article className="exercise-demo-step" key={step.title}>
            <div className="exercise-demo-visual"><span className="exercise-demo-number">{index+1}</span><StepIcon action={step.action}/></div>
            <b>{step.title}</b>
            <p>{step.detail}</p>
          </article>
        ))}
      </div>
      <p className="exercise-demo-disclaimer">Illustrated movement guidance, not a live video or medical assessment. Use the easier variation when needed.</p>
    </section>
  );
}
