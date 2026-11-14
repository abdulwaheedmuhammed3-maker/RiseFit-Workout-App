package com.risefit.app.alarm;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

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
