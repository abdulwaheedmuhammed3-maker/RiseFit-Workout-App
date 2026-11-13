import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { Camera, CheckCircle2, ShieldCheck, RotateCcw, UserRound } from 'lucide-react';

type ExerciseType = 'squat' | 'pushup' | 'jumping-jack' | 'situp';
type Props = { target?: number; exercise?: ExerciseType; onVerified: () => void };
type Landmark = { x: number; y: number; z?: number; visibility?: number };
type Phase = 'ready' | 'down' | 'up' | 'open' | 'closed';

const EXERCISES: Record<ExerciseType, { title: string; instruction: string; setup: string }> = {
  squat: { title: 'bodyweight squats', instruction: 'Bend your knees and hips, then return to a fully upright position.', setup: 'Stand far enough back for your shoulders, hips, knees and ankles to stay visible. A side-facing camera angle works best.' },
  pushup: { title: 'push-ups', instruction: 'Lower your chest with bent elbows while keeping your body aligned, then press back up.', setup: 'Place the phone low enough to see your shoulders, elbows, hips and wrists. Keep your full body in frame.' },
  'jumping-jack': { title: 'jumping jacks', instruction: 'Jump or step your feet apart while raising both hands, then return to the closed position.', setup: 'Stand back so your hands and feet remain visible throughout the movement.' },
  situp: { title: 'sit-ups', instruction: 'Raise your upper body from the lowered position and return under control.', setup: 'Position the phone side-on and keep your shoulders, hips and knees visible.' },
};

function angle(a: Landmark, b: Landmark, c: Landmark) {
  const ab = Math.hypot(a.x - b.x, a.y - b.y);
  const cb = Math.hypot(c.x - b.x, c.y - b.y);
  if (ab === 0 || cb === 0) return 180;
  const dot = (a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y);
  const cosine = Math.max(-1, Math.min(1, dot / (ab * cb)));
  return Math.acos(cosine) * (180 / Math.PI);
}

function getMovementPhase(pose: Landmark[], exercise: ExerciseType): { phase: Phase; valid: boolean } {
  const left = (index: number) => pose[index];
  const required = exercise === 'squat' ? [11,12,23,24,25,26,27,28]
    : exercise === 'pushup' ? [11,12,13,14,15,16,23,24]
    : exercise === 'jumping-jack' ? [11,12,15,16,27,28]
    : [11,12,23,24,25,26];
  if (!required.every(i => pose[i] && (pose[i].visibility ?? 1) > 0.55)) return { phase: 'ready', valid: false };

  if (exercise === 'squat') {
    const knee = (angle(left(23), left(25), left(27)) + angle(left(24), left(26), left(28))) / 2;
    return { phase: knee < 105 ? 'down' : knee > 155 ? 'up' : 'ready', valid: true };
  }
  if (exercise === 'pushup') {
    const elbow = (angle(left(11), left(13), left(15)) + angle(left(12), left(14), left(16))) / 2;
    return { phase: elbow < 95 ? 'down' : elbow > 150 ? 'up' : 'ready', valid: true };
  }
  if (exercise === 'jumping-jack') {
    const wristY = (left(15).y + left(16).y) / 2;
    const shoulderY = (left(11).y + left(12).y) / 2;
    const feetGap = Math.abs(left(27).x - left(28).x);
    const shoulderGap = Math.max(0.08, Math.abs(left(11).x - left(12).x));
    const open = wristY < shoulderY - 0.04 && feetGap > shoulderGap * 2.1;
    const closed = wristY > shoulderY + 0.02 && feetGap < shoulderGap * 1.65;
    return { phase: open ? 'open' : closed ? 'closed' : 'ready', valid: true };
  }
  const hip = (angle(left(11), left(23), left(25)) + angle(left(12), left(24), left(26))) / 2;
  return { phase: hip < 115 ? 'up' : hip > 145 ? 'down' : 'ready', valid: true };
}

