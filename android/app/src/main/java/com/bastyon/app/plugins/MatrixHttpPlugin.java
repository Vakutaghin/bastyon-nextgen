package com.bastyon.app.plugins;

import android.text.TextUtils;

import com.bastyon.app.plugins.tor.TorNetwork;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Запросы к серверу чатов мимо WebView (src/helpers/api/request-native.ts):
 * в WebView ответ без заголовков CORS (502/504 от nginx сервера чатов) fetch
 * отдаёт как «Failed to fetch», а здесь виден настоящий код.
 *
 * Тело ответа не держится в памяти Java: оно потоком пишется в файл кэша, а
 * WebView читает файл сам (Capacitor.convertFileSrc). CapacitorHttp, через
 * который это шло раньше, читал ответ целиком в строку и разбирал JSON в
 * Java: первый /sync большого аккаунта (40 МБ) упирался в предел кучи
 * (192 МБ на эмуляторе), OutOfMemoryError плагин не ловил, и запрос висел
 * без ответа и без ошибки — переписки не грузились, а ошибки не было.
 *
 *   request({ id, url, method, headers, body?, connectTimeout, readTimeout })
 *       → { status, headers, path }; path — файл с телом, "" — тела нет.
 *       Ошибка — с кодом-именем исключения (UnknownHostException,
 *       SocketTimeoutException…), как у CapacitorHttp.
 *   cancel({ id }) — оборвать запрос (сигнал отмены из JS).
 *   release({ path }) — удалить прочитанный файл.
 */
@CapacitorPlugin(name = "MatrixHttp")
public class MatrixHttpPlugin extends Plugin {

    private static final String DIR = "matrix-http";
    private static final int BUFFER = 64 * 1024;
    // Set.of есть только с API 30, String.join — с 26, а minSdk 24.
    private static final Set<String> METHODS = new HashSet<>(Arrays.asList("GET", "POST", "PUT", "DELETE", "HEAD"));

    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Map<String, HttpURLConnection> active = new ConcurrentHashMap<>();

    @Override
    public void load() {
        super.load();
        // Файлы прошлого запуска никто уже не прочитает.
        executor.execute(() -> {
            File[] old = dir().listFiles();
            if (old != null) for (File f : old) f.delete();
        });
    }

    @Override
    protected void handleOnDestroy() {
        for (HttpURLConnection conn : active.values()) conn.disconnect();
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void request(PluginCall call) {
        String id = call.getString("id", UUID.randomUUID().toString());
        String url = call.getString("url", "");
        String method = call.getString("method", "GET").toUpperCase(Locale.ROOT);
        if (!url.startsWith("https://") && !url.startsWith("http://")) {
            call.reject("bad url", "MalformedURLException");
            return;
        }
        if (!METHODS.contains(method)) {
            call.reject("unsupported method " + method, "ProtocolException");
            return;
        }
        executor.execute(() -> {
            File out = null;
            HttpURLConnection conn = null;
            try {
                // Под Tor — через Tor; Tor ещё не готов — исключение, а не напрямую.
                conn = (HttpURLConnection) new URL(url).openConnection(TorNetwork.proxy());
                active.put(id, conn);
                conn.setRequestMethod(method);
                conn.setInstanceFollowRedirects(true);
                conn.setUseCaches(false);
                conn.setConnectTimeout(call.getInt("connectTimeout", 30_000));
                conn.setReadTimeout(call.getInt("readTimeout", 120_000));
                JSObject headers = call.getObject("headers", new JSObject());
                for (Iterator<String> it = headers.keys(); it.hasNext(); ) {
                    String key = it.next();
                    conn.setRequestProperty(key, headers.getString(key));
                }
                String body = call.getString("body");
                if (body != null && !method.equals("GET") && !method.equals("HEAD")) {
                    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                    conn.setDoOutput(true);
                    conn.setFixedLengthStreamingMode(bytes.length);
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(bytes);
                    }
                }

                int status = conn.getResponseCode();
                InputStream in = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
                String path = "";
                if (in != null) {
                    File dir = dir();
                    if (!dir.mkdirs() && !dir.isDirectory()) throw new IOException("no cache dir");
                    out = new File(dir, UUID.randomUUID() + ".body");
                    try (InputStream src = in; OutputStream dst = new FileOutputStream(out)) {
                        byte[] buf = new byte[BUFFER];
                        int n;
                        while ((n = src.read(buf)) != -1) dst.write(buf, 0, n);
                    }
                    path = out.getAbsolutePath();
                }

                JSObject resHeaders = new JSObject();
                for (Map.Entry<String, List<String>> h : conn.getHeaderFields().entrySet()) {
                    if (h.getKey() != null) resHeaders.put(h.getKey(), TextUtils.join(", ", h.getValue()));
                }
                JSObject ret = new JSObject();
                ret.put("status", status);
                ret.put("headers", resHeaders);
                ret.put("path", path);
                call.resolve(ret);
            } catch (Throwable t) {
                // Throwable, а не Exception: нехватка памяти тоже должна дойти до JS
                // ошибкой, а не оставить запрос висеть.
                if (out != null) out.delete();
                String message = t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName();
                call.reject(message, t.getClass().getSimpleName());
            } finally {
                active.remove(id);
                if (conn != null) conn.disconnect();
            }
        });
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        HttpURLConnection conn = active.remove(call.getString("id", ""));
        if (conn != null) executor.execute(conn::disconnect);
        call.resolve();
    }

    @PluginMethod
    public void release(PluginCall call) {
        String path = call.getString("path", "");
        try {
            File file = new File(path).getCanonicalFile();
            // Удаляем только свои файлы.
            if (dir().getCanonicalFile().equals(file.getParentFile())) file.delete();
        } catch (IOException ignored) {
            // нечего удалять
        }
        call.resolve();
    }

    private File dir() {
        return new File(getContext().getCacheDir(), DIR);
    }
}
