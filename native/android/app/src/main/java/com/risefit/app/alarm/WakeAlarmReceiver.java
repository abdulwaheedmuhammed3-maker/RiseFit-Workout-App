package com.risefit.app.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.content.SharedPreferences;

public class WakeAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        SharedPreferences prefs = context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean("enabled", false)) return;

        int hour = prefs.getInt("hour", 6);
        int minute = prefs.getInt("minute", 30);
        try {
            AlarmScheduler.scheduleNext(context, hour, minute);
        } catch (SecurityException ignored) {
            prefs.edit().putBoolean("enabled", false).apply();
        }

        Intent service = new Intent(context, WakeAlarmService.class)
            .setAction(WakeAlarmService.ACTION_RING);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(service);
            else context.startService(service);
        } catch (RuntimeException ignored) {
            prefs.edit().putBoolean("ringing", false).apply();
        }
    }
}
