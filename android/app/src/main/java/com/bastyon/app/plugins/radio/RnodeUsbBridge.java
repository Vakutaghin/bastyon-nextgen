package com.bastyon.app.plugins.radio;

import android.hardware.usb.UsbManager;
import android.os.ParcelFileDescriptor;

import com.hoho.android.usbserial.driver.UsbSerialDriver;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * RNode по USB для узла Reticulum. Сам узел (Rust) открыть USB на Android не
 * может: порт открывает приложение (usb-serial-for-android), а узлу отдаётся
 * конец socketpair — байты между портом и парой перекачивает мост.
 */
final class RnodeUsbBridge {
    private static final int BAUD = 115_200;

    private final SerialRadioLink link;
    private final ParcelFileDescriptor ours;
    private final ParcelFileDescriptor theirs;
    private final FileOutputStream toNode;
    private volatile boolean closed;

    private RnodeUsbBridge(UsbManager usb, UsbSerialDriver driver) throws IOException, RadioException {
        ParcelFileDescriptor[] pair = ParcelFileDescriptor.createSocketPair();
        ours = pair[0];
        theirs = pair[1];
        toNode = new FileOutputStream(ours.getFileDescriptor());
        link = SerialRadioLink.open(0, usb, driver, BAUD, new RadioLink.Sink() {
            @Override
            public void data(int id, byte[] bytes) {
                try {
                    toNode.write(bytes);
                } catch (IOException e) {
                    close();
                }
            }

            @Override
            public void gattValue(int id, String characteristic, byte[] bytes) {}

            @Override
            public void closed(int id, String reason) {
                close();
            }
        });
        Thread pump = new Thread(this::pumpToRadio, "rnode-usb-bridge");
        pump.setDaemon(true);
        pump.start();
    }

    static RnodeUsbBridge open(UsbManager usb, UsbSerialDriver driver) throws IOException, RadioException {
        return new RnodeUsbBridge(usb, driver);
    }

    /** Дескриптор для узла (`fd` в настройках RNode); узел дублирует его себе. */
    int nodeFd() {
        return theirs.getFd();
    }

    private void pumpToRadio() {
        byte[] buf = new byte[4096];
        try (FileInputStream fromNode = new FileInputStream(ours.getFileDescriptor())) {
            int n;
            while (!closed && (n = fromNode.read(buf)) > 0) {
                byte[] chunk = new byte[n];
                System.arraycopy(buf, 0, chunk, 0, n);
                link.write(chunk);
            }
        } catch (IOException e) {
            // пара закрыта — узел остановлен
        } finally {
            close();
        }
    }

    void close() {
        if (closed) return;
        closed = true;
        link.close();
        try {
            ours.close();
        } catch (IOException ignored) {
            // уже закрыт
        }
        try {
            theirs.close();
        } catch (IOException ignored) {
            // уже закрыт
        }
    }
}
