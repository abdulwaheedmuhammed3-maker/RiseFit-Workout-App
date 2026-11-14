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

interface NativeAlarmPlugin {
  getStatus(): Promise<NativeAlarmStatus>;
  requestExactAlarmAccess(): Promise<void>;
  requestDndAccess(): Promise<void>;
  requestFullScreenAccess(): Promise<void>;
  schedule(options: { hour: number; minute: number }): Promise<NativeAlarmStatus>;
  cancel(): Promise<NativeAlarmStatus>;
  consumeAlarmLaunch(): Promise<{ openChallenge: boolean }>;
  addListener(
    eventName: 'alarmTriggered',
    listener: (event: { openChallenge: boolean }) => void,
  ): Promise<PluginListenerHandle>;
}

export const NativeAlarm = registerPlugin<NativeAlarmPlugin>('NativeAlarm');
