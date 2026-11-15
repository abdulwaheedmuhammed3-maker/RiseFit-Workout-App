import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { Camera, CheckCircle2, ShieldCheck, RotateCcw, Volume2, VolumeX } from 'lucide-react';

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
  pushup: { title: 'push-ups', instruction: 'Lower your chest with bent elbows while keeping your body aligned, then press back up.', setup: 'Use a low, side-on camera angle. Keep your shoulders, elbows, wrists, hips and ankles visible so RiseFit can check your full body line.' },
  'jumping-jack': { title: 'jumping jacks', instruction: 'Jump or step your feet apart while raising both hands, then return to the closed position.', setup: 'Stand back so your hands and feet remain visible throughout the movement.' },
  situp: { title: 'sit-ups', instruction: 'Raise your upper body from the lowered position and return under control.', setup: 'Position the phone side-on and keep your shoulders, hips and knees visible.' },
  plank: { title: 'a forearm plank', instruction: 'Hold a straight line from your shoulders through your hips to your ankles. The timer only advances while your plank position is detected.', setup: 'Place the phone side-on at a low angle. Keep your shoulders, hips and ankles visible and hold your body in a straight line.' },
  lunge: { title: 'reverse lunges', instruction: 'Step one foot back, lower with control, then return to standing. Alternate legs.', setup: 'Face the camera at a slight angle and keep both hips, knees and ankles in frame.' },
  highknees: { title: 'high knees', instruction: 'Raise one knee at a time toward hip height while the other leg supports you. Alternate sides with control.', setup: 'Face the camera and keep your shoulders, hips, knees and ankles visible. Keep one leg straight as you lift the other knee.' },
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
  const visible = (indices: number[]) => indices.every(index =>
    point(index) && (point(index).visibility ?? 1) > 0.55
  );
  const side = (left: number[], right: number[]) => {
    const leftVisible = visible(left);
    const rightVisible = visible(right);
    if (!leftVisible && !rightVisible) return null;
    if (leftVisible && rightVisible) {
      const score = (indices: number[]) => indices.reduce((sum, index) => sum + (point(index).visibility ?? 1), 0);
      return score(left) >= score(right) ? left : right;
    }
    return leftVisible ? left : right;
  };

  if (exercise === 'squat') {
    const leg = side([23,25,27], [24,26,28]);
    if (!leg) return { phase: 'ready', valid: false };
    const shoulder = leg[0] === 23 ? 11 : 12;
    if (!visible([shoulder, leg[0]])) return { phase: 'ready', valid: false };
    // Squats require an upright standing torso, not seated knee extensions.
    const torsoDx = Math.abs(point(shoulder).x - point(leg[0]).x);
    const torsoDy = Math.abs(point(shoulder).y - point(leg[0]).y);
    if (torsoDy <= torsoDx * 1.05) return { phase: 'ready', valid: false };
    const knee = angle(point(leg[0]), point(leg[1]), point(leg[2]));
    return { phase: knee < 105 ? 'down' : knee > 155 ? 'up' : 'ready', valid: true };
  }
  if (exercise === 'lunge') {
    // Count a lunge when either knee bends, and re-arm only once the visible
    // legs return to standing. This supports alternating left/right lunges.
    const leftVisible = visible([23,25,27]);
    const rightVisible = visible([24,26,28]);
    if (!leftVisible && !rightVisible) return { phase: 'ready', valid: false };
    const torso = side([11,23], [12,24]);
    if (!torso) return { phase: 'ready', valid: false };
    // Reject seated or floor-based leg movements that can mimic a knee bend.
    const torsoDx = Math.abs(point(torso[0]).x - point(torso[1]).x);
    const torsoDy = Math.abs(point(torso[0]).y - point(torso[1]).y);
    if (torsoDy <= torsoDx * 1.05) return { phase: 'ready', valid: false };
    const leftKnee = leftVisible ? angle(point(23), point(25), point(27)) : null;
    const rightKnee = rightVisible ? angle(point(24), point(26), point(28)) : null;
    const anyKneeBent = (leftKnee !== null && leftKnee < 112) || (rightKnee !== null && rightKnee < 112);
    const allVisibleLegsStanding = (leftKnee === null || leftKnee > 150) && (rightKnee === null || rightKnee > 150);
    return {
      phase: anyKneeBent ? 'down' : allVisibleLegsStanding ? 'up' : 'ready',
      valid: true
    };
  }
  if (exercise === 'pushup') {
    const arm = side([11,13,15], [12,14,16]);
    if (!arm) return { phase: 'ready', valid: false };
    const body = arm[0] === 11 ? [11,23,27] : [12,24,28];
    if (!visible(body)) return { phase: 'ready', valid: false };

    // Elbow bending alone also occurs in standing arm curls. Require a
    // straight, near-horizontal shoulder-to-ankle line before counting.
    const bodyAngle = angle(point(body[0]), point(body[1]), point(body[2]));
    const bodyLevel = Math.abs(point(body[0]).y - point(body[2]).y) < 0.35;
    if (bodyAngle < 150 || !bodyLevel) return { phase: 'ready', valid: false };

    const elbow = angle(point(arm[0]), point(arm[1]), point(arm[2]));
    return { phase: elbow < 95 ? 'down' : elbow > 150 ? 'up' : 'ready', valid: true };
  }
  if (exercise === 'jumping-jack') {
    if (!visible([11,12,15,16,27,28])) return { phase: 'ready', valid: false };
    const wristY = (point(15).y + point(16).y) / 2;
    const shoulderY = (point(11).y + point(12).y) / 2;
    const feetGap = Math.abs(point(27).x - point(28).x);
    const shoulderGap = Math.max(0.08, Math.abs(point(11).x - point(12).x));
    const open = wristY < shoulderY - 0.04 && feetGap > shoulderGap * 2.1;
    const closed = wristY > shoulderY + 0.02 && feetGap < shoulderGap * 1.65;
    return { phase: open ? 'open' : closed ? 'closed' : 'ready', valid: true };
  }
  if (exercise === 'situp') {
    const torso = side([11,23,25], [12,24,26]);
    if (!torso) return { phase: 'ready', valid: false };
    const hip = angle(point(torso[0]), point(torso[1]), point(torso[2]));
    const horizontal = Math.abs(point(torso[0]).x - point(torso[1]).x);
    const vertical = Math.abs(point(torso[0]).y - point(torso[1]).y);
    const lyingBack = horizontal > vertical * 1.1;
    const sittingUp = vertical > horizontal * 1.1;
    // Reject standing hip bends: a sit-up starts with the torso horizontal
    // and reaches the raised phase with the torso more upright.
    if (hip > 145 && lyingBack) return { phase: 'down', valid: true };
    if (hip < 115 && sittingUp) return { phase: 'up', valid: true };
    return { phase: 'ready', valid: true };
  }
  if (exercise === 'plank') {
    const body = side([11,23,27], [12,24,28]);
    if (!body) return { phase: 'hold', valid: false };
    const arm = body[0] === 11 ? [11,13,15] : [12,14,16];
    if (!visible(arm)) return { phase: 'hold', valid: false };
    const bodyAngle = angle(point(body[0]), point(body[1]), point(body[2]));
    const bodyLevel = Math.abs(point(body[0]).y - point(body[2]).y) < 0.22;
    const bodyExtended = Math.abs(point(body[0]).x - point(body[2]).x) > 0.18;
    const elbowAngle = angle(point(arm[0]), point(arm[1]), point(arm[2]));
    const elbowBent = elbowAngle > 60 && elbowAngle < 130;
    const elbowUnderShoulder = Math.abs(point(arm[0]).x - point(arm[1]).x) < 0.2;
    return {
      phase: 'hold',
      valid: bodyAngle > 150 && bodyLevel && bodyExtended && elbowBent && elbowUnderShoulder
    };
  }
  if (exercise === 'highknees') {
    if (!visible([11,12,23,24,25,26,27,28])) return { phase: 'ready', valid: false };
    const shoulderX = (point(11).x + point(12).x) / 2;
    const shoulderY = (point(11).y + point(12).y) / 2;
    const hipX = (point(23).x + point(24).x) / 2;
    const hipY = (point(23).y + point(24).y) / 2;
    const torsoUpright = hipY > shoulderY + 0.08
      && Math.abs(hipY - shoulderY) > Math.abs(hipX - shoulderX);
    if (!torsoUpright) return { phase: 'ready', valid: false };

    const leftRaised = point(25).y < point(23).y - 0.1;
    const rightRaised = point(26).y < point(24).y - 0.1;
    const leftKnee = angle(point(23), point(25), point(27));
    const rightKnee = angle(point(24), point(26), point(28));
    // One leg must remain nearly straight as the other knee lifts. This
    // rejects seated knee raises and double-knee tucks as high-knee reps.
    const hasStandingSupport = leftRaised && !rightRaised
      ? rightKnee > 150
      : rightRaised && !leftRaised
        ? leftKnee > 150
        : !leftRaised && !rightRaised && (leftKnee > 150 || rightKnee > 150);
    if (!hasStandingSupport || (leftRaised && rightRaised)) return { phase: 'ready', valid: false };
    return { phase: leftRaised || rightRaised ? 'open' : 'closed', valid: true };
  }
  if (exercise === 'deadbug') {
    // Dead bugs alternate legs. Track either extension and re-arm only when
    // the visible legs return to their bent starting position.
    const leftVisible = visible([11,23,25]);
    const rightVisible = visible([12,24,26]);
    if (!leftVisible && !rightVisible) return { phase: 'ready', valid: false };
    const torso = side([11,23], [12,24]);
    if (!torso) return { phase: 'ready', valid: false };
    const torsoHorizontal = Math.abs(point(torso[0]).x - point(torso[1]).x)
      > Math.abs(point(torso[0]).y - point(torso[1]).y) * 1.1;
    if (!torsoHorizontal) return { phase: 'ready', valid: false };
    const leftAngle = leftVisible ? angle(point(11), point(23), point(25)) : null;
    const rightAngle = rightVisible ? angle(point(12), point(24), point(26)) : null;
    const anyLegExtended = (leftAngle !== null && leftAngle > 148)
      || (rightAngle !== null && rightAngle > 148);
    const allVisibleLegsBent = (leftAngle === null || leftAngle < 125)
      && (rightAngle === null || rightAngle < 125);
    return {
      phase: anyLegExtended ? 'up' : allVisibleLegsBent ? 'down' : 'ready',
      valid: true
    };
  }
  const torso = side([11,23,25], [12,24,26]);
  if (!torso) return { phase: 'ready', valid: false };
  const torsoHorizontal = Math.abs(point(torso[0]).x - point(torso[1]).x)
    > Math.abs(point(torso[0]).y - point(torso[1]).y) * 1.1;
  if (!torsoHorizontal) return { phase: 'ready', valid: false };
  const hipAngle = angle(point(torso[0]), point(torso[1]), point(torso[2]));
  return { phase: hipAngle < 130 ? 'down' : hipAngle > 155 ? 'up' : 'ready', valid: true };
}

