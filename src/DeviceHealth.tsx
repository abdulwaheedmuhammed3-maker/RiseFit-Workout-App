import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, CheckCircle2, Clock3, Cpu, Footprints, RefreshCw, Settings, ShieldAlert, ShieldCheck, Zap } from 'lucide-react';
import { NativeAlarm, type DeviceHealth as DeviceHealthData } from './nativeAlarm';

const initial: DeviceHealthData = {
  batteryPercent: -1, charging: false, batteryStatus: 'unknown',
  batteryOptimizationExempt: false, powerSaveMode: false,
  stepSensorAvailable: false, stepSensorName: '', stepSensorVendor: '',
  activityPermissionGranted: false, trackingEnabled: false,
  lastStepUpdate: 0, serviceStartedAt: 0, checkedAt: 0
};

const relativeTime = (timestamp: number) => {
  if (!timestamp || timestamp <= 0) return 'No reading recorded yet';
  const age = Date.now() - timestamp;
  if (age < 0) return 'Just recorded';
  if (age < 60_000) return 'Less than a minute ago';
  if (age < 3_600_000) return Math.floor(age / 60_000) + ' min ago';
  if (age < 86_400_000) return Math.floor(age / 3_600_000) + ' hr ago';
  return Math.floor(age / 86_400_000) + ' days ago';
};

export default function DeviceHealth() {
  const [data, setData] = useState<DeviceHealthData>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settingsBusy, setSettingsBusy] = useState(false);
  const isAndroid = Capacitor.getPlatform() === 'android';

  const refresh = useCallback(async () => {
    if (!isAndroid) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      // Refreshing the native step stats also asks the service to restart when tracking is enabled.
      await NativeAlarm.getDailyStepStats();
      setData(await NativeAlarm.getDeviceHealth());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'RiseFit could not read device health.');
    } finally {
      setLoading(false);
    }
  }, [isAndroid]);

  useEffect(() => {
    void refresh();
    const onResume = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('focus', onResume);
    document.addEventListener('visibilitychange', onResume);
    return () => {
      window.removeEventListener('focus', onResume);
      document.removeEventListener('visibilitychange', onResume);
    };
  }, [refresh]);

  const openBatterySettings = async () => {
    setSettingsBusy(true);
    setError('');
    try { await NativeAlarm.openBatterySettings(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open battery settings.'); }
    finally { setSettingsBusy(false); }
  };

  const batteryIcon = data.batteryPercent < 15
    ? <BatteryLow size={20}/>
    : data.batteryPercent < 50 ? <BatteryMedium size={20}/> : <BatteryFull size={20}/>;

  return (
    <section className="device-health panel" aria-label="Battery and sensor health">
      <div className="device-health-heading">
        <div><span className="eyebrow">DEVICE STATUS</span><h2>Battery & sensor monitor</h2><p>Checks this phone’s battery, step sensor and Android permissions.</p></div>
        <button type="button" className="device-health-refresh" onClick={() => void refresh()} disabled={loading} aria-label="Refresh device status"><RefreshCw size={17}/></button>
      </div>
      {!isAndroid ? (
        <div className="notice"><Cpu size={17}/><span>Detailed battery and hardware sensor information is available in the installed Android app.</span></div>
      ) : (
        <>
          <div className="device-health-battery">
            <span className="device-health-icon">{data.charging ? <BatteryCharging size={23}/> : batteryIcon}</span>
            <div><span className="eyebrow">BATTERY LEVEL</span><strong>{data.batteryPercent >= 0 ? data.batteryPercent + '%' : 'Unavailable'}</strong><small>{data.charging ? 'Charging or fully charged' : data.batteryStatus === 'discharging' ? 'On battery power' : data.batteryStatus.replace('_', ' ')}</small></div>
            {data.powerSaveMode && <span className="device-health-power"><Zap size={14}/> Power saver on</span>}
          </div>
          <div className="device-health-grid">
            <article>
              <span className="device-health-mini-icon"><Footprints size={18}/></span>
              <div><strong>Hardware step sensor</strong><small>{data.stepSensorAvailable ? 'Available' : 'Not detected on this phone'}</small>{data.stepSensorName && <small>{data.stepSensorName}{data.stepSensorVendor ? ' · ' + data.stepSensorVendor : ''}</small>}</div>
              <span className={data.stepSensorAvailable ? 'device-health-state good' : 'device-health-state warn'}>{data.stepSensorAvailable ? 'READY' : 'UNAVAILABLE'}</span>
            </article>
            <article>
              <span className="device-health-mini-icon"><ShieldCheck size={18}/></span>
              <div><strong>Activity permission</strong><small>{data.activityPermissionGranted ? 'Granted' : 'Not granted'}</small></div>
              <span className={data.activityPermissionGranted ? 'device-health-state good' : 'device-health-state warn'}>{data.activityPermissionGranted ? 'ALLOWED' : 'BLOCKED'}</span>
            </article>
            <article>
              <span className="device-health-mini-icon"><CheckCircle2 size={18}/></span>
              <div><strong>Automatic step tracking</strong><small>{data.trackingEnabled ? 'Enabled in RiseFit' : 'Not enabled'}</small></div>
              <span className={data.trackingEnabled ? 'device-health-state good' : 'device-health-state warn'}>{data.trackingEnabled ? 'ENABLED' : 'OFF'}</span>
            </article>
            <article>
              <span className="device-health-mini-icon"><Clock3 size={18}/></span>
              <div><strong>Last sensor update</strong><small>{relativeTime(data.lastStepUpdate)}</small></div>
            </article>
          </div>
          <div className="device-health-power-status">
            {data.batteryOptimizationExempt
              ? <><CheckCircle2 size={17}/><span>RiseFit is exempt from Android’s standard battery optimisation restrictions.</span></>
              : <><ShieldAlert size={17}/><span>Android battery optimisation may limit background activity on some phones. Manufacturer-specific power controls may also apply.</span></>}
          </div>
          {!data.batteryOptimizationExempt && <button type="button" className="secondary full" disabled={settingsBusy} onClick={() => void openBatterySettings()}><Settings size={15}/>{settingsBusy ? 'Opening settings…' : 'Open battery optimisation settings'}</button>}
          <p className="device-health-footnote">The last sensor update means the last time Android reported a step-counter event. No recent event does not by itself prove the tracking service has stopped.</p>
        </>
      )}
      {error && <p className="step-counter-error" role="alert">{error}</p>}
      <small className="device-health-checked">{loading ? 'Checking device…' : data.checkedAt ? 'Checked ' + new Date(data.checkedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}</small>
    </section>
  );
}
