import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { NativeAlarm, type DailyStepStats, type NativeAlarmStatus } from './nativeAlarm';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Activity, AlarmClock, Home, Dumbbell, Flame, Settings, Play, ChevronRight, ChevronLeft, Timer, Plus, CheckCircle2, ArrowLeft, RotateCcw, CalendarDays, ShieldCheck, Footprints, Pencil, Camera } from 'lucide-react';
import WorkoutVerification, { type ExerciseType } from './WorkoutVerification';
import Statistics from './Statistics';
import ProfileSetup, { getLocalDateKey, isValidDateOnly, type RiseFitProfile } from './Profile';
import DeviceSetup from './DeviceSetup';
import WomensFitness from './WomensFitness';
import AlarmReliability from './AlarmReliability';
import ExerciseDemonstration from './ExerciseDemonstration';
import RestTimer from './RestTimer';
import FitnessGoals from './FitnessGoals';
import DataPrivacy from './DataPrivacy';
import DeviceHealth from './DeviceHealth';

type AlarmDifficulty = 'Easy' | 'Normal' | 'Hard' | 'Extreme';
type AlarmExerciseConfig = { exerciseId: ExerciseId; target: number; rounds: number };
type WakeAlarm = { id: string; time: string; enabled: boolean; label: string; challenge?: AlarmExerciseConfig[]; difficulty?: AlarmDifficulty; requireAllMissions?: boolean };
type CompletedSession = { id: string; title: string; kind: 'plan' | 'alarm' | 'exercise'; completedAt: string };
type RestState = { mode: 'plan-round' | 'plan-exercise' | 'library-round'; nextLabel: string };
type ExerciseId = 'squat'|'pushup'|'jack'|'situp'|'plank'|'lunge'|'highknees'|'deadbug'|'bridge';
type Exercise = { id:ExerciseId; name:string; category:string; target:number; unit:'reps'|'sec'; rounds:number; cues:string[]; easier:string };
const poseExerciseById:Record<ExerciseId,ExerciseType>={squat:'squat',pushup:'pushup',jack:'jumping-jack',situp:'situp',plank:'plank',lunge:'lunge',highknees:'highknees',deadbug:'deadbug',bridge:'bridge'};
const defaultAlarmChallenge:AlarmExerciseConfig[]=[{exerciseId:'squat',target:20,rounds:1}];
const alarmDifficultyFactor:Record<AlarmDifficulty,number>={Easy:0.75,Normal:1,Hard:1.25,Extreme:1.5};
const alarmTarget=(alarm:WakeAlarm,item:AlarmExerciseConfig)=>Math.max(1,Math.min(300,Math.round(item.target*alarmDifficultyFactor[alarm.difficulty??'Normal'])));
const exercises:Exercise[]=[
 {id:'squat',name:'Bodyweight Squat',category:'Full body',target:20,unit:'reps',rounds:3,cues:['Feet around shoulder-width apart.','Sit hips back with chest lifted.','Press through feet to stand tall.'],easier:'Squat to a sturdy chair.'},
 {id:'pushup',name:'Push-up',category:'Strength',target:12,unit:'reps',rounds:3,cues:['Hands slightly wider than shoulders.','Keep body in a straight line.','Lower with control and push up.'],easier:'Use a wall or do knee push-ups.'},
 {id:'jack',name:'Jumping Jack',category:'Cardio',target:30,unit:'reps',rounds:3,cues:['Stand tall with arms down.','Jump feet apart and raise arms.','Return smoothly.'],easier:'Step side-to-side without jumping.'},
 {id:'situp',name:'Sit-up',category:'Core',target:12,unit:'reps',rounds:3,cues:['Lie on your back with knees bent.','Lift your upper body with control.','Lower your shoulders back to the floor.'],easier:'Use a smaller range of motion.'},
 {id:'plank',name:'Forearm Plank',category:'Core',target:30,unit:'sec',rounds:3,cues:['Elbows beneath shoulders.','Brace core and keep hips level.','Breathe steadily.'],easier:'Keep knees on the floor.'},
 {id:'lunge',name:'Reverse Lunge',category:'Full body',target:12,unit:'reps',rounds:3,cues:['Stand with feet hip-width apart.','Step back and lower carefully.','Push through front foot; alternate.'],easier:'Hold a stable chair for balance.'},
 {id:'highknees',name:'High Knees',category:'Cardio',target:30,unit:'reps',rounds:3,cues:['Stand upright and brace core.','Lift knees in alternating rhythm.','Stay light and breathe.'],easier:'March in place.'},
 {id:'deadbug',name:'Dead Bug',category:'Core',target:10,unit:'reps',rounds:3,cues:['Lie on back with arms raised.','Extend opposite arm and leg slowly.','Return and alternate.'],easier:'Move one limb at a time.'},
 {id:'bridge',name:'Glute Bridge',category:'Strength',target:15,unit:'reps',rounds:3,cues:['Lie back with knees bent.','Press feet down and lift hips.','Pause, then lower slowly.'],easier:'Lift hips to a comfortable height.'},
];
const DEFAULT_ALARMS: WakeAlarm[] = [{id:'default',time:'06:30',enabled:false,label:'Morning workout'}];
const isRecord = (value: unknown): value is Record<string, unknown> =>
 value !== null && typeof value === 'object' && !Array.isArray(value);
