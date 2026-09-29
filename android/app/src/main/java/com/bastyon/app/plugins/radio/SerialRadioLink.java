package com.bastyon.app.plugins.radio;

import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;

import com.hoho.android.usbserial.driver.UsbSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialPort;
import com.hoho.android.usbserial.util.SerialInputOutputManager;

import java.io.IOException;

/**
 * Радио по USB (OTG): CDC-ACM (ESP32-S3, nRF52, RP2040), CP210x, CH34x, FTDI —
 * драйверы usb-serial-for-android. Разрешение на устройство спрашивает
 * плагин до открытия.
 */
final class SerialRadioLink extends RadioLink implements SerialInputOutputManager.Listener {
    private static final int WRITE_TIMEOUT_MS = 2_000;

    final UsbDevice device;
    private final UsbSerialPort port;
    private final SerialInputOutputManager io;

    private SerialRadioLink(int id, String label, Sink sink, UsbDevice device, UsbSerialPort port) {
        super(id, label, sink);
        this.device = device;
        this.port = port;
        this.io = new SerialInputOutputManager(port, this);
    }

    static SerialRadioLink open(
            int id, UsbManager usb, UsbSerialDriver driver, int baud, Sink sink) throws RadioException {
        UsbDevice device = driver.getDevice();
        if (!usb.hasPermission(device)) throw new RadioException("port_permission", device.getDeviceName());
        UsbDeviceConnection connection = usb.openDevice(device);
        if (connection == null) throw new RadioException("open_failed", device.getDeviceName());
        UsbSerialPort port = driver.getPorts().get(0);
        try {
            port.open(connection);
            port.setParameters(baud, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE);
            // DTR: платы с TinyUSB отдают данные только при нём; RTS вместе с ним —
            // так схема автосброса ESP32 не трогает EN (как на десктопе).
            try {
                port.setDTR(true);
                port.setRTS(true);
            } catch (IOException | UnsupportedOperationException ignored) {
                // у некоторых чипов линий управления нет
            }
        } catch (IOException e) {
            try {
                port.close();
            } catch (IOException ignored) {
                // не открылся
            }
            throw new RadioException("open_failed", e.getMessage());
        }
        SerialRadioLink link = new SerialRadioLink(id, device.getDeviceName(), sink, device, port);
        link.io.start();
        return link;
    }

    @Override
    public void onNewData(byte[] data) {
        if (data.length > 0) sink.data(id, data);
    }

    @Override
    public void onRunError(Exception e) {
        lost("device_lost");
    }

    @Override
    void write(byte[] data) throws IOException {
        port.write(data, WRITE_TIMEOUT_MS);
    }

    @Override
    void release() {
        io.setListener(null);
        io.stop();
        try {
            port.close();
        } catch (IOException ignored) {
            // устройство уже отключено
        }
    }
}
