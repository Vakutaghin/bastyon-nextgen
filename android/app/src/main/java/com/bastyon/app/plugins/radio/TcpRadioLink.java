package com.bastyon.app.plugins.radio;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.UnknownHostException;
import java.util.Arrays;

/** Радио по Wi-Fi: TCP в локальной сети (Meshtastic — 4403, MeshCore — 5000). */
final class TcpRadioLink extends RadioLink {
    private static final int CONNECT_TIMEOUT_MS = 6_000;

    private final Socket socket;
    private final OutputStream out;

    private TcpRadioLink(int id, String label, Sink sink, Socket socket) throws IOException {
        super(id, label, sink);
        this.socket = socket;
        this.out = socket.getOutputStream();
        InputStream in = socket.getInputStream();
        Thread reader = new Thread(() -> readLoop(in), "mesh-tcp-" + id);
        reader.setDaemon(true);
        reader.start();
    }

    /** Блокирует до соединения — вызывать не из главного потока. */
    static TcpRadioLink open(int id, String host, int port, Sink sink) throws RadioException {
        if (port <= 0 || port > 65535) throw new RadioException("bad_address", "port " + port);
        InetAddress[] addresses;
        try {
            addresses = InetAddress.getAllByName(host.trim());
        } catch (UnknownHostException e) {
            throw new RadioException("resolve_failed", host);
        }
        // Имя, которое хоть в одном адресе уходит наружу, — не радио в LAN.
        for (InetAddress a : addresses) {
            if (!LanAddress.isLan(a)) throw new RadioException("address_not_allowed", host);
        }
        Socket socket = new Socket();
        try {
            socket.setTcpNoDelay(true);
            socket.connect(new InetSocketAddress(addresses[0], port), CONNECT_TIMEOUT_MS);
            return new TcpRadioLink(id, host + ":" + port, sink, socket);
        } catch (IOException e) {
            try {
                socket.close();
            } catch (IOException ignored) {
                // уже закрыт
            }
            throw new RadioException("connect_failed", e.getMessage());
        }
    }

    private void readLoop(InputStream in) {
        byte[] buf = new byte[4096];
        try {
            while (!isClosed()) {
                int n = in.read(buf);
                if (n < 0) break;
                if (n > 0) sink.data(id, Arrays.copyOf(buf, n));
            }
        } catch (IOException ignored) {
            // сокет закрыт или сеть пропала — ниже сообщим
        }
        lost("device_lost");
    }

    @Override
    void write(byte[] data) throws IOException {
        synchronized (out) {
            out.write(data);
            out.flush();
        }
    }

    @Override
    void release() {
        try {
            socket.close();
        } catch (IOException ignored) {
            // уже закрыт
        }
    }
}
