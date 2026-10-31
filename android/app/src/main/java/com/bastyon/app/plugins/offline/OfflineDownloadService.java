package com.bastyon.app.plugins.offline;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

import com.bastyon.app.MainActivity;
import com.bastyon.app.R;

import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Служба переднего плана ({@code dataSync}), пока есть ждущие или качающийся
 * ролик: свёрнутое или закрытое смахиванием приложение Android иначе усыпит, и
 * загрузка встанет. Само скачивание — в OfflineManager; служба показывает
 * уведомление «Скачивается 34 %» с кнопками «Пауза» и «Отмена» и
 * останавливается, когда очередь пуста.
 *
 * Android 15 даёт {@code dataSync} 6 часов в сутки: кончились — система зовёт
 * {@link #onTimeout(int, int)}, загрузки встают на паузу с {@code quota} и
 * продолжаются, когда приложение снова на экране.
 *
 * Разрешение на уведомления служба не просит: без него Android 13+ уведомление
 * просто не показывает, а загрузка идёт.
 */
public class OfflineDownloadService extends Service implements OfflineManager.Listener {
    private static final String TAG = "OfflineVideo";
    static final String CHANNEL_ID = "bastyon_offline_downloads";
    static final int NOTIFICATION_ID = 4343;
    static final String ACTION_PAUSE = "com.bastyon.app.offline.PAUSE";
    static final String ACTION_CANCEL = "com.bastyon.app.offline.CANCEL";
    static final String EXTRA_ID = "id";
    /** Уведомление обновляется не чаще раза в секунду: чаще система режет. */
    private static final long NOTIFY_EVERY_MS = 1_000;

    /** Служба на переднем плане: менеджеру незачем запускать её ещё раз. */
    private static volatile boolean active;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService actions = Executors.newSingleThreadExecutor();
    private OfflineManager manager;
    private int lastStartId;
    private long lastNotify;
    private int lastPercent = -2;
    @Nullable private String lastId;
    private boolean destroyed;

    /** Есть что качать — служба должна работать. */
    static void ensureStarted(Context ctx) {
        if (active) return;
        try {
            ContextCompat.startForegroundService(ctx, new Intent(ctx, OfflineDownloadService.class));
        } catch (RuntimeException e) {
            // Android 12+ не даёт поднять службу из фона (Wi-Fi вернулся, а
            // приложение свёрнуто): загрузка идёт, пока жив процесс, а служба
            // поднимется, когда приложение снова на экране.
            Log.w(TAG, "foreground service not started: " + e);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        manager = OfflineManager.get(this);
        ensureChannel();
        manager.addListener(this);
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        lastStartId = startId;
        if (!enterForeground()) {
            stopSelfResult(startId);
            return START_NOT_STICKY;
        }
        active = true;
        String action = intent != null ? intent.getAction() : null;
        String id = intent != null ? intent.getStringExtra(EXTRA_ID) : null;
        if (id != null && (ACTION_PAUSE.equals(action) || ACTION_CANCEL.equals(action))) {
            boolean cancel = ACTION_CANCEL.equals(action);
            actions.execute(() -> {
                try {
                    // «Отмена» — удалить вместе с недокачанным.
                    if (cancel) manager.remove(id);
                    else manager.pause(id);
                } catch (OfflineStore.OfflineException ignored) {
                    // Чужой id в интенте — делать нечего.
                }
                main.post(this::stopIfIdle);
            });
        } else {
            main.post(this::stopIfIdle);
        }
        // Процесс убили — система поднимет службу снова, и очередь продолжится.
        return START_STICKY;
    }

    private boolean enterForeground() {
        try {
            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                    : 0;
            ServiceCompat.startForeground(this, NOTIFICATION_ID, build(), type);
            return true;
        } catch (RuntimeException e) {
            // Суточное время dataSync кончилось или запуск из фона запрещён.
            Log.w(TAG, "startForeground: " + e);
            return false;
        }
    }

    private void stopIfIdle() {
        if (destroyed) return;
        if (manager.busy()) {
            refresh(true);
            return;
        }
        stopNow();
    }

    private void stopNow() {
        active = false;
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelfResult(lastStartId);
    }

    /** Android 15: суточное время загрузки переднего плана кончилось. */
    @Override
    public void onTimeout(int startId, int fgsType) {
        Log.w(TAG, "dataSync time limit reached");
        manager.pauseActive(OfflineManager.ERR_QUOTA);
        stopNow();
    }

    @Override
    public void onDestroy() {
        destroyed = true;
        active = false;
        manager.removeListener(this);
        actions.shutdown();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ─── События менеджера (из его потоков) ───────────────────────────────

    @Override
    public void onProgress(String id, long received, long total) {
        main.post(() -> refresh(false));
    }

    @Override
    public void onChanged(String id, @Nullable JSONObject item) {
        main.post(this::stopIfIdle);
    }

    // ─── Уведомление ──────────────────────────────────────────────────────

    private void refresh(boolean force) {
        if (!active || destroyed) return;
        OfflineManager.Current c = manager.current();
        int percent = percent(c);
        String id = c != null ? c.id : null;
        long now = SystemClock.elapsedRealtime();
        boolean same = percent == lastPercent && (id == null ? lastId == null : id.equals(lastId));
        if (!force && (same || now - lastNotify < NOTIFY_EVERY_MS)) return;
        lastNotify = now;
        lastPercent = percent;
        lastId = id;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIFICATION_ID, build());
    }

    /** −1 — размер ещё не известен. */
    private static int percent(@Nullable OfflineManager.Current c) {
        if (c == null || c.total <= 0) return -1;
        return (int) Math.min(100, c.received * 100 / c.total);
    }

    private Notification build() {
        OfflineManager.Current c = manager != null ? manager.current() : null;
        int percent = percent(c);
        String title = c != null && !c.title.isEmpty() ? c.title : "Bastyon";
        String text = percent >= 0
                ? getString(R.string.offline_downloading, percent)
                : getString(R.string.offline_downloading_unknown);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle(title)
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setSilent(true)
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .setContentIntent(openApp())
                .setProgress(100, Math.max(0, percent), percent < 0);
        if (c != null) {
            b.addAction(new NotificationCompat.Action(
                    android.R.drawable.ic_media_pause, getString(R.string.media_pause),
                    actionIntent(ACTION_PAUSE, c.id, 1)));
            b.addAction(new NotificationCompat.Action(
                    android.R.drawable.ic_menu_close_clear_cancel, getString(R.string.offline_cancel),
                    actionIntent(ACTION_CANCEL, c.id, 2)));
        }
        return b.build();
    }

    private PendingIntent actionIntent(String action, String id, int requestCode) {
        Intent intent = new Intent(this, OfflineDownloadService.class)
                .setAction(action)
                .putExtra(EXTRA_ID, id);
        return PendingIntent.getService(this, requestCode, intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private PendingIntent openApp() {
        Intent open = new Intent(this, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        // Канал уже есть — создание обновит только имя: после смены языка
        // системы оно на новом языке.
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, getString(R.string.offline_channel_name), NotificationManager.IMPORTANCE_LOW);
        channel.setShowBadge(false);
        nm.createNotificationChannel(channel);
    }
}
