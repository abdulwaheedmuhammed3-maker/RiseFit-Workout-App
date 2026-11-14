package com.risefit.app.alarm;

import android.os.Bundle;

import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;

/**
 * Requests the platform READ_STEPS runtime permission.
 *
 * On Android 14 and later, Android routes this Health permission through
 * the system Health Connect consent UI.
 */
public final class HealthStepPermissionActivity extends ComponentActivity {
    private static final String READ_STEPS_PERMISSION =
        "android.permission.health.READ_STEPS";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ActivityResultLauncher<String[]> permissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(),
                result -> {
                    // RiseFit refreshes permission state when the app returns to foreground.
                    finish();
                });

        permissionLauncher.launch(new String[]{READ_STEPS_PERMISSION});
    }
}
