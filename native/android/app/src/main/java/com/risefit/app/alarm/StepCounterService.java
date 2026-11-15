package com.risefit.app.alarm;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
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
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.SystemClock;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Keeps Android's low-power hardware step counter registered while RiseFit is
 * not visible. Daily totals are stored only in app-private SharedPreferences.
 */
public final class StepCounterService extends Service implements SensorEventListener {
    private static final String PREFS = "risefit_native_steps";
    private static final String KEY_ENABLED = "tracking_enabled";
    private static final String KEY_LAST_RAW = "last_raw_counter";
    private static final String KEY_LAST_UPDATED = "last_updated";
    private static final String KEY_LAST_EVENT_DATE = "last_event_date";
    private static final String KEY_SERVICE_STARTED_AT = "service_started_at";
    private static final String CHANNEL_ID = "risefit_step_tracking";
    private static final int NOTIFICATION_ID = 6310;

    public static final String ACTION_STOP = "com.risefit.app.steps.STOP";

    private SensorManager sensorManager;
    private Sensor stepCounter;
    private HandlerThread sensorThread;
    private Handler sensorHandler;
    private boolean listenerRegistered = false;

    public static String dayKey(String date) {
        return "day_" + date;
    }

    private static boolean hasActivityPermission(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
            || context.checkSelfPermission("android.permission.ACTIVITY_RECOGNITION")
                == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    public static void enable(Context context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_ENABLED, true).apply();
        try {
            startService(context);
        } catch (RuntimeException error) {
            disable(context);
            throw error;
        }
    }

    public static void disable(Context context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_ENABLED, false).apply();
        context.stopService(new Intent(context, StepCounterService.class));
    }

    public static void startIfEnabled(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean(KEY_ENABLED, false) || !hasActivityPermission(context)) return;
        startService(context);
    }

    private static void startService(Context context) {
        Intent intent = new Intent(context, StepCounterService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    private SharedPreferences preferences() {
        return getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            preferences().edit().putBoolean(KEY_ENABLED, false).apply();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (!preferences().getBoolean(KEY_ENABLED, false) || !hasActivityPermission(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        try {
            startAsForegroundService();
        } catch (RuntimeException startError) {
            // Do not leave the user-facing enabled flag set when Android
            // refuses the foreground-service start or required service type.
            preferences().edit().putBoolean(KEY_ENABLED, false).apply();
            stopSelf();
            return START_NOT_STICKY;
        }
        if (listenerRegistered) return START_STICKY;

        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager == null) {
            markUnsupportedAndStop();
            return START_NOT_STICKY;
        }

        // Prefer a wake-up step counter when the device exposes one; otherwise
        // use the standard hardware counter. The foreground service keeps the
        // listener registered while the Activity is closed or swiped away.
        stepCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER, true);
        if (stepCounter == null) {
            stepCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        }
        if (stepCounter == null) {
            markUnsupportedAndStop();
            return START_NOT_STICKY;
        }

        sensorThread = new HandlerThread("RiseFitStepCounter");
        sensorThread.start();
        sensorHandler = new Handler(sensorThread.getLooper());
        try {
            listenerRegistered = sensorManager.registerListener(
                this, stepCounter, SensorManager.SENSOR_DELAY_NORMAL, 10_000_000, sensorHandler
            );
        } catch (RuntimeException registrationError) {
            markUnsupportedAndStop();
            return START_NOT_STICKY;
        }
        if (!listenerRegistered) {
            markUnsupportedAndStop();
            return START_NOT_STICKY;
        }
        preferences().edit().putLong(KEY_SERVICE_STARTED_AT, System.currentTimeMillis()).apply();
        return START_STICKY;
    }

    private void startAsForegroundService() {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification() {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = launchIntent == null ? null : PendingIntent.getActivity(
            this, 6310, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent pauseIntent = new Intent(this, StepCounterService.class).setAction(ACTION_STOP);
        PendingIntent pausePendingIntent = PendingIntent.getService(
            this, 6311, pauseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);

        builder.setSmallIcon(android.R.drawable.ic_menu_myplaces)
            .setContentTitle("RiseFit is counting your steps")
            .setContentText("Automatic daily tracking is active on this phone.")
            .setCategory(Notification.CATEGORY_STATUS)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(android.R.drawable.ic_media_pause, "Pause", pausePendingIntent);
        if (contentIntent != null) builder.setContentIntent(contentIntent);
        return builder.build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "Automatic step tracking", NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Shows when RiseFit is counting steps in the background.");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private void markUnsupportedAndStop() {
        preferences().edit().putBoolean(KEY_ENABLED, false).apply();
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event == null || event.sensor.getType() != Sensor.TYPE_STEP_COUNTER || event.values.length == 0) return;

        long rawTotal = Math.max(0L, (long) event.values[0]);
        SharedPreferences prefs = preferences();

        // SensorEvent timestamps use elapsed realtime. Convert the event time
        // to wall time before deciding which local calendar day receives steps.
        long eventWallTime = System.currentTimeMillis();
        long elapsedSinceEventMs = Math.max(
            0L, (SystemClock.elapsedRealtimeNanos() - event.timestamp) / 1_000_000L
        );
        if (event.timestamp > 0L && elapsedSinceEventMs < eventWallTime) {
            eventWallTime -= elapsedSinceEventMs;
        }
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        String date = dateFormat.format(new Date(eventWallTime));

        long previousRaw = prefs.getLong(KEY_LAST_RAW, -1L);
        boolean counterReset = previousRaw < 0L || rawTotal < previousRaw;

        // A sensor gap can span a local midnight when the service was paused,
        // killed, or could not run in the background. The cumulative difference
        // then contains more than today's steps and cannot safely be split.
        // Use the saved event date; older installs fall back to last_updated.
        String previousEventDate = prefs.getString(KEY_LAST_EVENT_DATE, null);
        if (previousEventDate == null) {
            long lastUpdated = prefs.getLong(KEY_LAST_UPDATED, 0L);
            if (lastUpdated > 0L) {
                previousEventDate = dateFormat.format(new Date(lastUpdated));
            }
        }
        boolean crossedCalendarDate = previousEventDate != null
            && !previousEventDate.equals(date);
        boolean newCounterBaseline = counterReset || crossedCalendarDate;
        long delta = newCounterBaseline
            ? 0L
            : Math.max(0L, rawTotal - previousRaw);

        if (counterReset) {
            // If Android rebooted today, the raw total since boot is safe to
            // attribute to today. If the phone has been running across dates,
            // the cumulative value cannot be split, so keep a zero baseline.
            long bootTimeMillis = System.currentTimeMillis() - SystemClock.elapsedRealtime();
            String bootDate = dateFormat.format(new Date(bootTimeMillis));
            if (bootDate.equals(date)) {
                delta = rawTotal;
            }
        }

        SharedPreferences.Editor editor = prefs.edit()
            .putLong(KEY_LAST_RAW, rawTotal)
            .putLong(KEY_LAST_UPDATED, System.currentTimeMillis())
            .putString(KEY_LAST_EVENT_DATE, date);
        if (delta > 0L) {
            String key = dayKey(date);
            editor.putLong(key, Math.max(0L, prefs.getLong(key, 0L)) + delta);
        }
        editor.apply();
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // The step counter reports integer totals; no calibration action is needed.
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Do not stop on swipe-away: the user explicitly enabled continuous tracking.
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        if (sensorManager != null && listenerRegistered) {
            sensorManager.unregisterListener(this);
        }
        listenerRegistered = false;
        if (sensorThread != null) {
            sensorThread.quitSafely();
            sensorThread = null;
            sensorHandler = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
