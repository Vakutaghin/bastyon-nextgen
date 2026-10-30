package com.bastyon.app.plugins;

import android.util.Base64;

import com.bastyon.app.plugins.tor.TorNetwork;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

/**
 * Прямое подключение к нодам Pocketnet (src/helpers/api/direct-nodes): когда
 * прокси недоступны (в РФ их адреса закрыты), приложение спрашивает ноды
 * само, по их TLS-портам — API 38881 и уведомления WSS 8887.
 *
 * Сертификат ноды самоподписанный, и WebView его не примет, поэтому запросы
 * идут здесь. Цепочку проверять не у кого: сверяется отпечаток SHA-256 с
 * запомненным при первой встрече (pin). Подпись рукопожатия проверяет сам TLS
 * — владеть ключом сертификата сервер обязан.
 *
 *   request({ id, url, body, pin, timeoutMs }) → { status, body, fingerprint }
 *       POST https://IP:порт/public/ или /post/. Чужой сертификат — ошибка
 *       с кодом pin_mismatch, до отправки запроса.
 *   cancel({ id })
 *   wsConnect({ id, url, pin }) → { fingerprint }; дальше события
 *       wsMessage { id, data } и wsClose { id, code, reason }.
 *   wsSend({ id, data }), wsClose({ id })
 *
 * При включённом Tor — отказ с кодом tor_enabled.
 */
@CapacitorPlugin(name = "NodeLink")
public class NodeLinkPlugin extends Plugin {

    private static final String PIN_MISMATCH = "pin_mismatch";
    private static final int CONNECT_TIMEOUT_MS = 10_000;
    private static final int MAX_FRAME = 16 * 1024 * 1024;
    /** Тишина дольше — шлём ping; ещё столько же без ответа — сокет мёртв. */
    private static final int IDLE_MS = 75_000;

    /**
     * Сертификат на IP-адрес не выписан — имя не сверяем, сверяем отпечаток.
     * Один экземпляр: пул соединений различает их по фабрике и проверке имени.
     */
    private static final HostnameVerifier ANY_HOSTNAME = (hostname, session) -> true;

    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Map<String, HttpsURLConnection> requests = new ConcurrentHashMap<>();
    private final Map<String, NodeSocket> sockets = new ConcurrentHashMap<>();
    /** Фабрика на ноду и отпечаток: соединения к той же ноде переиспользуются. */
    private final Map<String, SSLSocketFactory> factories = new ConcurrentHashMap<>();

    /** Включили Tor: открытые напрямую соединения закрываются, как у компьютера. */
    private final Runnable closeOnTor = () -> executor.execute(this::closeAll);

    @Override
    public void load() {
        super.load();
        TorNetwork.addOnEnabled(closeOnTor);
    }

