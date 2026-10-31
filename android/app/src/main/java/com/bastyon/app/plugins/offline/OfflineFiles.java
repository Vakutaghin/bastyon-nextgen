package com.bastyon.app.plugins.offline;

import androidx.annotation.Nullable;

import java.io.File;
import java.io.FileInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Ответ на {@code https://localhost/_offline_/<id>/<файл>}: скачанное отдаётся
 * странице по id, как схема {@code bastyon-offline://} у компьютера
 * (src-tauri/src/offline/protocol.rs).
 *
 * Свой ответ, а не {@code _capacitor_file_}: WebViewLocalServer Capacitor
 * 8.0.1 считает длины в int — ролик больше 2 ГБ не перематывался бы. Здесь —
 * 206 с честным {@code Content-Range} и длинами в long. Файл в память не
 * читается: WebView берёт поток сколько нужно и закрывает при перемотке.
 *
 * Как WebView обходится с Range (Chromium, android_webview
 * InputStreamReader::Seek): он сам применяет Range запроса к потоку из
 * WebResourceResponse — берёт {@code available()} за длину файла, считает по
 * ней границы и пропускает начало через {@code skip()}. Поэтому поток здесь —
 * файл с нулевого байта до конца запрошенного куска, а не кусок с его начала
 * (так WebView отвечал бы «диапазон не выполним» на любой Range не с нуля).
 * {@code available()} — int: у файла больше 2 ГБ он возвращает 0, тогда
 * WebView границы не считает и пропускает только явно заданное начало
 * ({@code bytes=a-}); для {@code bytes=-n} у такого файла поток уже стоит на
 * месте. Результат {@code skip()} WebView тоже читает как int и пропускает в
 * цикле — поэтому за раз не больше {@code Integer.MAX_VALUE}.
 * {@code Content-Length} WebView ставит сам по {@code available()} (у файла
 * больше 2 ГБ — 0, но тело приходит целиком, а плееру хватает
 * {@code Content-Range}); свой рядом дал бы двойное значение.
 *
 * Отдаются только {@code video.mp4} (есть лишь целиком скачанный),
 * {@code thumb.jpg}, {@code avatar.jpg}, {@code captions/<язык>.vtt} и
 * {@code playlist.m3u8}; остальное — 404.
 */
final class OfflineFiles {
    static final String PREFIX = "/_offline_/";

    private OfflineFiles() {}

    /** Готовый ответ; в WebResourceResponse его собирает OfflineWebViewClient. */
    static final class Response {
        final int status;
        final String reason;
        final String mime;
        @Nullable final String encoding;
        final Map<String, String> headers;
        final InputStream body;

        Response(int status, String reason, String mime, @Nullable String encoding,
                 Map<String, String> headers, InputStream body) {
            this.status = status;
            this.reason = reason;
            this.mime = mime;
            this.encoding = encoding;
            this.headers = headers;
            this.body = body;
        }
    }

    static String mime(String name) {
        if (name.endsWith(".mp4")) return "video/mp4";
        if (name.endsWith(".jpg")) return "image/jpeg";
        if (name.endsWith(".vtt")) return "text/vtt";
        if (name.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
        return "application/octet-stream";
    }

    /**
     * {@code bytes=a-b}, {@code bytes=a-}, {@code bytes=-n} → {начало, конец
     * включительно}; несколько диапазонов — первый. null — не выполнить.
     */
    @Nullable
    static long[] parseRange(String value, long len) {
        if (len <= 0) return null;
        String v = value.trim();
        if (!v.startsWith("bytes=")) return null;
        String spec = v.substring("bytes=".length());
        int comma = spec.indexOf(',');
        if (comma >= 0) spec = spec.substring(0, comma);
        spec = spec.trim();
        int dash = spec.indexOf('-');
        if (dash < 0) return null;
        String a = spec.substring(0, dash).trim();
        String b = spec.substring(dash + 1).trim();
        long start;
        long end;
        try {
            if (a.isEmpty()) {
                long suffix = Long.parseLong(b);
                if (suffix <= 0) return null;
                start = Math.max(0, len - suffix);
                end = len - 1;
            } else {
                start = Long.parseLong(a);
                end = b.isEmpty() ? len - 1 : Math.min(Long.parseLong(b), len - 1);
            }
        } catch (NumberFormatException e) {
            return null;
        }
        if (start < 0 || start > end || start >= len) return null;
        return new long[] {start, end};
    }

    /** {@code /_offline_/<id>/<имя>} → {id, имя}; null — не наш или не отдаётся. */
    @Nullable
    static String[] split(@Nullable String path) {
        if (path == null || !path.startsWith(PREFIX)) return null;
        String rest = path.substring(PREFIX.length());
        int slash = rest.indexOf('/');
        if (slash <= 0) return null;
        String id = rest.substring(0, slash);
        String name = rest.substring(slash + 1);
        boolean servable = name.equals(OfflineStore.VIDEO) || OfflineStore.validExtraName(name);
        if (!OfflineStore.validId(id) || !servable) return null;
        return new String[] {id, name};
    }

    private static Map<String, String> baseHeaders() {
        Map<String, String> h = new LinkedHashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        h.put("Cache-Control", "no-store");
        return h;
    }

    private static Response empty(int status, String reason) {
        // Тело — «пропускаемое»: на запрос с Range WebView сначала пропустит
        // начало, и пустой поток превратил бы 404/416 в сетевую ошибку.
        return new Response(status, reason, "text/plain", null, baseHeaders(), new Nothing());
    }

    /**
     * Ответ на запрос к {@code path} (уже раскодированный путь адреса) с
     * заголовком {@code range} (или null).
     */
    static Response respond(File root, @Nullable String path, String method, @Nullable String range) {
        String[] parts = split(path);
        if (parts == null) return empty(404, "Not Found");
        if (!"GET".equalsIgnoreCase(method) && !"HEAD".equalsIgnoreCase(method)) {
            return empty(405, "Method Not Allowed");
        }
        String name = parts[1];
        File file = new File(OfflineStore.dir(root, parts[0]), name);
        if (!file.isFile()) return empty(404, "Not Found");
        long len = file.length();
        boolean head = "HEAD".equalsIgnoreCase(method);

        Map<String, String> headers = baseHeaders();
        headers.put("Accept-Ranges", "bytes");
        headers.put("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
        String mime = mime(name);
        String encoding = name.endsWith(".vtt") || name.endsWith(".m3u8") ? "utf-8" : null;

        long start = 0;
        long count = len;
        int status = 200;
        String reason = "OK";
        if (range != null) {
            long[] r = parseRange(range, len);
            if (r == null) {
                Response bad = empty(416, "Range Not Satisfiable");
                bad.headers.put("Content-Range", "bytes */" + len);
                return bad;
            }
            start = r[0];
            count = r[1] - r[0] + 1;
            status = 206;
            reason = "Partial Content";
            headers.put("Content-Range", "bytes " + r[0] + "-" + r[1] + "/" + len);
        }

        InputStream body;
        if (head || count == 0) {
            body = new Nothing();
        } else {
            try {
                body = webViewStream(file, range != null, start, start + count, suffix(range));
            } catch (IOException e) {
                return empty(500, "Internal Server Error");
            }
        }
        return new Response(status, reason, mime, encoding, headers, body);
    }

    /** Пустое тело (HEAD): WebView может пропустить начало куска — пусть «пропускает». */
    static final class Nothing extends InputStream {
        @Override
        public int read() {
            return -1;
        }

        @Override
        public long skip(long n) {
            return Math.max(0, Math.min(n, Integer.MAX_VALUE));
        }

        @Override
        public int available() {
            return 0;
        }
    }

    /** {@code bytes=-n}: начало считается от конца файла. */
    private static boolean suffix(@Nullable String range) {
        if (range == null) return false;
        String v = range.trim();
        return v.startsWith("bytes=") && v.substring("bytes=".length()).trim().startsWith("-");
    }

    /**
     * Поток для WebView, который сам пропустит начало куска [start, end)
     * (см. описание класса). Без Range — файл целиком.
     */
    static InputStream webViewStream(File file, boolean ranged, long start, long end, boolean suffix)
            throws IOException {
        FileInputStream in = new FileInputStream(file);
        try {
            if (!ranged || end <= Integer.MAX_VALUE) {
                // WebView сверит границы по available() и сам пропустит start байт.
                return new Limited(in, end, true);
            }
            if (!suffix) {
                // Больше 2 ГБ: available() молчит, WebView пропустит явное начало сам.
                return new Limited(in, end, false);
            }
            // bytes=-n у файла больше 2 ГБ: WebView начала не знает и не пропустит.
            in.getChannel().position(start);
            return new Limited(in, end - start, false);
        } catch (IOException | RuntimeException e) {
            in.close();
            throw e;
        }
    }

    /**
     * Не больше {@code left} байт из потока. {@code available()} — сколько
     * осталось (WebView берёт это за длину) или 0 у файла больше 2 ГБ.
     */
    static final class Limited extends FilterInputStream {
        private long left;
        private final boolean reportAvailable;

        Limited(InputStream in, long left, boolean reportAvailable) {
            super(in);
            this.left = left;
            this.reportAvailable = reportAvailable;
        }

        @Override
        public int read() throws IOException {
            if (left <= 0) return -1;
            int b = super.read();
            if (b >= 0) left--;
            return b;
        }

        @Override
        public int read(byte[] buf, int off, int len) throws IOException {
            if (left <= 0) return -1;
            int n = super.read(buf, off, (int) Math.min(len, left));
            if (n > 0) left -= n;
            return n;
        }

        @Override
        public long skip(long n) throws IOException {
            // WebView читает ответ как int и пропускает в цикле.
            long s = super.skip(Math.min(Math.min(n, left), Integer.MAX_VALUE));
            if (s > 0) left -= s;
            return s;
        }

        @Override
        public int available() {
            if (!reportAvailable || left <= 0) return 0;
            return (int) Math.min(left, Integer.MAX_VALUE);
        }

        @Override
        public boolean markSupported() {
            return false;
        }
    }
}
