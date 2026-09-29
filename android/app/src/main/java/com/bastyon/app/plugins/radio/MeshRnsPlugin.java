package com.bastyon.app.plugins.radio;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.hardware.usb.UsbManager;
import android.net.wifi.WifiManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.hoho.android.usbserial.driver.UsbSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialProber;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Узел Reticulum на Android — то же, что команды `rns_*` десктопа
 * (src-tauri/src/rns): узел работает в процессе приложения (RnsNative), его
 * события приходят в JS потоком `rns`. Пока узел работает, держится общее с
 * радио постоянное уведомление, а для локальной сети — multicast Wi-Fi.
 *
 * RNode по USB: порт открывает приложение, узлу отдаётся socketpair
 * (RnodeUsbBridge).
 */
@CapacitorPlugin(name = "MeshRns")
public class MeshRnsPlugin extends Plugin {
    private static final String ACTION_USB_PERMISSION = "com.bastyon.app.RNS_USB_PERMISSION";

    /** Узел и его вызовы по одному: старт и остановка ждут друг друга. */
    private final ExecutorService serial = Executors.newSingleThreadExecutor();
    /** Страницы NomadNet ждут ответа десятки секунд — не в очереди узла. */
    private final ExecutorService pages = Executors.newCachedThreadPool();
    private final List<RnodeUsbBridge> bridges = new ArrayList<>();
    private WifiManager.MulticastLock multicast;

    private final RnsNative.Events events = json -> {
        try {
            notifyListeners("rns", new JSObject(json));
        } catch (JSONException ignored) {
            // узел шлёт только JSON-объекты
        }
    };

    @Override
    protected void handleOnDestroy() {
        // Приложение закрыто: без JS узел некому слушать.
        serial.execute(this::stopNode);
        serial.shutdown();
        pages.shutdownNow();
        super.handleOnDestroy();
    }

    private static void reject(PluginCall call, RuntimeException e) {
        String message = e.getMessage() != null ? e.getMessage() : "rns_error";
        int colon = message.indexOf(':');
        call.reject(message, (colon == -1 ? message : message.substring(0, colon)).trim());
    }

    private static void resolveJson(PluginCall call, String json) throws JSONException {
        call.resolve(new JSObject(json));
    }

    private interface NodeCall {
        void run() throws JSONException;
    }

    private void onNode(PluginCall call, NodeCall run) {
        serial.execute(() -> {
            if (!RnsNative.LOADED) {
                call.reject("unsupported", "unsupported");
                return;
            }
            try {
                run.run();
            } catch (RuntimeException e) {
                reject(call, e);
            } catch (JSONException e) {
                call.reject("rns_error: " + e.getMessage(), "rns_error");
            }
        });
    }

    @PluginMethod
    public void available(PluginCall call) {
        call.resolve(new JSObject().put("available", RnsNative.LOADED));
    }

    /** Тексты постоянного уведомления, когда держит только узел. */
    @PluginMethod
    public void setNotice(PluginCall call) {
        MeshKeepAlive.setTexts(getContext(), MeshKeepAlive.RNS, call.getString("title", "Bastyon"),
                call.getString("text", ""), call.getString("channel", "Mesh"));
        call.resolve();
    }

    @PluginMethod
    public void start(PluginCall call) {
        JSObject options = call.getObject("options");
        if (options == null) {
            call.reject("rns_error: options", "rns_error");
            return;
        }
        onNode(call, () -> {
            stopNode();
            try {
                boolean lan = openInterfaces(options);
                if (lan) holdMulticast();
                File base = new File(getContext().getFilesDir(), "reticulum");
                String started = RnsNative.start(options.toString(), base.getAbsolutePath(), events);
                MeshKeepAlive.hold(getContext(), MeshKeepAlive.RNS, "Reticulum");
                resolveJson(call, started);
            } catch (RadioException e) {
                closeInterfaces();
                call.reject(e.getMessage(), e.code);
            } catch (RuntimeException | JSONException e) {
                closeInterfaces();
                throw e;
            }
        });
    }

