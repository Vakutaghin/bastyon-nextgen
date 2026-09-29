package com.bastyon.app.plugins.radio;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothProfile;
import android.content.Context;
import android.os.Build;

import java.util.ArrayDeque;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Радио по Bluetooth LE. Протоколам нужны примитивы GATT — запись, чтение и
 * уведомления характеристик (MeshCore: кадр на запись в Nordic UART;
 * Meshtastic: toRadio, чтение fromRadio по уведомлению fromNum).
 *
 * Android выполняет одну операцию GATT за раз и молча теряет вторую, поэтому
 * все операции стоят в очереди. Методы блокируют — вызывать не из главного
 * потока. Разрешения Bluetooth проверяет плагин.
 */
@SuppressLint("MissingPermission")
final class BleRadioLink extends RadioLink {
    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private static final long CONNECT_TIMEOUT_S = 15;
    /** Meshtastic на ESP32 держит чтение fromRadio до ~20 с, пока не появятся данные. */
    private static final long OP_TIMEOUT_S = 30;
    private static final int WANTED_MTU = 512;
    /** Коды GATT «нужно сопряжение»: после него операцию повторяем один раз. */
    private static final int GATT_INSUFFICIENT_AUTHENTICATION = 5;
    private static final int GATT_INSUFFICIENT_ENCRYPTION = 15;
    private static final int GATT_AUTH_FAIL = 137;

    private final BluetoothGatt gatt;
    private final CompletableFuture<Void> ready = new CompletableFuture<>();
    private final ArrayDeque<Op> queue = new ArrayDeque<>();
    private Op current = null;

    /** Одна операция GATT: запуск и её итог. */
    private abstract static class Op {
        final CompletableFuture<byte[]> result = new CompletableFuture<>();
        boolean retried = false;

        /** Запустить; false — Android сразу отказал. */
        abstract boolean start();
    }

