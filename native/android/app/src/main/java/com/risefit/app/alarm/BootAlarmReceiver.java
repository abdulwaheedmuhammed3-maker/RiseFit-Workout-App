package com.risefit.app.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

public class BootAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        SharedPreferences prefs = context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean("enabled", false)) return;
        try {
            AlarmScheduler.scheduleNext(
                context,
                prefs.getInt("hour", 6),
                prefs.getInt("minute", 30)
            );
        } catch (SecurityException ignored) {
            prefs.edit().putBoolean("enabled", false).apply();
        }
    }
}
