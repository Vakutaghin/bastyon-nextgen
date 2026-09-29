package com.bastyon.app.plugins.radio;

import java.io.IOException;

/**
 * Соединение с LoRa-радио: поток байтов (USB-serial, TCP) или GATT (Bluetooth).
 * Протоколы (Meshtastic, MeshCore) живут в JS — здесь только транспорт, как в
 * src-tauri/src/radio на десктопе.
 */
abstract class RadioLink {

    /** Куда соединение отдаёт события: байты, уведомления GATT, закрытие. */
    interface Sink {
        void data(int link, byte[] bytes);

        void gattValue(int link, String characteristic, byte[] bytes);

        void closed(int link, String reason);
    }

    final int id;
    final String label;
    final Sink sink;
    private volatile boolean closed = false;

    RadioLink(int id, String label, Sink sink) {
        this.id = id;
        this.label = label;
        this.sink = sink;
    }

    boolean isClosed() {
        return closed;
    }

    /** Байты радио (поток). У GATT — запись в характеристику, см. BleRadioLink. */
    abstract void write(byte[] data) throws IOException, RadioException;

    /** Закрыть по просьбе приложения: без события closed. */
    void close() {
        closed = true;
        release();
    }

    /** Соединение пропало само (кабель, питание, зона Bluetooth). */
    void lost(String reason) {
        if (closed) return;
        closed = true;
        release();
        sink.closed(id, reason);
    }

    /** Отпустить порт, сокет или GATT. */
    abstract void release();
}
