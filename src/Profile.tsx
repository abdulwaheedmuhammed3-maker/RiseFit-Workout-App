import { useState, type FormEvent } from 'react';
export type FitnessLevel='Beginner'|'Intermediate'|'Expert';
export type FitnessGoal='glutes'|'lower-body'|'core'|'full-body'|'upper-body';
export type RiseFitProfile={fullName:string;dateOfBirth:string;level:FitnessLevel;goal:FitnessGoal};

export const getLocalDateKey = (date = new Date()) =>
  String(date.getFullYear()) + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');

export const isValidDateOnly = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

type Props={initial?:RiseFitProfile|null;onSave:(profile:RiseFitProfile)=>void;onCancel?:()=>void};
export default function ProfileSetup({initial,onSave,onCancel}:Props){
 const [fullName,setFullName]=useState(initial?.fullName??'');
 const [dateOfBirth,setDateOfBirth]=useState(initial?.dateOfBirth??'');
 const [level,setLevel]=useState<FitnessLevel>(initial?.level??'Beginner');
 const [goal,setGoal]=useState<FitnessGoal>(initial?.goal??'full-body');
 const [error,setError]=useState('');
 const submit=(event:FormEvent)=>{event.preventDefault();if(!fullName.trim()||!dateOfBirth){setError('Enter your name and date of birth to continue.');return;}if(!isValidDateOnly(dateOfBirth)){setError('Enter a valid date of birth.');return;}if(dateOfBirth>getLocalDateKey()){setError('Date of birth cannot be in the future.');return;}onSave({fullName:fullName.trim(),dateOfBirth,level,goal});};
 return <main className="profile-setup-shell"><form className="profile-setup-card" onSubmit={submit}><span className="eyebrow">RISEFIT · YOUR STARTING POINT</span><h1>{initial?'Your profile':'Let’s set up your profile.'}</h1><p className="muted">A few details help RiseFit suggest workouts that match your experience and goals. You can edit these details later.</p><label>Full name<input autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your full name" maxLength={80} required/></label><label>Date of birth<input type="date" value={dateOfBirth} onChange={e=>setDateOfBirth(e.target.value)} max={getLocalDateKey()} required/></label><fieldset><legend>Workout experience</legend><div className="profile-choice-grid">{(['Beginner','Intermediate','Expert'] as const).map(item=><button type="button" key={item} className={level===item?'chosen':''} onClick={()=>setLevel(item)}>{item}</button>)}</div></fieldset><label>Main fitness goal<select value={goal} onChange={e=>setGoal(e.target.value as FitnessGoal)}><option value="full-body">Full-body fitness</option><option value="glutes">Glutes & hip development</option><option value="lower-body">Lower-body development</option><option value="core">Core strength</option><option value="upper-body">Upper-body strength</option></select></label>{error&&<p className="profile-error" role="alert">{error}</p>}<button className="primary full" type="submit">{initial?'Save profile':'Continue to RiseFit'}</button>{onCancel&&<button className="secondary full" type="button" onClick={onCancel}>Cancel</button>}<small className="profile-privacy">Saved on this device in this version of RiseFit. This is not an online account and does not sync across devices.</small></form></main>;
}