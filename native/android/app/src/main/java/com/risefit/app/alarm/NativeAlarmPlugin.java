package com.risefit.app.alarm;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.BatteryManager;
import android.os.PowerManager;
import android.content.IntentFilter;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import java.util.Locale;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PermissionState;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "NativeAlarm",
    permissions = {
        @Permission(
            alias = "activityRecognition",
            strings = { "android.permission.ACTIVITY_RECOGNITION" }
        )
    }
)
public class NativeAlarmPlugin extends Plugin {
    private TextToSpeech voiceEngine;
    private boolean voiceEngineReady = false;
    private String pendingVoiceText;
    @PluginMethod
    public void speakText(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.trim().isEmpty()) {
            call.reject("There is no voice coaching text to speak.");
            return;
        }
        String safeText = text.trim();
        if (safeText.length() > 500) safeText = safeText.substring(0, 500);
        if (voiceEngineReady && voiceEngine != null) {
            int result = voiceEngine.speak(safeText, TextToSpeech.QUEUE_FLUSH, null, "risefit-coaching");
            if (result == TextToSpeech.ERROR) call.reject("Android could not speak the coaching instruction.");
            else call.resolve();
            return;
        }
        pendingVoiceText = safeText;
        if (voiceEngine == null) {
            voiceEngine = new TextToSpeech(getContext(), status -> {
                if (status == TextToSpeech.SUCCESS && voiceEngine != null) {
                    voiceEngineReady = true;
                    voiceEngine.setLanguage(Locale.getDefault());
                    voiceEngine.setSpeechRate(0.95f);
                    String queued = pendingVoiceText;
                    pendingVoiceText = null;
                    if (queued != null) voiceEngine.speak(queued, TextToSpeech.QUEUE_FLUSH, null, "risefit-coaching");
                } else {
                    voiceEngineReady = false;
                    pendingVoiceText = null;
                }
            });
        }
        call.resolve();
    }

    @PluginMethod
    public void getSpeechStatus(PluginCall call) {
        if (voiceEngineReady && voiceEngine != null) {
            resolveSpeechStatus(call);
            return;
        }
        if (voiceEngine != null) {
            JSObject result = new JSObject();
            result.put("available", false);
            result.put("languageAvailable", false);
            result.put("language", Locale.getDefault().toLanguageTag());
            result.put("message", "Android voice engine is still starting. Check again in a moment.");
            call.resolve(result);
            return;
        }
        voiceEngine = new TextToSpeech(getContext(), status -> {
            if (status == TextToSpeech.SUCCESS && voiceEngine != null) {
                voiceEngineReady = true;
                voiceEngine.setLanguage(Locale.getDefault());
                resolveSpeechStatus(call);
            } else {
                voiceEngineReady = false;
                JSObject result = new JSObject();
                result.put("available", false);
                result.put("languageAvailable", false);
                result.put("language", Locale.getDefault().toLanguageTag());
                result.put("message", "No working Android text-to-speech engine is available. Install or enable a speech engine in Android settings.");
                call.resolve(result);
            }
        });
    }

    private void resolveSpeechStatus(PluginCall call) {
        Locale locale = Locale.getDefault();
        int languageResult = voiceEngine == null ? TextToSpeech.ERROR : voiceEngine.isLanguageAvailable(locale);
        boolean languageAvailable = languageResult >= TextToSpeech.LANG_AVAILABLE;
        JSObject result = new JSObject();
        result.put("available", voiceEngineReady);
        result.put("languageAvailable", languageAvailable);
        result.put("language", locale.toLanguageTag());
        result.put("message", !voiceEngineReady
            ? "Android text-to-speech is unavailable."
            : languageAvailable ? "Voice engine and device language are ready." : "The current device language is not installed for speech. Install a voice for " + locale.getDisplayName() + " in Android text-to-speech settings.");
        call.resolve(result);
    }

    @PluginMethod
    public void stopSpeech(PluginCall call) {
        pendingVoiceText = null;
        if (voiceEngine != null && voiceEngineReady) voiceEngine.stop();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (voiceEngine != null) {
            voiceEngine.stop();
            voiceEngine.shutdown();
            voiceEngine = null;
            voiceEngineReady = false;
            pendingVoiceText = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        // Restore only alarms whose broadcast PendingIntent no longer exists.
        // This recovers alarms cleared by Android without moving already-pending
        // alarms to tomorrow when the user opens RiseFit near their ring time.
        AlarmScheduler.restoreMissingAlarms(getContext());
        call.resolve(status());
    }

    @PluginMethod
    public void requestExactAlarmAccess(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                    .setData(Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(intent);
            }
            call.resolve();
        } catch (RuntimeException error) {
            call.reject("Could not open Android exact-alarm settings.", null, error);
        }
    }

    @PluginMethod
    public void requestDndAccess(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            JSObject result = new JSObject();
            result.put("manualSetupRequired", false);
            call.resolve(result);
            return;
        }
        try {
            // Android's DND access settings action takes no data URI.
            getActivity().startActivity(new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS));
            JSObject result = new JSObject();
            result.put("manualSetupRequired", false);
            call.resolve(result);
        } catch (RuntimeException directSettingsError) {
            try {
                getActivity().startActivity(new Intent(Settings.ACTION_SETTINGS));
                JSObject result = new JSObject();
                result.put("manualSetupRequired", true);
                call.resolve(result);
            } catch (RuntimeException fallbackError) {
                call.reject("Could not open Android settings. Go to Settings > Special app access > Do Not Disturb access and allow RiseFit.", null, fallbackError);
            }
        }
    }

    @PluginMethod
    public void requestFullScreenAccess(PluginCall call) {
        if (Build.VERSION.SDK_INT < 34) {
            call.resolve();
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
                .setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (RuntimeException error) {
            call.reject("Could not open Android full-screen alarm settings.", null, error);
        }
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        String id = call.getString("id");
        Integer hour = call.getInt("hour");
        Integer minute = call.getInt("minute");
        if (id == null || id.trim().isEmpty() || id.length() > 80 || hour == null || minute == null || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            call.reject("Choose a valid alarm and time."); return;
        }
        AlarmManager manager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && manager != null && !manager.canScheduleExactAlarms()) {
            call.reject("Allow RiseFit to set exact alarms, then save the alarm again."); return;
        }
        android.content.SharedPreferences prefs = getContext().getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(AlarmScheduler.enabledKey(id), true)
            .putInt(AlarmScheduler.hourKey(id), hour).putInt(AlarmScheduler.minuteKey(id), minute).apply();
        try { AlarmScheduler.scheduleNext(getContext(), id, hour, minute); call.resolve(status()); }
        catch (Exception error) {
            prefs.edit().putBoolean(AlarmScheduler.enabledKey(id), false).apply();
            // A failed update must not leave an old AlarmManager entry or
            // PendingIntent representing an alarm that is now marked disabled.
            try { AlarmScheduler.cancel(getContext(), id); }
            catch (RuntimeException ignored) {}
            call.reject("RiseFit could not schedule this alarm.", null, error);
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.trim().isEmpty()) { call.reject("Alarm ID is required."); return; }
        Context context = getContext();
        android.content.SharedPreferences prefs = context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(AlarmScheduler.enabledKey(id), false).apply();
        AlarmScheduler.cancel(context, id);

        // Cancelling an alarm must also stop its current ring, even when the
        // challenge Activity has not opened yet and cannot guard the UI action.
        boolean isCurrentlyRinging = prefs.getBoolean("ringing", false)
            && id.equals(prefs.getString("active_alarm_id", null));
        if (isCurrentlyRinging) {
            context.stopService(new Intent(context, WakeAlarmService.class));
            prefs.edit().putBoolean("ringing", false)
                .remove("active_alarm_id")
                .remove("ring_started_at")
                .apply();
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) manager.cancel(6303);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopRinging(PluginCall call) {
        Context context = getContext();
        // Clear persisted ring state even if Android already stopped the
        // service after process pressure. Otherwise a stale ringing flag can
        // make a later sticky-service recovery resume an alarm the user has
        // already completed in RiseFit.
        context.stopService(new Intent(context, WakeAlarmService.class));
        android.content.SharedPreferences prefs = context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE);
        prefs.edit().putBoolean("ringing", false)
            .remove("active_alarm_id")
            .remove("ring_started_at")
            .apply();
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(6303);
        call.resolve();
    }

    @PluginMethod
    public void requestStepTrackingPermission(PluginCall call) {
        SensorManager sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        Sensor sensor = sensorManager == null ? null : sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (sensor == null) {
            call.reject("This phone does not provide a built-in hardware step counter.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            && getPermissionState("activityRecognition") != PermissionState.GRANTED) {
            requestPermissionForAlias("activityRecognition", call, "stepTrackingPermissionCallback");
            return;
        }
        enableStepTracking(call);
    }

    @PermissionCallback
    private void stepTrackingPermissionCallback(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            && getContext().checkSelfPermission("android.permission.ACTIVITY_RECOGNITION")
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            call.reject("Physical activity access was not granted. Allow RiseFit to recognise physical activity to count your steps.");
            return;
        }
        enableStepTracking(call);
    }

    private void enableStepTracking(PluginCall call) {
        try {
            StepCounterService.enable(getContext());
            call.resolve();
        } catch (RuntimeException error) {
            StepCounterService.disable(getContext());
            call.reject("RiseFit could not start background step tracking. Check notification and battery settings, then try again.", null, error);
        }
    }

    private void stopStepTrackingIfPermissionRevoked(Context context, boolean permissionGranted) {
        if (permissionGranted) return;
        android.content.SharedPreferences prefs = context.getSharedPreferences(
            "risefit_native_steps", Context.MODE_PRIVATE
        );
        if (prefs.getBoolean("tracking_enabled", false)) {
            StepCounterService.disable(context);
        }
    }

    @PluginMethod
    public void getDailyStepStats(PluginCall call) {
        Context context = getContext();
        SensorManager sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        Sensor sensor = sensorManager == null ? null : sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        boolean available = sensor != null;
        boolean activityPermissionGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
            || context.checkSelfPermission("android.permission.ACTIVITY_RECOGNITION")
                == android.content.pm.PackageManager.PERMISSION_GRANTED;
        stopStepTrackingIfPermissionRevoked(context, activityPermissionGranted);

        if (!available) {
            JSObject result = new JSObject();
            result.put("available", false);
            result.put("permissionGranted", false);
            result.put("stepsToday", 0);
            result.put("days", new JSArray());
            result.put("message", "This phone does not include a built-in hardware step counter. RiseFit cannot count steps automatically on this device.");
            result.put("lastUpdated", System.currentTimeMillis());
            call.resolve(result);
            return;
        }

        android.content.SharedPreferences prefs = context.getSharedPreferences(
            "risefit_native_steps", Context.MODE_PRIVATE
        );
        boolean trackingEnabled = activityPermissionGranted
            && prefs.getBoolean("tracking_enabled", false);
        if (trackingEnabled) {
            try {
                StepCounterService.startIfEnabled(context);
            } catch (RuntimeException error) {
                StepCounterService.disable(context);
                call.reject("RiseFit could not restart its background step counter. Open RiseFit and enable automatic steps again.", null, error);
                return;
            }
        }

        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        JSArray days = new JSArray();
        long stepsToday = 0L;
        // Keep a full year available for monthly comparisons and local backup exports.
        for (int index = 0; index < 365; index++) {
            LocalDate date = today.minusDays(index);
            long steps = Math.max(0L, prefs.getLong(StepCounterService.dayKey(date.toString()), 0L));
            JSObject entry = new JSObject();
            entry.put("date", date.toString());
            entry.put("steps", steps);
            days.put(entry);
            if (index == 0) stepsToday = steps;
        }

        JSObject result = new JSObject();
        result.put("available", true);
        result.put("permissionGranted", trackingEnabled);
        result.put("stepsToday", stepsToday);
        result.put("days", days);
        result.put("lastUpdated", prefs.getLong("last_updated", System.currentTimeMillis()));
        result.put("source", "native_sensor");
        if (!activityPermissionGranted) {
            result.put("message", "Allow RiseFit to recognise physical activity so it can count steps automatically.");
        } else if (!trackingEnabled) {
            result.put("message", "Enable automatic step counting once. RiseFit will then keep counting while the app is closed.");
        } else {
            result.put("message", "Steps are counted directly from this phone, including while RiseFit is closed.");
        }
        call.resolve(result);
    }

    @PluginMethod
    public void getDeviceHealth(PluginCall call) {
        Context context = getContext();
        SensorManager sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        Sensor sensor = sensorManager == null ? null : sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        boolean permissionGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
            || context.checkSelfPermission("android.permission.ACTIVITY_RECOGNITION")
                == android.content.pm.PackageManager.PERMISSION_GRANTED;
        stopStepTrackingIfPermissionRevoked(context, permissionGranted);
        android.content.SharedPreferences stepPrefs = context.getSharedPreferences(
            "risefit_native_steps", Context.MODE_PRIVATE
        );
        boolean trackingEnabled = permissionGranted && stepPrefs.getBoolean("tracking_enabled", false);

        Intent battery = context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        int batteryPercent = -1;
        boolean charging = false;
        String batteryStatus = "unknown";
        if (battery != null) {
            int level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
            if (level >= 0 && scale > 0) batteryPercent = Math.round((level * 100f) / scale);
            int status = battery.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
            charging = status == BatteryManager.BATTERY_STATUS_CHARGING
                || status == BatteryManager.BATTERY_STATUS_FULL;
            if (status == BatteryManager.BATTERY_STATUS_CHARGING) batteryStatus = "charging";
            else if (status == BatteryManager.BATTERY_STATUS_FULL) batteryStatus = "full";
            else if (status == BatteryManager.BATTERY_STATUS_DISCHARGING) batteryStatus = "discharging";
            else if (status == BatteryManager.BATTERY_STATUS_NOT_CHARGING) batteryStatus = "not_charging";
        }

        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        boolean batteryOptimizationExempt = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
            || (powerManager != null && powerManager.isIgnoringBatteryOptimizations(context.getPackageName()));
        boolean powerSaveMode = powerManager != null && powerManager.isPowerSaveMode();

        JSObject result = new JSObject();
        result.put("batteryPercent", batteryPercent);
        result.put("charging", charging);
        result.put("batteryStatus", batteryStatus);
        result.put("batteryOptimizationExempt", batteryOptimizationExempt);
        result.put("powerSaveMode", powerSaveMode);
        result.put("stepSensorAvailable", sensor != null);
        result.put("stepSensorName", sensor == null ? "" : sensor.getName());
        result.put("stepSensorVendor", sensor == null ? "" : sensor.getVendor());
        result.put("activityPermissionGranted", permissionGranted);
        result.put("trackingEnabled", trackingEnabled);
        result.put("lastStepUpdate", stepPrefs.getLong("last_updated", 0L));
        result.put("serviceStartedAt", stepPrefs.getLong("service_started_at", 0L));
        result.put("checkedAt", System.currentTimeMillis());
        call.resolve(result);
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                getActivity().startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
            } else {
                getActivity().startActivity(new Intent(Settings.ACTION_SETTINGS));
            }
            call.resolve();
        } catch (RuntimeException error) {
            call.reject("Could not open Android battery optimization settings. Open your phone's Settings and find Battery or App battery usage.", null, error);
        }
    }

    @PluginMethod
    public void consumeAlarmLaunch(PluginCall call) {
        Intent intent = getActivity().getIntent();
        boolean openChallenge = intent != null && intent.getBooleanExtra(AlarmScheduler.EXTRA_OPEN_CHALLENGE, false);
        boolean openAlarmSettings = intent != null && intent.getBooleanExtra(AlarmScheduler.EXTRA_OPEN_ALARM_SETTINGS, false);
        String alarmId = intent == null ? null : intent.getStringExtra(AlarmScheduler.EXTRA_ALARM_ID);
        long occurrenceAt = intent == null ? 0L : intent.getLongExtra(AlarmScheduler.EXTRA_ALARM_OCCURRENCE_AT, 0L);
        if (openChallenge || openAlarmSettings) {
            intent.removeExtra(AlarmScheduler.EXTRA_OPEN_CHALLENGE);
            intent.removeExtra(AlarmScheduler.EXTRA_OPEN_ALARM_SETTINGS);
            getActivity().setIntent(intent);
        }
        JSObject result = new JSObject();
        result.put("openChallenge", openChallenge);
        result.put("openAlarmSettings", openAlarmSettings);
        if (alarmId != null) result.put("alarmId", alarmId);
        if (openChallenge && occurrenceAt > 0L) result.put("occurrenceAt", occurrenceAt);
        call.resolve(result);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent == null) return;

        boolean openChallenge = intent.getBooleanExtra(AlarmScheduler.EXTRA_OPEN_CHALLENGE, false);
        boolean openAlarmSettings = intent.getBooleanExtra(AlarmScheduler.EXTRA_OPEN_ALARM_SETTINGS, false);
        if (openChallenge || openAlarmSettings) {
            // Both launch flags are one-shot. Do not replay a challenge or
            // reopen the alarm editor on a later app resume.
            intent.removeExtra(AlarmScheduler.EXTRA_OPEN_CHALLENGE);
            intent.removeExtra(AlarmScheduler.EXTRA_OPEN_ALARM_SETTINGS);
            getActivity().setIntent(intent);

            String alarmId = intent.getStringExtra(AlarmScheduler.EXTRA_ALARM_ID);
            if (openChallenge) {
                JSObject event = new JSObject();
                event.put("openChallenge", true);
                long occurrenceAt = intent.getLongExtra(AlarmScheduler.EXTRA_ALARM_OCCURRENCE_AT, 0L);
                if (alarmId != null) event.put("alarmId", alarmId);
                if (occurrenceAt > 0L) event.put("occurrenceAt", occurrenceAt);
                notifyListeners("alarmTriggered", event, true);
            }
            if (openAlarmSettings) {
                JSObject event = new JSObject();
                event.put("openAlarmSettings", true);
                if (alarmId != null) event.put("alarmId", alarmId);
                notifyListeners("alarmSettingsRequested", event, true);
            }
        }
    }

    private JSObject status() {
        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        boolean exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S
            || (alarmManager != null && alarmManager.canScheduleExactAlarms());
        boolean dnd = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
            || (notificationManager != null && notificationManager.isNotificationPolicyAccessGranted());
        boolean fullScreen = Build.VERSION.SDK_INT < 34
            || (notificationManager != null && notificationManager.canUseFullScreenIntent());
        android.content.SharedPreferences prefs = context.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE);

        JSObject result = new JSObject();
        result.put("canScheduleExactAlarms", exact);
        result.put("canBypassDnd", dnd);
        result.put("canUseFullScreenIntent", fullScreen);
        boolean anyScheduled = false;
        int hour = 6, minute = 30;
        for (String key : prefs.getAll().keySet()) {
            if (key.startsWith("alarm_") && key.endsWith("_enabled") && prefs.getBoolean(key, false)) {
                String id = key.substring(6, key.length() - 8);
                if (!AlarmScheduler.hasPendingAlarm(context, id)) continue;
                anyScheduled = true;
                hour = prefs.getInt(AlarmScheduler.hourKey(id), 6);
                minute = prefs.getInt(AlarmScheduler.minuteKey(id), 30);
                break;
            }
        }
        result.put("scheduled", anyScheduled && exact);
        result.put("ringing", prefs.getBoolean("ringing", false));
        result.put("hour", hour);
        result.put("minute", minute);
        return result;
    }
}
