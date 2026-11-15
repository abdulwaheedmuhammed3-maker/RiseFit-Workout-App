import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Pause, Play, Plus, SkipForward, Timer } from 'lucide-react';

type Props = { seconds?: number; nextLabel: string; onComplete: () => void };

const formatTime = (value: number) => {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
};

export default function RestTimer({ seconds = 30, nextLabel, onComplete }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  const [total, setTotal] = useState(seconds);
  const [paused, setPaused] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    setRemaining(seconds);
    setTotal(seconds);
    setPaused(false);
    completedRef.current = false;
  }, [seconds]);

  useEffect(() => {
    if (paused || remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [paused, remaining]);

  useEffect(() => {
    if (remaining === 0 && !completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current();
    }
  }, [remaining]);

  const extend = () => {
    completedRef.current = false;
    setRemaining(value => value + 15);
    setTotal(value => value + 15);
    setPaused(false);
  };
  const progress = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

  return (
    <section className="rest-timer-card" aria-label="Rest timer">
      <span className="eyebrow">RECOVERY BREAK</span>
      <div className="rest-timer-icon"><Timer size={22}/></div>
      <h2>Take a moment to recover.</h2>
      <p className="muted">Breathe, relax your muscles and get ready for the next movement.</p>
      <div className="rest-timer-ring" style={{'--rest-progress': `${progress}%`} as CSSProperties}>
        <strong>{formatTime(remaining)}</strong><small>{paused ? 'PAUSED' : 'RESTING'}</small>
      </div>
      <div className="rest-next">
        <span className="eyebrow">UP NEXT</span>
        <b>{nextLabel}</b>
      </div>
      <div className="rest-timer-actions">
        <button type="button" className="secondary" onClick={() => setPaused(value => !value)}>{paused ? <Play size={15}/> : <Pause size={15}/>} {paused ? 'Resume' : 'Pause'}</button>
        <button type="button" className="secondary" onClick={extend}><Plus size={15}/> 15 seconds</button>
      </div>
      <button type="button" className="primary full" onClick={() => onComplete()}><SkipForward size={16}/> Skip rest and continue</button>
    </section>
  );
}
