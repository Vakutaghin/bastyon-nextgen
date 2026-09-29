package com.bastyon.app.plugins.radio;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import com.bastyon.app.MainActivity;

/**
 * Держит приложение живым, пока подключено радио: иначе Android усыпит его в
 * фоне и радио («на поясе, телефон в кармане») замолчит. Само соединение и
 * протокол — в плагине и JS; служба только показывает постоянное уведомление.
 * Тексты приходят из JS на языке интерфейса.
 */
public class MeshRadioService extends Service {
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_TEXT = "text";
    static final String EXTRA_CHANNEL = "channel";
    static final String CHANNEL_ID = "mesh_radio";
    static final String MESSAGES_CHANNEL_ID = "mesh_messages";
    private static final int NOTIFICATION_ID = 7342;

    static void start(Context ctx, String title, String text, String channelName) {
        Intent intent = new Intent(ctx, MeshRadioService.class)
                .putExtra(EXTRA_TITLE, title)
                .putExtra(EXTRA_TEXT, text)
                .putExtra(EXTRA_CHANNEL, channelName);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(intent);
        else ctx.startService(intent);
    }

    static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, MeshRadioService.class));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String title = intent != null ? intent.getStringExtra(EXTRA_TITLE) : null;
        String text = intent != null ? intent.getStringExtra(EXTRA_TEXT) : null;
        String channelName = intent != null ? intent.getStringExtra(EXTRA_CHANNEL) : null;
        ensureChannel(this, CHANNEL_ID, channelName != null ? channelName : "Mesh", NotificationManager.IMPORTANCE_LOW);
        Notification n = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle(title != null ? title : "Bastyon")
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setContentIntent(openApp(this))
                .build();
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
                : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, n, type);
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    static PendingIntent openApp(Context ctx) {
        Intent open = new Intent(ctx, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void ensureChannel(Context ctx, String id, String name, int importance) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel existing = nm.getNotificationChannel(id);
        if (existing != null) {
            // Имя канала — на языке интерфейса; сменили язык — обновится.
            if (!name.contentEquals(existing.getName())) {
                existing.setName(name);
                nm.createNotificationChannel(existing);
            }
            return;
        }
        NotificationChannel channel = new NotificationChannel(id, name, importance);
        channel.setShowBadge(importance > NotificationManager.IMPORTANCE_LOW);
        nm.createNotificationChannel(channel);
    }
}
