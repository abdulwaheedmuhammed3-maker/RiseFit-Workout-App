import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { CheckCircle2, RefreshCw, Volume2 } from 'lucide-react';
import { NativeAlarm } from './nativeAlarm';

type SpeechStatus = { available: boolean; languageAvailable: boolean; language: string; message: string };

export default function VoiceSettings() {
  const isAndroid = Capacitor.getPlatform() === 'android';
  const [status, setStatus] = useState<SpeechStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  const checkVoice = useCallback(async () => {
    if (!isAndroid) {
      const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
      setStatus({ available: supported, languageAvailable: supported, language: navigator.language || 'default', message: supported ? 'Browser speech is available.' : 'Speech is not supported in this browser.' });
      return;
    }
    setChecking(true);
    setError('');
    try { setStatus(await NativeAlarm.getSpeechStatus()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not check Android voice services.'); }
    finally { setChecking(false); }
  }, [isAndroid]);

  useEffect(() => { void checkVoice(); return () => { if (isAndroid) void NativeAlarm.stopSpeech().catch(() => undefined); }; }, [checkVoice, isAndroid]);

  const testVoice = async () => {
    setTesting(true);
    setError('');
    try {
      if (isAndroid) await NativeAlarm.speakText({ text: 'Hello. RiseFit voice coaching is working. Follow the movement instructions and keep good form.' });
      else if (status?.available) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance('Hello. RiseFit voice coaching is working.'));
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'RiseFit could not play the voice test.'); }
    finally { setTesting(false); }
  };

  const ready = Boolean(status?.available && status?.languageAvailable);
  return <section className="panel device-permission-settings" aria-label="Voice coaching settings">
    <div className="section-title"><div><span className="eyebrow">VOICE COACHING</span><h2>Speech & sound</h2></div><span className={ready ? 'device-health-state good' : 'device-health-state warn'}>{ready ? 'READY' : 'CHECK'}</span></div>
    <p className="muted">RiseFit can speak exercise cues aloud. It does not need microphone permission because it does not listen to you.</p>
    <div className="device-health-grid"><article><span className="device-health-mini-icon"><Volume2 size={18}/></span><div><strong>Text-to-speech engine</strong><small>{checking ? 'Checking speech services…' : status?.message ?? 'Not checked yet'}</small>{status?.language && <small>Device language: {status.language}</small>}</div><span className={ready ? 'device-health-state good' : 'device-health-state warn'}>{ready ? 'READY' : 'NOT READY'}</span></article></div>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
      <button type="button" className="secondary" onClick={() => void checkVoice()} disabled={checking}><RefreshCw size={15}/>{checking ? 'Checking…' : 'Check voice'}</button>
      <button type="button" className="primary" onClick={() => void testVoice()} disabled={!ready || testing}><Volume2 size={15}/>{testing ? 'Playing test…' : 'Test voice'}</button>
    </div>
    <p className="device-health-footnote">If you cannot hear the test, turn up your phone’s media volume and check Android Settings → Text-to-speech output for an installed voice and speech engine. No microphone or special sound permission is required.</p>
    {error && <p className="step-counter-error" role="alert">{error}</p>}
  </section>;
}
