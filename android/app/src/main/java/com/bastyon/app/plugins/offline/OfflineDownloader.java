package com.bastyon.app.plugins.offline;

import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Загрузка одного ролика кусками по {@code Range} с докачкой и проверкой —
 * то же, что у компьютера (src-tauri/src/offline/download.rs).
 * <ul>
 *   <li>Кусок — 4 МиБ; после каждого {@code state.json} записан, и обрыв,
 *       перезапуск или смена сети продолжают с последнего целого куска.</li>
 *   <li>Суммы фрагментов ({@code segmentsSha256Url} PeerTube: {@code { "<файл>":
 *       { "<начало>-<конец>": "<sha256>" } }}, концы включительно) проверяются,
 *       пока фрагмент пишется. Не сошлось — фрагмент качается заново, второй
 *       раз не сошлось — сбой. Подмену самой нодой это не ловит: суммы с той
 *       же ноды, — ловит обрезанное и побитое при докачке.</li>
 *   <li>Сбой сети — повтор через 1, 2, 5, 15, 30 с, каждый раз со следующего
 *       адреса (рядом с плейлистом, исходная нода, архив).</li>
 * </ul>
 * Сеть, суммы, место на диске и отчёт о ходе — снаружи (интерфейсы ниже):
 * так алгоритм проверяется тестом на обычной JVM, без Android.
 */
final class OfflineDownloader {
    static final long MB = 1024L * 1024L;
    /** Сверх размера ролика должно оставаться свободным. */
    static final long SPARE = 200 * MB;
    /** Обложка, аватар, субтитры — не больше. */
    static final long EXTRA_MAX = 20 * MB;
    static final long HASHES_MAX = 5 * MB;
    static final int SMALL_TIMEOUT_MS = 20_000;
    static final String USER_AGENT = "Bastyon/1.0";

    static final int RUN = 0;
    static final int PAUSE = 1;
    static final int REMOVE = 2;

    /** Соединение по адресу: на Android — через {@code TorNetwork.proxy()}. */
    interface Net {
        HttpURLConnection open(String url) throws IOException;
    }

    /** Ход загрузки наружу: {@code persist} — записать {@code state.json}. */
    interface Report {
        void report(OfflineStore.State state, boolean persist);
    }

    /** Свободно на диске, байт; −1 — не узнать. */
    interface FreeSpace {
        long bytes();
    }

    /** Суммы фрагментов этого файла; пусто — проверять нечем. */
    interface Hashes {
        List<HashRange> load(OfflineDownloader d);
    }

    static final class Policy {
        final long chunk;
        final long[] retryDelaysMs;
        /** Пауза без единого байта, после которой запрос считается оборванным. */
        final int stallMs;

        Policy(long chunk, long[] retryDelaysMs, int stallMs) {
            this.chunk = chunk;
            this.retryDelaysMs = retryDelaysMs;
            this.stallMs = stallMs;
        }

        static Policy standard() {
            return new Policy(4 * MB, new long[] {1_000, 2_000, 5_000, 15_000, 30_000}, 60_000);
        }
    }

    /** Сбой загрузки с кодом для {@code state.error}. */
    static final class DlException extends Exception {
        final String code;

        DlException(String code, String detail) {
            super(code + (detail == null || detail.isEmpty() ? "" : ": " + detail));
            this.code = code;
        }

        DlException(String code) {
            this(code, null);
        }
    }

    /** Фрагмент с суммой: {@code [start, end]} включительно. */
    static final class HashRange {
        final long start;
        final long end;
        final String sha;

        HashRange(long start, long end, String sha) {
            this.start = start;
            this.end = end;
            this.sha = sha;
        }
    }

    // ─── Разбор ───────────────────────────────────────────────────────────

