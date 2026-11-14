import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { Camera, CheckCircle2, ShieldCheck, RotateCcw, UserRound } from 'lucide-react';

export type ExerciseType = 'squat' | 'pushup' | 'jumping-jack' | 'situp' | 'plank' | 'lunge' | 'highknees' | 'deadbug' | 'bridge';
type Unit = 'reps' | 'sec';
type Variant = 'alarm' | 'workout';
type Props = {
  target?: number;
  exercise?: ExerciseType;
  unit?: Unit;
  variant?: Variant;
  completionLabel?: string;
  onVerified: () => void;
};
type Landmark = { x: number; y: number; z?: number; visibility?: number };
type Phase = 'ready' | 'down' | 'up' | 'open' | 'closed' | 'hold';

const EXERCISES: Record<ExerciseType, { title: string; instruction: string; setup: string }> = {
  squat: { title: 'bodyweight squats', instruction: 'Bend your knees and hips, then return to a fully upright position.', setup: 'Stand far enough back for your shoulders, hips, knees and ankles to stay visible. A side-facing camera angle works best.' },
  pushup: { title: 'push-ups', instruction: 'Lower your chest with bent elbows while keeping your body aligned, then press back up.', setup: 'Place the phone low enough to see your shoulders, elbows, hips and wrists. Keep your full body in frame.' },
  'jumping-jack': { title: 'jumping jacks', instruction: 'Jump or step your feet apart while raising both hands, then return to the closed position.', setup: 'Stand back so your hands and feet remain visible throughout the movement.' },
  situp: { title: 'sit-ups', instruction: 'Raise your upper body from the lowered position and return under control.', setup: 'Position the phone side-on and keep your shoulders, hips and knees visible.' },
  plank: { title: 'a forearm plank', instruction: 'Hold a straight line from your shoulders through your hips to your ankles. The timer only advances while your plank position is detected.', setup: 'Place the phone side-on at a low angle. Keep your shoulders, hips and ankles visible and hold your body in a straight line.' },
  lunge: { title: 'reverse lunges', instruction: 'Step one foot back, lower with control, then return to standing. Alternate legs.', setup: 'Face the camera at a slight angle and keep both hips, knees and ankles in frame.' },
  highknees: { title: 'high knees', instruction: 'Raise one knee at a time toward hip height, alternating sides with control.', setup: 'Face the camera and keep your hips and both knees visible. Lift each knee clearly above hip level.' },
  deadbug: { title: 'dead bugs', instruction: 'Lie on your back and slowly extend a leg, then return to the bent starting position.', setup: 'Position the phone side-on. Keep your shoulders, hips, knees and ankles visible while lying down.' },
  bridge: { title: 'glute bridges', instruction: 'Lie on your back with knees bent, lift your hips, then lower under control.', setup: 'Position the phone side-on and keep your shoulders, hips and knees visible.' },
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
  const point = (index: number) => pose[index];
  const required = exercise === 'squat' ? [11,12,23,24,25,26,27,28]
    : exercise === 'pushup' ? [11,12,13,14,15,16,23,24]
    : exercise === 'jumping-jack' ? [11,12,15,16,27,28]
    : exercise === 'situp' ? [11,12,23,24,25,26]
    : exercise === 'plank' ? [11,23,27]
    : exercise === 'lunge' ? [11,12,23,24,25,26,27,28]
    : exercise === 'highknees' ? [23,24,25,26]
    : exercise === 'deadbug' ? [11,12,23,24,25,26]
    : [11,12,23,24,25,26];

  if (!required.every(index => point(index) && (point(index).visibility ?? 1) > 0.55)) {
    return { phase: 'ready', valid: false };
  }

  if (exercise === 'squat') {
    const knee = (angle(point(23), point(25), point(27)) + angle(point(24), point(26), point(28))) / 2;
    return { phase: knee < 105 ? 'down' : knee > 155 ? 'up' : 'ready', valid: true };
  }
  if (exercise === 'pushup') {
    const elbow = (angle(point(11), point(13), point(15)) + angle(point(12), point(14), point(16))) / 2;
    return { phase: elbow < 95 ? 'down' : elbow > 150 ? 'up' : 'ready', valid: true };
  }
  if (exercise === 'jumping-jack') {
    const wristY = (point(15).y + point(16).y) / 2;
    const shoulderY = (point(11).y + point(12).y) / 2;
    const feetGap = Math.abs(point(27).x - point(28).x);
    const shoulderGap = Math.max(0.08, Math.abs(point(11).x - point(12).x));
    const open = wristY < shoulderY - 0.04 && feetGap > shoulderGap * 2.1;
    const closed = wristY > shoulderY + 0.02 && feetGap < shoulderGap * 1.65;
    return { phase: open ? 'open' : closed ? 'closed' : 'ready', valid: true };
  }
  if (exercise === 'situp') {
    const hip = (angle(point(11), point(23), point(25)) + angle(point(12), point(24), point(26))) / 2;
    return { phase: hip < 115 ? 'up' : hip > 145 ? 'down' : 'ready', valid: true };
  }
  if (exercise === 'plank') {
    const bodyAngle = angle(point(11), point(23), point(27));
    const bodyLevel = Math.abs(point(11).y - point(27).y) < 0.22;
    const bodyExtended = Math.abs(point(11).x - point(27).x) > 0.18;
    return { phase: 'hold', valid: bodyAngle > 150 && bodyLevel && bodyExtended };
  }
  if (exercise === 'lunge') {
    const leftKnee = angle(point(23), point(25), point(27));
    const rightKnee = angle(point(24), point(26), point(28));
    const deepestKnee = Math.min(leftKnee, rightKnee);
    const standing = Math.min(leftKnee, rightKnee) > 150;
    return { phase: deepestKnee < 112 ? 'down' : standing ? 'up' : 'ready', valid: true };
  }
  if (exercise === 'highknees') {
    const raised = point(25).y < point(23).y - 0.1 || point(26).y < point(24).y - 0.1;
    return { phase: raised ? 'open' : 'closed', valid: true };
  }
  if (exercise === 'deadbug') {
    const hipExtension = Math.max(
      angle(point(11), point(23), point(25)),
      angle(point(12), point(24), point(26))
    );
    return { phase: hipExtension > 148 ? 'up' : hipExtension < 125 ? 'down' : 'ready', valid: true };
  }
  const hipAngle = (angle(point(11), point(23), point(25)) + angle(point(12), point(24), point(26))) / 2;
  return { phase: hipAngle < 130 ? 'down' : hipAngle > 155 ? 'up' : 'ready', valid: true };
}

