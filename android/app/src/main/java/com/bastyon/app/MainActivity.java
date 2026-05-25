package com.bastyon.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebView;
import android.graphics.Color;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.bastyon.app.plugins.BackgroundMediaPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundMediaPlugin.class);
        super.onCreate(savedInstanceState);

        // Edge-to-edge: WebView рисует под status/navigation barами.
        // На targetSdk 35+ это default, но вызываем явно для совместимости с младшими SDK.
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);

        // Прозрачные системные бары — чтобы под ними был виден контент WebView.
        // На API 35+ задаётся темой автоматически, до этого — здесь.
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);

        // Прокидываем системные insets в WebView как CSS-переменные.
        // env(safe-area-inset-*) у iOS-style WebView отрабатывают сами, у Android-
        // WebView их нужно установить руками: подписываемся на WindowInsets и пишем
        // CSS custom properties в :root через document.documentElement.style.
        View root = window.getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            float density = getResources().getDisplayMetrics().density;
            int topPx = Math.round(systemBars.top / density);
            int bottomPx = Math.round(systemBars.bottom / density);
            int leftPx = Math.round(systemBars.left / density);
            int rightPx = Math.round(systemBars.right / density);

            WebView wv = getBridge() != null ? getBridge().getWebView() : null;
            if (wv != null) {
                String js = String.format(
                    "document.documentElement.style.setProperty('--android-inset-top', '%dpx');" +
                    "document.documentElement.style.setProperty('--android-inset-bottom', '%dpx');" +
                    "document.documentElement.style.setProperty('--android-inset-left', '%dpx');" +
                    "document.documentElement.style.setProperty('--android-inset-right', '%dpx');",
                    topPx, bottomPx, leftPx, rightPx
                );
                wv.evaluateJavascript(js, null);
            }
            return insets;
        });

        // Светлые иконки в статус-баре (тема Dark).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController ctrl = window.getInsetsController();
            if (ctrl != null) {
                ctrl.setSystemBarsAppearance(
                    0,
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                      | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                );
            }
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // WebView's Chromium engine pauses HTML5 media when the activity
        // backgrounds. Force-resume it so video/audio keeps playing while
        // our MediaPlaybackService holds the foreground notification.
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv != null) {
            wv.onResume();
        }
    }
}