const validExerciseIds: ExerciseId[] = ['squat','pushup','jack','situp','plank','lunge','highknees','deadbug','bridge'];
const loadProfile = (): RiseFitProfile | null => {
 try {
  const raw = localStorage.getItem('risefit-profile-v1');
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || typeof value.fullName !== 'string' || !value.fullName.trim() ||
      !isValidDateOnly(value.dateOfBirth) || value.dateOfBirth > getLocalDateKey()) return null;
  const level = ['Beginner','Intermediate','Expert'].includes(String(value.level)) ? value.level as RiseFitProfile['level'] : 'Beginner';
  const goal = ['glutes','lower-body','core','full-body','upper-body'].includes(String(value.goal)) ? value.goal as RiseFitProfile['goal'] : 'full-body';
  return {fullName:value.fullName.trim(),dateOfBirth:value.dateOfBirth,level,goal};
 } catch { return null; }
};
const loadAlarms = (): WakeAlarm[] => {
 try {
  const raw = localStorage.getItem('risefit-alarms-v2');
  if (!raw) return DEFAULT_ALARMS;
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) return DEFAULT_ALARMS;
  if (value.length === 0) return [];
  const restored = value.filter((item): item is Record<string, unknown> =>
   isRecord(item) && typeof item.id === 'string' && typeof item.label === 'string' &&
   typeof item.enabled === 'boolean' && typeof item.time === 'string' &&
   /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.time)
  ).map(item => {
   const challenge = Array.isArray(item.challenge) ? item.challenge.filter((entry): entry is AlarmExerciseConfig =>
    isRecord(entry) && typeof entry.exerciseId === 'string' && validExerciseIds.includes(entry.exerciseId as ExerciseId) &&
    Number.isInteger(entry.target) && Number(entry.target) >= 1 && Number(entry.target) <= 300 &&
    Number.isInteger(entry.rounds) && Number(entry.rounds) >= 1 && Number(entry.rounds) <= 10
   ) : undefined;
   return {id:item.id as string,time:item.time as string,enabled:item.enabled as boolean,label:item.label as string,
    difficulty:['Easy','Normal','Hard','Extreme'].includes(String(item.difficulty)) ? item.difficulty as AlarmDifficulty : 'Normal',
    requireAllMissions:typeof item.requireAllMissions === 'boolean' ? item.requireAllMissions : false,
    ...(challenge?.length ? {challenge} : {})};
  });
  return restored.length ? restored : DEFAULT_ALARMS;
 } catch { return DEFAULT_ALARMS; }
};
const loadHistory = (): CompletedSession[] => {
 try {
  const raw = localStorage.getItem('risefit-workout-history-v1');
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CompletedSession =>
   isRecord(item) && typeof item.id === 'string' && typeof item.title === 'string' &&
   ['plan','alarm','exercise'].includes(String(item.kind)) &&
   typeof item.completedAt === 'string' && !Number.isNaN(Date.parse(item.completedAt)) && Date.parse(item.completedAt) <= Date.now()
  );
 } catch { return []; }
};