export default function WorkoutVerification({
  target = 20,
  exercise = 'squat',
  unit = 'reps',
  variant = 'alarm',
  completionLabel,
  onVerified,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef<Phase>('ready');
  const lastCountAtRef = useRef(0);
  const stableFramesRef = useRef(0);
  const activeDurationRef = useRef(0);
  const lastFrameAtRef = useRef(0);
  const [count, setCount] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [poseSeen, setPoseSeen] = useState(false);
  const [complete, setComplete] = useState(false);
  const config = EXERCISES[exercise];

  useEffect(() => {
    let alive = true;
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
            const now = performance.now();
            const result = landmarkerRef.current.detectForVideo(video, now);
            const pose = result.landmarks?.[0] as Landmark[] | undefined;
            if (pose) {
              const movement = getMovementPhase(pose, exercise);
              setPoseSeen(movement.valid);

              if (unit === 'sec') {
                if (movement.valid) {
                  const delta = lastFrameAtRef.current ? Math.min(now - lastFrameAtRef.current, 120) : 0;
                  lastFrameAtRef.current = now;
                  activeDurationRef.current += delta;
                  const next = Math.min(Math.floor(activeDurationRef.current / 1000), target);
                  setCount(value => value === next ? value : next);
                  if (next >= target) setComplete(true);
                } else {
                  lastFrameAtRef.current = 0;
                  phaseRef.current = 'ready';
                  stableFramesRef.current = 0;
                }
              } else if (movement.valid && movement.phase !== 'ready') {
                stableFramesRef.current += 1;
                if (stableFramesRef.current >= 2) {
                  const previous = phaseRef.current;
                  const isCompletedCycle = (exercise === 'squat' || exercise === 'pushup' || exercise === 'situp' || exercise === 'lunge' || exercise === 'deadbug' || exercise === 'bridge')
                    ? previous === 'down' && movement.phase === 'up'
                    : previous === 'closed' && movement.phase === 'open';
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
              lastFrameAtRef.current = 0;
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
        activeDurationRef.current = 0;
        lastFrameAtRef.current = 0;

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
          streamRef.current?.getTracks().forEach(track => track.stop());
          streamRef.current = null;
          setLoading(false);
          setError(e instanceof Error && e.name === 'NotAllowedError' ? 'Camera permission was denied. Allow RiseFit camera access in Android Settings > Apps > RiseFit > Permissions, then retry.' : e instanceof Error ? e.message : 'Camera or pose model could not start. Allow camera access and retry.');
        }
      }
    };

    const visibilityHandler = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
        lastFrameAtRef.current = 0;
        streamRef.current?.getVideoTracks().forEach(track => { track.enabled = false; });
      } else if (alive && landmarkerRef.current) {
        streamRef.current?.getVideoTracks().forEach(track => { track.enabled = true; });
        startLoop();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    void start();

    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', visibilityHandler);
      cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      stopCamera();
    };
  }, [target, exercise, unit, retryAttempt]);

  useEffect(() => {
    if (complete) {
      cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, [complete]);

  const isWorkout = variant === 'workout';
  const progressUnit = unit === 'sec' ? 'seconds' : 'reps';
  const heading = unit === 'sec'
    ? `Hold ${config.title} for ${target} seconds`
    : `Complete ${target} ${config.title}`;

  return <section className={isWorkout ? 'verification-workout' : 'panel session'}>
    <span className="eyebrow">{isWorkout ? 'WORKOUT · LIVE CAMERA TRACKING' : 'ALARM CHALLENGE · LIVE VERIFICATION'}</span>
    <h2>{heading}</h2>
    <p className="muted">{config.instruction}</p>
    <div style={{position:'relative', overflow:'hidden', borderRadius:16, background:'#09090d', aspectRatio:'4/3', margin:'18px 0'}}>
      <video ref={videoRef} muted playsInline style={{width:'100%',height:'100%',objectFit:'cover',transform:'scaleX(-1)'}} />
      {loading && !complete && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'#09090dcc',color:'#f4f4f7',textAlign:'center',padding:20}}><Camera size={28}/><p>Starting camera and pose detection…</p></div>}{!loading && !poseSeen && !complete && <div style={{position:'absolute',left:12,right:12,bottom:12,padding:'10px 12px',borderRadius:10,background:'#09090dbb',color:'#f4f4f7',textAlign:'center',fontSize:12,pointerEvents:'none'}}>{config.setup}</div>}
      {complete && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'#10101dcc',color:'#9a91ff'}}><CheckCircle2 size={52}/><b>Target verified</b></div>}
    </div>
    <div className="counter">
      <span className="eyebrow">{loading ? 'INITIALIZING CAMERA & POSE MODEL' : error ? 'CAMERA / TRACKING ISSUE' : poseSeen ? (unit === 'sec' ? 'PLANK POSITION VERIFIED · HOLD STEADY' : 'BODY DETECTED · KEEP MOVING') : 'POSITION YOUR BODY IN FRAME'}</span>
      <div className="number">{count}<small>/ {target} {progressUnit}</small></div>
      <div className="progress-track count-track"><i style={{width:`${count/target*100}%`}}/></div>
    </div>
    {error && <><div className="notice"><Camera size={17}/><span>{error}</span></div><button className="secondary full" onClick={() => setRetryAttempt(value => value + 1)}><RotateCcw size={15}/> Retry camera &amp; pose setup</button></>}
    {complete
      ? <><div className="notice"><ShieldCheck size={17}/><span>{unit === 'sec' ? 'RiseFit verified the hold duration while your body remained in the detected plank position.' : 'RiseFit detected the target movement cycles on this device.'} Your camera feed is not uploaded.</span></div><button className="primary full" onClick={onVerified}><CheckCircle2 size={17}/> {completionLabel ?? (isWorkout ? 'Continue' : 'Dismiss challenge')}</button></>
      : <p className="muted" style={{textAlign:'center',fontSize:12}}>On-device pose estimation · No video recording or upload</p>}
  </section>;
}
