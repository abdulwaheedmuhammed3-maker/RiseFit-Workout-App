package com.risefit.app.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.content.SharedPreferences;

public class WakeAlarmReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String id = intent == null ? null : intent.getStringExtra(AlarmScheduler.EXTRA_ALARM_ID);
        if (id == null || id.isEmpty()) return;
        SharedPreferences prefs = context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean(AlarmScheduler.enabledKey(id), false)) return;
        int hour = prefs.getInt(AlarmScheduler.hourKey(id), 6);
        int minute = prefs.getInt(AlarmScheduler.minuteKey(id), 30);
        try {
            AlarmScheduler.scheduleNext(context, id, hour, minute);
        } catch (RuntimeException schedulingError) {
            // Failure to schedule tomorrow's repeat must not cancel the alarm
            // that is due now. Keep the enabled preference so WakeAlarmService
            // can ring this occurrence; BootAlarmReceiver can restore repeats
            // after exact-alarm access or device state is repaired.
        }
        Intent service = new Intent(context, WakeAlarmService.class)
            .setAction(WakeAlarmService.ACTION_RING).putExtra(AlarmScheduler.EXTRA_ALARM_ID, id);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(service);
            else context.startService(service);
        } catch (RuntimeException ignored) {}
    }
}