    private final BluetoothGattCallback callback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                if (!g.requestMtu(WANTED_MTU)) g.discoverServices();
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                if (!ready.isDone()) {
                    ready.completeExceptionally(new RadioException("ble_connect_failed", "status " + status));
                }
                failAll("ble_io_failed");
                lost("device_lost");
            }
        }

        @Override
        public void onMtuChanged(BluetoothGatt g, int mtu, int status) {
            g.discoverServices();
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt g, int status) {
            if (status == BluetoothGatt.GATT_SUCCESS) ready.complete(null);
            else ready.completeExceptionally(new RadioException("ble_connect_failed", "discovery " + status));
        }

        @Override
        public void onCharacteristicRead(BluetoothGatt g, BluetoothGattCharacteristic ch, byte[] value, int status) {
            finish(status, value);
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onCharacteristicRead(BluetoothGatt g, BluetoothGattCharacteristic ch, int status) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) finish(status, ch.getValue());
        }

        @Override
        public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic ch, int status) {
            finish(status, new byte[0]);
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor d, int status) {
            finish(status, new byte[0]);
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic ch, byte[] value) {
            sink.gattValue(id, ch.getUuid().toString().toLowerCase(Locale.ROOT), value);
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic ch) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
                byte[] value = ch.getValue();
                sink.gattValue(id, ch.getUuid().toString().toLowerCase(Locale.ROOT), value == null ? new byte[0] : value);
            }
        }
    };

    private BleRadioLink(int id, String label, Sink sink, Context ctx, BluetoothDevice device) {
        super(id, label, sink);
        this.gatt = device.connectGatt(ctx, false, callback, BluetoothDevice.TRANSPORT_LE);
    }

    /** Подключиться и найти сервисы. Блокирует до 15 с. */
    static BleRadioLink open(int id, Context ctx, BluetoothDevice device, Sink sink) throws RadioException {
        String name = device.getName();
        BleRadioLink link = new BleRadioLink(id, name != null ? name : device.getAddress(), sink, ctx, device);
        if (link.gatt == null) throw new RadioException("ble_connect_failed", device.getAddress());
        try {
            link.ready.get(CONNECT_TIMEOUT_S, TimeUnit.SECONDS);
            return link;
        } catch (TimeoutException e) {
            link.close();
            throw new RadioException("ble_connect_failed", "timeout");
        } catch (ExecutionException e) {
            link.close();
            Throwable cause = e.getCause();
            if (cause instanceof RadioException) throw (RadioException) cause;
            throw new RadioException("ble_connect_failed", String.valueOf(cause));
        } catch (InterruptedException e) {
            link.close();
            Thread.currentThread().interrupt();
            throw new RadioException("ble_connect_failed", "interrupted");
        }
    }

    // ─── Очередь операций ───────────────────────────────────────────────────

    private byte[] run(Op op) throws RadioException {
        if (isClosed()) throw new RadioException("link_not_found", "closed");
        synchronized (queue) {
            queue.add(op);
            if (current == null) next();
        }
        try {
            return op.result.get(OP_TIMEOUT_S, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            synchronized (queue) {
                if (current == op) {
                    current = null;
                    next();
                } else {
                    queue.remove(op);
                }
            }
            throw new RadioException("ble_io_failed", "timeout");
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof RadioException) throw (RadioException) cause;
            throw new RadioException("ble_io_failed", String.valueOf(cause));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RadioException("ble_io_failed", "interrupted");
        }
    }

    /** Следующая операция. Вызывать под замком queue. */
    private void next() {
        while ((current = queue.poll()) != null) {
            boolean started;
            try {
                started = current.start();
            } catch (RuntimeException e) {
                started = false;
            }
            if (started) return;
            current.result.completeExceptionally(new RadioException("ble_io_failed", "rejected"));
        }
    }

    private void finish(int status, byte[] value) {
        Op op;
        synchronized (queue) {
            op = current;
            if (op == null) return;
            if (isAuthError(status) && !op.retried) {
                // Радио с PIN: Android сейчас покажет сопряжение; повторим после него.
                op.retried = true;
                retryAfterBond(op);
                return;
            }
            current = null;
            next();
        }
        if (status == BluetoothGatt.GATT_SUCCESS) op.result.complete(value == null ? new byte[0] : value);
        else op.result.completeExceptionally(new RadioException("ble_io_failed", "gatt status " + status));
    }

    private static boolean isAuthError(int status) {
        return status == GATT_INSUFFICIENT_AUTHENTICATION
                || status == GATT_INSUFFICIENT_ENCRYPTION
                || status == GATT_AUTH_FAIL;
    }

    private void retryAfterBond(Op op) {
        BluetoothDevice device = gatt.getDevice();
        if (device.getBondState() == BluetoothDevice.BOND_NONE) device.createBond();
        new Thread(() -> {
            // Ждём сопряжения до 25 с: пользователь вводит PIN в системном окне.
            for (int i = 0; i < 50 && device.getBondState() != BluetoothDevice.BOND_BONDED; i++) {
                try {
                    Thread.sleep(500);
                } catch (InterruptedException e) {
                    return;
                }
            }
            synchronized (queue) {
                if (current != op) return;
                if (!op.start()) {
                    current = null;
                    op.result.completeExceptionally(new RadioException("ble_io_failed", "not paired"));
                    next();
                }
            }
        }, "mesh-ble-bond").start();
    }

    private void failAll(String code) {
        synchronized (queue) {
            if (current != null) current.result.completeExceptionally(new RadioException(code, "disconnected"));
            current = null;
            for (Op op : queue) op.result.completeExceptionally(new RadioException(code, "disconnected"));
            queue.clear();
        }
    }

    private BluetoothGattCharacteristic find(UUID uuid) throws RadioException {
        for (BluetoothGattService s : gatt.getServices()) {
            BluetoothGattCharacteristic ch = s.getCharacteristic(uuid);
            if (ch != null) return ch;
        }
        throw new RadioException("characteristic_not_found", uuid.toString());
    }

    // ─── Операции ───────────────────────────────────────────────────────────

    @SuppressWarnings("deprecation")
    void writeCharacteristic(UUID uuid, byte[] data, boolean withResponse) throws RadioException {
        BluetoothGattCharacteristic ch = find(uuid);
        int type = withResponse
                ? BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                : BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE;
        run(new Op() {
            @Override
            boolean start() {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    return gatt.writeCharacteristic(ch, data, type) == BluetoothGatt.GATT_SUCCESS;
                }
                ch.setWriteType(type);
                ch.setValue(data);
                return gatt.writeCharacteristic(ch);
            }
        });
    }

    byte[] readCharacteristic(UUID uuid) throws RadioException {
        BluetoothGattCharacteristic ch = find(uuid);
        return run(new Op() {
            @Override
            boolean start() {
                return gatt.readCharacteristic(ch);
            }
        });
    }

    /** Включить уведомления (или индикации, если характеристика умеет только их). */
    @SuppressWarnings("deprecation")
    void subscribe(UUID uuid) throws RadioException {
        BluetoothGattCharacteristic ch = find(uuid);
        if (!gatt.setCharacteristicNotification(ch, true)) {
            throw new RadioException("ble_io_failed", "notifications " + uuid);
        }
        BluetoothGattDescriptor cccd = ch.getDescriptor(CCCD);
        if (cccd == null) return; // уведомления без дескриптора — уже включены
        byte[] value = (ch.getProperties() & BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0
                ? BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                : BluetoothGattDescriptor.ENABLE_INDICATION_VALUE;
        run(new Op() {
            @Override
            boolean start() {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    return gatt.writeDescriptor(cccd, value) == BluetoothGatt.GATT_SUCCESS;
                }
                cccd.setValue(value);
                return gatt.writeDescriptor(cccd);
            }
        });
    }

    @Override
    void write(byte[] data) throws RadioException {
        throw new RadioException("ble_io_failed", "write needs a characteristic");
    }

    @Override
    void release() {
        failAll("link_not_found");
        try {
            gatt.disconnect();
            gatt.close();
        } catch (RuntimeException ignored) {
            // адаптер выключили
        }
    }
}
