package com.sprouttrack.app;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridge.setWebViewClient(new NurseryAwareWebViewClient(bridge, this::applyNursery));
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
