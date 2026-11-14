package com.risefit.app.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import java.util.Map;

public class BootAlarmReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        SharedPreferences prefs = context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE);
        for (Map.Entry<String, ?> entry : prefs.getAll().entrySet()) {
            String key = entry.getKey();
            if (!key.startsWith("alarm_") || !key.endsWith("_enabled") || !Boolean.TRUE.equals(entry.getValue())) continue;
            String id = key.substring(6, key.length() - 8);
            try {
                AlarmScheduler.scheduleNext(context, id,
                    prefs.getInt(AlarmScheduler.hourKey(id), 6),
                    prefs.getInt(AlarmScheduler.minuteKey(id), 30));
            } catch (SecurityException ignored) {
                prefs.edit().putBoolean(AlarmScheduler.enabledKey(id), false).apply();
            }
        }
    }
}