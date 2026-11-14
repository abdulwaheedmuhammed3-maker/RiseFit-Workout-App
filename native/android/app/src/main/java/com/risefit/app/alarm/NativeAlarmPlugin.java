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
            call.resolve();
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
                .setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (RuntimeException error) {
            call.reject("Could not open Android Do Not Disturb access settings.", null, error);
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
        Integer hour = call.getInt("hour");
        Integer minute = call.getInt("minute");
        if (hour == null || minute == null || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            call.reject("Choose a valid alarm time.");
            return;
        }
        AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
            && alarmManager != null && !alarmManager.canScheduleExactAlarms()) {
            call.reject("Allow RiseFit to set exact alarms, then save the alarm again.");
            return;
        }

        getContext().getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean("enabled", true)
            .putBoolean("ringing", false)
            .putInt("hour", hour)
            .putInt("minute", minute)
            .apply();
        try {
            AlarmScheduler.scheduleNext(getContext(), hour, minute);
            call.resolve(status());
        } catch (Exception error) {
            getContext().getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean("enabled", false).apply();
            call.reject("RiseFit could not schedule this alarm.", null, error);
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        getContext().getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean("enabled", false).apply();
        AlarmScheduler.cancel(getContext());
        getContext().stopService(new Intent(getContext(), WakeAlarmService.class));
        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(6303);
        call.resolve(status());
    }

    @PluginMethod
    public void consumeAlarmLaunch(PluginCall call) {
        Intent intent = getActivity().getIntent();
        boolean openChallenge = intent != null && intent.getBooleanExtra(AlarmScheduler.EXTRA_OPEN_CHALLENGE, false);
        if (openChallenge) {
            intent.removeExtra(AlarmScheduler.EXTRA_OPEN_CHALLENGE);
            getActivity().setIntent(intent);
        }
        JSObject result = new JSObject();
        result.put("openChallenge", openChallenge);
        call.resolve(result);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent != null && intent.getBooleanExtra(AlarmScheduler.EXTRA_OPEN_CHALLENGE, false)) {
            JSObject event = new JSObject();
            event.put("openChallenge", true);
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
        result.put("scheduled", prefs.getBoolean("enabled", false));
        result.put("ringing", prefs.getBoolean("ringing", false));
        result.put("hour", prefs.getInt("hour", 6));
        result.put("minute", prefs.getInt("minute", 30));
        return result;
    }
}