    /**
     * Суммы одного файла: {@code "<начало>-<конец>" → sha256}. Негодные записи
     * пропускаются; перекрытия значат чужой формат — null: без проверки
     * лучше, чем ложный сбой.
     */
    @Nullable
    static List<HashRange> fromSpans(Map<String, String> spans) {
        List<HashRange> ranges = new ArrayList<>();
        for (Map.Entry<String, String> e : spans.entrySet()) {
            String span = e.getKey();
            String sha = e.getValue();
            int dash = span.indexOf('-');
            if (dash <= 0 || sha == null) continue;
            long start;
            long end;
            try {
                start = Long.parseLong(span.substring(0, dash));
                end = Long.parseLong(span.substring(dash + 1));
            } catch (NumberFormatException ex) {
                continue;
            }
            if (start < 0 || end < start || sha.length() != 64 || !isHex(sha)) continue;
            ranges.add(new HashRange(start, end, sha.toLowerCase(Locale.ROOT)));
        }
        Collections.sort(ranges, (a, b) -> Long.compare(a.start, b.start));
        for (int i = 1; i < ranges.size(); i++) {
            if (ranges.get(i).start <= ranges.get(i - 1).end) return null;
        }
        return ranges;
    }

    private static boolean isHex(String s) {
        for (int i = 0; i < s.length(); i++) {
            if (Character.digit(s.charAt(i), 16) < 0) return false;
        }
        return true;
    }

