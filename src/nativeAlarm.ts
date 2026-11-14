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
export interface DailyStepEntry { date: string; steps: number; }
export interface DailyStepStats {
  available: boolean;
  permissionGranted: boolean;
  stepsToday: number;
  days: DailyStepEntry[];
  lastUpdated?: number;
  source?: 'health_connect';
  message?: string;
}
interface NativeAlarmPlugin {
  getStatus(): Promise<NativeAlarmStatus>;
  requestExactAlarmAccess(): Promise<void>;
  requestDndAccess(): Promise<{ manualSetupRequired: boolean }>;
  requestFullScreenAccess(): Promise<void>;
  schedule(options: { id: string; hour: number; minute: number }): Promise<NativeAlarmStatus>;
  cancelAlarm(options: { id: string }): Promise<void>;
  stopRinging(): Promise<void>;
  requestStepReadPermission(): Promise<void>;
  getDailyStepStats(): Promise<DailyStepStats>;
  consumeAlarmLaunch(): Promise<{ openChallenge: boolean; alarmId?: string }>;
  addListener(eventName: 'alarmTriggered', listener: (event: { openChallenge: boolean; alarmId?: string }) => void): Promise<PluginListenerHandle>;
}
export const NativeAlarm = registerPlugin<NativeAlarmPlugin>('NativeAlarm');