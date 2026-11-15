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
  source?: 'native_sensor';
  message?: string;
}
export interface DeviceHealth {
  batteryPercent: number;
  charging: boolean;
  batteryStatus: 'charging' | 'full' | 'discharging' | 'not_charging' | 'unknown';
  batteryOptimizationExempt: boolean;
  powerSaveMode: boolean;
  stepSensorAvailable: boolean;
  stepSensorName: string;
  stepSensorVendor: string;
  activityPermissionGranted: boolean;
  trackingEnabled: boolean;
  lastStepUpdate: number;
  serviceStartedAt: number;
  checkedAt: number;
}
interface NativeAlarmPlugin {
  getStatus(): Promise<NativeAlarmStatus>;
  requestExactAlarmAccess(): Promise<void>;
  requestDndAccess(): Promise<{ manualSetupRequired: boolean }>;
  requestFullScreenAccess(): Promise<void>;
  schedule(options: { id: string; hour: number; minute: number }): Promise<NativeAlarmStatus>;
  cancelAlarm(options: { id: string }): Promise<void>;
  stopRinging(): Promise<void>;
  requestStepTrackingPermission(): Promise<void>;
  getDailyStepStats(): Promise<DailyStepStats>;
  getDeviceHealth(): Promise<DeviceHealth>;
  openBatterySettings(): Promise<void>;
  consumeAlarmLaunch(): Promise<{ openChallenge: boolean; alarmId?: string }>;
  addListener(eventName: 'alarmTriggered', listener: (event: { openChallenge: boolean; alarmId?: string }) => void): Promise<PluginListenerHandle>;
}
export const NativeAlarm = registerPlugin<NativeAlarmPlugin>('NativeAlarm');