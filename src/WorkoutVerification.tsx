import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { Activity, Camera, CheckCircle2, ShieldCheck } from 'lucide-react';

type Props = { target?: number; onVerified: () => void };
type Landmark = { x: number; y: number; visibility?: number };

export default function WorkoutVerification({ target = 20, onVerified }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef<'standing' | 'lowered'>('standing');
  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [poseSeen, setPoseSeen] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let alive = true;
    const start = async () => {
      try {
        setLoading(true);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const files = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm'
        );
        const model = await PoseLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task' },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.55,
          minPosePresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });
        if (!alive) { model.close(); return; }
        landmarkerRef.current = model;
        setReady(true);
        setLoading(false);
        const loop = () => {
          if (!alive || !videoRef.current || !landmarkerRef.current) return;
          const video = videoRef.current;
          if (video.readyState >= 2) {
            const result = landmarkerRef.current.detectForVideo(video, performance.now());
            const pose = result.landmarks?.[0] as Landmark[] | undefined;
            if (pose && pose[23] && pose[24] && pose[25] && pose[26] && pose[11] && pose[12]) {
              const visible = [pose[23], pose[24], pose[25], pose[26], pose[11], pose[12]]
                .every(p => (p.visibility ?? 1) > 0.5);
              if (visible) {
                setPoseSeen(true);
                const hipY = (pose[23].y + pose[24].y) / 2;
                const kneeY = (pose[25].y + pose[26].y) / 2;
                const shoulderY = (pose[11].y + pose[12].y) / 2;
                const torso = Math.max(0.08, hipY - shoulderY);
                const bend = (kneeY - hipY) / torso;
                if (bend > 0.18) phaseRef.current = 'lowered';
                if (bend < 0.02 && phaseRef.current === 'lowered') {
                  phaseRef.current = 'standing';
                  setCount(prev => {
                    const next = prev + 1;
                    if (next >= target) {
                      setComplete(true);
                      setReady(false);
                    }
                    return Math.min(next, target);
                  });
                }
              } else setPoseSeen(false);
            } else setPoseSeen(false);
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (e) {
        if (alive) {
          setLoading(false);
          setError(e instanceof Error ? e.message : 'Camera or pose model could not start. Allow camera access and retry.');
        }
      }
    };
    void start();
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [target]);

  useEffect(() => {
    if (complete) {
      cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
    }
  }, [complete]);

  return <section className="panel session">
    <span className="eyebrow">ALARM CHALLENGE · LIVE VERIFICATION</span>
    <h2>Complete {target} bodyweight squats</h2>
    <p className="muted">Keep your full upper body and legs in frame. RiseFit counts a rep when it detects a squat down and return to standing.</p>
    <div style={{position:'relative', overflow:'hidden', borderRadius:16, background:'#090b08', aspectRatio:'4/3', margin:'18px 0'}}>
      <video ref={videoRef} muted playsInline style={{width:'100%',height:'100%',objectFit:'cover',transform:'scaleX(-1)'}} />
      {!poseSeen && !complete && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'#090b08aa',color:'#f4f5f2',textAlign:'center',padding:20}}><Camera size={28}/><p>Stand back so your shoulders, hips and knees are visible.</p></div>}
      {complete && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'#10160dcc',color:'#c5f36b'}}><CheckCircle2 size={52}/><b>Challenge complete</b></div>}
    </div>
    <div className="counter">
      <span className="eyebrow">{loading ? 'INITIALIZING CAMERA & POSE MODEL' : error ? 'CAMERA SETUP ISSUE' : poseSeen ? 'BODY DETECTED · KEEP MOVING' : 'SEARCHING FOR FULL BODY'}</span>
      <div className="number">{count}<small>/ {target} reps</small></div>
      <div className="progress-track count-track"><i style={{width:`${count/target*100}%`}}/></div>
    </div>
    {error && <div className="notice"><Camera size={17}/><span>{error}</span></div>}
    {complete ? <><div className="notice"><ShieldCheck size={17}/><span>Live camera pose tracking recorded the target repetitions on this device. Your camera feed is not uploaded.</span></div><button className="primary full" onClick={onVerified}><CheckCircle2 size={17}/> Dismiss challenge</button></> : <p className="muted" style={{textAlign:'center',fontSize:12}}>On-device pose estimation · No video recording or upload</p>}
  </section>;
}
