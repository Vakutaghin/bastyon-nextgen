package com.bastyon.app.plugins.tor;

import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Tor, встроенный в APK (src/helpers/tor/tor-bridge.ts). Интерфейс тот же,
 * что у компьютера:
 *
 *   call({ command, args }) → { value } — команда tor_* с JSON аргументов
 *       invoke Tauri; ошибка — текст ошибки Rust ("tor_not_ready: …").
 *   guard() — Tor сейчас включат: WebView больше не ходит напрямую.
 *   событие "event" { event, payload } — tor:state и tor:ws:&lt;id&gt;:*.
 *
 * Регистрируется, только если Tor в сборке есть ({@link TorNetwork#available()}).
 */
@CapacitorPlugin(name = "Tor")
public class TorPlugin extends Plugin {
    /** Сообщение Rust, когда tor умер сам (bastyon_tor::process::EXITED_MESSAGE). */
    private static final String EXITED = "tor process exited unexpectedly";

    /** Плагин пересоздаётся вместе с окном, а Tor — один на процесс. */
    private static volatile TorPlugin current;
    private static volatile String lastMessage = "";

    @Override
    public void load() {
        super.load();
        current = this;
        Context ctx = getContext();
        File root = new File(ctx.getFilesDir(), "tor");
        TorNative.init(
                root.getAbsolutePath(),
                ctx.getApplicationInfo().nativeLibraryDir,
                readAsset(ctx, "tor/pt_config.json"),
                TorPlugin::deliver);
    }

    @Override
    protected void handleOnDestroy() {
        if (current == this) current = null;
        super.handleOnDestroy();
    }

    /**
     * Android 12+ в фоне убивает дочерние процессы приложения. Вернулись, а
     * tor умер сам, — запускаем снова, как он и был включён.
     */
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (TorNetwork.wanted() && "failed".equals(TorNetwork.status()) && EXITED.equals(lastMessage)) {
            TorNative.call("tor_start", "{}", (result, error) -> {});
        }
    }

    /** Перед включением: WebView — в никуда, пока Tor не подключится (tor-bridge guardWebView). */
    @PluginMethod
    public void guard(PluginCall call) {
        TorNetwork.setWanted(true);
        call.resolve();
    }

    @PluginMethod
    public void call(PluginCall call) {
        String command = call.getString("command", "");
        JSObject args = call.getObject("args", new JSObject());
        if ("tor_start".equals(command)) {
            TorNetwork.setWanted(true);
        } else if ("tor_stop".equals(command) && !args.optBoolean("restart", false)) {
            TorNetwork.setWanted(false);
        }
        TorNative.call(command, args.toString(), (result, error) -> {
            if (error != null) {
                call.reject(error);
                return;
            }
            try {
                JSObject ret = new JSObject();
                ret.put("value", parse(result));
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(e.toString());
            }
        });
    }

    private static void deliver(String name, String json) {
        Object payload;
        try {
            payload = parse(json);
        } catch (Exception e) {
            return;
        }
        if ("tor:state".equals(name) && payload instanceof JSONObject) {
            JSONObject snap = (JSONObject) payload;
            lastMessage = snap.optString("message", "");
            TorNetwork.onState(snap.optString("status", "off"), snap.optInt("http_tunnel_port", 0));
        }
        TorPlugin plugin = current;
        if (plugin == null) return;
        JSObject event = new JSObject();
        event.put("event", name);
        event.put("payload", payload);
        plugin.notifyListeners("event", event);
    }

    private static Object parse(String json) throws Exception {
        if (json == null) return JSONObject.NULL;
        return new JSONTokener(json).nextValue();
    }

    private static String readAsset(Context ctx, String name) {
        try (InputStream in = ctx.getAssets().open(name)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }
}
