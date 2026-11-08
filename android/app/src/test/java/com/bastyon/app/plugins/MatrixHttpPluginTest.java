package com.bastyon.app.plugins;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okio.Buffer;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

/**
 * Тело запроса MatrixHttp: POST не уходит второй раз, когда соединение
 * оборвалось после отправки (сервер мог его выполнить — вторая комната,
 * второй вход), а PUT с txnId OkHttp по-прежнему повторяет сам.
 */
public class MatrixHttpPluginTest {

    /**
     * HTTP/1.1 на localhost. Первый запрос соединения — ответ и keep-alive;
     * запрос /x на уже послужившем соединении сервер читает и молча рвёт:
     * так выглядит соединение, умершее, пока приложение было в фоне.
     */
    private ServerSocket server;
    private final AtomicInteger xRequests = new AtomicInteger();
    private Thread acceptor;

    @Before
    public void start() throws IOException {
        server = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
        acceptor = new Thread(() -> {
            while (!server.isClosed()) {
                try {
                    Socket s = server.accept();
                    new Thread(() -> serve(s)).start();
                } catch (IOException e) {
                    return;
                }
            }
        });
        acceptor.start();
    }

    @After
    public void stop() throws IOException {
        server.close();
    }

    private void serve(Socket s) {
        try (Socket socket = s) {
            BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
            OutputStream out = socket.getOutputStream();
            int served = 0;
            while (true) {
                String line = in.readLine();
                if (line == null) return;
                String path = line.split(" ")[1];
                int length = 0;
                for (String h; (h = in.readLine()) != null && !h.isEmpty(); ) {
                    if (h.toLowerCase(Locale.ROOT).startsWith("content-length:")) {
                        length = Integer.parseInt(h.substring(15).trim());
                    }
                }
                for (int i = 0; i < length; i++) in.read();
                if (path.equals("/x")) {
                    xRequests.incrementAndGet();
                    if (served > 0) return; // соединение умерло: запрос дошёл, ответа нет
                }
                out.write("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok".getBytes(StandardCharsets.US_ASCII));
                out.flush();
                served++;
            }
        } catch (IOException ignored) {
            // клиент ушёл
        }
    }

    private String url(String path) {
        return "http://127.0.0.1:" + server.getLocalPort() + path;
    }

    /** Прогретое соединение в пуле, затем запрос, который сервер оборвёт. */
    private Response sendOnStaleConnection(String method) throws IOException {
        OkHttpClient client = new OkHttpClient.Builder().readTimeout(5, TimeUnit.SECONDS).build();
        try (Response warm = client.newCall(new Request.Builder().url(url("/warm")).build()).execute()) {
            assertEquals(200, warm.code());
        }
        RequestBody body = MatrixHttpPlugin.body(method, "{\"a\":1}", "application/json");
        return client.newCall(new Request.Builder().url(url("/x")).method(method, body).build()).execute();
    }

    @Test
    public void postIsNotResentAfterTheConnectionDrops() throws IOException {
        try (Response ignored = sendOnStaleConnection("POST")) {
            fail("POST должен упасть, а не уйти второй раз");
        } catch (IOException expected) {
            // ошибка уходит в JS, решает SDK или человек
        }
        assertEquals(1, xRequests.get());
    }

    @Test
    public void putIsRetriedOnAFreshConnection() throws IOException {
        try (Response res = sendOnStaleConnection("PUT")) {
            assertEquals(200, res.code());
        }
        assertEquals(2, xRequests.get());
    }

    @Test
    public void bodyKeepsTypeAndBytes() throws IOException {
        RequestBody post = MatrixHttpPlugin.body("POST", "{\"a\":1}", "application/json");
        assertTrue(post.isOneShot());
        assertEquals("application/json", String.valueOf(post.contentType()));
        assertEquals(7, post.contentLength());
        Buffer buf = new Buffer();
        post.writeTo(buf);
        assertEquals("{\"a\":1}", buf.readUtf8());

        assertFalse(MatrixHttpPlugin.body("PUT", "{}", "application/json").isOneShot());
        assertEquals(0, MatrixHttpPlugin.body("POST", null, null).contentLength());
        assertNull(MatrixHttpPlugin.body("GET", null, null));
        assertNull(MatrixHttpPlugin.body("HEAD", null, null));
    }
}
