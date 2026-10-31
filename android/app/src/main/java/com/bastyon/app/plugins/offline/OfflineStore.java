package com.bastyon.app.plugins.offline;

import android.content.Context;

import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;

/**
 * Папка скачанного ролика: {@code filesDir/offline/<id>/}. Тот же вид, что у
 * компьютера (src-tauri/src/offline/store.rs) и веба:
 * <ul>
 *   <li>{@code video.mp4} — ролик, на время загрузки {@code video.mp4.part};</li>
 *   <li>{@code thumb.jpg}, {@code avatar.jpg}, {@code captions/<язык>.vtt} —
 *       обложка, аватар автора, субтитры;</li>
 *   <li>{@code playlist.m3u8} — плейлист качества для ExoPlayer, ссылается
 *       только на {@code video.mp4};</li>
 *   <li>{@code meta.json} — что показать без сети; пишет страница, здесь его
 *       не разбирают (кроме {@code id});</li>
 *   <li>{@code state.json} — ход загрузки;</li>
 *   <li>{@code job.json} — откуда качать, чтобы продолжить после перезапуска;</li>
 *   <li>{@code sha256.json} — суммы фрагментов этого файла с ноды.</li>
 * </ul>
 * Папка личная (медиасканер её не видит), облачная копия у приложения
 * выключена (allowBackup=false).
 */
final class OfflineStore {
    static final String VIDEO = "video.mp4";
    static final String PART = "video.mp4.part";
    static final String META = "meta.json";
    static final String STATE = "state.json";
    static final String JOB = "job.json";
    static final String HASHES = "sha256.json";

    static final String QUEUED = "queued";
    static final String DOWNLOADING = "downloading";
    static final String PAUSED = "paused";
    static final String FAILED = "failed";
    static final String DONE = "done";

    private static final List<String> STATUSES = Arrays.asList(QUEUED, DOWNLOADING, PAUSED, FAILED, DONE);

    private OfflineStore() {}

    static File root(Context context) {
        return new File(context.getFilesDir(), "offline");
    }

    static File dir(File root, String id) {
        return new File(root, id);
    }

    // ─── Проверки: ничего, что уведёт путь из папки ───────────────────────

