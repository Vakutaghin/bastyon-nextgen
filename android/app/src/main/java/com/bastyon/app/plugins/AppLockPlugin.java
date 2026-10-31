package com.bastyon.app.plugins;

import android.app.Activity;
import android.os.Build;
import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Замок приложения (пин-код или графический ключ): снимок окна в списке
 * недавних не показываем, иначе переписку видно поверх закрытого приложения.
 *
 * Android 13+ умеет это прямо: setRecentsScreenshotEnabled(false), снимки
 * экрана при этом разрешены. На старых — FLAG_SECURE, но только пока окно
 * уходит в фон: с ним постоянно не сделать и обычный снимок экрана.
 */
@CapacitorPlugin(name = "AppLock")
public class AppLockPlugin extends Plugin {
    private volatile boolean hide = false;

    @PluginMethod
    public void setHideInRecents(PluginCall call) {
        hide = Boolean.TRUE.equals(call.getBoolean("hide", false));
        Activity activity = getActivity();
        if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.runOnUiThread(() -> activity.setRecentsScreenshotEnabled(!hide));
        }
        call.resolve();
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        if (hide && Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            setSecure(true);
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            setSecure(false);
        }
    }

    private void setSecure(boolean secure) {
        Activity activity = getActivity();
        if (activity == null) return;
        activity.runOnUiThread(() -> {
            if (secure) {
                activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            } else {
                activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
        });
    }
}
