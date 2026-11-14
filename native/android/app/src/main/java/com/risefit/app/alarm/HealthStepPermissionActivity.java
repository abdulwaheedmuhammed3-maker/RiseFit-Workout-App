package com.risefit.app.alarm;

import android.os.Bundle;

import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContract;
import androidx.health.connect.client.PermissionController;

import java.util.Collections;
import java.util.Set;

/**
 * Hosts the official Health Connect permission contract.
 *
 * This is separate from the settings/management screen: launching the contract
 * explicitly asks the user to grant the declared READ_STEPS permission.
 */
public final class HealthStepPermissionActivity extends ComponentActivity {
    private static final String READ_STEPS_PERMISSION =
        "android.permission.health.READ_STEPS";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ActivityResultContract<Set<String>, Set<String>> contract =
            PermissionController.createRequestPermissionResultContract();

        ActivityResultLauncher<Set<String>> permissionLauncher =
            registerForActivityResult(contract, grantedPermissions -> {
                // RiseFit refreshes permission state when the app returns to foreground.
                finish();
            });

        permissionLauncher.launch(Collections.singleton(READ_STEPS_PERMISSION));
    }
}
