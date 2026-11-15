package com.risefit.app.alarm;

import android.app.AlarmManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import java.util.Map;

public class BootAlarmReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        // Exact alarms are removed by Android when the special access is revoked.
        // Keep the user's enabled preference in SharedPreferences so it can be
        // restored when Android sends ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED.
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        SharedPreferences prefs = context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE);

        // Alarm restoration is independent of step tracking. If exact-alarm
        // access is unavailable, skip only the alarm rescheduling work rather
        // than returning before the step foreground service can be restored.
        boolean canRestoreAlarms = manager != null
            && (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms());
        if (canRestoreAlarms) {
            // AlarmManager stores wall-clock trigger instants. Recalculate each
            // recurring alarm after boot, manual clock changes, timezone changes,
            // app replacement, or exact-alarm permission being granted.
            for (Map.Entry<String, ?> entry : prefs.getAll().entrySet()) {
                String key = entry.getKey();
                if (!key.startsWith("alarm_") || !key.endsWith("_enabled") || !Boolean.TRUE.equals(entry.getValue())) continue;
                String id = key.substring(6, key.length() - 8);
                try {
                    AlarmScheduler.scheduleNext(context, id,
                        prefs.getInt(AlarmScheduler.hourKey(id), 6),
                        prefs.getInt(AlarmScheduler.minuteKey(id), 30));
                } catch (SecurityException ignored) {
                    // Do not clear the enabled preference. Android may send the
                    // permission-granted broadcast later and the alarm can recover.
                }
            }
        }
        // Restore the continuous step listener after a reboot or app update.
        // Android allows the health foreground-service type to be started here
        // when ACTIVITY_RECOGNITION has already been granted.
        try {
            StepCounterService.startIfEnabled(context);
        } catch (RuntimeException ignored) {
            // RiseFit will retry when the user next opens the app.
        }
    }
}
