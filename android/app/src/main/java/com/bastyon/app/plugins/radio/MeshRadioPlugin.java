package com.bastyon.app.plugins.radio;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.os.ParcelUuid;
import android.util.Base64;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.hoho.android.usbserial.driver.UsbSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialProber;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Радио для mesh-сетей на Android — то же, что команды `radio_*` десктопа
 * (src-tauri/src/radio): список USB-портов, соединения USB / TCP (только LAN) /
 * Bluetooth LE и события `radio` с байтами. Протоколы Meshtastic и MeshCore —
 * в JS (src/mesh), одинаковые для всех платформ.
 *
 * Пока открыто хоть одно соединение, работает MeshRadioService: без него
 * Android усыпил бы приложение в фоне.
 */
@SuppressLint("MissingPermission")
@CapacitorPlugin(
        name = "MeshRadio",
        permissions = {
                @Permission(
                        strings = {Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT},
                        alias = "bluetooth"),
                @Permission(strings = {Manifest.permission.ACCESS_FINE_LOCATION}, alias = "location"),
                @Permission(strings = {Manifest.permission.POST_NOTIFICATIONS}, alias = "notifications")
        })
public class MeshRadioPlugin extends Plugin {
    private static final String ACTION_USB_PERMISSION = "com.bastyon.app.MESH_USB_PERMISSION";
    private static final int MAX_LINKS = 8;
    private static final int MAX_WRITE = 4096;
    private static final int DEFAULT_BAUD = 115_200;

    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Map<Integer, RadioLink> links = new ConcurrentHashMap<>();
    private final AtomicInteger nextId = new AtomicInteger(1);
    /** Ждут разрешения USB: имя устройства → вызов serialOpen. */
    private final Map<String, PluginCall> usbPending = new ConcurrentHashMap<>();
    private final AtomicInteger messageNotificationId = new AtomicInteger(9000);

    private String noticeTitle = "Bastyon";
    private String noticeText = "";
    private String noticeChannel = "Mesh";

