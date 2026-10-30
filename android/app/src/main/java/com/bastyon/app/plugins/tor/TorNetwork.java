package com.bastyon.app.plugins.tor;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.webkit.ProxyConfig;
import androidx.webkit.ProxyController;
import androidx.webkit.WebViewFeature;

import java.io.File;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Куда ходит сеть приложения, пока включён Tor. Всё мимо Rust идёт через
 * HTTP-туннель Tor (HTTPTunnelPort): имя хоста уходит в CONNECT, разрешает
 * его Tor, а не устройство.
 *
 * WebView — целиком, прокси WebView (ProxyController): картинки, видео,
 * звук и сокеты тоже идут через Tor. Пока Tor не готов, прокси указывает на
 * порт 1 — там никто не слушает (порты ниже 1024 приложениям не открыть), и
 * WebView не ходит никуда, а не напрямую.
 *
 * HttpURLConnection — с прокси из {@link #proxy()}: Tor не готов — запрос
 * не начинается вовсе.
 *
 * «Tor включён» хранится и здесь: WebView должен получить прокси до первой
 * загрузки, раньше, чем интерфейс прочитает свои настройки.
 */
public final class TorNetwork {
    private static final String TAG = "TorNetwork";
    private static final String PREFS = "bastyon_tor";
    private static final String KEY_WANTED = "wanted";
    private static final String BLACKHOLE = "127.0.0.1:1";

    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final CopyOnWriteArrayList<Runnable> ON_ENABLED = new CopyOnWriteArrayList<>();

    private static volatile boolean available;
    private static volatile boolean wanted;
    private static volatile String status = "off";
    private static volatile int httpPort;
    private static Context app;

    private TorNetwork() {}

    /**
     * До создания WebView. Tor есть в этой сборке, только если на месте
     * библиотека, программы tor и WebView умеет прокси.
     */
    public static void init(Context context) {
        app = context.getApplicationContext();
        String libDir = app.getApplicationInfo().nativeLibraryDir;
        available = TorNative.LOADED
                && new File(libDir, "libtor.so").isFile()
                && WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE);
        wanted = available && prefs().getBoolean(KEY_WANTED, false);
        applyWebViewProxy();
    }

    public static boolean available() {
        return available;
    }

    public static boolean wanted() {
        return wanted;
    }

    static String status() {
        return status;
    }

    /**
     * Прокси для HttpURLConnection. Tor выключен — без прокси; включён и
     * готов — HTTP-туннель Tor; включён, но не готов — IOException.
     */
    public static Proxy proxy() throws IOException {
        if (!wanted) return Proxy.NO_PROXY;
        int port = httpPort;
        if (!"ready".equals(status) || port <= 0) {
            throw new IOException("tor_not_ready: status=" + status);
        }
        return new Proxy(Proxy.Type.HTTP, new InetSocketAddress("127.0.0.1", port));
    }

    /** Прямые соединения (ноды напрямую) — только без Tor, как у компьютера. */
    public static boolean directRefused() {
        return wanted || !"off".equals(status);
    }

    /** Tor включили: прямые соединения закрываются (NodeLinkPlugin). */
    public static void addOnEnabled(Runnable listener) {
        ON_ENABLED.add(listener);
    }

    public static void removeOnEnabled(Runnable listener) {
        ON_ENABLED.remove(listener);
    }

    static void setWanted(boolean value) {
        if (!available || wanted == value) return;
        wanted = value;
        prefs().edit().putBoolean(KEY_WANTED, value).apply();
        applyWebViewProxy();
        if (value) {
            for (Runnable listener : ON_ENABLED) listener.run();
        }
    }

    /** Снимок {@code tor:state}: статус и порт туннеля. */
    static void onState(String newStatus, int newHttpPort) {
        boolean changed = !newStatus.equals(status) || newHttpPort != httpPort;
        status = newStatus;
        httpPort = newHttpPort;
        if (changed) applyWebViewProxy();
    }

    private static SharedPreferences prefs() {
        return app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static void applyWebViewProxy() {
        if (!available) return;
        final boolean on = wanted;
        final String target = "ready".equals(status) && httpPort > 0
                ? "127.0.0.1:" + httpPort
                : BLACKHOLE;
        MAIN.post(() -> {
            ProxyController controller = ProxyController.getInstance();
            if (!on) {
                controller.clearProxyOverride(Runnable::run, () -> Log.i(TAG, "WebView proxy off"));
                return;
            }
            // Без addDirect(): прокси недоступен — запрос падает, а не уходит напрямую.
            ProxyConfig config = new ProxyConfig.Builder().addProxyRule(target).build();
            controller.setProxyOverride(config, Runnable::run, () -> Log.i(TAG, "WebView proxy " + target));
        });
    }
}
