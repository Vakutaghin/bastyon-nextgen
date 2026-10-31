package com.bastyon.app.plugins;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Locale;

/**
 * Счётчик непрочитанных сообщений на значке приложения.
 *
 * У Android нет общего способа поставить число на значок: лаунчеры рисуют
 * точку или число по уведомлениям приложения. Поэтому, пока приложение свёрнуто
 * и есть непрочитанные, висит одно тихое уведомление «N непрочитанных
 * сообщений» с числом (setNumber) — по нему число на значке рисуют Samsung,
 * Xiaomi, OPPO, vivo, а Pixel и прочие — точку. Открыли приложение — убираем:
 * число видно внутри. Без звука и вибрации, отключается тумблером в настройках
 * уведомлений приложения или каналом «Непрочитанные сообщения» в системе.
 *
 * Huawei и Honor умеют число на значке без уведомления — им отдаём напрямую.
 */
@CapacitorPlugin(
        name = "AppBadge",
        permissions = {
                @Permission(strings = {"android.permission.POST_NOTIFICATIONS"}, alias = "notifications")
        }
)
public class AppBadgePlugin extends Plugin {
    private static final String TAG = "AppBadge";
    private static final String CHANNEL_ID = "unread_messages";
    private static final int NOTIFICATION_ID = 7301;

    private int count = 0;
    private String title = "Bastyon";
    private String text = "";
    private String channelName = "Unread messages";
    /** Приложение свёрнуто: только тогда держим уведомление со счётчиком. */
    private boolean inBackground = false;

    @Override
    public void load() {
        // Уведомление прошлого запуска устарело: число придёт от мессенджера заново.
        NotificationManagerCompat.from(getContext()).cancel(NOTIFICATION_ID);
    }

    @PluginMethod
    public void set(PluginCall call) {
        Integer value = call.getInt("count", 0);
        count = Math.max(0, value == null ? 0 : value);
        title = call.getString("title", title);
        text = call.getString("text", text);
        channelName = call.getString("channel", channelName);
        setLauncherBadge(count);
        refreshNotification();
        call.resolve();
    }

    @Override
    protected void handleOnPause() {
        inBackground = true;
        refreshNotification();
    }

    @Override
    protected void handleOnResume() {
        inBackground = false;
        refreshNotification();
    }

    private void refreshNotification() {
        Context ctx = getContext();
        NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
        if (count <= 0 || !inBackground) {
            nm.cancel(NOTIFICATION_ID);
            return;
        }
        if (!nm.areNotificationsEnabled()) return;
        ensureChannel(ctx);

        Notification notification = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(ctx.getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(text)
                .setNumber(count)
                .setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setSilent(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setAutoCancel(true)
                .setContentIntent(contentIntent(ctx))
                .build();
        setMiuiMessageCount(notification, count);
        try {
            nm.notify(NOTIFICATION_ID, notification);
        } catch (SecurityException e) {
            // Разрешение на уведомления отозвали между проверкой и показом.
            Log.w(TAG, "notify: " + e.getMessage());
        }
    }

    private void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        // Тот же id с новым именем — система переименует канал (смена языка).
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, channelName, NotificationManager.IMPORTANCE_LOW);
        channel.setShowBadge(true);
        channel.enableVibration(false);
        channel.setSound(null, null);
        nm.createNotificationChannel(channel);
    }

    private PendingIntent contentIntent(Context ctx) {
        Intent launchIntent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(ctx, NOTIFICATION_ID, launchIntent, flags);
    }

    /** MIUI и HyperOS берут число не из setNumber, а из своего поля уведомления. */
    private static void setMiuiMessageCount(Notification notification, int value) {
        if (!"xiaomi".equals(Build.MANUFACTURER.toLowerCase(Locale.ROOT))) return;
        try {
            Field field = notification.getClass().getDeclaredField("extraNotification");
            Object extra = field.get(notification);
            if (extra == null) return;
            Method method = extra.getClass().getDeclaredMethod("setMessageCount", int.class);
            method.invoke(extra, value);
        } catch (ReflectiveOperationException | RuntimeException e) {
            // Не MIUI или поле убрали — останется число из setNumber.
        }
    }

    /** Число на значке без уведомления — у лаунчеров Huawei и Honor. */
    private void setLauncherBadge(int value) {
        String maker = Build.MANUFACTURER.toLowerCase(Locale.ROOT);
        String authority;
        if (maker.contains("huawei")) {
            authority = "com.huawei.android.launcher.settings";
        } else if (maker.contains("honor")) {
            authority = "com.hihonor.android.launcher.settings";
        } else {
            return;
        }
        Context ctx = getContext();
        Intent launchIntent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        ComponentName component = launchIntent == null ? null : launchIntent.getComponent();
        if (component == null) return;
        Bundle extra = new Bundle();
        extra.putString("package", ctx.getPackageName());
        extra.putString("class", component.getClassName());
        extra.putInt("badgenumber", value);
        try {
            ctx.getContentResolver().call(Uri.parse("content://" + authority + "/badge/"), "change_badge", null, extra);
        } catch (RuntimeException e) {
            // Старый или чужой лаунчер без этого провайдера.
            Log.w(TAG, "launcher badge: " + e.getMessage());
        }
    }
}
