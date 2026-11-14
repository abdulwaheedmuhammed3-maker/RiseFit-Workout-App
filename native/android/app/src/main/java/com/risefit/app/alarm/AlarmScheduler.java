package com.risefit.app.alarm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import java.util.Calendar;

public final class AlarmScheduler {
    public static final String PREFS = "risefit_native_alarm";
    public static final String EXTRA_OPEN_CHALLENGE = "risefitAlarmChallenge";
    private static final int ALARM_REQUEST = 6301;
    private static final int SHOW_REQUEST = 6302;

    private AlarmScheduler() {}

    public static void scheduleNext(Context context, int hour, int minute) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) throw new IllegalStateException("Android alarm service is unavailable.");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
            throw new SecurityException("Allow RiseFit to set exact alarms in Android settings.");
        }

        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, hour);
        next.set(Calendar.MINUTE, minute);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (!next.after(Calendar.getInstance())) next.add(Calendar.DAY_OF_YEAR, 1);

        Intent alarmIntent = new Intent(context, WakeAlarmReceiver.class)
            .setAction(context.getPackageName() + ".WAKE_ALARM");
        PendingIntent alarmPendingIntent = PendingIntent.getBroadcast(
            context, ALARM_REQUEST, alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent showIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (showIntent == null) showIntent = new Intent(context, com.risefit.app.MainActivity.class);
        showIntent.setAction(context.getPackageName() + ".OPEN_WAKE_ALARM");
        showIntent.putExtra(EXTRA_OPEN_CHALLENGE, true);
        showIntent.setData(Uri.parse("risefit://alarm/" + System.currentTimeMillis()));
        showIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent showPendingIntent = PendingIntent.getActivity(
            context, SHOW_REQUEST, showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        manager.setAlarmClock(
            new AlarmManager.AlarmClockInfo(next.getTimeInMillis(), showPendingIntent),
            alarmPendingIntent
        );
    }

    public static void cancel(Context context) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        Intent intent = new Intent(context, WakeAlarmReceiver.class)
            .setAction(context.getPackageName() + ".WAKE_ALARM");
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context, ALARM_REQUEST, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        manager.cancel(pendingIntent);
        pendingIntent.cancel();
    }
}