function getCoachingCue(pose: Landmark[] | undefined, exercise: ExerciseType, phase: Phase): string {
  if (!pose) return 'Move your full body into the camera frame.';
  const point = (index: number) => pose[index];
  const visible = (indices: number[]) => indices.every(index => point(index) && (point(index).visibility ?? 1) > 0.55);
  const chooseSide = (left: number[], right: number[]) => {
    const leftVisible = visible(left), rightVisible = visible(right);
    if (!leftVisible && !rightVisible) return null;
    if (leftVisible && rightVisible) {
      const score = (items: number[]) => items.reduce((sum, index) => sum + (point(index).visibility ?? 1), 0);
      return score(left) >= score(right) ? left : right;
    }
    return leftVisible ? left : right;
  };
  if (exercise === 'plank') {
    const body = chooseSide([11,23,27], [12,24,28]);
    if (!body) return 'Keep your shoulders, hips and ankles visible.';
    const arm = body[0] === 11 ? [11,13,15] : [12,14,16];
    if (!visible(arm)) return 'Keep your shoulder, elbow and wrist visible from the side.';
    const lineAngle = angle(point(body[0]), point(body[1]), point(body[2]));
    const level = Math.abs(point(body[0]).y - point(body[2]).y);
    const elbowAngle = angle(point(arm[0]), point(arm[1]), point(arm[2]));
    if (Math.abs(point(arm[0]).x - point(arm[1]).x) >= 0.2) return 'Place your elbows directly beneath your shoulders.';
    if (elbowAngle <= 60 || elbowAngle >= 130) return 'Bend your elbows and keep your forearms supported.';
    if (lineAngle < 150) return 'Straighten your line from shoulders through hips to ankles.';
    if (level >= 0.22) return 'Adjust your hips so your body stays more level.';
    return 'Hold steady and keep breathing.';
  }
  if (exercise === 'pushup') {
    const body = chooseSide([11,23,27], [12,24,28]);
    if (!body) return 'Keep your shoulders, hips and ankles visible.';
    if (angle(point(body[0]), point(body[1]), point(body[2])) < 155) return 'Keep your shoulders, hips and ankles aligned.';
    return phase === 'down' ? 'Keep your body steady as you lower.' : phase === 'up' ? 'Press the floor away and finish tall.' : 'Lower your chest with control, then press back up.';
  }
  if (exercise === 'squat') return phase === 'down'
    ? 'Keep your chest lifted and knees tracking in line with your feet.'
    : phase === 'up' ? 'Press through your feet and stand tall.' : 'Sit your hips back, lower with control, then stand.';
  if (exercise === 'lunge') return phase === 'down'
    ? 'Keep your front knee tracking in line with your foot.'
    : phase === 'up' ? 'Press through the front foot and return to balance.' : 'Step back and lower only as far as feels comfortable.';
  if (exercise === 'jumping-jack') return phase === 'open'
    ? 'Bring your feet together and lower your arms smoothly.' : 'Open your feet while raising both arms.';
  if (exercise === 'highknees') return phase === 'open'
    ? 'Good lift. Alternate knees and keep your chest tall.' : 'Lift one knee towards hip height, then switch sides.';
  if (exercise === 'situp') return phase === 'up'
    ? 'Lower your shoulders slowly and keep your neck relaxed.' : 'Lift your chest using your core. Avoid pulling your neck.';
  if (exercise === 'deadbug') return phase === 'up'
    ? 'Return with control, then switch to the opposite side.' : 'Extend opposite arm and leg while keeping your back comfortable.';
  return phase === 'up'
    ? 'Lower your hips slowly and reset.' : 'Lift your hips by squeezing your glutes; avoid over-arching your back.';
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
  const lastVideoTimeRef = useRef(-1);
  const processingFailedRef = useRef(false);
  const poseSeenRef = useRef(false);
  const leftKneeRaisedRef = useRef(false);
  const rightKneeRaisedRef = useRef(false);
  const highKneesInitializedRef = useRef(false);
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const incrementCount = () => {
    const next = Math.min(countRef.current + 1, target);
    countRef.current = next;
    setCount(next);
    if (next >= target) setComplete(true);
  };
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [poseSeen, setPoseSeen] = useState(false);
  const [complete, setComplete] = useState(false);
  const [coachingTip, setCoachingTip] = useState('Move your full body into the camera frame.');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const voiceEnabledRef = useRef(false);
  const coachingCueRef = useRef('');
  const lastSpokenCueRef = useRef('');
  const lastSpokenAtRef = useRef(0);
  const config = EXERCISES[exercise];
  const voiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const speak = (message: string) => {
    if (!voiceSupported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
  };
  const toggleVoice = () => {
    const next = !voiceEnabled;
    voiceEnabledRef.current = next;
    setVoiceEnabled(next);
    if (next) speak(coachingTip || 'Voice coaching is on. Follow the live movement cues.');
    else if (voiceSupported) window.speechSynthesis.cancel();
  };
  const updateCoachingCue = (pose: Landmark[] | undefined, phase: Phase, now: number) => {
    const cue = getCoachingCue(pose, exercise, phase);
    if (cue !== coachingCueRef.current) {
      coachingCueRef.current = cue;
      setCoachingTip(cue);
      if (voiceEnabledRef.current && voiceSupported && cue !== lastSpokenCueRef.current && now - lastSpokenAtRef.current > 2800) {
        lastSpokenCueRef.current = cue;
        lastSpokenAtRef.current = now;
        speak(cue);
      }
    }
  };

  useEffect(() => {
    let alive = true;
    const stopCamera = () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
    const startLoop = () => {
      const loop = () => {
        if (!alive || !videoRef.current || !landmarkerRef.current || document.hidden || processingFailedRef.current) return;
        const video = videoRef.current;
        if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
          try {
            lastVideoTimeRef.current = video.currentTime;
            const now = performance.now();
            const result = landmarkerRef.current.detectForVideo(video, now);
            const pose = result.landmarks?.[0] as Landmark[] | undefined;
            if (pose) {
              const movement = getMovementPhase(pose, exercise);
              updateCoachingCue(pose, movement.phase, now);
              if (poseSeenRef.current !== movement.valid) { poseSeenRef.current = movement.valid; setPoseSeen(movement.valid); }

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
              } else if (exercise === 'highknees' && movement.valid) {
                const leftRaised = pose[25].y < pose[23].y - 0.1;
                const rightRaised = pose[26].y < pose[24].y - 0.1;
                if (!highKneesInitializedRef.current) {
                  leftKneeRaisedRef.current = leftRaised;
                  rightKneeRaisedRef.current = rightRaised;
                  highKneesInitializedRef.current = true;
                } else {
                  const newLift = (leftRaised && !leftKneeRaisedRef.current) || (rightRaised && !rightKneeRaisedRef.current);
                  if (newLift && now - lastCountAtRef.current > 250) {
                    lastCountAtRef.current = now;
                    incrementCount();
                  }
                  leftKneeRaisedRef.current = leftRaised;
                  rightKneeRaisedRef.current = rightRaised;
                }
              } else if (movement.valid && movement.phase !== 'ready') {
                stableFramesRef.current += 1;
                if (stableFramesRef.current >= 2) {
                  const previous = phaseRef.current;
                  const isCompletedCycle = exercise === 'jumping-jack'
                    // A jumping jack is one complete open-and-return cycle.
                    ? previous === 'open' && movement.phase === 'closed'
                    : (exercise === 'squat' || exercise === 'pushup' || exercise === 'situp' || exercise === 'lunge' || exercise === 'deadbug' || exercise === 'bridge')
                      ? previous === 'down' && movement.phase === 'up'
                      : previous === 'closed' && movement.phase === 'open';
                  if (isCompletedCycle && now - lastCountAtRef.current > 650) {
                    lastCountAtRef.current = now;
                    incrementCount();
                  }
                  phaseRef.current = movement.phase;
                }
              } else if (!movement.valid) {
                stableFramesRef.current = 0;
                phaseRef.current = 'ready';
                if (exercise === 'highknees') {
                  // Do not count a knee lift that happened while the standing
                  // pose or support leg was outside the verified camera frame.
                  highKneesInitializedRef.current = false;
                  leftKneeRaisedRef.current = false;
                  rightKneeRaisedRef.current = false;
                }
              } else {
                stableFramesRef.current = 0;
              }
            } else {
              updateCoachingCue(undefined, 'ready', now);
              if (poseSeenRef.current) { poseSeenRef.current = false; setPoseSeen(false); }
              stableFramesRef.current = 0;
              phaseRef.current = 'ready';
              lastFrameAtRef.current = 0;
              if (exercise === 'highknees') {
                highKneesInitializedRef.current = false;
                leftKneeRaisedRef.current = false;
                rightKneeRaisedRef.current = false;
              }
            }
          } catch (trackingError) {
            processingFailedRef.current = true;
            cancelAnimationFrame(rafRef.current);
            const detail = trackingError instanceof Error ? trackingError.message : String(trackingError);
            setError('Live pose tracking stopped: ' + detail + '. Tap retry to restart detection.');
          }
        }
        if (alive && !document.hidden) rafRef.current = requestAnimationFrame(loop);
      };
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };

    const start = async () => {
      let stage: 'camera' | 'preview' | 'pose-model' = 'camera';
      try {
        setLoading(true);
        setError('');
        setPoseSeen(false);
        setCoachingTip('Move your full body into the camera frame.');
        coachingCueRef.current = '';
        setCount(0);
        countRef.current = 0;
        setComplete(false);
        phaseRef.current = 'ready';
        stableFramesRef.current = 0;
        lastCountAtRef.current = 0;
        activeDurationRef.current = 0;
        lastFrameAtRef.current = 0;
        lastVideoTimeRef.current = -1;
        processingFailedRef.current = false;
        poseSeenRef.current = false;
        highKneesInitializedRef.current = false;
        leftKneeRaisedRef.current = false;
        rightKneeRaisedRef.current = false;

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('This Android WebView does not expose camera capture (getUserMedia). Update Android System WebView and Google Chrome, then reopen RiseFit.');
        }

        const constraints: MediaStreamConstraints = {
          video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
          audio: false,
        };
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          // Some Android camera providers reject ideal facing/size constraints.
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (!alive) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        stream.getVideoTracks().forEach(track => {
          track.onended = () => {
            if (!alive) return;
            // Stop the animation loop and release the pose model immediately.
            // A lost camera track otherwise leaves requestAnimationFrame polling
            // a video element that can no longer produce frames.
            cancelAnimationFrame(rafRef.current);
            processingFailedRef.current = true;
            landmarkerRef.current?.close();
            landmarkerRef.current = null;
            lastFrameAtRef.current = 0;
            if (poseSeenRef.current) {
              poseSeenRef.current = false;
              setPoseSeen(false);
            }
            setError('Camera stream ended. Reopen camera setup to continue.');
          };
        });

        stage = 'preview';
        const video = videoRef.current;
        if (!video) throw new Error('Camera stream opened, but the preview element is not available.');
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.srcObject = stream;
        await video.play();
        if (!alive) return;
        // Keep the live camera visible even if downloading the pose model fails.
        setLoading(false);

        stage = 'pose-model';
        const files = await FilesetResolver.forVisionTasks(
          '/mediapipe/wasm'
        );
        const model = await PoseLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: '/mediapipe/pose_landmarker_lite.task' },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.65,
          minPosePresenceConfidence: 0.65,
          minTrackingConfidence: 0.65,
        });
        if (!alive) { model.close(); return; }
        landmarkerRef.current = model;
        setError('');
        if (!document.hidden) startLoop();
      } catch (e) {
        if (alive) {
          setLoading(false);
          const errorName = e instanceof Error ? e.name : 'UnknownError';
          const detail = e instanceof Error ? e.message : String(e);
          if (stage === 'preview') {
            // getUserMedia may have succeeded even when video.play() fails.
            // Release that stream immediately so a failed preview does not
            // leave the camera active behind the error/retry state.
            stopCamera();
            if (videoRef.current) videoRef.current.srcObject = null;
          }
          if (stage === 'camera') {
            setError(errorName === 'NotAllowedError'
              ? 'Android reported that camera access was denied to the WebView, despite the app permission being enabled. This points to an Android WebView permission hand-off issue.'
              : `Camera could not start (${errorName}): ${detail}`);
          } else if (stage === 'preview') {
            setError(`The camera stream opened but Android could not display it (${errorName}): ${detail}`);
          } else {
            setError(`Camera is on, but the pose model could not load (${errorName}): ${detail}. Check internet access and retry; the live preview should remain visible.`);
          }
        }
      }
    };

    const visibilityHandler = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
        lastFrameAtRef.current = 0;
        lastVideoTimeRef.current = -1;
        streamRef.current?.getVideoTracks().forEach(track => { track.enabled = false; });
      } else if (alive) {
        streamRef.current?.getVideoTracks().forEach(track => { track.enabled = true; });
        if (landmarkerRef.current) startLoop();
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
      if (voiceSupported) window.speechSynthesis.cancel();
    };
  }, [target, exercise, unit, retryAttempt]);

  useEffect(() => {
    if (complete) {
      cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (voiceEnabledRef.current) speak('Target reached. Well done.');
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
    <div className="live-coaching-card" aria-live="polite">
      <div className="live-coaching-top"><span className="eyebrow">LIVE MOVEMENT CUE</span>{isWorkout && <button type="button" className="voice-coach-toggle" onClick={toggleVoice} disabled={!voiceSupported} aria-pressed={voiceEnabled}>{voiceEnabled ? <Volume2 size={15}/> : <VolumeX size={15}/>} {voiceSupported ? (voiceEnabled ? 'Voice on' : 'Voice off') : 'Voice unavailable'}</button>}</div>
      <p>{coachingTip}</p>
      <small>Guidance is based on visible pose landmarks. It is a movement aid, not a medical-grade form assessment.</small>
    </div>
    {error && <><div className="notice"><Camera size={17}/><span>{error}</span></div><button className="secondary full" onClick={() => setRetryAttempt(value => value + 1)}><RotateCcw size={15}/> Retry camera &amp; pose setup</button></>}
    {complete
      ? <><div className="notice"><ShieldCheck size={17}/><span>{unit === 'sec' ? 'RiseFit verified the hold duration while your body remained in the detected plank position.' : 'RiseFit detected the target movement cycles on this device.'} Your camera feed is not uploaded.</span></div><button className="primary full" onClick={onVerified}><CheckCircle2 size={17}/> {completionLabel ?? (isWorkout ? 'Continue' : 'Dismiss challenge')}</button></>
      : <p className="muted" style={{textAlign:'center',fontSize:12}}>On-device pose estimation · No video recording or upload</p>}
  </section>;
}
