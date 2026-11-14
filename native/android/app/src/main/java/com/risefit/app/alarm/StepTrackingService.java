package com.risefit.app.alarm;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;

public class StepTrackingService extends Service implements SensorEventListener {
    public static final String PREFS = "risefit_step_tracking";
    public static final String ACTION_START = "com.risefit.app.steps.START";
    public static final String KEY_TRACKING = "tracking";
    public static final String KEY_STARTED_AT = "started_at";
    public static final String KEY_BASELINE_RAW = "baseline_raw";
    public static final String KEY_SEGMENT_OFFSET = "segment_offset";
    public static final String KEY_STEPS = "steps";

    private static final String CHANNEL_ID = "risefit_walk_tracking";
    private static final int NOTIFICATION_ID = 6401;
    private SensorManager sensorManager;
    private Sensor activeSensor;
    private boolean registered = false;
    private long lastNotifiedSteps = -1L;
    private long lastNotificationAt = 0L;

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences prefs = prefs();
        if (!prefs.getBoolean(KEY_TRACKING, false)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        createNotificationChannel();
        startAsForeground(buildNotification(prefs.getLong(KEY_STEPS, 0L)));

        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        Sensor detector = sensorManager == null ? null : sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
        Sensor counter = sensorManager == null ? null : sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        activeSensor = detector != null ? detector : counter;
        if (activeSensor == null) {
            prefs.edit().putBoolean(KEY_TRACKING, false).apply();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (!registered) {
            registered = sensorManager.registerListener(this, activeSensor, SensorManager.SENSOR_DELAY_NORMAL);
        }
        if (!registered) {
            prefs.edit().putBoolean(KEY_TRACKING, false).apply();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    private void startAsForeground(Notification notification) {
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "Walking tracker", NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Shows when RiseFit is counting steps during a walking session.");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private Notification buildNotification(long steps) {
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        return builder
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle("RiseFit walking tracker")
            .setContentText(String.format(java.util.Locale.getDefault(), "%,d steps recorded", steps))
            .setCategory(Notification.CATEGORY_SERVICE)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .build();
    }

    private void publishStepCount(long steps) {
        prefs().edit().putLong(KEY_STEPS, Math.max(0L, steps)).apply();
        long now = System.currentTimeMillis();
        if (steps != lastNotifiedSteps && (steps - lastNotifiedSteps >= 5 || now - lastNotificationAt >= 2500L)) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification(steps));
            lastNotifiedSteps = steps;
            lastNotificationAt = now;
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event == null || event.values == null || event.values.length == 0) return;
        SharedPreferences prefs = prefs();
        if (!prefs.getBoolean(KEY_TRACKING, false)) return;

        long currentSteps = prefs.getLong(KEY_STEPS, 0L);
        if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR) {
            long increment = Math.max(1L, Math.round(event.values[0]));
            publishStepCount(currentSteps + increment);
            return;
        }

        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            long raw = Math.round(event.values[0]);
            long baseline = prefs.getLong(KEY_BASELINE_RAW, -1L);
            long offset = prefs.getLong(KEY_SEGMENT_OFFSET, 0L);
            if (baseline < 0L) {
                prefs.edit().putLong(KEY_BASELINE_RAW, raw).apply();
                publishStepCount(currentSteps);
            } else if (raw < baseline) {
                // The hardware counter reset, usually because the phone rebooted during a walk.
                prefs.edit().putLong(KEY_BASELINE_RAW, raw).putLong(KEY_SEGMENT_OFFSET, currentSteps).apply();
                publishStepCount(currentSteps);
            } else {
                publishStepCount(offset + raw - baseline);
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) { }

    @Override
    public void onDestroy() {
        if (sensorManager != null && registered) {
            sensorManager.unregisterListener(this);
            registered = false;
        }
        if (!prefs().getBoolean(KEY_TRACKING, false)) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) manager.cancel(NOTIFICATION_ID);
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