const plans=[{id:'wake',title:'Full Body Wake-up',subtitle:'Balanced morning reset',duration:'8–10 min',ids:['squat','pushup','jack','plank']},{id:'core',title:'Core Ignition',subtitle:'Steady midsection',duration:'10–12 min',ids:['plank','situp','deadbug','bridge']},{id:'cardio',title:'Quick Cardio',subtitle:'Get your heart moving',duration:'8–10 min',ids:['jack','highknees','lunge']},{id:'glutes',title:'Glutes & Lower Body',subtitle:'Controlled lower-body strength',duration:'8–10 min',ids:['bridge','squat','lunge']},{id:'upper',title:'Upper Body & Core',subtitle:'Push strength and trunk control',duration:'8–10 min',ids:['pushup','plank','deadbug']}];
const lowImpactTargets:Record<ExerciseId,number>={bridge:10,squat:8,deadbug:8,plank:15,pushup:6,jack:10,situp:8,lunge:6,highknees:10};
const lowImpactPlan={id:'low-impact',title:'Low-impact Strength & Mobility',subtitle:'Controlled, lower-impact movements',duration:'8–10 min',ids:['bridge','squat','deadbug','plank']};
const allPlans=[...plans,lowImpactPlan];
const formatClockTime=(value:string)=>{const [hourText,minuteText]=value.split(':');const hour=Number(hourText);const period=hour>=12?'PM':'AM';const displayHour=hour%12||12;return `${displayHour}:${minuteText} ${period}`;};
const getGreeting=(date:Date)=>{const hour=date.getHours();return hour<5?'Up late?':hour<12?'Good morning.':hour<17?'Good afternoon.':hour<22?'Good evening.':'Winding down?';};
const localDayKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
type Tab='Overview'|'My alarms'|'Workouts'|'Statistics'|'Calendar'|'Alarm Challenge'|'Profile';
export default function App(){
 const [now,setNow]=useState(()=>new Date()); const [calendarMonth,setCalendarMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
 useEffect(()=>{const update=()=>setNow(new Date());const timer=window.setInterval(update,60_000);document.addEventListener('visibilitychange',update);return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',update);};},[]);
 const [deviceSetupComplete,setDeviceSetupComplete]=useState(()=>localStorage.getItem('risefit-device-setup-v1')==='done');
 const completeDeviceSetup=()=>{localStorage.setItem('risefit-device-setup-v1','done');setDeviceSetupComplete(true);};
 const [tab,setTab]=useState<Tab>('Overview'); const [activeAlarmId,setActiveAlarmId]=useState<string|null>(null); const [notificationAccess,setNotificationAccess]=useState<boolean|null>(null); const [alarmChallengeDone,setAlarmChallengeDone]=useState(false); const [followOnIndex,setFollowOnIndex]=useState<number|null>(null); const [alarmRound,setAlarmRound]=useState(1); const [profile,setProfile]=useState<RiseFitProfile|null>(loadProfile); const [alarmOn,setAlarmOn]=useState(false); const [alarms,setAlarms]=useState<WakeAlarm[]>(loadAlarms); const [filter,setFilter]=useState('All'); const [detail,setDetail]=useState<Exercise|null>(null); const [planId,setPlanId]=useState<string|null>(null); const [idx,setIdx]=useState(0); const [round,setRound]=useState(1); const [complete,setComplete]=useState(false); const [history,setHistory]=useState<CompletedSession[]>(loadHistory); const [alarmStatus,setAlarmStatus]=useState<NativeAlarmStatus|null>(null); const [alarmSaveNotice,setAlarmSaveNotice]=useState<string|null>(null); const [editingAlarmId,setEditingAlarmId]=useState<string|null>(null); const [editingAlarmTime,setEditingAlarmTime]=useState<string|null>(null); const [exerciseRound,setExerciseRound]=useState(1); const [exerciseVerificationStarted,setExerciseVerificationStarted]=useState(false); const [exerciseCompleted,setExerciseCompleted]=useState(false); const [restState,setRestState]=useState<RestState|null>(null); const [dailyStepStats,setDailyStepStats]=useState<DailyStepStats|null>(null); const [stepStatsLoading,setStepStatsLoading]=useState(true); const [stepStatsError,setStepStatsError]=useState('');
 const [lowImpactMode,setLowImpactMode]=useState(()=>localStorage.getItem('risefit-low-impact-mode-v1')==='on');
 const [restDayEnabled,setRestDayEnabled]=useState(()=>localStorage.getItem('risefit-rest-day-v1')===localDayKey(new Date()));
 const refreshDailySteps=async()=>{
  if(Capacitor.getPlatform()!=='android'){
   setDailyStepStats({available:false,permissionGranted:false,stepsToday:0,days:[],message:'Automatic daily step reading is available in the RiseFit Android app.'});
   setStepStatsLoading(false);
   return;
  }
  setStepStatsLoading(true);
  try{
   const result=await NativeAlarm.getDailyStepStats();
   setDailyStepStats(result);
   setStepStatsError('');
  }catch(error){
   setStepStatsError(error instanceof Error?error.message:'RiseFit could not read its on-device step counter.');
  }finally{setStepStatsLoading(false);}
 };
 const requestStepReadAccess=async()=>{
  setStepStatsError('');
  try{
   const notificationPermission=await LocalNotifications.requestPermissions();
   if(notificationPermission.display!=='granted')throw new Error('Allow RiseFit notifications so Android can show the background step-tracking notification.');
   await NativeAlarm.requestStepTrackingPermission();
   await refreshDailySteps();
  }catch(error){setStepStatsError(error instanceof Error?error.message:'Could not enable the phone step counter.');}
 };
 useEffect(()=>{
  let disposed=false;
  const refresh=async()=>{
   if(document.hidden)return;
   try{
    if(Capacitor.getPlatform()!=='android'){
     if(!disposed)setDailyStepStats({available:false,permissionGranted:false,stepsToday:0,days:[],message:'Automatic daily step reading is available in the RiseFit Android app.'});
     if(!disposed)setStepStatsLoading(false);
     return;
    }
    const result=await NativeAlarm.getDailyStepStats();
    if(!disposed){setDailyStepStats(result);setStepStatsError('');}
   }catch(error){if(!disposed)setStepStatsError(error instanceof Error?error.message:'RiseFit could not read its on-device step counter.');}
   finally{if(!disposed)setStepStatsLoading(false);}
  };
  void refresh();
  const timer=window.setInterval(()=>void refresh(),60_000);
  document.addEventListener('visibilitychange',refresh);
  window.addEventListener('focus',refresh);
  return()=>{disposed=true;window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);};
 },[]);
 const refreshAlarmStatus=async()=>{
  if(Capacitor.getPlatform()!=='android')return;
  try{
   const [status,notifications]=await Promise.all([NativeAlarm.getStatus(),LocalNotifications.checkPermissions()]);
   setAlarmStatus(status);setAlarmOn(status.scheduled);setNotificationAccess(notifications.display==='granted');
  }catch{}
 };
 useEffect(()=>{
  if(Capacitor.getPlatform()!=='android')return;
  let listener:{remove:()=>Promise<void>}|undefined;
  let disposed=false;
  void NativeAlarm.addListener('alarmTriggered',event=>{setActiveAlarmId(event.alarmId??null);setAlarmChallengeDone(false);setFollowOnIndex(0);setAlarmRound(1);setTab('Alarm Challenge');}).then(value=>{if(disposed)void value.remove();else listener=value;});
  void LocalNotifications.cancel({notifications:[{id:6301}]}).catch(()=>{});
  const checkLaunch=async()=>{try{const result=await NativeAlarm.consumeAlarmLaunch();if(result.openChallenge){setActiveAlarmId(result.alarmId??null);setAlarmChallengeDone(false);setFollowOnIndex(0);setAlarmRound(1);setTab('Alarm Challenge');}await refreshAlarmStatus();}catch{}};
  const onVisibility=()=>{if(!document.hidden)void checkLaunch();};
  void checkLaunch();
  document.addEventListener('visibilitychange',onVisibility);
  return()=>{disposed=true;document.removeEventListener('visibilitychange',onVisibility);void listener?.remove();};
 },[]);

 useEffect(()=>{if(profile)localStorage.setItem('risefit-profile-v1',JSON.stringify(profile));},[profile]);
 useEffect(()=>{localStorage.setItem('risefit-alarms-v2',JSON.stringify(alarms));setAlarmOn(alarms.some(a=>a.enabled));},[alarms]);
 useEffect(()=>{localStorage.setItem('risefit-workout-history-v1',JSON.stringify(history));},[history]);
 useEffect(()=>{localStorage.setItem('risefit-low-impact-mode-v1',lowImpactMode?'on':'off');},[lowImpactMode]);
 useEffect(()=>{if(restDayEnabled)localStorage.setItem('risefit-rest-day-v1',localDayKey(new Date()));else localStorage.removeItem('risefit-rest-day-v1');},[restDayEnabled]);
 useEffect(()=>{if(localStorage.getItem('risefit-rest-day-v1')!==localDayKey(now)&&restDayEnabled)setRestDayEnabled(false);},[now,restDayEnabled]);
 const recordSession=(title:string,kind:CompletedSession['kind'])=>setHistory(items=>[...items,{id:`${Date.now()}-${items.length}`,title,kind,completedAt:new Date().toISOString()}]);
 const deleteProfileAndTrainingData=()=>{localStorage.removeItem('risefit-profile-v1');localStorage.removeItem('risefit-fitness-goals-v1');localStorage.removeItem('risefit-low-impact-mode-v1');localStorage.removeItem('risefit-rest-day-v1');setProfile(null);setHistory([]);setLowImpactMode(false);setRestDayEnabled(false);};
 const sessions=history.length;
 const updateAlarm=(id:string,patch:Partial<WakeAlarm>)=>setAlarms(items=>items.map(a=>a.id===id?{...a,...patch}:a));
 const addAlarm=()=>{const alarm:WakeAlarm={id:`alarm-${Date.now()}`,time:'07:00',enabled:false,label:`Alarm ${alarms.length+1}`,challenge:[...defaultAlarmChallenge],difficulty:'Normal',requireAllMissions:true};setAlarms(items=>[...items,alarm]);setEditingAlarmId(alarm.id);setEditingAlarmTime(alarm.time);};
 const getAlarmChallenge=(alarm:WakeAlarm)=>alarm.challenge?.length?alarm.challenge:defaultAlarmChallenge;
 const updateAlarmChallenge=(alarmId:string,index:number,patch:Partial<AlarmExerciseConfig>)=>setAlarms(items=>items.map(alarm=>alarm.id!==alarmId?alarm:{...alarm,challenge:getAlarmChallenge(alarm).map((item,i)=>i===index?{...item,...patch}:item)}));
 const addAlarmExercise=(alarmId:string)=>setAlarms(items=>items.map(alarm=>{if(alarm.id!==alarmId)return alarm;const current=getAlarmChallenge(alarm);const used=new Set(current.map(item=>item.exerciseId));const next=exercises.find(item=>!used.has(item.id))??exercises[0];return {...alarm,challenge:[...current,{exerciseId:next.id,target:next.target,rounds:1}]};}));
 const removeAlarmExercise=(alarmId:string,index:number)=>setAlarms(items=>items.map(alarm=>alarm.id!==alarmId?alarm:{...alarm,challenge:getAlarmChallenge(alarm).filter((_,i)=>i!==index)}));
 const applyAlarmRoutine=(alarmId:string,preset:'gentle'|'balanced'|'energising')=>{
  const routines:Record<typeof preset,{difficulty:AlarmDifficulty;items:AlarmExerciseConfig[]}>= {
   gentle:{difficulty:'Easy',items:[{exerciseId:'bridge',target:10,rounds:1},{exerciseId:'squat',target:8,rounds:1},{exerciseId:'plank',target:15,rounds:1}]},
   balanced:{difficulty:'Normal',items:[{exerciseId:'squat',target:15,rounds:1},{exerciseId:'highknees',target:20,rounds:1},{exerciseId:'pushup',target:8,rounds:1},{exerciseId:'plank',target:20,rounds:1}]},
   energising:{difficulty:'Hard',items:[{exerciseId:'squat',target:20,rounds:1},{exerciseId:'jack',target:25,rounds:1},{exerciseId:'lunge',target:12,rounds:1},{exerciseId:'highknees',target:30,rounds:1}]}
  };
  const selected=routines[preset];
  setAlarms(items=>items.map(alarm=>alarm.id===alarmId?{...alarm,challenge:selected.items,difficulty:selected.difficulty,requireAllMissions:true}:alarm));
 };
 const scheduleWakeAlarm=async(alarm:WakeAlarm,closeEditor=false)=>{
  if(Capacitor.getPlatform()!=='android'){window.alert('The ringing wake-up alarm is available in the RiseFit Android app.');return;}
  try{
   const permission=await LocalNotifications.requestPermissions();
   if(permission.display!=='granted'){window.alert('Allow RiseFit notifications so Android can show the ringing alarm controls.');return;}
   const status=await NativeAlarm.getStatus();setAlarmStatus(status);
   if(!status.canScheduleExactAlarms){await NativeAlarm.requestExactAlarmAccess();window.alert('Allow RiseFit to set exact alarms in Android settings, then return and tap Save again.');return;}
   
   const [hour,minute]=alarm.time.split(':').map(Number);
   const updated=await NativeAlarm.schedule({id:alarm.id,hour,minute});
   setAlarmStatus(updated);updateAlarm(alarm.id,{enabled:true,time:alarm.time});setAlarmSaveNotice(`Alarm saved and enabled for ${formatClockTime(alarm.time)}.`);if(closeEditor){setEditingAlarmId(null);setEditingAlarmTime(null);}
  }catch(error){window.alert(error instanceof Error?error.message:'RiseFit could not schedule this alarm.');}
 };
 const requestExactAlarm=async()=>{try{await NativeAlarm.requestExactAlarmAccess();}catch(error){window.alert(error instanceof Error?error.message:'Could not open exact-alarm settings.');}};
 const requestFullScreenAccess=async()=>{try{await NativeAlarm.requestFullScreenAccess();}catch(error){window.alert(error instanceof Error?error.message:'Could not open full-screen alarm settings.');}};
 const disableWakeAlarm=async(id:string)=>{if(Capacitor.getPlatform()==='android'){await NativeAlarm.cancelAlarm({id});await refreshAlarmStatus();}updateAlarm(id,{enabled:false});};
 useEffect(()=>{if(tab==='My alarms')void refreshAlarmStatus();},[tab]);
 const currentPlan=allPlans.find(p=>p.id===planId); const sessionExercises=currentPlan?.ids.map(id=>{const exercise=exercises.find(e=>e.id===id)!;return currentPlan.id==='low-impact'?{...exercise,target:lowImpactTargets[id as ExerciseId]??exercise.target,rounds:2}:exercise;})??[]; const current=sessionExercises[idx];
 const start=(id:string)=>{setDetail(null);setRestState(null);setPlanId(id);setIdx(0);setRound(1);setComplete(false);};
 const advanceSession=()=>{if(!current)return; if(round<current.rounds){setRestState({mode:'plan-round',nextLabel:`${current.name} · round ${round+1}`});return;} if(idx+1<sessionExercises.length){setRestState({mode:'plan-exercise',nextLabel:sessionExercises[idx+1].name});return;}setComplete(true);recordSession(currentPlan?.title??'Workout plan','plan');};
 const finishRest=()=>{const pending=restState;if(!pending)return;setRestState(null);if(pending.mode==='plan-round'){setRound(value=>value+1);return;}if(pending.mode==='plan-exercise'){setIdx(value=>value+1);setRound(1);return;}setExerciseRound(value=>value+1);};
 const exit=()=>{setRestState(null);setPlanId(null);setComplete(false);};
 const tabs:[Tab,typeof Home][]=[['Overview',Home],['My alarms',AlarmClock],['Workouts',Dumbbell],['Statistics',Flame]];
 if(!profile)return <ProfileSetup onSave={setProfile}/>;
 if(!deviceSetupComplete)return <DeviceSetup onComplete={completeDeviceSetup}/>;
 return <div className="shell"><aside className="sidebar"><div className="brand"><span className="brand-symbol"><Activity/></span>Rise<span className="lime">Fit</span></div><div className="side-caption">YOUR SPACE</div><nav>{tabs.map(([label,Icon])=><button key={label} className={`nav ${tab===label?'active':''}`} onClick={()=>{setTab(label);setPlanId(null);setDetail(null)}}><Icon size={18}/>{label}</button>)}</nav><div className="side-bottom"><div className="motto"><Flame className="lime" size={18}/><b>Small steps.<br/>Strong habits.</b></div><button className={`nav ${tab==='Profile'?'active':''}`} onClick={()=>setTab('Profile')}><Settings size={18}/>Profile & settings</button></div></aside>
 <main className="main"><header className="header"><div><span className="eyebrow">YOUR DAILY RITUAL</span><h1>{planId?(complete?'You showed up.':'One rep at a time.'):tab==='Overview'?getGreeting(now):tab==='My alarms'?'Your alarms.':tab==='Workouts'?'Find your movement.':tab==='Statistics'?'Your progress.':tab==='Calendar'?'Your activity calendar.':'Your daily ritual.'}</h1>{tab==='Overview'&&!planId&&<p className="header-greeting-name">{profile.fullName}</p>}</div><button type="button" className="date-chip" onClick={()=>{setCalendarMonth(new Date(now.getFullYear(),now.getMonth(),1));setTab('Calendar');setPlanId(null);setDetail(null);}} aria-label="Open workout calendar"><CalendarDays size={15}/> Daily ritual</button><button type="button" className="date-chip" onClick={()=>setTab('Profile')} aria-label="Open profile"><Settings size={15}/></button></header>
 {tab==='Overview'&&!planId&&<><section className="hero-grid"><article className="hero"><span className="pill"><i/> NEXT WAKE-UP</span><div className="clock">{formatClockTime(alarms.find(a=>a.enabled)?.time??alarms[0]?.time??'06:30')}</div><p>Wake up with intention.<br/>Earn your morning.</p><button className="primary" onClick={()=>setTab('My alarms')}>Manage alarm <ChevronRight size={16}/></button><div className="clock-art"><div className="ring"><AlarmClock size={65}/></div><span>✳</span></div></article><article className="streak steps-home-card"><div className="cardline"><span className="eyebrow">STEPS TODAY</span><Footprints className="lime" size={20}/></div><div className="bigstat">{dailyStepStats?.permissionGranted?dailyStepStats.stepsToday.toLocaleString():'—'} <small>steps</small></div><p>{dailyStepStats?.permissionGranted?'Automatically counted by your phone, even when RiseFit is closed.':dailyStepStats?.available?(dailyStepStats.message??'Enable automatic step counting once to start tracking in the background.'):(dailyStepStats?.message??'Automatic step tracking is available in the Android app on phones with a step sensor.')}</p>{!dailyStepStats?.permissionGranted&&dailyStepStats?.available&&<button className="linkbtn" disabled={stepStatsLoading} onClick={()=>void requestStepReadAccess()}>{stepStatsLoading?'Checking…':'Enable automatic step counting'} <ChevronRight size={14}/></button>}{stepStatsError&&<p className="step-counter-error" role="alert">{stepStatsError}</p>}<span className="steps-home-workouts">{sessions} workout sessions completed</span></article></section>{!restDayEnabled&&<><section className="section-title"><div><span className="eyebrow">START MOVING</span><h2>Workout plans</h2></div><button className="linkbtn" onClick={()=>setTab('Workouts')}>Workout library <ChevronRight size={15}/></button></section><div className="plan-list">{plans.slice(0,2).map((p,i)=><div className="plan-row" key={p.id}><span className={`plan-icon tone${i}`}><Dumbbell size={19}/></span><div className="plan-info"><b>{p.title}</b><span>{p.subtitle} · {profile.level}</span></div><span className="duration"><Timer size={14}/>{p.duration}</span><button className="play" onClick={()=>{setTab('Workouts');start(p.id)}}><Play size={14} fill="currentColor"/></button></div>)}</div><div className="quote"><span>✳</span><p>You don’t have to be extreme. Just consistent.</p><small>RISEFIT MINDSET</small></div></>}</>}
 {tab==='Overview'&&!planId&&<FitnessGoals dailySteps={dailyStepStats?.days??[]} stepsPermissionGranted={dailyStepStats?.permissionGranted??false} sessions={history} profileGoal={profile.goal} lowImpactMode={lowImpactMode} onLowImpactChange={setLowImpactMode} restDayEnabled={restDayEnabled} onRestDayChange={setRestDayEnabled} onStartPlan={id=>{setTab('Workouts');start(id);}}/>}

 {tab==='My alarms'&&!planId&&<section className="panel"><div className="section-title"><div><span className="eyebrow">WAKE-UP ROUTINE</span><h2>Your alarms</h2></div><span className="pill">{alarms.filter(a=>a.enabled).length} ENABLED</span></div><AlarmReliability alarmStatus={alarmStatus} notificationAccess={notificationAccess} stepsAvailable={dailyStepStats?.available??false} stepsEnabled={dailyStepStats?.permissionGranted??false} onRefresh={()=>void refreshAlarmStatus()} onReviewSetup={()=>{localStorage.removeItem('risefit-device-setup-v1');setDeviceSetupComplete(false);}}/>{Capacitor.getPlatform()==='android'&&alarmStatus&&!alarmStatus.canScheduleExactAlarms&&alarms.some(a=>a.enabled)&&<div className="notice" role="status"><ShieldCheck size={17}/><span>Your alarms are saved but are not currently scheduled. Restore "Alarms & reminders" access to reactivate them; RiseFit will reschedule them automatically when Android grants access again.</span></div>}{alarmSaveNotice&&<div className="notice alarm-save-feedback" role="status"><ShieldCheck size={17}/><span>{alarmSaveNotice}</span><button type="button" className="alarm-feedback-dismiss" onClick={()=>setAlarmSaveNotice(null)}>Dismiss</button></div>}<div className="plan-list">{alarms.map(alarm=><div className={`alarm-card ${editingAlarmId===alarm.id?'alarm-editor':'alarm-summary'}`} key={alarm.id}><div className="alarm-editor-icon"><AlarmClock size={22}/></div>{editingAlarmId===alarm.id?<div className="alarm-editor-content"><div className="alarm-editor-heading"><label className="alarm-title-field"><span>ALARM TITLE</span><input className="alarm-title-input" aria-label="Alarm label" value={alarm.label} onChange={e=>updateAlarm(alarm.id,{label:e.target.value})}/></label><span className="alarm-repeat-pill">DAILY</span></div><label className="alarm-time-field"><span>RING AT</span><input className="alarm-time-input" aria-label="Alarm time" type="time" value={editingAlarmTime??alarm.time} onChange={e=>setEditingAlarmTime(e.target.value)}/></label><div className="alarm-challenge-editor"><span className="eyebrow">SMART WAKE-UP MISSIONS</span><p className="alarm-builder-help">Build a morning routine from camera-verified movements. New alarms can require every selected mission before the alarm stops.</p><div className="alarm-routine-presets"><button type="button" className="secondary" onClick={()=>applyAlarmRoutine(alarm.id,'gentle')}>Gentle start</button><button type="button" className="secondary" onClick={()=>applyAlarmRoutine(alarm.id,'balanced')}>Balanced</button><button type="button" className="secondary" onClick={()=>applyAlarmRoutine(alarm.id,'energising')}>Energising</button></div><div className="alarm-settings-grid"><label>Difficulty<select value={alarm.difficulty??'Normal'} onChange={e=>updateAlarm(alarm.id,{difficulty:e.target.value as AlarmDifficulty})}><option>Easy</option><option>Normal</option><option>Hard</option><option>Extreme</option></select><small className="alarm-difficulty-help">Actual repetitions or seconds are adjusted by this setting.</small></label><label className="alarm-required-toggle"><input type="checkbox" checked={alarm.requireAllMissions??false} onChange={e=>updateAlarm(alarm.id,{requireAllMissions:e.target.checked})}/><span><b>Require all missions</b><small>Complete every exercise before dismissing this alarm.</small></span></label></div>{getAlarmChallenge(alarm).map((item,index)=>{const exercise=exercises.find(e=>e.id===item.exerciseId)!;return <div className="alarm-exercise-config" key={index}><label>Exercise<select value={item.exerciseId} onChange={e=>{const chosen=exercises.find(x=>x.id===e.target.value)!;updateAlarmChallenge(alarm.id,index,{exerciseId:chosen.id,target:chosen.target});}}>{exercises.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label>Base target ({exercise.unit})<input type="number" min="1" max="300" step="1" value={item.target} onChange={e=>updateAlarmChallenge(alarm.id,index,{target:Math.max(1,Math.min(300,Math.round(Number(e.target.value)||1)))})}/></label><label>Rounds<input type="number" min="1" max="10" step="1" value={item.rounds} onChange={e=>updateAlarmChallenge(alarm.id,index,{rounds:Math.max(1,Math.min(10,Math.round(Number(e.target.value)||1)))})}/></label>{getAlarmChallenge(alarm).length>1&&<button className="secondary" onClick={()=>removeAlarmExercise(alarm.id,index)}>Remove</button>}</div>})}<button className="secondary" onClick={()=>addAlarmExercise(alarm.id)} disabled={getAlarmChallenge(alarm).length>=exercises.length}>+ Add exercise</button></div><div className="alarm-editor-footer"><button className="secondary save-alarm-btn" onClick={()=>void scheduleWakeAlarm({...alarm,time:editingAlarmTime??alarm.time},true)}>Save alarm</button><div className="alarm-editor-actions"><button className={`toggle ${alarm.enabled?'on':''}`} onClick={()=>{if(alarm.enabled)void disableWakeAlarm(alarm.id);else void scheduleWakeAlarm({...alarm,time:editingAlarmTime??alarm.time});}} aria-label={alarm.enabled?'Disable alarm':'Enable alarm'}><i/></button><button className="secondary alarm-delete-btn" onClick={()=>{if(alarm.enabled)void disableWakeAlarm(alarm.id);setAlarms(items=>items.filter(a=>a.id!==alarm.id));setEditingAlarmId(current=>current===alarm.id?null:current);}}>Delete</button></div></div></div>:<div className="alarm-summary-content"><div className="alarm-summary-heading"><div><b>{alarm.label}</b><span>{formatClockTime(alarm.time)} · DAILY</span></div><span className={`alarm-summary-status ${alarm.enabled?'active':'inactive'}`}>{alarm.enabled?'ACTIVE':'OFF'}</span></div><div className="alarm-summary-meta"><span>{alarm.difficulty??'Normal'} difficulty</span><span>{alarm.requireAllMissions?'All missions required':'First mission dismisses alarm'}</span></div><div className="alarm-summary-challenge">{getAlarmChallenge(alarm).map((item,index)=>{const exercise=exercises.find(e=>e.id===item.exerciseId)!;return <span key={index}>{exercise.name} · {alarmTarget(alarm,item)} {exercise.unit} · {item.rounds} round{item.rounds===1?'':'s'}</span>;})}</div><div className="alarm-summary-footer"><button className="secondary alarm-edit-btn" onClick={()=>{setEditingAlarmId(alarm.id);setEditingAlarmTime(alarm.time);}}><Pencil size={14}/> Edit settings</button><div className="alarm-editor-actions"><button className={`toggle ${alarm.enabled?'on':''}`} onClick={()=>{if(alarm.enabled)void disableWakeAlarm(alarm.id);else void scheduleWakeAlarm(alarm);}} aria-label={alarm.enabled?'Disable alarm':'Enable alarm'}><i/></button><button className="secondary alarm-delete-btn" onClick={()=>{if(alarm.enabled)void disableWakeAlarm(alarm.id);setAlarms(items=>items.filter(a=>a.id!==alarm.id));}}>Delete</button></div></div></div>}</div>)}</div><button className="primary full" onClick={addAlarm}><Plus size={17}/> Add another alarm</button><div className="notice"><ShieldCheck size={17}/><span>Each alarm repeats daily and can be enabled, disabled or deleted independently. Completing a challenge stops the current ringing only; it does not delete the alarm schedule.</span></div>{Capacitor.getPlatform()==='android'&&<div className="alarm-access"><button className="secondary full" onClick={()=>void requestExactAlarm()}>{alarmStatus?.canScheduleExactAlarms?'Exact alarm access granted':'Allow exact alarm access'}</button>{alarmStatus&&!alarmStatus.canUseFullScreenIntent&&<button className="secondary full" onClick={()=>void requestFullScreenAccess()}>Allow full-screen alarm display</button>}</div>}</section>}
{tab==='Alarm Challenge'&&!planId&&(()=>{const alarm=alarms.find(item=>item.id===activeAlarmId);const challenge=alarm?getAlarmChallenge(alarm):defaultAlarmChallenge;const missionIndex=followOnIndex??0;const first=challenge[missionIndex]??challenge[0];const selected=first?exercises.find(item=>item.id===first.exerciseId):exercises[0];if(alarmChallengeDone){return <section className="panel session"><div className="success"><CheckCircle2 size={44}/></div><span className="eyebrow">ALARM DISMISSED</span><h2>{alarm?.requireAllMissions?'Your full morning routine is complete.':'You completed the wake-up mission.'}</h2><p className="muted">{alarm?.requireAllMissions?'Every required mission is verified and the alarm has stopped.':'The alarm has stopped. You can continue with the remaining optional exercises.'}</p>{!alarm?.requireAllMissions&&followOnIndex!==null&&challenge[followOnIndex]&&(()=>{const item=challenge[followOnIndex];const exercise=exercises.find(e=>e.id===item.exerciseId)!;return <><p className="muted">Optional exercise · round {alarmRound} of {item.rounds}</p><WorkoutVerification key={`alarm-follow-${followOnIndex}-${alarmRound}`} target={alarmTarget(alarm??{id:'',time:'',enabled:false,label:''},item)} exercise={poseExerciseById[item.exerciseId]} unit={exercise.unit} variant="workout" completionLabel={alarmRound<item.rounds?'Next round':'Finish optional exercise'} onVerified={()=>{if(alarmRound<item.rounds)setAlarmRound(value=>value+1);else{recordSession(exercise.name,'alarm');setFollowOnIndex(null);setAlarmRound(1);}}}/></>})()}{!alarm?.requireAllMissions&&followOnIndex===null&&challenge.slice(1).map((item,index)=>{const exercise=exercises.find(e=>e.id===item.exerciseId)!;const actualIndex=index+1;return <div className="alarm-follow-row" key={actualIndex}><div><b>{exercise.name}</b><small>{item.target} {exercise.unit} · {item.rounds} round(s)</small></div><button className="secondary" onClick={()=>{setAlarmRound(1);setFollowOnIndex(actualIndex);}}>Continue</button></div>})}<button className="primary full" onClick={()=>{setTab('Overview');setActiveAlarmId(null);setFollowOnIndex(null);}}>Finish and return home</button></section>;}return <><p className="muted">Mission {missionIndex+1} of {challenge.length} · round {alarmRound} of {first?.rounds??1}. {alarm?.requireAllMissions?'Complete every mission to dismiss the alarm.':'Complete this first mission to dismiss the alarm.'}</p><WorkoutVerification key={`alarm-mission-${missionIndex}-${alarmRound}`} target={first?alarmTarget(alarm??{id:'',time:'',enabled:false,label:''},first):20} exercise={poseExerciseById[first?.exerciseId??'squat']} unit={selected?.unit??'reps'} onVerified={()=>{if(alarmRound<(first?.rounds??1)){setAlarmRound(value=>value+1);return;}if(alarm?.requireAllMissions&&missionIndex+1<challenge.length){setFollowOnIndex(missionIndex+1);setAlarmRound(1);return;}if(Capacitor.getPlatform()==='android')void NativeAlarm.stopRinging();recordSession(`Alarm: ${alarm?.label??'Morning routine'} · ${challenge.length} mission(s)`,'alarm');setAlarmChallengeDone(true);setFollowOnIndex(null);setAlarmRound(1);}}/></>;})()}
 {tab==='Workouts'&&!planId&&!detail&&<section className="panel"><div className="section-title"><div><span className="eyebrow">MOVE YOUR WAY</span><h2>Workout plans</h2></div></div><div className="plan-list">{allPlans.map((p,i)=><div className="plan-row" key={p.id}><span className={`plan-icon tone${i}`}><Dumbbell size={19}/></span><div className="plan-info"><b>{p.title}</b><span>{p.subtitle} · {profile.level}</span></div><span className="duration"><Timer size={14}/>{p.duration}</span><button className="play" onClick={()=>start(p.id)}><Play size={14} fill="currentColor"/></button></div>)}</div><div className="section-title library-head"><div><span className="eyebrow">INDIVIDUAL MOVEMENTS</span><h2>Exercise library</h2></div></div><div className="filters">{['All','Full body','Core','Cardio','Strength'].map(f=><button key={f} className={filter===f?'selected':''} onClick={()=>setFilter(f)}>{f}</button>)}</div><div className="exercise-grid">{exercises.filter(e=>filter==='All'||e.category===filter).map((e,i)=><button className="exercise-card" key={e.id} onClick={()=>{setRestState(null);setDetail(e);setExerciseRound(1);setExerciseVerificationStarted(false);setExerciseCompleted(false);}}><span className={`plan-icon tone${i%3}`}><Dumbbell size={18}/></span><b>{e.name}</b><small>{e.category} · {e.target} {e.unit}</small><ChevronRight size={15} className="arrow"/></button>)}</div></section>}
 {tab==='Workouts'&&!planId&&!detail&&<WomensFitness goal={profile.goal} level={profile.level} onStart={id=>{setTab('Workouts');start(id);}}/>}
 {tab==='Workouts'&&detail&&!planId&&<section className="panel exercise-detail-panel"><button className="back" onClick={()=>{setDetail(null);setExerciseVerificationStarted(false);setExerciseCompleted(false);setExerciseRound(1);}}><ArrowLeft size={15}/> Exercise library</button><span className="eyebrow">{detail.category.toUpperCase()}</span><h2 className="detail-title">{detail.name}</h2><p className="muted">{detail.target} {detail.unit} · {detail.rounds} rounds · camera verified</p><h3>How to do it</h3><ol className="cues">{detail.cues.map((cue,i)=><li key={i}>{cue}</li>)}</ol><ExerciseDemonstration exercise={poseExerciseById[detail.id]}/><div className="notice"><CheckCircle2 size={17}/><span>Modification: {detail.easier}</span></div>{exerciseCompleted?<div className="exercise-verified-state"><CheckCircle2 size={38}/><span className="eyebrow">EXERCISE VERIFIED</span><h3>{detail.name} complete</h3><p className="muted">RiseFit counted {detail.rounds} rounds of {detail.target} {detail.unit}. Your completed exercise has been added to your training record.</p><button className="primary full" onClick={()=>{setDetail(null);setExerciseVerificationStarted(false);setExerciseCompleted(false);setExerciseRound(1);}}>Back to exercise library</button></div>:!exerciseVerificationStarted?<div className="exercise-camera-start"><p className="muted">Read the instructions above, position your full body in the camera frame, then start. RiseFit will check your movement and count each detected rep (or verified hold second).</p><button className="primary full" onClick={()=>{setExerciseRound(1);setExerciseVerificationStarted(true);}}><Camera size={17}/> Start camera &amp; count {detail.unit==='sec'?'seconds':'reps'}</button></div>:<div className="exercise-verification-stage"><div className="session-top"><span className="eyebrow">ROUND {exerciseRound} / {detail.rounds}</span><b>{detail.target} {detail.unit} target</b></div>{restState?.mode==='library-round'?<RestTimer seconds={30} nextLabel={restState.nextLabel} onComplete={finishRest}/>:<><WorkoutVerification key={`library-${detail.id}-${exerciseRound}`} target={detail.target} exercise={poseExerciseById[detail.id]} unit={detail.unit} variant="workout" completionLabel={exerciseRound<detail.rounds?'Start recovery':'Finish exercise'} onVerified={()=>{if(exerciseRound<detail.rounds){setRestState({mode:'library-round',nextLabel:`${detail.name} · round ${exerciseRound+1}`});}else{setExerciseCompleted(true);recordSession(`${detail.name} · ${detail.target} ${detail.unit} × ${detail.rounds} rounds`,'exercise');}}}/><button className="secondary full" onClick={()=>{setExerciseVerificationStarted(false);setExerciseRound(1);setRestState(null);}}>Stop camera and return to instructions</button></>}</div>}</section>}
{tab==='Workouts'&&planId&&<section className="panel session">{restState&&restState.mode!=='library-round'?<RestTimer seconds={30} nextLabel={restState.nextLabel} onComplete={finishRest}/>:complete?<><div className="success"><CheckCircle2 size={44}/></div><span className="eyebrow">SESSION COMPLETE</span><h2>{currentPlan?.title}</h2><p className="muted">You finished the planned movements. Nice work showing up.</p><button className="primary full" onClick={()=>{exit();setTab('Overview')}}>Done <ChevronRight size={16}/></button><button className="secondary full" onClick={()=>start(planId)}><RotateCcw size={15}/> Repeat session</button></>:current?<><button className="back" onClick={exit}><ArrowLeft size={15}/> Exit session</button><div className="session-top"><span className="eyebrow">{currentPlan?.title.toUpperCase()}</span><b>Exercise {idx+1} of {sessionExercises.length}</b></div><div className="progress-track"><i style={{width:`${(idx+1)/sessionExercises.length*100}%`}}/></div><div className="counter"><span className="eyebrow">ROUND {round} / {current.rounds}</span><h2>{current.name}</h2><p>{current.target} {current.unit} target · camera verified</p></div>{planId==='low-impact'&&<div className="notice"><ShieldCheck size={17}/><span>Low-impact session: use a comfortable range, move slowly, and choose this movement’s modification when needed — {current.easier} Stop if you feel pain or dizziness.</span></div>}<ExerciseDemonstration exercise={poseExerciseById[current.id]}/><WorkoutVerification key={`${planId}-${idx}-${round}`} target={current.target} exercise={poseExerciseById[current.id]} unit={current.unit} variant="workout" completionLabel="Take recovery break" onVerified={advanceSession}/><div className="instruction"><b>Form cues</b><ol className="cues">{current.cues.map((c,i)=><li key={i}>{c}</li>)}</ol><small>Move with control. Stop if you feel pain, dizziness, or unusual shortness of breath.</small></div></>:null}</section>}
 {tab==='Statistics'&&!planId&&<Statistics sessions={history} dailySteps={dailyStepStats?.days??[]} stepsPermissionGranted={dailyStepStats?.permissionGranted??false}/>}
 {tab==='Profile'&&!planId&&<><section className="panel device-permission-settings"><div className="section-title"><div><span className="eyebrow">ANDROID ACCESS</span><h2>Device permissions</h2></div></div><p className="muted">Review step tracking, notifications and alarm access whenever you need to.</p><button className="secondary full" onClick={()=>{localStorage.removeItem('risefit-device-setup-v1');setDeviceSetupComplete(false);}}>Review device setup</button></section><DeviceHealth/><DataPrivacy profile={profile} sessions={history} dailySteps={dailyStepStats?.days??[]} lowImpactMode={lowImpactMode} restDayEnabled={restDayEnabled} onClearWorkoutHistory={()=>setHistory([])} onDeleteProfileAndTrainingData={deleteProfileAndTrainingData}/><ProfileSetup initial={profile} onSave={setProfile} onCancel={()=>setTab('Overview')}/></>}

 {tab==='Calendar'&&!planId&&<section className="panel">
  <div className="section-title"><div><span className="eyebrow">YOUR CONSISTENCY</span><h2>Workout calendar</h2></div><span className="pill">{history.length} SESSIONS</span></div>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,margin:'18px 0'}}>
   <button type="button" className="secondary" aria-label="Previous month" onClick={()=>setCalendarMonth(m=>new Date(m.getFullYear(),m.getMonth()-1,1))}><ChevronLeft size={17}/></button>
   <strong>{calendarMonth.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</strong>
   <button type="button" className="secondary" aria-label="Next month" onClick={()=>setCalendarMonth(m=>new Date(m.getFullYear(),m.getMonth()+1,1))}><ChevronRight size={17}/></button>
  </div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:6,textAlign:'center'}}>
   {['S','M','T','W','T','F','S'].map((d,i)=><span key={i} className="eyebrow" style={{padding:'8px 0'}}>{d}</span>)}
   {Array.from({length:new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1).getDay()},(_,i)=><span key={'blank-'+i}/>)}
   {Array.from({length:new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,0).getDate()},(_,i)=>{
    const day=i+1;const key=`${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const count=history.filter(item=>{const d=new Date(item.completedAt);return d.getFullYear()===calendarMonth.getFullYear()&&d.getMonth()===calendarMonth.getMonth()&&d.getDate()===day;}).length;
    const stepCount=dailyStepStats?.days.find(item=>item.date===key)?.steps??0;
    const hasActivity=count>0||stepCount>0;
    const today=now.getFullYear()===calendarMonth.getFullYear()&&now.getMonth()===calendarMonth.getMonth()&&now.getDate()===day;
    return <div key={key} title={hasActivity?`${count} completed session(s), ${stepCount.toLocaleString()} steps`:''} style={{minHeight:48,borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,background:hasActivity?'rgba(119,123,255,.16)':'rgba(255,255,255,.03)',border:today?'1px solid var(--lime, #c5f36a)':'1px solid transparent',fontWeight:today?700:500}}><span>{day}</span>{hasActivity&&<span style={{width:5,height:5,borderRadius:'50%',background:'#8589ff'}}/>}</div>;
   })}
  </div>
  <div className="notice" style={{marginTop:18}}><CheckCircle2 size={17}/><span>Marked days show completed workouts and days with recorded steps. Step totals come from this phone's built-in step sensor and are stored locally; older workout sessions not saved on this device cannot be displayed.</span></div>
  <h3 style={{marginTop:22}}>Daily steps · recent records</h3>
  {dailyStepStats?.permissionGranted?<div className="plan-list">{dailyStepStats.days.filter(item=>item.date.startsWith(`${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth()+1).padStart(2,'0')}`)).map(item=><div className="plan-row" key={item.date}><span className="plan-icon tone0"><Footprints size={18}/></span><div className="plan-info"><b>{new Date(item.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</b><span>{item.steps.toLocaleString()} steps</span></div></div>)}</div>:<p className="muted">Enable automatic step counting from the Steps Today card on Overview to see daily step totals here.</p>}
  <h3 style={{marginTop:22}}>Sessions this month</h3>
  {history.filter(item=>{const d=new Date(item.completedAt);return d.getFullYear()===calendarMonth.getFullYear()&&d.getMonth()===calendarMonth.getMonth();}).length===0?<p className="muted">No completed sessions recorded this month yet.</p>:<div className="plan-list">{history.filter(item=>{const d=new Date(item.completedAt);return d.getFullYear()===calendarMonth.getFullYear()&&d.getMonth()===calendarMonth.getMonth();}).sort((a,b)=>b.completedAt.localeCompare(a.completedAt)).map(item=><div className="plan-row" key={item.id}><span className="plan-icon tone0"><CheckCircle2 size={18}/></span><div className="plan-info"><b>{item.title}</b><span>{new Date(item.completedAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</span></div></div>)}</div>}
 </section>}

 <footer>RISEFIT <span>·</span> SMART FITNESS, ONE REP AT A TIME</footer></main></div>;
}