    private static boolean safeChars(String s) {
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            boolean ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
                    || c == '-' || c == '_';
            if (!ok) return false;
        }
        return true;
    }

    /** {@code <uuid>-<высота>}: буквы, цифры, {@code -} и {@code _}, не длиннее 100. */
    static boolean validId(@Nullable String id) {
        return id != null && !id.isEmpty() && id.length() <= 100 && safeChars(id);
    }

    /**
     * Имена дополнительных файлов, которые можно скачать и отдать странице.
     * {@code playlist.m3u8} — плейлист качества для ExoPlayer (только Android,
     * см. OfflinePlaylist).
     */
    static boolean validExtraName(@Nullable String name) {
        if (name == null) return false;
        if (name.equals("thumb.jpg") || name.equals("avatar.jpg") || name.equals(OfflinePlaylist.NAME)) return true;
        if (!name.startsWith("captions/") || !name.endsWith(".vtt")) return false;
        int from = "captions/".length();
        int to = name.length() - ".vtt".length();
        if (to <= from) return false;
        String lang = name.substring(from, to);
        return lang.length() <= 32 && safeChars(lang);
    }

    static boolean validUrl(@Nullable String url) {
        if (url == null) return false;
        try {
            URI u = new URI(url);
            String scheme = u.getScheme();
            if (scheme == null) return false;
            scheme = scheme.toLowerCase(Locale.ROOT);
            String host = u.getHost();
            return (scheme.equals("https") || scheme.equals("http")) && host != null && !host.isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    // ─── Состояние и задание ──────────────────────────────────────────────

    /** {@code state.json}: {@code {status, received, total, error?}}. */
    static final class State {
        String status;
        /** Скачано подряд с начала файла. */
        long received;
        /** Размер файла; 0 — ещё не известен. */
        long total;
        /** Причина паузы или сбоя (коды — как у компьютера). */
        @Nullable String error;

        State(String status, long received, long total, @Nullable String error) {
            this.status = status;
            this.received = received;
            this.total = total;
            this.error = error;
        }

        static State queued(long total) {
            return new State(QUEUED, 0, total, null);
        }

        State copy() {
            return new State(status, received, total, error);
        }
    }

    static final class Extra {
        final String name;
        final String url;

        Extra(String name, String url) {
            this.name = name;
            this.url = url;
        }
    }

    /** Что качать ({@code OfflineJob} в types.ts). Собирает страница. */
    static final class Job {
        final String id;
        /** Адреса одного файла по порядку: рядом с плейлистом, исходная нода, архив. */
        final List<String> sources;
        /** Имя файла в ответе {@code segmentsSha256Url}. */
        final String fileName;
        final List<String> sha256Urls;
        final List<Extra> extras;
        /** Размер из описания ролика; точный приходит в {@code Content-Range}. */
        final long size;

        Job(String id, List<String> sources, String fileName, List<String> sha256Urls, List<Extra> extras, long size) {
            this.id = id;
            this.sources = sources;
            this.fileName = fileName;
            this.sha256Urls = sha256Urls;
            this.extras = extras;
            this.size = size;
        }

        /** Код ошибки, как у компьютера, или null — задание годное. */
        @Nullable
        String validate() {
            if (!validId(id)) return "invalid_id";
            if (sources.isEmpty()) return "invalid_sources";
            for (String u : sources) if (!validUrl(u)) return "invalid_sources";
            for (String u : sha256Urls) if (!validUrl(u)) return "invalid_sources";
            for (Extra e : extras) if (!validExtraName(e.name) || !validUrl(e.url)) return "invalid_extras";
            return null;
        }
    }

    // ─── JSON ─────────────────────────────────────────────────────────────

    static JSONObject stateJson(State s) throws JSONException {
        JSONObject o = new JSONObject();
        o.put("status", s.status);
        o.put("received", s.received);
        o.put("total", s.total);
        if (s.error != null) o.put("error", s.error);
        return o;
    }

    @Nullable
    static State parseState(@Nullable JSONObject o) {
        if (o == null) return null;
        String status = o.optString("status", "");
        if (!STATUSES.contains(status)) return null;
        String error = o.isNull("error") ? null : o.optString("error", null);
        return new State(status, Math.max(0, o.optLong("received", 0)), Math.max(0, o.optLong("total", 0)), error);
    }

    static JSONObject jobJson(Job job) throws JSONException {
        JSONObject o = new JSONObject();
        o.put("id", job.id);
        o.put("sources", new JSONArray(job.sources));
        o.put("fileName", job.fileName);
        o.put("sha256Urls", new JSONArray(job.sha256Urls));
        JSONArray extras = new JSONArray();
        for (Extra e : job.extras) {
            JSONObject x = new JSONObject();
            x.put("name", e.name);
            x.put("url", e.url);
            extras.put(x);
        }
        o.put("extras", extras);
        o.put("size", job.size);
        return o;
    }

    /** Задание из JSON (страницы или {@code job.json}); null — не задание. */
    @Nullable
    static Job parseJob(@Nullable JSONObject o) {
        if (o == null) return null;
        Object id = o.opt("id");
        Object fileName = o.opt("fileName");
        Object size = o.opt("size");
        JSONArray sources = o.optJSONArray("sources");
        if (!(id instanceof String) || !(fileName instanceof String) || !(size instanceof Number) || sources == null) {
            return null;
        }
        List<String> sourceList = strings(sources);
        List<String> shaList = strings(o.optJSONArray("sha256Urls"));
        if (sourceList == null || shaList == null) return null;
        List<Extra> extras = new ArrayList<>();
        JSONArray rawExtras = o.optJSONArray("extras");
        if (rawExtras != null) {
            for (int i = 0; i < rawExtras.length(); i++) {
                JSONObject x = rawExtras.optJSONObject(i);
                if (x == null || !(x.opt("name") instanceof String) || !(x.opt("url") instanceof String)) return null;
                extras.add(new Extra(x.optString("name"), x.optString("url")));
            }
        }
        // optLong, а не getLong у PluginCall: число из JS приходит и как Integer.
        long bytes = Math.max(0, ((Number) size).longValue());
        return new Job((String) id, sourceList, (String) fileName, shaList, extras, bytes);
    }

    @Nullable
    private static List<String> strings(@Nullable JSONArray arr) {
        List<String> out = new ArrayList<>();
        if (arr == null) return out;
        for (int i = 0; i < arr.length(); i++) {
            Object v = arr.opt(i);
            if (!(v instanceof String)) return null;
            out.add((String) v);
        }
        return out;
    }

    // ─── Файлы ────────────────────────────────────────────────────────────

    static byte[] readBytes(File file, long max) throws IOException {
        try (InputStream in = new FileInputStream(file)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16 * 1024];
            long total = 0;
            int n;
            while ((n = in.read(buf)) != -1) {
                total += n;
                if (total > max) throw new IOException("too_large");
                out.write(buf, 0, n);
            }
            return out.toByteArray();
        }
    }

    @Nullable
    static JSONObject readJsonObject(File file) {
        try {
            return new JSONObject(new String(readBytes(file, 8L * 1024 * 1024), StandardCharsets.UTF_8));
        } catch (Exception e) {
            return null;
        }
    }

    /** Через временный файл: оборванная запись не оставит пол-JSON. */
    static void writeAtomic(File file, byte[] bytes) throws IOException {
        File tmp = new File(file.getParentFile(), file.getName() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(bytes);
            out.getFD().sync();
        }
        if (!tmp.renameTo(file)) {
            //noinspection ResultOfMethodCallIgnored
            tmp.delete();
            throw new IOException("rename failed: " + file.getName());
        }
    }

    static void writeJson(File file, Object json) throws IOException {
        writeAtomic(file, json.toString().getBytes(StandardCharsets.UTF_8));
    }

    @Nullable
    static State readState(File dir) {
        return parseState(readJsonObject(new File(dir, STATE)));
    }

    static void writeState(File dir, State state) throws IOException {
        try {
            writeJson(new File(dir, STATE), stateJson(state));
        } catch (JSONException e) {
            throw new IOException(e);
        }
    }

    @Nullable
    static Job readJob(File dir) {
        return parseJob(readJsonObject(new File(dir, JOB)));
    }

    static void writeJob(File dir, Job job) throws IOException {
        try {
            writeJson(new File(dir, JOB), jobJson(job));
        } catch (JSONException e) {
            throw new IOException(e);
        }
    }

    @Nullable
    static JSONObject readMeta(File dir) {
        return readJsonObject(new File(dir, META));
    }

    static void writeMeta(File dir, JSONObject meta) throws IOException {
        writeJson(new File(dir, META), meta);
    }

    /** {@code {id, meta, state}}; null — нет такого (или постановка не дописана). */
    @Nullable
    static JSONObject readItem(File root, String id) {
        File dir = dir(root, id);
        JSONObject meta = readMeta(dir);
        if (meta == null) return null;
        State state = readState(dir);
        if (state == null) {
            // Состояние потерялось: готовый файл — скачан, иначе — сбой.
            File video = new File(dir, VIDEO);
            state = video.isFile()
                    ? new State(DONE, video.length(), video.length(), null)
                    : new State(FAILED, 0, 0, "io");
        }
        try {
            JSONObject item = new JSONObject();
            item.put("id", id);
            item.put("meta", meta);
            item.put("state", stateJson(state));
            return item;
        } catch (JSONException e) {
            return null;
        }
    }

    /** Папки роликов с годными именами, по порядку. */
    static List<String> ids(File root) {
        List<String> out = new ArrayList<>();
        File[] entries = root.listFiles();
        if (entries == null) return out;
        for (File f : entries) {
            if (f.isDirectory() && validId(f.getName())) out.add(f.getName());
        }
        java.util.Collections.sort(out);
        return out;
    }

    /** Все ролики. Без {@code meta.json} — недописанная постановка, её не видно. */
    static List<JSONObject> list(File root) {
        List<JSONObject> items = new ArrayList<>();
        for (String id : ids(root)) {
            JSONObject item = readItem(root, id);
            if (item != null) items.add(item);
        }
        return items;
    }

    /** Слить поля в {@code meta.json}: null убирает поле, {@code id} не меняется. */
    static JSONObject patchMeta(File dir, JSONObject patch) throws OfflineException {
        JSONObject meta = readMeta(dir);
        if (meta == null) throw new OfflineException("not_found");
        try {
            Iterator<String> keys = patch.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                if (key.equals("id")) continue;
                if (patch.isNull(key)) meta.remove(key);
                else meta.put(key, patch.get(key));
            }
            writeMeta(dir, meta);
        } catch (JSONException | IOException e) {
            throw new OfflineException("io");
        }
        return meta;
    }

    static long dirSize(File f) {
        if (f.isFile()) return f.length();
        File[] children = f.listFiles();
        if (children == null) return 0;
        long sum = 0;
        for (File c : children) sum += dirSize(c);
        return sum;
    }

    static boolean deleteRecursive(File f) {
        File[] children = f.listFiles();
        if (children != null) {
            for (File c : children) deleteRecursive(c);
        }
        return f.delete() || !f.exists();
    }

    /** Ошибка с кодом для страницы: {@code invalid_id}, {@code not_found}, … */
    static final class OfflineException extends Exception {
        final String code;

        OfflineException(String code) {
            super(code);
            this.code = code;
        }
    }
}
