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
  const deadlineRef = useRef(Date.now() + seconds * 1000);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const safeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    deadlineRef.current = Date.now() + safeSeconds * 1000;
    setRemaining(safeSeconds);
    setTotal(safeSeconds);
    setPaused(false);
    completedRef.current = false;
  }, [seconds]);

  useEffect(() => {
    if (paused || completedRef.current) return;

    const updateRemaining = () => {
      const next = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemaining(current => current === next ? current : next);
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 250);
    document.addEventListener('visibilitychange', updateRemaining);
    window.addEventListener('focus', updateRemaining);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', updateRemaining);
      window.removeEventListener('focus', updateRemaining);
    };
  }, [paused]);

  useEffect(() => {
    if (remaining === 0 && !completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current();
    }
  }, [remaining]);

  const togglePaused = () => {
    if (paused) {
      deadlineRef.current = Date.now() + remaining * 1000;
      setPaused(false);
      return;
    }
    const current = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
    setRemaining(current);
    if (current === 0) {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
      return;
    }
    setPaused(true);
  };

  const extend = () => {
    const current = paused
      ? remaining
      : Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
    const next = current + 15;
    deadlineRef.current = Date.now() + next * 1000;
    setRemaining(next);
    setTotal(value => value + 15);
    completedRef.current = false;
    setPaused(false);
  };

  const skip = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setRemaining(0);
    onCompleteRef.current();
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
        <button type="button" className="secondary" onClick={togglePaused}>{paused ? <Play size={15}/> : <Pause size={15}/>} {paused ? 'Resume' : 'Pause'}</button>
        <button type="button" className="secondary" onClick={extend}><Plus size={15}/> 15 seconds</button>
      </div>
      <button type="button" className="primary full" onClick={skip}><SkipForward size={16}/> Skip rest and continue</button>
    </section>
  );
}
