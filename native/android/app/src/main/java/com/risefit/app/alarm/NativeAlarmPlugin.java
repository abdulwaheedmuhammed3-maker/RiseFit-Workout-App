package com.risefit.app.alarm;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.health.connect.AggregateRecordsRequest;
import android.health.connect.AggregateRecordsResponse;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.StepsRecord;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.ext.SdkExtensions;
import android.os.OutcomeReceiver;
import android.provider.Settings;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeAlarm")
public class NativeAlarmPlugin extends Plugin {
    @PluginMethod
    public void getStatus(PluginCall call) {
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
            call.reject("RiseFit could not schedule this alarm.", null, error);
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.trim().isEmpty()) { call.reject("Alarm ID is required."); return; }
        getContext().getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(AlarmScheduler.enabledKey(id), false).apply();
        AlarmScheduler.cancel(getContext(), id);
        call.resolve();
    }

    @PluginMethod
    public void stopRinging(PluginCall call) {
        getContext().stopService(new Intent(getContext(), WakeAlarmService.class).setAction(WakeAlarmService.ACTION_STOP));
        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(6303);
        call.resolve();
    }

    private static final String READ_STEPS_PERMISSION = "android.permission.health.READ_STEPS";

    @PluginMethod
    public void requestStepReadPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 34) {
            call.reject("Automatic daily step reading requires Android 14 or later with Health Connect support.");
            return;
        }

        Context context = getContext();
        android.app.Activity activity = getActivity();
        if (activity == null) {
            call.reject("RiseFit could not open Android settings because its screen is not available. Return to RiseFit and try again.");
            return;
        }

        Intent appPermissionsIntent = new Intent(HealthConnectManager.ACTION_MANAGE_HEALTH_PERMISSIONS);
        appPermissionsIntent.putExtra(Intent.EXTRA_PACKAGE_NAME, context.getPackageName());
        try {
            activity.startActivity(appPermissionsIntent);
            call.resolve();
            return;
        } catch (RuntimeException directError) {
            android.util.Log.w("RiseFitHealthConnect", "Could not open app-specific Health Connect permissions; trying Health Connect settings.", directError);
        }

        // Some Android builds expose the Health Connect settings screen but do not expose
        // the app-specific permissions route. The settings fallback lets the user open
        // App permissions, choose RiseFit, and enable Steps manually.
        try {
            Intent healthConnectSettings = new Intent("android.health.connect.action.HEALTH_HOME_SETTINGS");
            activity.startActivity(healthConnectSettings);
            call.resolve();
        } catch (RuntimeException fallbackError) {
            android.util.Log.e("RiseFitHealthConnect", "Could not open Health Connect settings.", fallbackError);
            call.reject(
                "Android could not open Health Connect automatically. Open your phone Settings, find Health Connect, then go to App permissions > RiseFit and allow Steps.",
                null,
                fallbackError
            );
        }
    }

    @PluginMethod
    public void getDailyStepStats(PluginCall call) {
        if (Build.VERSION.SDK_INT < 34) {
            JSObject result = new JSObject();
            result.put("available", false);
            result.put("permissionGranted", false);
            result.put("stepsToday", 0);
            result.put("days", new JSArray());
            result.put("message", "Automatic daily steps require Android 14 or later with Health Connect support.");
            call.resolve(result);
            return;
        }
        if (SdkExtensions.getExtensionVersion(Build.VERSION_CODES.UPSIDE_DOWN_CAKE) < 20) {
            JSObject result = new JSObject();
            result.put("available", false);
            result.put("permissionGranted", false);
            result.put("stepsToday", 0);
            result.put("days", new JSArray());
            result.put("message", "This phone needs the Android 14 system update that enables automatic Health Connect step counting.");
            call.resolve(result);
            return;
        }

        Context context = getContext();
        HealthConnectManager manager = context.getSystemService(HealthConnectManager.class);
        if (manager == null) {
            JSObject result = new JSObject();
            result.put("available", false);
            result.put("permissionGranted", false);
            result.put("stepsToday", 0);
            result.put("days", new JSArray());
            result.put("message", "Android Health Connect is not available on this device.");
            call.resolve(result);
            return;
        }

        boolean permissionGranted = context.checkSelfPermission(READ_STEPS_PERMISSION)
            == android.content.pm.PackageManager.PERMISSION_GRANTED;
        if (!permissionGranted) {
            JSObject result = new JSObject();
            result.put("available", true);
            result.put("permissionGranted", false);
            result.put("stepsToday", 0);
            result.put("days", new JSArray());
            result.put("lastUpdated", System.currentTimeMillis());
            call.resolve(result);
            return;
        }

        queryStepDay(manager, call, LocalDate.now(ZoneId.systemDefault()), 0, new JSArray(), 0L);
    }

    private void queryStepDay(
        HealthConnectManager manager,
        PluginCall call,
        LocalDate day,
        int dayIndex,
        JSArray days,
        long todaySteps
    ) {
        ZoneId zone = ZoneId.systemDefault();
        Instant start = day.atStartOfDay(zone).toInstant();
        Instant end = day.plusDays(1).atStartOfDay(zone).toInstant();
        if (day.equals(LocalDate.now(zone))) end = Instant.now();

        TimeInstantRangeFilter range = new TimeInstantRangeFilter.Builder()
            .setStartTime(start)
            .setEndTime(end)
            .build();
        AggregateRecordsRequest<Long> request = new AggregateRecordsRequest.Builder<Long>(range)
            .addAggregationType(StepsRecord.STEPS_COUNT_TOTAL)
            .build();

        manager.aggregate(request, getContext().getMainExecutor(),
            new OutcomeReceiver<AggregateRecordsResponse<Long>, HealthConnectException>() {
                @Override
                public void onResult(AggregateRecordsResponse<Long> response) {
                    Long value = response.get(StepsRecord.STEPS_COUNT_TOTAL);
                    long count = value == null ? 0L : Math.max(0L, value);
                    JSObject entry = new JSObject();
                    entry.put("date", day.toString());
                    entry.put("steps", count);
                    days.put(entry);

                    long nextTodaySteps = dayIndex == 0 ? count : todaySteps;
                    if (dayIndex < 6) {
                        queryStepDay(manager, call, day.minusDays(1), dayIndex + 1, days, nextTodaySteps);
                        return;
                    }

                    JSObject result = new JSObject();
                    result.put("available", true);
                    result.put("permissionGranted", true);
                    result.put("stepsToday", nextTodaySteps);
                    result.put("days", days);
                    result.put("lastUpdated", System.currentTimeMillis());
                    result.put("source", "health_connect");
                    call.resolve(result);
                }

                @Override
                public void onError(HealthConnectException error) {
                    call.reject("RiseFit could not read daily steps from Android Health Connect.", null, error);
                }
            }
        );
    }

    @PluginMethod
    public void consumeAlarmLaunch(PluginCall call) {
        Intent intent = getActivity().getIntent();
        boolean openChallenge = intent != null && intent.getBooleanExtra(AlarmScheduler.EXTRA_OPEN_CHALLENGE, false);
        String alarmId = intent == null ? null : intent.getStringExtra(AlarmScheduler.EXTRA_ALARM_ID);
        if (openChallenge) {
            intent.removeExtra(AlarmScheduler.EXTRA_OPEN_CHALLENGE);
            getActivity().setIntent(intent);
        }
        JSObject result = new JSObject();
        result.put("openChallenge", openChallenge);
        if (alarmId != null) result.put("alarmId", alarmId);
        call.resolve(result);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent != null && intent.getBooleanExtra(AlarmScheduler.EXTRA_OPEN_CHALLENGE, false)) {
            JSObject event = new JSObject();
            event.put("openChallenge", true);
            String alarmId = intent.getStringExtra(AlarmScheduler.EXTRA_ALARM_ID);
            if (alarmId != null) event.put("alarmId", alarmId);
            notifyListeners("alarmTriggered", event, true);
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
                anyScheduled = true;
                String id = key.substring(6, key.length() - 8);
                hour = prefs.getInt(AlarmScheduler.hourKey(id), 6);
                minute = prefs.getInt(AlarmScheduler.minuteKey(id), 30);
                break;
            }
        }
        result.put("scheduled", anyScheduled);
        result.put("ringing", prefs.getBoolean("ringing", false));
        result.put("hour", hour);
        result.put("minute", minute);
        return result;
    }
}
