package com.bastyon.app.plugins.offline;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.StatFs;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.Nullable;

import com.bastyon.app.plugins.tor.TorNetwork;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Очередь скачанных роликов на Android — то же, что OfflineManager у
 * компьютера (src-tauri/src/offline/mod.rs). Список ведёт тот, кто качает:
 * страница только читает его (OfflineVideoPlugin) и подписана на события.
 *
 * <ul>
 *   <li>Качается один ролик за раз, остальные ждут. Пока есть ждущие или
 *       качающийся, работает служба переднего плана OfflineDownloadService —
 *       загрузка переживает закрытие приложения.</li>
 *   <li>После запуска качавшееся и ждавшее продолжается само, чуть погодя.</li>
 *   <li>Сеть — только {@code HttpURLConnection} с {@code TorNetwork.proxy()}:
 *       Tor включён и не готов — пауза с {@code tor_not_ready}, страница
 *       продолжит, когда он поднимется.</li>
 *   <li>«Только по Wi-Fi» (по умолчанию включено): нет безлимитной сети — пауза
 *       с {@code wifi}; появилась — продолжает само.</li>
 *   <li>Android 15 даёт загрузке переднего плана 6 часов в сутки: кончились —
 *       пауза с {@code quota}, продолжение, когда приложение снова на экране.</li>
 * </ul>
 * Гонки «удалить во время загрузки» — как у компьютера: под замком либо сигнал
 * доходит до загрузки (и она удаляет папку сама в {@link #finish}), либо
 * загрузки уже нет и папку удаляет команда.
 */
final class OfflineManager {
    private static final String TAG = "OfflineVideo";

    interface Listener {
        void onProgress(String id, long received, long total);

        /** {@code item} — null, когда ролик удалён. */
        void onChanged(String id, @Nullable JSONObject item);

        /** Перенос во внутреннюю память или на карту: сколько роликов уже на месте. */
        default void onMoving(int done, int total) {}
    }

    /** Что качается сейчас — для уведомления службы. */
    static final class Current {
        final String id;
        final String title;
        final long received;
        final long total;

        Current(String id, String title, long received, long total) {
            this.id = id;
            this.title = title;
            this.received = received;
            this.total = total;
        }
    }

    /** После запуска не мешаем ему: недокачанное продолжается чуть позже. */
    private static final long RESUME_AFTER_MS = 3_000;
    private static final long PROGRESS_EVERY_MS = 250;
    /** Сеть пропала: столько ждём, не появится ли другая, прежде чем ставить паузу. */
    private static final long NETWORK_SETTLE_MS = 2_000;
    private static final String PREFS = "bastyon_offline";
    private static final String KEY_WIFI_ONLY = "wifi_only";
    /** Где скачанное: {@link OfflineLocation#INTERNAL} или {@link OfflineLocation#SD}. */
    private static final String KEY_STORAGE = "storage";
    /** Сколько ждать, пока загрузка встанет перед переносом. */
    private static final long STOP_WAIT_MS = 30_000;

    static final String ERR_WIFI = "wifi";
    static final String ERR_QUOTA = "quota";
    static final String ERR_TOR = "tor_not_ready";

    @Nullable private static OfflineManager instance;

    static synchronized OfflineManager get(Context context) {
        if (instance == null) instance = new OfflineManager(context.getApplicationContext());
        return instance;
    }

    private final Context app;
    /** Папка со скачанным сейчас; меняет только перенос. */
    private volatile File root;
    /** Выбрана карта, а её нет на месте: качаем во внутреннюю. */
    private volatile boolean sdUnavailable;
    /** Идёт перенос: загрузки не запускаются, список не меняется. */
    private volatile boolean moving;
    private final SharedPreferences prefs;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final CopyOnWriteArrayList<Listener> listeners = new CopyOnWriteArrayList<>();

    private final ArrayDeque<String> queue = new ArrayDeque<>();
    @Nullable private String runningId;
    @Nullable private OfflineDownloader running;
    private String runningTitle = "";

    private volatile boolean wifiOnly;
    private volatile boolean unmetered;
    /** Последнее применённое «есть безлимитная сеть»; null — ещё не применяли. */
    @Nullable private Boolean appliedNetwork;

    private OfflineManager(Context app) {
        this.app = app;
        // Служба может подняться и без окна (система перезапустила процесс), а
        // окно настраивает Tor в MainActivity. Без этого «Tor включён» не был бы
        // прочитан, и загрузка ушла бы мимо него.
        if (!TorNetwork.available()) TorNetwork.init(app);
        prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        File sd = OfflineLocation.SD.equals(prefs.getString(KEY_STORAGE, OfflineLocation.INTERNAL))
                ? OfflineLocation.sdRoot(app) : null;
        sdUnavailable = sd == null && OfflineLocation.SD.equals(prefs.getString(KEY_STORAGE, null));
        root = sd != null ? sd : OfflineLocation.internalRoot(app);
        //noinspection ResultOfMethodCallIgnored
        root.mkdirs();
        wifiOnly = prefs.getBoolean(KEY_WIFI_ONLY, true);
        for (String id : OfflineStore.ids(root)) {
            File dir = dir(id);
            if (OfflineStore.readMeta(dir) == null) continue;
            OfflineStore.State s = OfflineStore.readState(dir);
            // Качалось или ждало при выходе — продолжим.
            if (s != null && (OfflineStore.QUEUED.equals(s.status) || OfflineStore.DOWNLOADING.equals(s.status))) {
                s.status = OfflineStore.QUEUED;
                writeStateQuietly(dir, s);
                queue.add(id);
            }
        }
        unmetered = currentlyUnmetered();
        watchNetwork();
        main.postDelayed(() -> {
            applyNetwork(currentlyUnmetered());
            pump();
        }, RESUME_AFTER_MS);
    }

    File dir(String id) {
        return OfflineStore.dir(root, id);
    }

    /** Папка со скачанным — для WebView и ExoPlayer. */
    File root() {
        return root;
    }

    private void notMoving() throws OfflineStore.OfflineException {
        if (moving) throw new OfflineStore.OfflineException("moving");
    }

    void addListener(Listener l) {
        listeners.addIfAbsent(l);
    }

    void removeListener(Listener l) {
        listeners.remove(l);
    }

    // ─── Сеть: «только по Wi-Fi» ──────────────────────────────────────────

    private boolean currentlyUnmetered() {
        try {
            ConnectivityManager cm = app.getSystemService(ConnectivityManager.class);
            if (cm == null) return true;
            Network active = cm.getActiveNetwork();
            if (active == null) return false;
            return isUnmetered(cm.getNetworkCapabilities(active));
        } catch (RuntimeException e) {
            // Без разрешения на состояние сети не узнать — не мешаем загрузке.
            return true;
        }
    }

    private static boolean isUnmetered(@Nullable NetworkCapabilities caps) {
        if (caps == null) return false;
        if (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)) return true;
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_TEMPORARILY_NOT_METERED);
    }

    private final Runnable recheckNetwork = () -> applyNetwork(currentlyUnmetered());

    private void watchNetwork() {
        try {
            ConnectivityManager cm = app.getSystemService(ConnectivityManager.class);
            if (cm == null) return;
            cm.registerDefaultNetworkCallback(new ConnectivityManager.NetworkCallback() {
                @Override
                public void onCapabilitiesChanged(Network network, NetworkCapabilities caps) {
                    main.removeCallbacks(recheckNetwork);
                    if (isUnmetered(caps)) {
                        applyNetwork(true);
                    } else {
                        main.postDelayed(recheckNetwork, NETWORK_SETTLE_MS);
                    }
                }

                @Override
                public void onLost(Network network) {
                    // Wi-Fi сменился другим Wi-Fi — следом придёт новая сеть.
                    main.removeCallbacks(recheckNetwork);
                    main.postDelayed(recheckNetwork, NETWORK_SETTLE_MS);
                }
            });
        } catch (RuntimeException e) {
            Log.w(TAG, "network callback: " + e);
        }
    }

    /** Безлимитная сеть появилась или пропала. Действует только смена. */
    private void applyNetwork(boolean now) {
        synchronized (this) {
            unmetered = now;
            if (appliedNetwork != null && appliedNetwork == now) return;
            appliedNetwork = now;
        }
        if (!wifiOnly) return;
        if (now) resumePaused(ERR_WIFI);
        else pauseActive(ERR_WIFI);
    }

    /** Сеть сейчас безлимитная (Wi-Fi) — спрашивает страница перед загрузками подписок. */
    boolean unmeteredNow() {
        return currentlyUnmetered();
    }

    private boolean networkAllowed() {
        return !wifiOnly || unmetered;
    }

    void setWifiOnly(boolean on) {
        prefs.edit().putBoolean(KEY_WIFI_ONLY, on).apply();
        wifiOnly = on;
        unmetered = currentlyUnmetered();
        if (!on) resumePaused(ERR_WIFI);
        else if (!unmetered) pauseActive(ERR_WIFI);
    }

    // ─── Очередь ──────────────────────────────────────────────────────────

    synchronized boolean busy() {
        return running != null || !queue.isEmpty();
    }

    @Nullable
    synchronized Current current() {
        OfflineDownloader d = running;
        if (d == null || runningId == null) return null;
        OfflineStore.State s = d.state();
        return new Current(runningId, runningTitle, s.received, s.total);
    }

    /** Запустить ждущий, если ничего не качается. */
    void pump() {
        if (moving) return;
        List<String> changed = new ArrayList<>();
        synchronized (this) {
            while (running == null && !queue.isEmpty()) {
                String id = queue.pollFirst();
                File dir = dir(id);
                OfflineStore.State st = OfflineStore.readState(dir);
                if (st == null || !OfflineStore.QUEUED.equals(st.status)) continue;
                if (!networkAllowed()) {
                    // Только по Wi-Fi, а его нет: ждут все, продолжат сами.
                    queue.addFirst(id);
                    changed.addAll(pauseQueuedLocked(ERR_WIFI));
                    break;
                }
                OfflineStore.Job job = OfflineStore.readJob(dir);
                if (job == null) {
                    st.status = OfflineStore.FAILED;
                    st.error = "io";
                    writeStateQuietly(dir, st);
                    changed.add(id);
                    continue;
                }
                start(id, dir, job, st);
            }
        }
        for (String id : changed) emitChanged(id);
        updateService();
    }

    /** Под замком. */
    private void start(String id, File dir, OfflineStore.Job job, OfflineStore.State st) {
        JSONObject meta = OfflineStore.readMeta(dir);
        runningTitle = meta != null ? meta.optString("title", "") : "";
        final long[] lastProgress = {0};
        OfflineDownloader.Report report = (s, persist) -> {
            if (persist) writeStateQuietly(dir, s);
            long now = SystemClock.elapsedRealtime();
            if (now - lastProgress[0] >= PROGRESS_EVERY_MS) {
                lastProgress[0] = now;
                emitProgress(id, s.received, s.total);
            }
        };
        OfflineDownloader.Net net = url -> (HttpURLConnection) new URL(url).openConnection(TorNetwork.proxy());
        OfflineDownloader.FreeSpace free = () -> freeBytes(dir);
        OfflineDownloader d = new OfflineDownloader(net, OfflineDownloader.Policy.standard(), dir, job,
                st.copy(), report, free, OfflineDownloader::loadHashes);
        running = d;
        runningId = id;
        Thread t = new Thread(() -> runTask(id, dir, d), "offline-" + id);
        t.setPriority(Thread.NORM_PRIORITY - 1);
        t.start();
    }

    private void runTask(String id, File dir, OfflineDownloader d) {
        OfflineStore.State state = d.state();
        state.status = OfflineStore.DOWNLOADING;
        state.error = null;
        writeStateQuietly(dir, state);
        emitChanged(id);
        String status;
        String error = null;
        try {
            // Tor включён, но не готов — запрос не начинается вовсе.
            TorNetwork.proxy();
            d.run();
            status = OfflineStore.DONE;
        } catch (IOException e) {
            status = OfflineStore.PAUSED;
            error = ERR_TOR;
        } catch (OfflineDownloader.DlException e) {
            switch (e.code) {
                case "stopped":
                    status = OfflineStore.PAUSED;
                    error = d.pauseReason();
                    break;
                case "disk_full":
                case ERR_TOR:
                    status = OfflineStore.PAUSED;
                    error = e.code;
                    break;
                default:
                    Log.w(TAG, id + ": " + e.getMessage());
                    status = OfflineStore.FAILED;
                    error = e.code;
            }
        } catch (RuntimeException e) {
            Log.e(TAG, id + ": " + e, e);
            status = OfflineStore.FAILED;
            error = "io";
        }
        finish(id, dir, d, status, error);
        pump();
    }

    /** Итог загрузки — под замком (см. описание класса). */
    private void finish(String id, File dir, OfflineDownloader d, String status, @Nullable String error) {
        synchronized (this) {
            if (running == d) {
                running = null;
                runningId = null;
                runningTitle = "";
            }
            if (d.signal() == OfflineDownloader.REMOVE) {
                OfflineStore.deleteRecursive(dir);
            } else {
                OfflineStore.State state = d.state();
                if (OfflineStore.DONE.equals(status)) {
                    state.received = Math.max(state.total, state.received);
                    state.total = state.received;
                    state.error = null;
                } else {
                    state.error = error;
                }
                state.status = status;
                if (dir.isDirectory()) writeStateQuietly(dir, state);
            }
        }
        emitChanged(id);
    }

    /** Под замком: ждущие — на паузу с причиной. Возвращает, что поменялось. */
    private List<String> pauseQueuedLocked(@Nullable String reason) {
        List<String> changed = new ArrayList<>();
        for (String id : queue) {
            File dir = dir(id);
            OfflineStore.State st = OfflineStore.readState(dir);
            if (st != null && OfflineStore.QUEUED.equals(st.status)) {
                st.status = OfflineStore.PAUSED;
                st.error = reason;
                writeStateQuietly(dir, st);
                changed.add(id);
            }
        }
        queue.clear();
        return changed;
    }

    /** Качающийся и ждущие — на паузу с причиной ({@code wifi}, {@code quota}). */
    void pauseActive(String reason) {
        List<String> changed;
        synchronized (this) {
            if (running != null) running.stop(OfflineDownloader.PAUSE, reason);
            changed = pauseQueuedLocked(reason);
        }
        for (String id : changed) emitChanged(id);
        updateService();
    }

    /** Стоящие на паузе с этой причиной — снова в очередь. */
    void resumePaused(String reason) {
        List<String> changed = new ArrayList<>();
        synchronized (this) {
            for (String id : OfflineStore.ids(root)) {
                if (id.equals(runningId) || queue.contains(id)) continue;
                File dir = dir(id);
                OfflineStore.State st = OfflineStore.readState(dir);
                if (st == null || !OfflineStore.PAUSED.equals(st.status) || !reason.equals(st.error)) continue;
                st.status = OfflineStore.QUEUED;
                st.error = null;
                writeStateQuietly(dir, st);
                queue.add(id);
                changed.add(id);
            }
        }
        for (String id : changed) emitChanged(id);
        if (!changed.isEmpty()) pump();
    }

    /** Приложение снова на экране: суточное время Android 15 начато заново. */
    void onForeground() {
        resumePaused(ERR_QUOTA);
        updateService();
    }

    private void updateService() {
        if (busy()) OfflineDownloadService.ensureStarted(app);
    }

    // ─── Команды страницы ─────────────────────────────────────────────────

    private static void checkId(String id) throws OfflineStore.OfflineException {
        if (!OfflineStore.validId(id)) throw new OfflineStore.OfflineException("invalid_id");
    }

    List<JSONObject> list() {
        return OfflineStore.list(root);
    }

    /** Поставить в очередь. Уже есть — вернуть как есть (аккаунт допишет страница). */
    JSONObject enqueue(OfflineStore.Job job, JSONObject meta) throws OfflineStore.OfflineException {
        notMoving();
        String invalid = job.validate();
        if (invalid != null) throw new OfflineStore.OfflineException(invalid);
        synchronized (this) {
            JSONObject existing = OfflineStore.readItem(root, job.id);
            if (existing != null) return existing;
            File dir = dir(job.id);
            if (!dir.mkdirs() && !dir.isDirectory()) throw new OfflineStore.OfflineException("io");
            try {
                meta.put("id", job.id);
                OfflineStore.writeJob(dir, job);
                OfflineStore.writeState(dir, OfflineStore.State.queued(job.size));
                // meta.json последним: без него папку не видно в списке.
                OfflineStore.writeMeta(dir, meta);
            } catch (JSONException | IOException e) {
                throw new OfflineStore.OfflineException("io");
            }
            if (!queue.contains(job.id) && !job.id.equals(runningId)) queue.add(job.id);
        }
        emitChanged(job.id);
        pump();
        JSONObject item = OfflineStore.readItem(root, job.id);
        if (item == null) throw new OfflineStore.OfflineException("io");
        return item;
    }

    void pause(String id) throws OfflineStore.OfflineException {
        checkId(id);
        boolean changed = false;
        synchronized (this) {
            if (id.equals(runningId) && running != null) {
                running.stop(OfflineDownloader.PAUSE, null);
                return;
            }
            queue.remove(id);
            File dir = dir(id);
            OfflineStore.State st = OfflineStore.readState(dir);
            // Ждал Wi-Fi или суточного времени — теперь ждёт человека.
            boolean waiting = st != null && OfflineStore.PAUSED.equals(st.status)
                    && (ERR_WIFI.equals(st.error) || ERR_QUOTA.equals(st.error));
            if (st != null && (OfflineStore.QUEUED.equals(st.status) || waiting)) {
                st.status = OfflineStore.PAUSED;
                st.error = null;
                changed = writeStateQuietly(dir, st);
            }
        }
        if (changed) emitChanged(id);
    }

    /** Продолжить приостановленное или упавшее (кнопка «Повторить»). */
    void resume(String id) throws OfflineStore.OfflineException {
        checkId(id);
        notMoving();
        synchronized (this) {
            if (id.equals(runningId) || queue.contains(id)) return;
            File dir = dir(id);
            OfflineStore.State st = OfflineStore.readState(dir);
            if (st == null) {
                // state.json потерялся (список показывает failed/io), а задание
                // на месте — «Повторить» начинает заново, а не отвечает not_found.
                OfflineStore.Job job = OfflineStore.readJob(dir);
                if (job == null || OfflineStore.readMeta(dir) == null) {
                    throw new OfflineStore.OfflineException("not_found");
                }
                if (new File(dir, OfflineStore.VIDEO).isFile()) return;
                st = OfflineStore.State.queued(job.size);
            }
            if (OfflineStore.DONE.equals(st.status)) return;
            st.status = OfflineStore.QUEUED;
            st.error = null;
            try {
                OfflineStore.writeState(dir, st);
            } catch (IOException e) {
                throw new OfflineStore.OfflineException("io");
            }
            queue.add(id);
        }
        emitChanged(id);
        pump();
    }

    /** Удалить ролик или отменить загрузку (с недокачанным). */
    void remove(String id) throws OfflineStore.OfflineException {
        checkId(id);
        notMoving();
        boolean removed;
        synchronized (this) {
            if (id.equals(runningId) && running != null) {
                running.stop(OfflineDownloader.REMOVE, null);
                return;
            }
            queue.remove(id);
            File dir = dir(id);
            removed = dir.exists() && OfflineStore.deleteRecursive(dir);
        }
        if (removed) emitChanged(id);
    }

    /** Поля {@code meta.json}: аккаунты, «автор удалил», дата проверки. */
    JSONObject patchMeta(String id, JSONObject patch) throws OfflineStore.OfflineException {
        checkId(id);
        notMoving();
        synchronized (this) {
            OfflineStore.patchMeta(dir(id), patch);
        }
        emitChanged(id);
        JSONObject item = OfflineStore.readItem(root, id);
        if (item == null) throw new OfflineStore.OfflineException("not_found");
        return item;
    }

    long used() {
        return OfflineStore.dirSize(root);
    }

    /** Свободно на диске с папкой скачанного; −1 — не узнать. */
    static long freeBytes(File dir) {
        try {
            return new StatFs(dir.getPath()).getAvailableBytes();
        } catch (RuntimeException e) {
            return -1;
        }
    }

    long free() {
        return freeBytes(root);
    }

    /** Стереть всё скачанное (выход из всех аккаунтов, «Удалить всё»). */
    void clear() throws OfflineStore.OfflineException {
        notMoving();
        for (String id : OfflineStore.ids(root)) remove(id);
    }

    /**
     * Путь для ExoPlayer; null — не скачан. Есть годный {@code playlist.m3u8} —
     * он (HLS с BYTERANGE по {@code video.mp4}: ExoPlayer начинает с нужного
     * места), иначе сам {@code video.mp4}.
     */
    @Nullable
    String nativePath(String id) throws OfflineStore.OfflineException {
        checkId(id);
        File video = new File(dir(id), OfflineStore.VIDEO);
        if (!video.isFile()) return null;
        File playlist = new File(dir(id), OfflinePlaylist.NAME);
        if (playlist.isFile()) {
            try {
                String text = new String(OfflineStore.readBytes(playlist, OfflineDownloader.EXTRA_MAX),
                        java.nio.charset.StandardCharsets.UTF_8);
                if (OfflinePlaylist.fits(text, video.length())) return playlist.getAbsolutePath();
            } catch (IOException e) {
                // Не прочитать — играем файл.
            }
        }
        return video.getAbsolutePath();
    }

    // ─── Где лежит скачанное ──────────────────────────────────────────────

    /**
     * {@code {current, sd: {free} | null, internalFree, sdUnavailable}}: где
     * сейчас, есть ли карта памяти и сколько свободно.
     */
    JSONObject storage() throws JSONException {
        File internal = OfflineLocation.internalRoot(app);
        File sd = OfflineLocation.sdRoot(app);
        JSONObject ret = new JSONObject();
        ret.put("current", internal.equals(root) ? OfflineLocation.INTERNAL : OfflineLocation.SD);
        ret.put("internalFree", freeBytes(app.getFilesDir()));
        if (sd != null) {
            File volume = sd.getParentFile();
            ret.put("sd", new JSONObject().put("free", freeBytes(volume != null ? volume : sd)));
        } else {
            ret.put("sd", JSONObject.NULL);
        }
        ret.put("sdUnavailable", sdUnavailable);
        return ret;
    }

    /**
     * Перенести скачанное во внутреннюю память или на карту. Загрузка на время
     * встаёт и продолжается на новом месте. Ошибки: {@code moving},
     * {@code busy}, {@code no_sd}, {@code no_space}, {@code target_busy},
     * {@code io} — тогда всё остаётся как было.
     */
    void moveStorage(String target) throws OfflineStore.OfflineException {
        File to = OfflineLocation.SD.equals(target) ? OfflineLocation.sdRoot(app)
                : OfflineLocation.INTERNAL.equals(target) ? OfflineLocation.internalRoot(app) : null;
        if (to == null) throw new OfflineStore.OfflineException(OfflineLocation.SD.equals(target) ? "no_sd" : "invalid");
        File from = root;
        if (to.equals(from)) {
            prefs.edit().putString(KEY_STORAGE, target).apply();
            sdUnavailable = false;
            return;
        }
        List<String> resume = new ArrayList<>();
        synchronized (this) {
            if (moving) throw new OfflineStore.OfflineException("moving");
            moving = true;
            if (running != null && runningId != null) {
                resume.add(runningId);
                running.stop(OfflineDownloader.PAUSE, null);
            }
            resume.addAll(queue);
            queue.clear();
        }
        try {
            long until = SystemClock.elapsedRealtime() + STOP_WAIT_MS;
            while (true) {
                synchronized (this) {
                    if (running == null) break;
                }
                if (SystemClock.elapsedRealtime() > until) throw new OfflineStore.OfflineException("busy");
                SystemClock.sleep(100);
            }
            //noinspection ResultOfMethodCallIgnored
            to.mkdirs();
            if (!OfflineLocation.enoughSpace(OfflineStore.dirSize(from), freeBytes(to))) {
                throw new OfflineStore.OfflineException("no_space");
            }
            OfflineLocation.moveItems(from, to, OfflineStore.ids(from), this::emitMoving);
            root = to;
            sdUnavailable = false;
            prefs.edit().putString(KEY_STORAGE, target).apply();
        } finally {
            moving = false;
            requeue(resume);
        }
    }

    /** Остановленное переносом — снова в очередь, уже там, где теперь скачанное. */
    private void requeue(List<String> ids) {
        List<String> changed = new ArrayList<>();
        synchronized (this) {
            for (String id : ids) {
                if (id.equals(runningId) || queue.contains(id)) continue;
                File dir = dir(id);
                OfflineStore.State st = OfflineStore.readState(dir);
                if (st == null || OfflineStore.DONE.equals(st.status)) continue;
                st.status = OfflineStore.QUEUED;
                st.error = null;
                if (writeStateQuietly(dir, st)) {
                    queue.add(id);
                    changed.add(id);
                }
            }
        }
        for (String id : changed) emitChanged(id);
        pump();
    }

    private void emitMoving(int done, int total) {
        for (Listener l : listeners) {
            try {
                l.onMoving(done, total);
            } catch (RuntimeException e) {
                Log.w(TAG, "moving listener: " + e);
            }
        }
    }

    // ─── События ──────────────────────────────────────────────────────────

    private void emitProgress(String id, long received, long total) {
        for (Listener l : listeners) {
            try {
                l.onProgress(id, received, total);
            } catch (RuntimeException e) {
                Log.w(TAG, "progress listener: " + e);
            }
        }
    }

    private void emitChanged(String id) {
        JSONObject item = OfflineStore.readItem(root, id);
        for (Listener l : listeners) {
            try {
                l.onChanged(id, item);
            } catch (RuntimeException e) {
                Log.w(TAG, "changed listener: " + e);
            }
        }
    }

    private static boolean writeStateQuietly(File dir, OfflineStore.State state) {
        try {
            OfflineStore.writeState(dir, state);
            return true;
        } catch (IOException e) {
            return false;
        }
    }
}