    /**
     * RNode по USB — открыть и подставить узлу дескриптор моста. true — есть
     * локальная сеть (нужен multicast).
     */
    private boolean openInterfaces(JSObject options) throws JSONException, RadioException {
        JSONArray list = options.optJSONArray("interfaces");
        boolean lan = false;
        if (list == null) return false;
        UsbManager usb = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        for (int i = 0; i < list.length(); i++) {
            JSONObject iface = list.getJSONObject(i);
            String kind = iface.optString("kind");
            if ("auto".equals(kind)) lan = true;
            if (!"rnode".equals(kind)) continue;
            String path = iface.optString("port");
            UsbSerialDriver driver = null;
            if (usb != null) {
                for (UsbSerialDriver d : UsbSerialProber.getDefaultProber().findAllDrivers(usb)) {
                    if (d.getDevice().getDeviceName().equals(path)) driver = d;
                }
            }
            if (driver == null) throw new RadioException("port_not_found", path);
            if (!usb.hasPermission(driver.getDevice())) {
                // Разрешение даёт пользователь в системном окне; после него
                // узел запускают ещё раз.
                Intent intent = new Intent(ACTION_USB_PERMISSION).setPackage(getContext().getPackageName());
                int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
                usb.requestPermission(driver.getDevice(), PendingIntent.getBroadcast(getContext(), 0, intent, flags));
                throw new RadioException("port_permission", path);
            }
            try {
                RnodeUsbBridge bridge = RnodeUsbBridge.open(usb, driver);
                bridges.add(bridge);
                iface.put("fd", bridge.nodeFd());
            } catch (java.io.IOException e) {
                throw new RadioException("open_failed", e.getMessage());
            }
        }
        return lan;
    }

    private void closeInterfaces() {
        for (RnodeUsbBridge b : bridges) b.close();
        bridges.clear();
        if (multicast != null && multicast.isHeld()) multicast.release();
        multicast = null;
    }

    /** AutoInterface ищет соседей multicast-ом: без блокировки Wi-Fi его глушит. */
    private void holdMulticast() {
        WifiManager wifi = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wifi == null) return;
        multicast = wifi.createMulticastLock("bastyon-rns");
        multicast.setReferenceCounted(false);
        multicast.acquire();
    }

    private void stopNode() {
        if (RnsNative.LOADED) RnsNative.stop();
        closeInterfaces();
        MeshKeepAlive.release(getContext(), MeshKeepAlive.RNS);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        onNode(call, () -> {
            stopNode();
            call.resolve();
        });
    }

    @PluginMethod
    public void status(PluginCall call) {
        onNode(call, () -> resolveJson(call, RnsNative.status()));
    }

    @PluginMethod
    public void announce(PluginCall call) {
        onNode(call, () -> {
            RnsNative.announce();
            call.resolve();
        });
    }

    @PluginMethod
    public void send(PluginCall call) {
        String to = call.getString("to", "");
        String title = call.getString("title", "");
        String content = call.getString("content", "");
        String method = call.getString("method", "auto");
        onNode(call, () -> call.resolve(new JSObject().put("id", RnsNative.send(to, title, content, method))));
    }

    @PluginMethod
    public void requestPath(PluginCall call) {
        String to = call.getString("to", "");
        onNode(call, () -> {
            RnsNative.requestPath(to);
            call.resolve();
        });
    }

    @PluginMethod
    public void setPropagationNode(PluginCall call) {
        String hash = call.getString("hash");
        onNode(call, () -> {
            RnsNative.setPropagationNode(hash == null ? "" : hash);
            call.resolve();
        });
    }

    @PluginMethod
    public void sync(PluginCall call) {
        onNode(call, () -> {
            RnsNative.sync();
            call.resolve();
        });
    }

    @PluginMethod
    public void page(PluginCall call) {
        String node = call.getString("node", "");
        String path = call.getString("path", "");
        JSObject data = call.getObject("data", new JSObject());
        pages.execute(() -> {
            if (!RnsNative.LOADED) {
                call.reject("unsupported", "unsupported");
                return;
            }
            try {
                resolveJson(call, RnsNative.page(node, path, data.toString()));
            } catch (RuntimeException e) {
                reject(call, e);
            } catch (JSONException e) {
                call.reject("rns_error: " + e.getMessage(), "rns_error");
            }
        });
    }
}
