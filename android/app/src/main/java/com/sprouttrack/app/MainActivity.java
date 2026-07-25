package com.sprouttrack.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridge.setWebViewClient(new NurseryAwareWebViewClient(bridge, this::applyNursery));
        createDefaultNotificationChannel();
    }

    /**
     * Spec §6.4. Must exist before any FCM message can arrive - channel
     * creation is idempotent (a re-create with the same id is a no-op), so
     * this runs unconditionally on every launch rather than tracking
     * first-run state. NotificationChannel is Android 8 (API 26)+ only; below
     * that, notifications have no channel concept and this is skipped.
     * The id here must match @string/default_notification_channel_id, which
     * AndroidManifest.xml wires to
     * com.google.firebase.messaging.default_notification_channel_id so FCM
     * routes messages into it instead of its own auto-created
     * "Miscellaneous" channel.
     */
    private void createDefaultNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        String channelId = getString(R.string.default_notification_channel_id);
        NotificationChannel channel = new NotificationChannel(
            channelId,
            getString(R.string.default_notification_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT);
        NotificationManager manager = ContextCompat.getSystemService(this, NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    /**
     * Idempotent and paired: NurseryAwareWebViewClient only calls this on an
     * actual active/inactive transition, and each branch here fully
     * reverts the other (keep-screen-on flag, system bar visibility).
     */
    private void applyNursery(boolean active) {
        runOnUiThread(() -> {
            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            if (active) {
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                controller.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsetsCompat.Type.systemBars());
            } else {
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                controller.show(WindowInsetsCompat.Type.systemBars());
            }
        });
    }
}