    @Override
    protected void handleOnDestroy() {
        TorNetwork.removeOnEnabled(closeOnTor);
        closeAll();
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    private void closeAll() {
        for (HttpsURLConnection conn : requests.values()) conn.disconnect();
        for (NodeSocket socket : sockets.values()) socket.shutdown();
    }

    // --- Сертификат -----------------------------------------------------------

    static String fingerprint(X509Certificate cert) throws CertificateException {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(cert.getEncoded());
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) hex.append(String.format(Locale.ROOT, "%02x", b));
            return hex.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new CertificateException(e);
        }
    }

    /** Отпечаток с запомненным; null — первая встреча, годится любой. */
    private static final class PinTrustManager implements X509TrustManager {
        private final String pin;

        PinTrustManager(String pin) {
            this.pin = pin == null ? null : pin.toLowerCase(Locale.ROOT);
        }

        @Override
        public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
            if (chain == null || chain.length == 0) throw new CertificateException("no certificate");
            if (pin != null && !pin.equals(fingerprint(chain[0]))) {
                throw new CertificateException(PIN_MISMATCH);
            }
        }

        @Override
        public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
            throw new CertificateException("not a server");
        }

        @Override
        public X509Certificate[] getAcceptedIssuers() {
            return new X509Certificate[0];
        }
    }

    private SSLSocketFactory factory(String host, int port, String pin) throws Exception {
        String key = host + ":" + port + "|" + (pin == null ? "" : pin);
        SSLSocketFactory cached = factories.get(key);
        if (cached != null) return cached;
        SSLContext ctx = SSLContext.getInstance("TLS");
        ctx.init(null, new TrustManager[] { new PinTrustManager(pin) }, new SecureRandom());
        SSLSocketFactory created = ctx.getSocketFactory();
        if (factories.size() > 256) factories.clear();
        factories.put(key, created);
        return created;
    }

    private static boolean isPinMismatch(Throwable t) {
        for (Throwable c = t; c != null; c = c.getCause()) {
            if (c.getMessage() != null && c.getMessage().contains(PIN_MISMATCH)) return true;
        }
        return false;
    }

    private static void reject(PluginCall call, Throwable t) {
        if (isPinMismatch(t)) {
            call.reject("certificate changed", PIN_MISMATCH);
            return;
        }
        String message = t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName();
        call.reject(message, t.getClass().getSimpleName());
    }

    private static String readAll(InputStream in) throws IOException {
        if (in == null) return "";
        try (InputStream src = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = src.read(buf)) != -1) out.write(buf, 0, n);
            return out.toString("UTF-8");
        }
    }

    // --- RPC ------------------------------------------------------------------

    /**
     * С Tor мимо него ничего не идёт — как у компьютера (refuse_direct):
     * запросы с адресом и подписью ноде напрямую не уходят.
     */
    private static boolean refusedUnderTor(PluginCall call) {
        if (!TorNetwork.directRefused()) return false;
        call.reject("tor_enabled: direct connections are off while Tor is on", "tor_enabled");
        return true;
    }

    @PluginMethod
    public void request(PluginCall call) {
        if (refusedUnderTor(call)) return;
        String id = call.getString("id", "");
        String url = call.getString("url", "");
        String body = call.getString("body", "");
        String pin = call.getString("pin");
        int timeout = call.getInt("timeoutMs", 30_000);
        URL parsed;
        try {
            parsed = new URL(url);
        } catch (Exception e) {
            call.reject("bad url", "MalformedURLException");
            return;
        }
        String path = parsed.getPath();
        if (!"https".equals(parsed.getProtocol()) || parsed.getPort() <= 0
                || !("/public/".equals(path) || "/post/".equals(path)) || parsed.getQuery() != null) {
            call.reject("only node API urls", "MalformedURLException");
            return;
        }
        // Чтение можно повторить, если нода закрыла соединение из пула, пока оно
        // лежало («Software caused connection abort», «unexpected end of stream»).
        // Транзакцию (/post/) — нет: второй раз её не отправляем.
        int attempts = "/public/".equals(path) ? 2 : 1;
        executor.execute(() -> {
            for (int attempt = 1; ; attempt++) {
                HttpsURLConnection conn = null;
                try {
                    conn = (HttpsURLConnection) parsed.openConnection();
                    requests.put(id, conn);
                    conn.setSSLSocketFactory(factory(parsed.getHost(), parsed.getPort(), pin));
                    conn.setHostnameVerifier(ANY_HOSTNAME);
                    conn.setRequestMethod("POST");
                    conn.setUseCaches(false);
                    conn.setInstanceFollowRedirects(false);
                    conn.setConnectTimeout(Math.min(timeout, CONNECT_TIMEOUT_MS));
                    conn.setReadTimeout(timeout);
                    conn.setRequestProperty("Content-Type", "application/json");
                    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                    conn.setDoOutput(true);
                    conn.setFixedLengthStreamingMode(bytes.length);
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(bytes);
                    }
                    int status = conn.getResponseCode();
                    String fp = "";
                    java.security.cert.Certificate[] certs = conn.getServerCertificates();
                    if (certs.length > 0 && certs[0] instanceof X509Certificate) {
                        fp = fingerprint((X509Certificate) certs[0]);
                    }
                    // gzip снимает сам HttpURLConnection; дочитанный ответ возвращает
                    // соединение в пул — следующий запрос к ноде обойдётся без рукопожатия.
                    String text = readAll(status >= 400 ? conn.getErrorStream() : conn.getInputStream());
                    JSObject ret = new JSObject();
                    ret.put("status", status);
                    ret.put("body", text);
                    ret.put("fingerprint", fp);
                    requests.remove(id);
                    call.resolve(ret);
                    return;
                } catch (Throwable t) {
                    if (conn != null) conn.disconnect();
                    // Отменённый (cancel убрал его из карты) не повторяем.
                    boolean stale = t instanceof IOException && !(t instanceof SocketTimeoutException)
                            && !isPinMismatch(t) && requests.containsKey(id);
                    if (stale && attempt < attempts) continue;
                    requests.remove(id);
                    reject(call, t);
                    return;
                }
            }
        });
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        HttpsURLConnection conn = requests.remove(call.getString("id", ""));
        if (conn != null) executor.execute(conn::disconnect);
        call.resolve();
    }

    // --- WebSocket ------------------------------------------------------------

    @PluginMethod
    public void wsConnect(PluginCall call) {
        if (refusedUnderTor(call)) return;
        String id = call.getString("id", "");
        String url = call.getString("url", "");
        String pin = call.getString("pin");
        URI uri;
        try {
            uri = new URI(url);
        } catch (Exception e) {
            call.reject("bad url", "MalformedURLException");
            return;
        }
        if (!"wss".equals(uri.getScheme()) || uri.getPort() <= 0 || !"/ws".equals(uri.getPath())
                || id.isEmpty() || sockets.containsKey(id)) {
            call.reject("only node ws urls", "MalformedURLException");
            return;
        }
        executor.execute(() -> {
            NodeSocket socket = new NodeSocket(id);
            try {
                String fp = socket.open(uri, factory(uri.getHost(), uri.getPort(), pin));
                sockets.put(id, socket);
                JSObject ret = new JSObject();
                ret.put("fingerprint", fp);
                call.resolve(ret);
                socket.readLoop();
            } catch (Throwable t) {
                if (!socket.opened) {
                    socket.shutdown();
                    reject(call, t);
                } else {
                    socket.closed(1006, t.getMessage() != null ? t.getMessage() : "connection lost");
                }
            }
        });
    }

    @PluginMethod
    public void wsSend(PluginCall call) {
        NodeSocket socket = sockets.get(call.getString("id", ""));
        String data = call.getString("data", "");
        if (socket == null) {
            call.reject("socket closed", "IOException");
            return;
        }
        executor.execute(() -> {
            try {
                socket.send(0x1, data.getBytes(StandardCharsets.UTF_8));
                call.resolve();
            } catch (Throwable t) {
                reject(call, t);
            }
        });
    }

    @PluginMethod
    public void wsClose(PluginCall call) {
        NodeSocket socket = sockets.remove(call.getString("id", ""));
        if (socket != null) {
            executor.execute(() -> {
                try {
                    socket.send(0x8, new byte[] { 0x03, (byte) 0xe8 });
                } catch (Throwable ignored) {
                    // уже оборван
                }
                socket.shutdown();
            });
        }
        call.resolve();
    }

    /**
     * Клиент WebSocket (RFC 6455) поверх TLS — столько, сколько нужно
     * уведомлениям ноды: текстовые кадры, ping/pong, close. Своя реализация,
     * чтобы не тащить в приложение OkHttp ради одного сокета.
     */
    private final class NodeSocket {
        private final String id;
        private SSLSocket socket;
        private InputStream in;
        private OutputStream out;
        private final SecureRandom random = new SecureRandom();
        volatile boolean opened = false;
        private volatile boolean done = false;

        NodeSocket(String id) {
            this.id = id;
        }

        String open(URI uri, SSLSocketFactory factory) throws Exception {
            Socket raw = new Socket();
            raw.connect(new InetSocketAddress(uri.getHost(), uri.getPort()), CONNECT_TIMEOUT_MS);
            socket = (SSLSocket) factory.createSocket(raw, uri.getHost(), uri.getPort(), true);
            socket.setSoTimeout(CONNECT_TIMEOUT_MS);
            socket.startHandshake();
            String fp = fingerprint((X509Certificate) socket.getSession().getPeerCertificates()[0]);
            in = socket.getInputStream();
            out = socket.getOutputStream();

            byte[] nonce = new byte[16];
            random.nextBytes(nonce);
            String key = Base64.encodeToString(nonce, Base64.NO_WRAP);
            String request = "GET " + uri.getRawPath() + " HTTP/1.1\r\n"
                    + "Host: " + uri.getHost() + ":" + uri.getPort() + "\r\n"
                    + "Upgrade: websocket\r\n"
                    + "Connection: Upgrade\r\n"
                    + "Sec-WebSocket-Key: " + key + "\r\n"
                    + "Sec-WebSocket-Version: 13\r\n"
                    + "User-Agent: Bastyon/1.0\r\n\r\n";
            out.write(request.getBytes(StandardCharsets.US_ASCII));
            out.flush();

            String head = readHead();
            String[] lines = head.split("\r\n");
            if (lines.length == 0 || !lines[0].matches("HTTP/1\\.[01] 101.*")) {
                throw new IOException("ws handshake: " + (lines.length > 0 ? lines[0] : "empty"));
            }
            String expected = Base64.encodeToString(
                    MessageDigest.getInstance("SHA-1").digest(
                            (key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").getBytes(StandardCharsets.US_ASCII)),
                    Base64.NO_WRAP);
            boolean accepted = false;
            for (String line : lines) {
                int colon = line.indexOf(':');
                if (colon > 0 && line.substring(0, colon).trim().equalsIgnoreCase("Sec-WebSocket-Accept")
                        && line.substring(colon + 1).trim().equals(expected)) {
                    accepted = true;
                }
            }
            if (!accepted) throw new IOException("ws handshake: bad accept");
            // Блок приходит раз в минуту; дольше тишина — проверяем связь (readLoop).
            socket.setSoTimeout(IDLE_MS);
            opened = true;
            return fp;
        }

        private String readHead() throws IOException {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            int matched = 0;
            while (matched < 4) {
                int b = in.read();
                if (b == -1) throw new EOFException("ws handshake: closed");
                buf.write(b);
                matched = (b == (matched % 2 == 0 ? '\r' : '\n')) ? matched + 1 : (b == '\r' ? 1 : 0);
                if (buf.size() > 16 * 1024) throw new IOException("ws handshake: header too long");
            }
            return buf.toString("US-ASCII");
        }

        private void readFully(byte[] dst) throws IOException {
            int off = 0;
            while (off < dst.length) {
                int n = in.read(dst, off, dst.length - off);
                if (n == -1) throw new EOFException("connection lost");
                off += n;
            }
        }

        void readLoop() throws IOException {
            ByteArrayOutputStream message = new ByteArrayOutputStream();
            byte[] head = new byte[2];
            boolean pinged = false;
            while (!done) {
                try {
                    readFully(head);
                } catch (SocketTimeoutException idle) {
                    // Сеть сменилась или NAT забыл соединение — без этого сокет
                    // висел бы открытым, а уведомления не шли.
                    if (pinged) throw new IOException("no answer to ping");
                    send(0x9, new byte[0]);
                    pinged = true;
                    continue;
                }
                pinged = false;
                boolean fin = (head[0] & 0x80) != 0;
                int opcode = head[0] & 0x0f;
                boolean masked = (head[1] & 0x80) != 0;
                long len = head[1] & 0x7f;
                if (len == 126) {
                    byte[] ext = new byte[2];
                    readFully(ext);
                    len = ((ext[0] & 0xff) << 8) | (ext[1] & 0xff);
                } else if (len == 127) {
                    byte[] ext = new byte[8];
                    readFully(ext);
                    len = 0;
                    for (byte b : ext) len = (len << 8) | (b & 0xff);
                }
                if (len < 0 || len > MAX_FRAME) throw new IOException("frame too large");
                byte[] mask = null;
                if (masked) {
                    mask = new byte[4];
                    readFully(mask);
                }
                byte[] payload = new byte[(int) len];
                readFully(payload);
                if (mask != null) {
                    for (int i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
                }
                switch (opcode) {
                    case 0x0: // продолжение
                    case 0x1: // текст
                    case 0x2: // двоичный — ноде не свойственно, читаем как текст
                        message.write(payload);
                        if (message.size() > MAX_FRAME) throw new IOException("message too large");
                        if (fin) {
                            JSObject ev = new JSObject();
                            ev.put("id", id);
                            ev.put("data", message.toString("UTF-8"));
                            notifyListeners("wsMessage", ev);
                            message.reset();
                        }
                        break;
                    case 0x8: { // close
                        int code = payload.length >= 2 ? ((payload[0] & 0xff) << 8) | (payload[1] & 0xff) : 1005;
                        String reason = payload.length > 2
                                ? new String(payload, 2, payload.length - 2, StandardCharsets.UTF_8) : "";
                        try {
                            send(0x8, payload.length >= 2 ? new byte[] { payload[0], payload[1] } : new byte[0]);
                        } catch (IOException ignored) {
                            // сервер уже ушёл
                        }
                        closed(code, reason);
                        return;
                    }
                    case 0x9: // ping
                        send(0xA, payload);
                        break;
                    default: // pong и прочее
                        break;
                }
            }
        }

        synchronized void send(int opcode, byte[] payload) throws IOException {
            if (out == null || done) throw new IOException("socket closed");
            ByteArrayOutputStream frame = new ByteArrayOutputStream(payload.length + 14);
            frame.write(0x80 | opcode);
            if (payload.length < 126) {
                frame.write(0x80 | payload.length);
            } else if (payload.length <= 0xffff) {
                frame.write(0x80 | 126);
                frame.write((payload.length >> 8) & 0xff);
                frame.write(payload.length & 0xff);
            } else {
                frame.write(0x80 | 127);
                for (int i = 7; i >= 0; i--) frame.write((int) (((long) payload.length >> (8 * i)) & 0xff));
            }
            byte[] mask = new byte[4];
            random.nextBytes(mask);
            frame.write(mask, 0, 4);
            for (int i = 0; i < payload.length; i++) frame.write(payload[i] ^ mask[i % 4]);
            out.write(frame.toByteArray());
            out.flush();
        }

        void closed(int code, String reason) {
            if (done) return;
            shutdown();
            if (sockets.remove(id) == null && !opened) return;
            JSObject ev = new JSObject();
            ev.put("id", id);
            ev.put("code", code);
            ev.put("reason", reason);
            notifyListeners("wsClose", ev);
        }

        void shutdown() {
            done = true;
            try {
                if (socket != null) socket.close();
            } catch (IOException ignored) {
                // уже закрыт
            }
        }
    }
}
