import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface NativeAlarmStatus {
  canScheduleExactAlarms: boolean;
  canBypassDnd: boolean;
  canUseFullScreenIntent: boolean;
  scheduled: boolean;
  ringing: boolean;
  hour: number;
  minute: number;
}
export interface NativeAlarmItem { id: string; hour: number; minute: number; enabled: boolean; }
export interface StepTrackingStatus {
  sensorAvailable: boolean;
  sensorType: 'detector' | 'counter' | 'none';
  permissionGranted: boolean;
  tracking: boolean;
  steps: number;
  startedAt?: number;
}
interface NativeAlarmPlugin {
  getStatus(): Promise<NativeAlarmStatus>;
  requestExactAlarmAccess(): Promise<void>;
  requestDndAccess(): Promise<{ manualSetupRequired: boolean }>;
  requestFullScreenAccess(): Promise<void>;
  schedule(options: { id: string; hour: number; minute: number }): Promise<NativeAlarmStatus>;
  cancelAlarm(options: { id: string }): Promise<void>;
  stopRinging(): Promise<void>;
  getStepTrackingStatus(): Promise<StepTrackingStatus>;
  startStepTracking(): Promise<StepTrackingStatus>;
  stopStepTracking(): Promise<StepTrackingStatus>;
  consumeAlarmLaunch(): Promise<{ openChallenge: boolean; alarmId?: string }>;
  addListener(eventName: 'alarmTriggered', listener: (event: { openChallenge: boolean; alarmId?: string }) => void): Promise<PluginListenerHandle>;
}
export const NativeAlarm = registerPlugin<NativeAlarmPlugin>('NativeAlarm');