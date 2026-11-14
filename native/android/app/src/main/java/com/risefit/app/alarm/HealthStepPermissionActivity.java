package com.risefit.app.alarm;

import android.os.Bundle;

import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.health.connect.client.PermissionController;

import java.util.Collections;
import java.util.Set;

/**
 * Requests READ_STEPS through Health Connect's official permission contract.
 * The Activity is declared in the generated Android manifest by prepare-android.mjs.
 */
public final class HealthStepPermissionActivity extends ComponentActivity {
    private static final String READ_STEPS_PERMISSION =
        "android.permission.health.READ_STEPS";
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (android.os.Build.VERSION.SDK_INT < 34) {
            finish();
            return;
        }

        if (checkSelfPermission(READ_STEPS_PERMISSION)
            == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            finish();
            return;
        }

        ActivityResultLauncher<Set<String>> permissionLauncher =
            registerForActivityResult(
                PermissionController.createRequestPermissionResultContract(),
                grantedPermissions -> {
                    // RiseFit re-reads the permission state when it returns to the foreground.
                    finish();
                }
            );

        permissionLauncher.launch(Collections.singleton(READ_STEPS_PERMISSION));
    }
}
