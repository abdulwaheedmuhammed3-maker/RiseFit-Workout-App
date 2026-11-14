package com.risefit.app;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public final class PermissionsRationaleActivity extends Activity {
    private int dp(float value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private TextView paragraph(String text) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(Color.rgb(218, 224, 214));
        view.setTextSize(15);
        view.setLineSpacing(dp(4), 1.0f);
        view.setPadding(0, dp(8), 0, dp(8));
        return view;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(11, 13, 10));

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(24), dp(32), dp(24), dp(24));

        TextView title = new TextView(this);
        title.setText("RiseFit privacy & Health Connect");
        title.setTextColor(Color.WHITE);
        title.setTextSize(24);
        title.setGravity(Gravity.START);
        content.addView(title, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        content.addView(paragraph(
            "RiseFit requests permission to read your daily step totals from Android Health Connect. " +
            "We use those totals only to show your steps today and recent daily step history in RiseFit. " +
            "RiseFit does not upload, sell, or share your Health Connect step records with a RiseFit server."
        ));

        content.addView(paragraph(
            "When you choose a camera-verified workout, RiseFit processes the live camera frames on your device " +
            "to estimate body pose and count exercise repetitions or verified hold time. RiseFit does not record, " +
            "store, or upload the camera video."
        ));

        content.addView(paragraph(
            "Your profile details, alarm settings, and completed workout history are stored in local app storage " +
            "on this device. This version does not provide an online account or cloud synchronisation."
        ));

        content.addView(paragraph(
            "You can revoke RiseFit's step access at any time in Android Settings under Health Connect app permissions. " +
            "You can remove local RiseFit data by clearing the app's storage or uninstalling the app. Doing so also " +
            "removes saved alarms and settings."
        ));

        Button close = new Button(this);
        close.setText("Close");
        close.setOnClickListener(view -> finish());
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        );
        buttonParams.topMargin = dp(20);
        content.addView(close, buttonParams);

        scroll.addView(content);
        setContentView(scroll);
    }
}
