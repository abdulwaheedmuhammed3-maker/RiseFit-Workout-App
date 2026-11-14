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
    public static final String EXTRA_ALARM_ID = "risefitAlarmId";
    private AlarmScheduler() {}

    private static String key(String id, String field) { return "alarm_" + id + "_" + field; }
    private static int requestCode(String id) { return 6301 + (id.hashCode() & 0x0fffffff); }

    public static void scheduleNext(Context context, String id, int hour, int minute) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) throw new IllegalStateException("Android alarm service is unavailable.");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms())
            throw new SecurityException("Allow RiseFit to set exact alarms in Android settings.");
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, hour); next.set(Calendar.MINUTE, minute);
        next.set(Calendar.SECOND, 0); next.set(Calendar.MILLISECOND, 0);
        if (!next.after(Calendar.getInstance())) next.add(Calendar.DAY_OF_YEAR, 1);

        Intent alarmIntent = new Intent(context, WakeAlarmReceiver.class)
            .setAction(context.getPackageName() + ".WAKE_ALARM." + id)
            .putExtra(EXTRA_ALARM_ID, id);
        PendingIntent alarmPendingIntent = PendingIntent.getBroadcast(context, requestCode(id), alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent showIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (showIntent == null) showIntent = new Intent(context, com.risefit.app.MainActivity.class);
        showIntent.setAction(context.getPackageName() + ".OPEN_WAKE_ALARM." + id);
        showIntent.setData(Uri.parse("risefit://alarm/" + id));
        showIntent.putExtra(EXTRA_OPEN_CHALLENGE, true);
        showIntent.putExtra(EXTRA_ALARM_ID, id);
        showIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent showPendingIntent = PendingIntent.getActivity(context, requestCode(id) + 1, showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        manager.setAlarmClock(new AlarmManager.AlarmClockInfo(next.getTimeInMillis(), showPendingIntent), alarmPendingIntent);
    }

    public static void cancel(Context context, String id) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;
        Intent intent = new Intent(context, WakeAlarmReceiver.class)
            .setAction(context.getPackageName() + ".WAKE_ALARM." + id)
            .putExtra(EXTRA_ALARM_ID, id);
        PendingIntent pending = PendingIntent.getBroadcast(context, requestCode(id), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        manager.cancel(pending); pending.cancel();
    }

    public static String enabledKey(String id) { return key(id, "enabled"); }
    public static String hourKey(String id) { return key(id, "hour"); }
    public static String minuteKey(String id) { return key(id, "minute"); }
}