    private final RadioLink.Sink sink = new RadioLink.Sink() {
        @Override
        public void data(int link, byte[] bytes) {
            JSObject ev = event(link, "data");
            ev.put("bytes", Base64.encodeToString(bytes, Base64.NO_WRAP));
            notifyListeners("radio", ev);
        }

        @Override
        public void gattValue(int link, String characteristic, byte[] bytes) {
            JSObject ev = event(link, "notify");
            ev.put("characteristic", characteristic);
            ev.put("bytes", Base64.encodeToString(bytes, Base64.NO_WRAP));
            notifyListeners("radio", ev);
        }

        @Override
        public void closed(int link, String reason) {
            if (links.remove(link) == null) return;
            JSObject ev = event(link, "closed");
            ev.put("reason", reason);
            notifyListeners("radio", ev);
            updateService();
        }
    };

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            String action = intent.getAction();
            if (ACTION_USB_PERMISSION.equals(action)) {
                UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                if (device == null) return;
                PluginCall call = usbPending.remove(device.getDeviceName());
                if (call == null) return;
                if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) openSerial(call);
                else call.reject("port_permission: " + device.getDeviceName(), "port_permission");
            } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(action)) {
                UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                if (device == null) return;
                for (RadioLink link : links.values()) {
                    if (link instanceof SerialRadioLink
                            && ((SerialRadioLink) link).device.getDeviceName().equals(device.getDeviceName())) {
                        link.lost("device_lost");
                    }
                }
            } else if (BluetoothAdapter.ACTION_STATE_CHANGED.equals(action)) {
                int state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.STATE_OFF);
                if (state == BluetoothAdapter.STATE_OFF) {
                    for (RadioLink link : links.values()) {
                        if (link instanceof BleRadioLink) link.lost("ble_off");
                    }
                }
            }
        }
    };

    @Override
    public void load() {
        super.load();
        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_USB_PERMISSION);
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        filter.addAction(BluetoothAdapter.ACTION_STATE_CHANGED);
        ContextCompat.registerReceiver(getContext(), receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @Override
    protected void handleOnDestroy() {
        // Приложение закрыто: без JS радио некому слушать — отпускаем всё.
        try {
            getContext().unregisterReceiver(receiver);
        } catch (IllegalArgumentException ignored) {
            // не был зарегистрирован
        }
        for (RadioLink link : links.values()) link.close();
        links.clear();
        MeshRadioService.stop(getContext());
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    private static JSObject event(int link, String kind) {
        JSObject ev = new JSObject();
        ev.put("link", link);
        ev.put("kind", kind);
        return ev;
    }

    private static void reject(PluginCall call, Exception e) {
        if (e instanceof RadioException) call.reject(e.getMessage(), ((RadioException) e).code);
        else call.reject("radio_error: " + e.getMessage(), "radio_error");
    }

    private int register(RadioLink link) {
        links.put(link.id, link);
        updateService();
        return link.id;
    }

    private int newLinkId() throws RadioException {
        if (links.size() >= MAX_LINKS) throw new RadioException("too_many_links", String.valueOf(MAX_LINKS));
        return nextId.getAndIncrement();
    }

    /** Служба жива, пока есть соединения; текст — последнего радио. */
    private void updateService() {
        Context ctx = getContext();
        if (links.isEmpty()) {
            MeshRadioService.stop(ctx);
            return;
        }
        StringBuilder names = new StringBuilder();
        for (RadioLink link : links.values()) {
            if (names.length() > 0) names.append(", ");
            names.append(link.label);
        }
        String text = noticeText.isEmpty() ? names.toString() : noticeText + " · " + names;
        try {
            MeshRadioService.start(ctx, noticeTitle, text, noticeChannel);
        } catch (RuntimeException ignored) {
            // Android 12+ не даёт поднять службу из фона — соединение работает и без неё.
        }
    }

    // ─── Тексты уведомлений ─────────────────────────────────────────────────

    /** Тексты постоянного уведомления на языке интерфейса. */
    @PluginMethod
    public void setNotice(PluginCall call) {
        noticeTitle = call.getString("title", noticeTitle);
        noticeText = call.getString("text", noticeText);
        noticeChannel = call.getString("channel", noticeChannel);
        if (!links.isEmpty()) updateService();
        call.resolve();
    }

    /** Уведомление о сообщении, пришедшем по радио (приложение в фоне). */
    @PluginMethod
    public void showMessage(PluginCall call) {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            call.resolve();
            return;
        }
        MeshRadioService.ensureChannel(ctx, MeshRadioService.MESSAGES_CHANNEL_ID,
                call.getString("channel", "Mesh"), NotificationManager.IMPORTANCE_HIGH);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, MeshRadioService.MESSAGES_CHANNEL_ID)
                .setSmallIcon(ctx.getApplicationInfo().icon)
                .setContentTitle(call.getString("title", "Bastyon"))
                .setContentText(call.getString("body", ""))
                .setStyle(new NotificationCompat.BigTextStyle().bigText(call.getString("body", "")))
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(MeshRadioService.openApp(ctx));
        NotificationManagerCompat.from(ctx).notify(call.getString("tag", "mesh"),
                messageNotificationId.incrementAndGet(), b.build());
        call.resolve();
    }

    /** Разрешение на уведомления (Android 13+): о сообщениях в фоне. */
    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve();
            return;
        }
        requestPermissionForAlias("notifications", call, "afterNotificationsPermission");
    }

    @PermissionCallback
    private void afterNotificationsPermission(PluginCall call) {
        call.resolve();
    }

    // ─── USB ────────────────────────────────────────────────────────────────

    private UsbManager usb() {
        return (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
    }

    private static String safe(ThrowingSupplier s) {
        try {
            return s.get();
        } catch (RuntimeException e) {
            return null; // имя платы доступно только после разрешения на устройство
        }
    }

    private interface ThrowingSupplier {
        String get();
    }

    @PluginMethod
    public void serialPorts(PluginCall call) {
        UsbManager usb = usb();
        if (usb == null) {
            call.resolve(new JSObject().put("ports", new JSArray()));
            return;
        }
        JSArray ports = new JSArray();
        for (UsbSerialDriver driver : UsbSerialProber.getDefaultProber().findAllDrivers(usb)) {
            UsbDevice d = driver.getDevice();
            JSObject p = new JSObject();
            p.put("path", d.getDeviceName());
            p.put("kind", "usb");
            p.put("vid", d.getVendorId());
            p.put("pid", d.getProductId());
            p.put("manufacturer", safe(d::getManufacturerName));
            p.put("product", safe(d::getProductName));
            p.put("serialNumber", usb.hasPermission(d) ? safe(d::getSerialNumber) : null);
            ports.put(p);
        }
        call.resolve(new JSObject().put("ports", ports));
    }

    @PluginMethod
    public void serialOpen(PluginCall call) {
        String path = call.getString("path");
        UsbManager usb = usb();
        UsbSerialDriver driver = usb == null ? null : findDriver(usb, path);
        if (driver == null) {
            call.reject("port_not_found: " + path, "port_not_found");
            return;
        }
        if (usb.hasPermission(driver.getDevice())) {
            openSerial(call);
            return;
        }
        // Разрешение даёт пользователь в системном окне; ответ — в receiver.
        call.setKeepAlive(true);
        usbPending.put(path, call);
        Intent intent = new Intent(ACTION_USB_PERMISSION).setPackage(getContext().getPackageName());
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        usb.requestPermission(driver.getDevice(), PendingIntent.getBroadcast(getContext(), 0, intent, flags));
    }

    private static UsbSerialDriver findDriver(UsbManager usb, String path) {
        if (path == null) return null;
        for (UsbSerialDriver d : UsbSerialProber.getDefaultProber().findAllDrivers(usb)) {
            if (path.equals(d.getDevice().getDeviceName())) return d;
        }
        return null;
    }

    private void openSerial(PluginCall call) {
        executor.execute(() -> {
            try {
                String path = call.getString("path");
                int baud = call.getInt("baud", DEFAULT_BAUD);
                if (baud < 1_200 || baud > 3_000_000) baud = DEFAULT_BAUD;
                UsbManager usb = usb();
                UsbSerialDriver driver = findDriver(usb, path);
                if (driver == null) throw new RadioException("port_not_found", path);
                int id = register(SerialRadioLink.open(newLinkId(), usb, driver, baud, sink));
                call.setKeepAlive(false);
                call.resolve(new JSObject().put("link", id));
            } catch (Exception e) {
                call.setKeepAlive(false);
                reject(call, e);
            }
        });
    }

    // ─── TCP ────────────────────────────────────────────────────────────────

    @PluginMethod
    public void tcpOpen(PluginCall call) {
        String host = call.getString("host", "");
        int port = call.getInt("port", 0);
        executor.execute(() -> {
            try {
                int id = register(TcpRadioLink.open(newLinkId(), host, port, sink));
                call.resolve(new JSObject().put("link", id));
            } catch (Exception e) {
                reject(call, e);
            }
        });
    }

    // ─── Общее ──────────────────────────────────────────────────────────────

    private RadioLink link(PluginCall call) throws RadioException {
        Integer id = call.getInt("link");
        RadioLink link = id == null ? null : links.get(id);
        if (link == null) throw new RadioException("link_not_found", String.valueOf(id));
        return link;
    }

    private static byte[] bytes(PluginCall call) throws RadioException {
        String data = call.getString("data", "");
        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            throw new RadioException("write_failed", "bad base64");
        }
        if (bytes.length > MAX_WRITE) throw new RadioException("write_failed", "too large");
        return bytes;
    }

    @PluginMethod
    public void write(PluginCall call) {
        executor.execute(() -> {
            try {
                link(call).write(bytes(call));
                call.resolve();
            } catch (Exception e) {
                reject(call, e);
            }
        });
    }

    @PluginMethod
    public void close(PluginCall call) {
        Integer id = call.getInt("link");
        RadioLink link = id == null ? null : links.remove(id);
        if (link != null) {
            executor.execute(link::close);
            updateService();
        }
        call.resolve();
    }

    // ─── Bluetooth LE ───────────────────────────────────────────────────────

    /** Какие разрешения нужны для Bluetooth на этой версии Android. */
    private String bluetoothAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "bluetooth" : "location";
    }

    private boolean withBluetoothPermission(PluginCall call, String callback) {
        String alias = bluetoothAlias();
        if (getPermissionState(alias) == PermissionState.GRANTED) return true;
        requestPermissionForAlias(alias, call, callback);
        return false;
    }

    private BluetoothAdapter adapter() throws RadioException {
        BluetoothManager bm = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = bm == null ? null : bm.getAdapter();
        if (adapter == null) throw new RadioException("ble_unavailable", "no adapter");
        if (!adapter.isEnabled()) throw new RadioException("ble_off", "");
        return adapter;
    }

    @PluginMethod
    public void bleScan(PluginCall call) {
        if (withBluetoothPermission(call, "afterScanPermission")) scan(call);
    }

    @PermissionCallback
    private void afterScanPermission(PluginCall call) {
        if (getPermissionState(bluetoothAlias()) == PermissionState.GRANTED) scan(call);
        else call.reject("ble_unavailable: permission denied", "ble_unavailable");
    }

    private void scan(PluginCall call) {
        int timeoutMs = Math.max(1_000, Math.min(call.getInt("timeoutMs", 4_000), 30_000));
        List<ScanFilter> filters = new ArrayList<>();
        try {
            JSONArray services = call.getArray("services", new JSArray());
            for (int i = 0; i < services.length(); i++) {
                filters.add(new ScanFilter.Builder()
                        .setServiceUuid(ParcelUuid.fromString(services.getString(i)))
                        .build());
            }
        } catch (JSONException | IllegalArgumentException e) {
            call.reject("scan_failed: bad service uuid", "scan_failed");
            return;
        }
        BluetoothLeScanner scanner;
        try {
            scanner = adapter().getBluetoothLeScanner();
            if (scanner == null) throw new RadioException("ble_off", "");
        } catch (RadioException e) {
            reject(call, e);
            return;
        }
        boolean all = filters.isEmpty();
        Map<String, JSObject> found = new LinkedHashMap<>();
        AtomicBoolean done = new AtomicBoolean(false);
        ScanCallback cb = new ScanCallback() {
            @Override
            public void onScanResult(int type, ScanResult r) {
                BluetoothDevice d = r.getDevice();
                String name = r.getScanRecord() != null ? r.getScanRecord().getDeviceName() : null;
                if (name == null) name = d.getName();
                // «Все устройства» — только с именем: безымянный шум не нужен.
                if (all && name == null) return;
                JSObject o = new JSObject();
                o.put("id", d.getAddress());
                o.put("name", name);
                o.put("rssi", r.getRssi());
                JSArray uuids = new JSArray();
                if (r.getScanRecord() != null && r.getScanRecord().getServiceUuids() != null) {
                    for (ParcelUuid u : r.getScanRecord().getServiceUuids()) {
                        uuids.put(u.getUuid().toString().toLowerCase(Locale.ROOT));
                    }
                }
                o.put("services", uuids);
                synchronized (found) {
                    found.put(d.getAddress(), o);
                }
            }

            @Override
            public void onScanFailed(int errorCode) {
                if (done.compareAndSet(false, true)) call.reject("scan_failed: " + errorCode, "scan_failed");
            }
        };
        ScanSettings settings = new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build();
        scanner.startScan(all ? null : filters, settings, cb);
        executor.execute(() -> {
            try {
                Thread.sleep(timeoutMs);
            } catch (InterruptedException ignored) {
                // закрываемся
            }
            try {
                scanner.stopScan(cb);
            } catch (RuntimeException ignored) {
                // адаптер выключили во время поиска
            }
            if (!done.compareAndSet(false, true)) return;
            JSArray devices = new JSArray();
            synchronized (found) {
                for (JSObject o : found.values()) devices.put(o);
            }
            call.resolve(new JSObject().put("devices", devices));
        });
    }

    @PluginMethod
    public void bleConnect(PluginCall call) {
        if (withBluetoothPermission(call, "afterConnectPermission")) connect(call);
    }

    @PermissionCallback
    private void afterConnectPermission(PluginCall call) {
        if (getPermissionState(bluetoothAlias()) == PermissionState.GRANTED) connect(call);
        else call.reject("ble_unavailable: permission denied", "ble_unavailable");
    }

    private void connect(PluginCall call) {
        String address = call.getString("id", "");
        executor.execute(() -> {
            try {
                if (!BluetoothAdapter.checkBluetoothAddress(address)) {
                    throw new RadioException("ble_device_not_found", address);
                }
                BluetoothDevice device = adapter().getRemoteDevice(address);
                int id = register(BleRadioLink.open(newLinkId(), getContext(), device, sink));
                call.resolve(new JSObject().put("link", id));
            } catch (Exception e) {
                reject(call, e);
            }
        });
    }

    private BleRadioLink bleLink(PluginCall call) throws RadioException {
        RadioLink link = link(call);
        if (!(link instanceof BleRadioLink)) throw new RadioException("link_not_found", "not bluetooth");
        return (BleRadioLink) link;
    }

    private static UUID uuid(PluginCall call) throws RadioException {
        String s = call.getString("characteristic", "");
        try {
            // Короткий 16-битный UUID — в базе Bluetooth SIG, как на десктопе.
            if (s.matches("(?i)^(0x)?[0-9a-f]{4}$")) {
                String hex = s.replaceFirst("(?i)^0x", "");
                return UUID.fromString("0000" + hex + "-0000-1000-8000-00805f9b34fb");
            }
            return UUID.fromString(s);
        } catch (IllegalArgumentException e) {
            throw new RadioException("characteristic_not_found", s);
        }
    }

    @PluginMethod
    public void bleSubscribe(PluginCall call) {
        executor.execute(() -> {
            try {
                bleLink(call).subscribe(uuid(call));
                call.resolve();
            } catch (Exception e) {
                reject(call, e);
            }
        });
    }

    @PluginMethod
    public void bleWrite(PluginCall call) {
        executor.execute(() -> {
            try {
                bleLink(call).writeCharacteristic(uuid(call), bytes(call), call.getBoolean("withResponse", true));
                call.resolve();
            } catch (Exception e) {
                reject(call, e);
            }
        });
    }

    @PluginMethod
    public void bleRead(PluginCall call) {
        executor.execute(() -> {
            try {
                byte[] value = bleLink(call).readCharacteristic(uuid(call));
                call.resolve(new JSObject().put("data", Base64.encodeToString(value, Base64.NO_WRAP)));
            } catch (Exception e) {
                reject(call, e);
            }
        });
    }
}