export default function WorkoutVerification({ target = 20, exercise = 'squat', onVerified }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef<Phase>('ready');
  const lastCountAtRef = useRef(0);
  const stableFramesRef = useRef(0);
  const [count, setCount] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [poseSeen, setPoseSeen] = useState(false);
  const [complete, setComplete] = useState(false);
  const config = EXERCISES[exercise];

  useEffect(() => {
    let alive = true;
    let visibilityHandler: (() => void) | undefined;

    const stopCamera = () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };

    const startLoop = () => {
      const loop = () => {
        if (!alive || !videoRef.current || !landmarkerRef.current || document.hidden) return;
        const video = videoRef.current;
        if (video.readyState >= 2) {
          try {
            const result = landmarkerRef.current.detectForVideo(video, performance.now());
            const pose = result.landmarks?.[0] as Landmark[] | undefined;
            if (pose) {
              const movement = getMovementPhase(pose, exercise);
              setPoseSeen(movement.valid);
              if (movement.valid && movement.phase !== 'ready') {
                stableFramesRef.current += 1;
                if (stableFramesRef.current >= 2) {
                  const previous = phaseRef.current;
                  const isCompletedCycle = (exercise === 'squat' || exercise === 'pushup' || exercise === 'situp')
                    ? previous === 'down' && movement.phase === 'up'
                    : previous === 'open' && movement.phase === 'closed';
                  const now = performance.now();
                  if (isCompletedCycle && now - lastCountAtRef.current > 650) {
                    lastCountAtRef.current = now;
                    setCount(value => {
                      const next = Math.min(value + 1, target);
                      if (next >= target) setComplete(true);
                      return next;
                    });
                  }
                  phaseRef.current = movement.phase;
                }
              } else if (!movement.valid) {
                stableFramesRef.current = 0;
                phaseRef.current = 'ready';
              } else {
                stableFramesRef.current = 0;
              }
            } else {
              setPoseSeen(false);
              stableFramesRef.current = 0;
              phaseRef.current = 'ready';
            }
          } catch {
            setError('Pose tracking paused. Reposition your phone and retry if detection does not resume.');
          }
        }
        if (alive && !document.hidden) rafRef.current = requestAnimationFrame(loop);
      };
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };

    const start = async () => {
      try {
        setLoading(true);
        setError('');
        setPoseSeen(false);
        setCount(0);
        setComplete(false);
        phaseRef.current = 'ready';
        stableFramesRef.current = 0;
        lastCountAtRef.current = 0;

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is unavailable. Open RiseFit in its Android app or a secure browser context.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
          audio: false,
        });
        if (!alive) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        if (!videoRef.current) throw new Error('Camera preview could not be initialized.');
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const files = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm'
        );
        const model = await PoseLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker_lite/float16/1/pose_landmarker_lite.task' },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.65,
          minPosePresenceConfidence: 0.65,
          minTrackingConfidence: 0.65,
        });
        if (!alive) { model.close(); return; }
        landmarkerRef.current = model;
        setLoading(false);
        startLoop();
      } catch (e) {
        if (alive) {
          setLoading(false);
          setError(e instanceof Error ? e.message : 'Camera or pose model could not start. Allow camera access and retry.');
        }
      }
    };

    visibilityHandler = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
        streamRef.current?.getVideoTracks().forEach(track => { track.enabled = false; });
      } else if (alive && landmarkerRef.current && !complete) {
        streamRef.current?.getVideoTracks().forEach(track => { track.enabled = true; });
        startLoop();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    void start();

    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', visibilityHandler!);
      cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      stopCamera();
    };
  }, [target, exercise, retryAttempt]);

  useEffect(() => {
    if (complete) {
      cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, [complete]);

  return <section className="panel session">
    <span className="eyebrow">ALARM CHALLENGE · LIVE VERIFICATION</span>
    <h2>Complete {target} {config.title}</h2>
    <p className="muted">{config.instruction}</p>
    <div style={{position:'relative', overflow:'hidden', borderRadius:16, background:'#090b08', aspectRatio:'4/3', margin:'18px 0'}}>
      <video ref={videoRef} muted playsInline style={{width:'100%',height:'100%',objectFit:'cover',transform:'scaleX(-1)'}} />
      {!poseSeen && !complete && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'#090b08aa',color:'#f4f5f2',textAlign:'center',padding:20}}><UserRound size={28}/><p>{config.setup}</p></div>}
      {complete && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'#10160dcc',color:'#9a8cff'}}><CheckCircle2 size={52}/><b>Challenge complete</b></div>}
    </div>
    <div className="counter">
      <span className="eyebrow">{loading ? 'INITIALIZING CAMERA & POSE MODEL' : error ? 'CAMERA / TRACKING ISSUE' : poseSeen ? 'BODY DETECTED · KEEP MOVING' : 'SEARCHING FOR FULL BODY'}</span>
      <div className="number">{count}<small>/ {target} reps</small></div>
      <div className="progress-track count-track"><i style={{width:`${count/target*100}%`}}/></div>
    </div>
    {error && <><div className="notice"><Camera size={17}/><span>{error}</span></div><button className="secondary full" onClick={() => setRetryAttempt(value => value + 1)}><RotateCcw size={15}/> Retry camera &amp; pose setup</button></>}
    {complete ? <><div className="notice"><ShieldCheck size={17}/><span>RiseFit detected the target movement cycles on this device. Your camera feed is not uploaded.</span></div><button className="primary full" onClick={onVerified}><CheckCircle2 size={17}/> Dismiss challenge</button></> : <p className="muted" style={{textAlign:'center',fontSize:12}}>On-device pose estimation · No video recording or upload</p>}
  </section>;
}