    /** Ответ {@code segmentsSha256Url}; null — этого файла в нём нет. */
    @Nullable
    static List<HashRange> parseHashes(byte[] body, String fileName) {
        try {
            JSONObject all = new JSONObject(new String(body, StandardCharsets.UTF_8));
            JSONObject mine = all.optJSONObject(fileName);
            if (mine == null) return null;
            Map<String, String> spans = new HashMap<>();
            Iterator<String> keys = mine.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                Object v = mine.opt(key);
                if (v instanceof String) spans.put(key, (String) v);
            }
            return fromSpans(spans);
        } catch (Exception e) {
            return null;
        }
    }

    /** Продолжать с начала фрагмента: середину уже не проверить. */
    static long snapToFragment(List<HashRange> ranges, long pos) {
        for (HashRange r : ranges) {
            if (pos > r.start && pos <= r.end) return r.start;
        }
        return pos;
    }

    /** {@code bytes 0-99/1234} → {0, 1234}; null — не разобрать. */
    @Nullable
    static long[] parseContentRange(@Nullable String value) {
        if (value == null) return null;
        String v = value.trim();
        if (!v.startsWith("bytes ")) return null;
        String rest = v.substring("bytes ".length());
        int slash = rest.indexOf('/');
        if (slash < 0) return null;
        String span = rest.substring(0, slash);
        int dash = span.indexOf('-');
        if (dash < 0) return null;
        try {
            long start = Long.parseLong(span.substring(0, dash).trim());
            long total = Long.parseLong(rest.substring(slash + 1).trim());
            return new long[] {start, total};
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // ─── Проверка фрагментов ──────────────────────────────────────────────

    /** Сверяет фрагменты по мере записи. */
    static final class Verifier {
        private final List<HashRange> ranges;
        /** Первый ещё не проверенный фрагмент. */
        private int next;
        @Nullable private MessageDigest hasher;
        private final Map<Integer, Integer> strikes = new HashMap<>();
        /** Начало фрагмента, дважды не сошедшегося с суммой. */
        long badStart = -1;

        Verifier(List<HashRange> ranges, long pos) {
            this.ranges = ranges;
            seek(pos);
        }

        void seek(long pos) {
            next = ranges.size();
            for (int i = 0; i < ranges.size(); i++) {
                if (ranges.get(i).end >= pos) {
                    next = i;
                    break;
                }
            }
            hasher = null;
        }

        /** Сколько байт с {@code pos} можно записать до следующей границы фрагмента. */
        int piece(long pos, int len) {
            if (next >= ranges.size()) return len;
            HashRange r = ranges.get(next);
            if (pos < r.start) return (int) Math.min(len, r.start - pos);
            return (int) Math.min(len, r.end + 1 - pos);
        }

        /**
         * Записанный кусок {@code [pos, pos + len)} — внутри одного фрагмента или
         * между ними (см. {@link #piece}). −1 — дальше; иначе — откуда писать
         * заново (фрагмент не сошёлся).
         */
        long absorb(long pos, byte[] data, int off, int len) throws DlException {
            if (next >= ranges.size()) return -1;
            HashRange r = ranges.get(next);
            if (pos < r.start) return -1;
            if (pos == r.start) hasher = sha256();
            if (hasher == null) {
                // Сюда не попасть: продолжаем всегда с начала фрагмента. На
                // всякий случай фрагмент без начала пропускаем, а не встаём.
                if (pos + len >= r.end + 1) next++;
                return -1;
            }
            hasher.update(data, off, len);
            if (pos + len != r.end + 1) return -1;
            String actual = hex(hasher.digest());
            hasher = null;
            int index = next;
            next++;
            if (actual.equals(r.sha)) return -1;
            Integer prev = strikes.get(index);
            int count = (prev == null ? 0 : prev) + 1;
            strikes.put(index, count);
            if (count >= 2) {
                badStart = r.start;
                throw new DlException("hash_mismatch");
            }
            log("fragment " + r.start + "-" + r.end + " mismatch, fetching again");
            seek(r.start);
            return r.start;
        }

        /** Все фрагменты проверены (или проверять нечего). */
        boolean complete() {
            return next >= ranges.size();
        }

        /** Начало первого непроверенного фрагмента; −1 — проверено всё. */
        long uncheckedStart() {
            return next < ranges.size() ? ranges.get(next).start : -1;
        }
    }

    static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xf, 16)).append(Character.forDigit(b & 0xf, 16));
        }
        return sb.toString();
    }

    // ─── Загрузка ─────────────────────────────────────────────────────────

    private final Net net;
    private final Policy policy;
    private final File dir;
    private final OfflineStore.Job job;
    private final OfflineStore.State state;
    private final Report report;
    private final FreeSpace free;
    private final Hashes hashes;

    private final Object lock = new Object();
    private volatile int signal = RUN;
    /** Причина паузы ({@code wifi}, {@code quota}); null — пауза человеком. */
    @Nullable private volatile String pauseReason;
    @Nullable private volatile HttpURLConnection current;

    @Nullable private RandomAccessFile file;
    @Nullable private Verifier verifier;

    OfflineDownloader(Net net, Policy policy, File dir, OfflineStore.Job job, OfflineStore.State state,
                      Report report, FreeSpace free, Hashes hashes) {
        this.net = net;
        this.policy = policy;
        this.dir = dir;
        this.job = job;
        this.state = state;
        this.report = report;
        this.free = free;
        this.hashes = hashes;
    }

    OfflineStore.State state() {
        return state;
    }

    int signal() {
        return signal;
    }

    @Nullable
    String pauseReason() {
        return pauseReason;
    }

    /** Остановить из другого потока: пауза (с причиной) или удаление. */
    void stop(int how, @Nullable String reason) {
        synchronized (lock) {
            if (signal == REMOVE) return;
            if (how == PAUSE && signal == PAUSE) return;
            if (how == PAUSE) pauseReason = reason;
            signal = how;
            lock.notifyAll();
        }
        // Чтение висит в сокете: оборвать соединение, поток увидит сигнал.
        // Отдельным потоком: зовут и из главного (кнопка уведомления), а закрытие
        // сокета — сетевая операция.
        HttpURLConnection c = current;
        if (c != null) {
            Thread t = new Thread(() -> {
                try {
                    c.disconnect();
                } catch (Exception ignored) {
                    // Уже закрыто.
                }
            }, "offline-stop");
            t.start();
        }
    }

    private void checkStopped() throws DlException {
        if (signal != RUN) throw new DlException("stopped");
    }

    private void waitMs(long ms) throws DlException {
        long until = System.currentTimeMillis() + ms;
        synchronized (lock) {
            while (signal == RUN) {
                long left = until - System.currentTimeMillis();
                if (left <= 0) break;
                try {
                    lock.wait(left);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new DlException("stopped");
                }
            }
        }
        checkStopped();
    }

    /** Код ошибки открытия соединения: Tor включён, но не готов — пауза до него. */
    private static boolean torNotReady(IOException e) {
        String m = e.getMessage();
        return m != null && m.startsWith("tor_not_ready");
    }

    private HttpURLConnection open(String url, int timeoutMs) throws DlException {
        HttpURLConnection conn;
        try {
            conn = net.open(url);
        } catch (IOException e) {
            if (torNotReady(e)) throw new DlException("tor_not_ready");
            throw new DlException("network", e.getMessage());
        }
        conn.setConnectTimeout(timeoutMs);
        conn.setReadTimeout(timeoutMs);
        conn.setInstanceFollowRedirects(true);
        conn.setUseCaches(false);
        conn.setRequestProperty("User-Agent", USER_AGENT);
        // Без сжатия: иначе длина ответа — не длина файла.
        conn.setRequestProperty("Accept-Encoding", "identity");
        return conn;
    }

    /** Небольшой файл целиком — обложка, субтитры, суммы. null — не вышло. */
    @Nullable
    byte[] fetchSmall(String url, long max) throws DlException {
        long deadline = System.currentTimeMillis() + SMALL_TIMEOUT_MS;
        HttpURLConnection conn = open(url, SMALL_TIMEOUT_MS);
        current = conn;
        try {
            int status = conn.getResponseCode();
            if (status < 200 || status > 299) {
                log("small " + status + " " + url);
                return null;
            }
            if (conn.getContentLengthLong() > max) return null;
            try (InputStream in = conn.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[16 * 1024];
                long total = 0;
                int n;
                while ((n = in.read(buf)) != -1) {
                    checkStopped();
                    total += n;
                    if (total > max || System.currentTimeMillis() > deadline) return null;
                    out.write(buf, 0, n);
                }
                return out.toByteArray();
            }
        } catch (IOException e) {
            checkStopped();
            log("small failed: " + e.getMessage());
            return null;
        } finally {
            current = null;
            conn.disconnect();
        }
    }

    /** Обложка, аватар и субтитры — по возможности: без них ролик всё равно играет. */
    private void fetchExtras() throws DlException {
        for (OfflineStore.Extra extra : job.extras) {
            checkStopped();
            File dest = new File(dir, extra.name);
            if (dest.isFile()) continue;
            byte[] body = fetchSmall(extra.url, EXTRA_MAX);
            if (body != null && extra.name.equals(OfflinePlaylist.NAME)) {
                // Только наш файл: имя с ноды → video.mp4, чужие адреса — отказ.
                String playlist = OfflinePlaylist.rewrite(new String(body, StandardCharsets.UTF_8), job.fileName);
                body = playlist != null ? playlist.getBytes(StandardCharsets.UTF_8) : null;
            }
            if (body == null) {
                log(extra.name + " skipped");
                continue;
            }
            File parent = dest.getParentFile();
            if (parent != null) //noinspection ResultOfMethodCallIgnored
                parent.mkdirs();
            File tmp = new File(dest.getPath() + ".tmp");
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                out.write(body);
            } catch (IOException e) {
                //noinspection ResultOfMethodCallIgnored
                tmp.delete();
                continue;
            }
            //noinspection ResultOfMethodCallIgnored
            tmp.renameTo(dest);
        }
    }

    /** Суммы фрагментов: с диска, а нет — с ноды. Не вышло — без проверки. */
    static List<HashRange> loadHashes(OfflineDownloader d) {
        File saved = new File(d.dir, OfflineStore.HASHES);
        if (saved.isFile()) {
            try {
                JSONArray arr = new JSONArray(new String(OfflineStore.readBytes(saved, HASHES_MAX * 2), StandardCharsets.UTF_8));
                List<HashRange> ranges = new ArrayList<>();
                for (int i = 0; i < arr.length(); i++) {
                    JSONArray r = arr.getJSONArray(i);
                    ranges.add(new HashRange(r.getLong(0), r.getLong(1), r.getString(2)));
                }
                return ranges;
            } catch (Exception e) {
                // Битый файл — возьмём с ноды заново.
            }
        }
        for (String url : d.job.sha256Urls) {
            byte[] body;
            try {
                body = d.fetchSmall(url, HASHES_MAX);
            } catch (DlException e) {
                // Остановили или Tor не готов — главный цикл увидит это сам.
                return new ArrayList<>();
            }
            if (body == null) continue;
            List<HashRange> ranges = parseHashes(body, d.job.fileName);
            if (ranges == null) {
                log("no hashes for " + d.job.fileName + " at " + url);
                continue;
            }
            // Тот же вид, что у компьютера: [[начало, конец, "sha"], …].
            JSONArray arr = new JSONArray();
            for (HashRange r : ranges) {
                JSONArray one = new JSONArray();
                one.put(r.start);
                one.put(r.end);
                one.put(r.sha);
                arr.put(one);
            }
            try {
                OfflineStore.writeJson(saved, arr);
            } catch (IOException ignored) {
                // Без кэша — скачаем суммы ещё раз в следующий раз.
            }
            return ranges;
        }
        return new ArrayList<>();
    }

    private static final int DONE = 0;
    private static final int RESTART = 1;

    /** Сетевой сбой куска: повторить (или следующий адрес). */
    private static final class NetworkError extends Exception {
        NetworkError(String m) {
            super(m);
        }
    }

    /** Файла по адресу нет (404/410). */
    private static final class NotFound extends Exception {}

    private void restartFrom(long pos) throws DlException {
        RandomAccessFile f = file;
        try {
            if (f != null) {
                f.setLength(pos);
                f.seek(pos);
            }
        } catch (IOException e) {
            throw writeError(e);
        }
        state.received = pos;
    }

    private DlException writeError(IOException e) {
        if (isDiskFull(e, dir)) return new DlException("disk_full");
        return new DlException("io", e.getMessage());
    }

    /** Ошибка записи — кончилось место (ENOSPC). */
    static boolean isDiskFull(IOException e, File dir) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            String m = t.getMessage();
            if (m != null && (m.contains("ENOSPC") || m.contains("No space left"))) return true;
        }
        // Причина бывает спрятана; почти пустой диск — тоже «кончилось место».
        return dir.getUsableSpace() < MB;
    }

    private int fetchChunk(String url) throws DlException, NetworkError, NotFound {
        long start = state.received;
        long end = state.total > 0
                ? Math.min(start + policy.chunk - 1, state.total - 1)
                : start + policy.chunk - 1;
        HttpURLConnection conn = open(url, policy.stallMs);
        conn.setRequestProperty("Range", "bytes=" + start + "-" + end);
        current = conn;
        boolean clean = false;
        InputStream in = null;
        try {
            checkStopped();
            int status;
            try {
                status = conn.getResponseCode();
            } catch (IOException e) {
                checkStopped();
                throw new NetworkError(e instanceof SocketTimeoutException ? "stalled" : String.valueOf(e.getMessage()));
            }
            if (status == 404 || status == 410) throw new NotFound();
            if (status < 200 || status > 299) throw new NetworkError("http " + status);

            // 206 — кусок с start; 200 — нода не умеет Range и шлёт файл с начала.
            long skip;
            long total;
            if (status == 206) {
                long[] range = parseContentRange(conn.getHeaderField("Content-Range"));
                if (range == null || range[0] != start) throw new NetworkError("bad content-range");
                skip = 0;
                total = range[1];
            } else {
                skip = start;
                total = Math.max(0, conn.getContentLengthLong());
            }
            if (total > 0 && state.total > 0 && total != state.total && start > 0) {
                // Файл на ноде другой: прежнее скачанное к нему не подходит.
                log("size changed " + state.total + " -> " + total + ", starting over");
                state.total = total;
                restartFrom(0);
                if (verifier != null) verifier.seek(0);
                return RESTART;
            }
            if (total > 0) state.total = total;

            try {
                in = conn.getInputStream();
            } catch (IOException e) {
                checkStopped();
                throw new NetworkError(String.valueOf(e.getMessage()));
            }
            byte[] buf = new byte[64 * 1024];
            long sincePersist = 0;
            while (true) {
                checkStopped();
                int n;
                try {
                    n = in.read(buf);
                } catch (IOException e) {
                    checkStopped();
                    throw new NetworkError(e instanceof SocketTimeoutException ? "stalled" : String.valueOf(e.getMessage()));
                }
                if (n == -1) break;
                int off = 0;
                int len = n;
                if (skip > 0) {
                    int s = (int) Math.min(skip, len);
                    skip -= s;
                    off += s;
                    len -= s;
                }
                if (state.total > 0) {
                    long room = Math.max(0, state.total - state.received);
                    if (len > room) len = (int) room;
                }
                while (len > 0) {
                    long pos = state.received;
                    int piece = verifier != null ? verifier.piece(pos, len) : len;
                    try {
                        //noinspection ConstantConditions
                        file.write(buf, off, piece);
                    } catch (IOException e) {
                        throw writeError(e);
                    }
                    state.received += piece;
                    sincePersist += piece;
                    long retry;
                    try {
                        retry = verifier != null ? verifier.absorb(pos, buf, off, piece) : -1;
                    } catch (DlException e) {
                        // Дважды не сошлось: побитый фрагмент — вон из файла, иначе
                        // «Повторить» продолжило бы после него, и он остался бы в ролике.
                        restartFrom(verifier.badStart);
                        report.report(state, true);
                        throw e;
                    }
                    off += piece;
                    len -= piece;
                    if (retry >= 0) {
                        restartFrom(retry);
                        report.report(state, true);
                        return RESTART;
                    }
                }
                if (sincePersist >= policy.chunk) {
                    // Нода без Range шлёт файл целиком — сохраняемся по ходу.
                    report.report(state, true);
                    sincePersist = 0;
                } else {
                    report.report(state, false);
                }
                if (state.total > 0 && state.received >= state.total) break;
            }
            clean = true;
            if (state.received == start && !(state.total > 0 && state.received >= state.total)) {
                // Ответ без единого байта посреди файла — сбой сети (повторы с
                // паузой и следующим адресом), иначе крутились бы на месте.
                throw new NetworkError("empty response");
            }
            return DONE;
        } finally {
            current = null;
            if (in != null) {
                try {
                    in.close();
                } catch (IOException ignored) {
                    // Соединение закроется ниже.
                }
            }
            if (!clean) conn.disconnect();
        }
    }

    /**
     * Скачать ролик в {@code dir} до {@code video.mp4}. {@code state} — с прошлого
     * раза (или новый); по ходу уходит в {@code report}.
     */
    void run() throws DlException {
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        if (new File(dir, OfflineStore.VIDEO).isFile()) return;
        fetchExtras();
        checkStopped();
        List<HashRange> ranges = hashes.load(this);
        checkStopped();

        File part = new File(dir, OfflineStore.PART);
        try {
            file = new RandomAccessFile(part, "rw");
        } catch (IOException e) {
            throw writeError(e);
        }
        try {
            long onDisk;
            try {
                onDisk = file.length();
            } catch (IOException e) {
                throw writeError(e);
            }
            if (state.total == 0) state.total = job.size;
            long resume = snapToFragment(ranges, Math.min(state.received, onDisk));
            restartFrom(resume);

            long available = free.bytes();
            if (available >= 0) {
                long needed = Math.max(0, state.total - state.received) + SPARE;
                if (available < needed) throw new DlException("no_space");
            }

            verifier = new Verifier(ranges, resume);
            List<String> sources = job.sources;
            int source = 0;
            int failures = 0;
            Set<Integer> missing = new HashSet<>();
            while (true) {
                checkStopped();
                if (state.total > 0 && state.received >= state.total) break;
                int index = source % sources.size();
                try {
                    int outcome = fetchChunk(sources.get(index));
                    if (outcome == DONE) {
                        failures = 0;
                        missing.clear();
                        report.report(state, true);
                        // Размер так и не узнали, а нода всё отдала.
                        if (state.total == 0) break;
                    }
                } catch (NotFound e) {
                    missing.add(index);
                    if (missing.size() >= sources.size()) throw new DlException("not_found");
                    source++;
                } catch (NetworkError e) {
                    report.report(state, true);
                    if (failures >= policy.retryDelaysMs.length) throw new DlException("network", e.getMessage());
                    long delay = policy.retryDelaysMs[failures];
                    log(job.id + " failed: " + e.getMessage() + "; retry in " + delay + " ms");
                    failures++;
                    source++;
                    waitMs(delay);
                } catch (DlException e) {
                    report.report(state, true);
                    throw e;
                }
            }
            if (!verifier.complete()) {
                // Файл кончился раньше фрагментов из сумм — это не тот файл.
                // Непроверенный хвост — вон: «Повторить» скачает его заново.
                restartFrom(verifier.uncheckedStart());
                report.report(state, true);
                throw new DlException("hash_mismatch");
            }
            try {
                file.getFD().sync();
            } catch (IOException e) {
                throw writeError(e);
            }
        } finally {
            try {
                file.close();
            } catch (IOException ignored) {
                // Всё записанное уже ушло в файл.
            }
            file = null;
        }
        if (!part.renameTo(new File(dir, OfflineStore.VIDEO))) throw new DlException("io", "rename");
        //noinspection ResultOfMethodCallIgnored
        new File(dir, OfflineStore.HASHES).delete();
    }

    /** В журнал Android; в тестах на JVM журнала нет — молчим. */
    static void log(String message) {
        try {
            android.util.Log.i("OfflineVideo", message);
        } catch (Throwable ignored) {
            // Заглушка android.jar в тестах.
        }
    }
}
