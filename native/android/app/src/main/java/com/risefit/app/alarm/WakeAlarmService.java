package com.risefit.app.alarm;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.media.AudioManager;
import android.content.pm.ServiceInfo;

public class WakeAlarmService extends Service {
    public static final String ACTION_RING = "com.risefit.app.alarm.RING";
    public static final String ACTION_STOP = "com.risefit.app.alarm.STOP";
    private static final int NOTIFICATION_ID = 6303;
    private static final String CHANNEL_DND = "risefit_alarm_bypass_dnd_v1";
    private static final String CHANNEL_NORMAL = "risefit_alarm_v1";
    private Ringtone ringtone;
    private android.os.PowerManager.WakeLock wakeLock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }

        SharedPreferences prefs = getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE);
        prefs.edit().putBoolean("ringing", true).apply();
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = createAlarmChannel(manager);

        Intent openIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (openIntent == null) openIntent = new Intent(this, com.risefit.app.MainActivity.class);
        openIntent.setAction(getPackageName() + ".OPEN_WAKE_ALARM");
        openIntent.putExtra(AlarmScheduler.EXTRA_OPEN_CHALLENGE, true);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
            this, 6302, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder notificationBuilder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, channelId)
            : new Notification.Builder(this);
        Notification notification = notificationBuilder
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle("RiseFit alarm")
            .setContentText("Complete your workout to stop this alarm.")
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setPriority(Notification.PRIORITY_MAX)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(openPendingIntent)
            .setFullScreenIntent(openPendingIntent, true)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        acquireWakeLock();
        startRingtone();
        return START_STICKY;
    }

    private String createAlarmChannel(NotificationManager manager) {
        boolean dndAccess = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
            || manager.isNotificationPolicyAccessGranted();
        String channelId = dndAccess ? CHANNEL_DND : CHANNEL_NORMAL;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager.getNotificationChannel(channelId) == null) {
            NotificationChannel channel = new NotificationChannel(
                channelId, "RiseFit wake-up alarm", NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Audible wake-up alarms for your scheduled RiseFit workout.");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[] { 0, 500, 350, 500 });
            channel.setSound(null, new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            if (dndAccess) channel.setBypassDnd(true);
            manager.createNotificationChannel(channel);
        }
        return channelId;
    }

    private void startRingtone() {
        try {
            Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmSound == null) alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            ringtone = RingtoneManager.getRingtone(getApplicationContext(), alarmSound);
            if (ringtone == null) return;
            ringtone.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) ringtone.setLooping(true);
            ringtone.play();
        } catch (RuntimeException ignored) {
            // The foreground notification remains available if the device has no playable alarm tone.
        }
    }

    private void acquireWakeLock() {
        try {
            android.os.PowerManager power = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
            if (power != null && (wakeLock == null || !wakeLock.isHeld())) {
                wakeLock = power.newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "RiseFit:WakeAlarm");
                wakeLock.acquire(10 * 60 * 1000L);
            }
        } catch (RuntimeException ignored) {}
    }

    @Override
    public void onDestroy() {
        if (ringtone != null) {
            try { ringtone.stop(); } catch (RuntimeException ignored) {}
            ringtone = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (RuntimeException ignored) {}
            wakeLock = null;
        }
        getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE).edit().putBoolean("ringing", false).apply();
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(NOTIFICATION_ID);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
