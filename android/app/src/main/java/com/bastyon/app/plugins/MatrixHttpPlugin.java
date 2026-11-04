package com.bastyon.app.plugins;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.os.SystemClock;
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
import java.net.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collection;
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
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Connection;
import okhttp3.EventListener;
import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;

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
 * OkHttp, а не HttpURLConnection. Тот умеет только HTTP/1.1: параллельные
 * запросы открывали каждый своё TLS-соединение (шесть разом — 460 мс против
 * 130 у WebView, на мобильной сети с потерями — секунды). А соединение,
 * умершее, пока приложение было в фоне, он держал до таймаута чтения: новые
 * сообщения приходили через полторы-две минуты, свои стояли «отправляется»,
 * под конец мигала «Ошибка синхронизации». По HTTP/2 всё идёт одним
 * соединением, как в WebView и у компьютера; пинг и проверка после фона
 * находят умершее за секунды, и запросы на нём OkHttp повторяет по новому.
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
    // Одно соединение на все запросы: умри оно молча (сменилась сеть, телефон
    // вернулся из фона), без пинга запросы ждали бы таймаута чтения — минуты.
    private static final long PING_MS = 10_000;
    // Дольше в фоне — соединение проверяем: сеть телефона за это время могла
    // его потерять, а узнали бы мы об этом только по пингу.
    private static final long BACKGROUND_CHECK_MS = 15_000;
    // Сколько ждать ответа на проверку: живое соединение отвечает за круг до сервера.
    private static final long PROBE_MS = 2_000;

    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Map<String, Call> active = new ConcurrentHashMap<>();
    // Отмена, пришедшая раньше, чем запрос успел уйти.
    private final Set<String> cancelled = ConcurrentHashMap.newKeySet();
    // Чьё соединение у какого запроса: умершее после фона закрываем целиком.
    private final Map<Call, Connection> inUse = new ConcurrentHashMap<>();
    private final OkHttpClient http = new OkHttpClient.Builder()
        .pingInterval(PING_MS, TimeUnit.MILLISECONDS)
        .eventListener(new EventListener() {
            @Override
            public void connectionAcquired(Call call, Connection connection) {
                inUse.put(call, connection);
            }

            @Override
            public void connectionReleased(Call call, Connection connection) {
                inUse.remove(call);
            }

            @Override
            public void callEnd(Call call) {
                inUse.remove(call);
            }

            @Override
            public void callFailed(Call call, IOException ioe) {
                inUse.remove(call);
            }
        })
        .build();
    private ConnectivityManager.NetworkCallback networkCallback;
    private long pausedAt;
    // Куда ходили последний раз — туда и проверка после фона.
    private volatile HttpUrl lastUrl;

    @Override
    public void load() {
        super.load();
        // Файлы прошлого запуска никто уже не прочитает.
        executor.execute(() -> {
            File[] old = dir().listFiles();
            if (old != null) for (File f : old) f.delete();
        });
        // Сменилась сеть (Wi-Fi ↔ мобильная): соединения прежней не годятся.
        ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null) {
            networkCallback = new ConnectivityManager.NetworkCallback() {
                private Network current;

                @Override
                public void onAvailable(Network network) {
                    if (current != null && !current.equals(network)) freshConnections();
                    current = network;
                }

                @Override
                public void onLost(Network network) {
                    if (!network.equals(current)) return;
                    current = null;
                    freshConnections();
                }
            };
            try {
                cm.registerDefaultNetworkCallback(networkCallback);
            } catch (RuntimeException e) {
                networkCallback = null;
            }
        }
    }

    @Override
    protected void handleOnPause() {
        pausedAt = SystemClock.elapsedRealtime();
    }

    @Override
    protected void handleOnResume() {
        if (pausedAt > 0 && SystemClock.elapsedRealtime() - pausedAt > BACKGROUND_CHECK_MS) {
            executor.execute(this::checkConnection);
        }
        pausedAt = 0;
    }

    /**
     * Вернулись из фона: жив ли запрос к серверу по тому же соединению.
     * Ответил — ничего не трогаем; нет — соединение умерло, пока приложение
     * стояло (сеть телефона его потеряла), и всё переходит на новое.
     */
    private void checkConnection() {
        HttpUrl base = lastUrl;
        if (base == null) return;
        HttpUrl probe = base.newBuilder().encodedPath("/_matrix/client/versions").query(null).build();
        try {
            OkHttpClient client = http.newBuilder()
                .proxy(TorNetwork.proxy())
                .callTimeout(PROBE_MS, TimeUnit.MILLISECONDS)
                .retryOnConnectionFailure(false)
                .build();
            try (Response ignored = client.newCall(new Request.Builder().url(probe).build()).execute()) {
                // соединение живо
            }
        } catch (Throwable t) {
            freshConnections();
        }
    }

    /**
     * Соединения прежней сети или умершие в фоне не годятся: закрываем их.
     * Запросы на них — длинный опрос /sync, отправка — падают сразу, и OkHttp
     * повторяет их по новому соединению, а что не повторил — повторит SDK.
     * Раньше (HttpURLConnection) опрос и отправка на умершем соединении висели
     * до таймаута чтения: новые сообщения приходили через полторы-две минуты,
     * свои стояли «отправляется».
     */
    private void freshConnections() {
        Collection<Connection> dead = new HashSet<>(inUse.values());
        for (Connection c : dead) {
            try {
                c.socket().close();
            } catch (IOException ignored) {
                // уже закрыто
            }
        }
        http.connectionPool().evictAll();
    }

    @Override
    protected void handleOnDestroy() {
        for (Call c : active.values()) c.cancel();
        if (networkCallback != null) {
            ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            try {
                if (cm != null) cm.unregisterNetworkCallback(networkCallback);
            } catch (RuntimeException ignored) {
                // уже снят
            }
        }
        executor.shutdownNow();
        http.connectionPool().evictAll();
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
            try {
                // Под Tor — через Tor; Tor ещё не готов — исключение, а не напрямую.
                Proxy proxy = TorNetwork.proxy();
                OkHttpClient client = http.newBuilder()
                    .proxy(proxy)
                    .connectTimeout(call.getInt("connectTimeout", 30_000), TimeUnit.MILLISECONDS)
                    .readTimeout(call.getInt("readTimeout", 120_000), TimeUnit.MILLISECONDS)
                    .build();

                Request.Builder req = new Request.Builder().url(url);
                lastUrl = HttpUrl.parse(url);
                String contentType = null;
                JSObject headers = call.getObject("headers", new JSObject());
                for (Iterator<String> it = headers.keys(); it.hasNext(); ) {
                    String key = it.next();
                    String value = headers.getString(key);
                    if (value == null) continue;
                    if (key.equalsIgnoreCase("Content-Type")) contentType = value;
                    req.header(key, value);
                }
                String body = call.getString("body");
                RequestBody reqBody = null;
                if (!method.equals("GET") && !method.equals("HEAD")) {
                    // Тело без Content-Type OkHttp шлёт как есть; POST и PUT без тела он не примет.
                    byte[] bytes = body != null ? body.getBytes(StandardCharsets.UTF_8) : new byte[0];
                    reqBody = RequestBody.create(bytes, contentType != null ? MediaType.parse(contentType) : null);
                }
                req.method(method, reqBody);

                Call c = client.newCall(req.build());
                active.put(id, c);
                if (cancelled.remove(id)) c.cancel();
                try (Response res = c.execute()) {
                    String path = "";
                    ResponseBody resBody = res.body();
                    if (resBody != null && !method.equals("HEAD")) {
                        File dir = dir();
                        if (!dir.mkdirs() && !dir.isDirectory()) throw new IOException("no cache dir");
                        out = new File(dir, UUID.randomUUID() + ".body");
                        try (InputStream src = resBody.byteStream(); OutputStream dst = new FileOutputStream(out)) {
                            byte[] buf = new byte[BUFFER];
                            int n;
                            while ((n = src.read(buf)) != -1) dst.write(buf, 0, n);
                        }
                        path = out.getAbsolutePath();
                    }

                    JSObject resHeaders = new JSObject();
                    for (Map.Entry<String, List<String>> h : res.headers().toMultimap().entrySet()) {
                        resHeaders.put(h.getKey(), TextUtils.join(", ", h.getValue()));
                    }
                    JSObject ret = new JSObject();
                    ret.put("status", res.code());
                    ret.put("headers", resHeaders);
                    ret.put("path", path);
                    call.resolve(ret);
                }
            } catch (Throwable t) {
                // Throwable, а не Exception: нехватка памяти тоже должна дойти до JS
                // ошибкой, а не оставить запрос висеть.
                if (out != null) out.delete();
                String message = t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName();
                call.reject(message, t.getClass().getSimpleName());
            } finally {
                active.remove(id);
            }
        });
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String id = call.getString("id", "");
        Call c = active.remove(id);
        if (c != null) c.cancel();
        else cancelled.add(id);
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
