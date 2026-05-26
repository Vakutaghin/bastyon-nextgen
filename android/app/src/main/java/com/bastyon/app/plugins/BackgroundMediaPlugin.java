package com.bastyon.app.plugins;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/**
 * Capacitor plugin that exposes the background-media foreground service to JS.
 *
 * JS lifecycle:
 *   - start(options)  — call when playback begins; spins up the service +
 *                       lock-screen notification.
 *   - update(state)   — call on play/pause/position changes; refreshes the
 *                       MediaSession + notification without restarting.
 *   - stop()          — call when playback ends or the player is destroyed;
 *                       tears down the service.
 *
 * Events emitted to JS (notify listeners):
 *   - "play"       — user pressed play from notification / lock screen.
 *   - "pause"      — user pressed pause.
 *   - "seekTo"     — { positionMs } user scrubbed; this is also fired for
 *                    the rewind/forward buttons (delta is resolved in the
 *                    service).
 *   - "stop"       — user dismissed playback.
 */
@CapacitorPlugin(
        name = "BackgroundMedia",
        permissions = {
                @Permission(strings = {"android.permission.POST_NOTIFICATIONS"}, alias = "notifications")
        }
)
public class BackgroundMediaPlugin extends Plugin {

    @Override
    public void load() {
        super.load();
        MediaPlaybackService.setCallback(new MediaPlaybackService.Callback() {
            @Override
            public void onPlay() {
                notifyListeners("play", new JSObject());
            }

            @Override
            public void onPause() {
                notifyListeners("pause", new JSObject());
            }

            @Override
            public void onSeekTo(long positionMs) {
                JSObject data = new JSObject();
                data.put("positionMs", positionMs);
                notifyListeners("seekTo", data);
            }

            @Override
            public void onStop() {
                notifyListeners("stop", new JSObject());
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        MediaPlaybackService.setCallback(null);
        super.handleOnDestroy();
    }

    @PluginMethod
    public void start(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, MediaPlaybackService.class)
                .setAction(MediaPlaybackService.ACTION_START);
        fillIntent(intent, call);
        startForegroundService(ctx, intent);
        call.resolve();
    }

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, MediaPlaybackService.class)
                .setAction(MediaPlaybackService.ACTION_UPDATE);
        fillIntent(intent, call);
        // Same call path — startService will deliver onStartCommand and the
        // service updates the notification without re-entering foreground.
        startForegroundService(ctx, intent);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, MediaPlaybackService.class)
                .setAction(MediaPlaybackService.ACTION_STOP);
        ctx.startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", true);
        call.resolve(ret);
    }

    private void fillIntent(Intent intent, PluginCall call) {
        String title = call.getString("title", "");
        String artist = call.getString("artist", "");
        String artworkUrl = call.getString("artworkUrl", null);
        Double durationSec = call.getDouble("duration", 0d);
        Double positionSec = call.getDouble("position", 0d);
        Float speed = call.getFloat("playbackSpeed", 1.0f);
        Boolean isPlaying = call.getBoolean("isPlaying", true);

        intent.putExtra(MediaPlaybackService.EXTRA_TITLE, title);
        intent.putExtra(MediaPlaybackService.EXTRA_ARTIST, artist);
        if (artworkUrl != null) {
            intent.putExtra(MediaPlaybackService.EXTRA_ARTWORK_URL, artworkUrl);
        }
        intent.putExtra(MediaPlaybackService.EXTRA_DURATION_MS,
                durationSec == null ? 0L : Math.round(durationSec * 1000d));
        intent.putExtra(MediaPlaybackService.EXTRA_POSITION_MS,
                positionSec == null ? 0L : Math.round(positionSec * 1000d));
        intent.putExtra(MediaPlaybackService.EXTRA_PLAYBACK_SPEED,
                speed == null ? 1.0f : speed);
        intent.putExtra(MediaPlaybackService.EXTRA_IS_PLAYING,
                isPlaying == null ? true : isPlaying);
    }

    private void startForegroundService(Context ctx, Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(intent);
        } else {
            ctx.startService(intent);
        }
    }
}
