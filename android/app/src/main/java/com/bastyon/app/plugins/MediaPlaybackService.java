package com.bastyon.app.plugins;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.annotation.OptIn;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import androidx.media.session.MediaButtonReceiver;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;

import com.bastyon.app.R;
import com.bastyon.app.plugins.tor.TorHttpDataSource;
import com.bastyon.app.plugins.tor.TorNetwork;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

/**
 * Foreground service that owns the MediaSession + notification while the
 * WebView's HTMLVideoElement is playing audio in the background.
 *
 * The actual audio rendering still happens inside the WebView — this service
 * exists to (a) keep the process alive and prioritised, (b) expose
 * media controls on the lock screen / notification shade, and (c) route
 * those control events back to JS via BackgroundMediaPlugin.
 *
 * Пока приложение свёрнуто или экран погашен, звук ролика играет здесь же
 * ExoPlayer (ACTION_NATIVE_PLAY): WebView видео в скрытой странице не играет —
 * Chromium ставит на паузу и его, и любой элемент с видеодорожкой (проверено на
 * эмуляторе API 35, WebView 124). Кнопки уведомления тогда управляют им сами,
 * а вернувшееся приложение забирает позицию (stopNativePlayback).
 */
public class MediaPlaybackService extends Service {

    public static final String CHANNEL_ID = "bastyon_media_playback";
    public static final int NOTIFICATION_ID = 4242;

    public static final String ACTION_START = "com.bastyon.app.media.START";
    public static final String ACTION_UPDATE = "com.bastyon.app.media.UPDATE";
    public static final String ACTION_STOP = "com.bastyon.app.media.STOP";
    public static final String ACTION_SEEK_DELTA = "com.bastyon.app.media.SEEK_DELTA";
    public static final String EXTRA_DELTA_MS = "deltaMs";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ARTWORK_URL = "artworkUrl";
    public static final String EXTRA_DURATION_MS = "durationMs";
    public static final String EXTRA_POSITION_MS = "positionMs";
    public static final String EXTRA_IS_PLAYING = "isPlaying";
    public static final String EXTRA_PLAYBACK_SPEED = "playbackSpeed";

    public static final String ACTION_NATIVE_PLAY = "com.bastyon.app.media.NATIVE_PLAY";
    public static final String EXTRA_URL = "url";
    public static final String EXTRA_VOLUME = "volume";

    /**
     * Очередь мини-плеера (JSON-массив {url, title, artist, artworkUrl, durationMs}):
     * свёрнутое приложение само следующий трек не включит, поэтому ExoPlayer
     * получает очередь целиком и переключает её сам.
     */
    public static final String EXTRA_QUEUE = "queue";
    /** Есть ли у WebView-плеера соседние треки: кнопки «предыдущий» и «следующий» вместо перемотки. */
    public static final String EXTRA_HAS_QUEUE = "hasQueue";
    public static final String ACTION_SKIP = "com.bastyon.app.media.SKIP";
    public static final String EXTRA_SKIP_FORWARD = "forward";

    public interface Callback {
        void onPlay();
        void onPause();
        void onSeekTo(long positionMs);
        void onStop();
        void onNext();
        void onPrevious();
    }

    private static volatile Callback callback;

    public static void setCallback(Callback cb) {
        callback = cb;
    }

    /** Для stopNativePlayback: позицию отдать сразу, без интента. */
    private static volatile MediaPlaybackService instance;

    private final IBinder binder = new LocalBinder();
    private MediaSessionCompat mediaSession;
    /** Звук ролика, пока приложение свёрнуто. null — играет WebView. */
    private ExoPlayer player;
    private Bitmap currentArtwork;
    private String currentArtworkUrl;
    private String currentTitle = "";
    private String currentArtist = "";
    private long currentDurationMs = 0L;
    private long currentPositionMs = 0L;
    private float currentSpeed = 1.0f;
    private boolean currentIsPlaying = false;
    /** Треки очереди в ExoPlayer: подписи для уведомления при переходе. */
    private final List<JSONObject> nativeQueue = new ArrayList<>();
    /** У WebView-плеера есть соседние треки (мини-плеер с очередью). */
    private boolean webQueue = false;

    public class LocalBinder extends Binder {
        public MediaPlaybackService getService() {
            return MediaPlaybackService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createNotificationChannel();
        initMediaSession();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            return START_NOT_STICKY;
        }

        // Hardware media-button presses arrive as MEDIA_BUTTON intents.
        MediaButtonReceiver.handleIntent(mediaSession, intent);

        String action = intent.getAction();
        if (ACTION_START.equals(action) || ACTION_UPDATE.equals(action)) {
            applyIntent(intent);
            Notification notification = buildNotification();
            if (ACTION_START.equals(action)) {
                // Аудиофокус не берём: у WebView он свой, и наш запрос после
                // его запроса ставил ролик на паузу (Chromium терял фокус).
                startInForeground(notification);
            } else {
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.notify(NOTIFICATION_ID, notification);
                }
            }
        } else if (ACTION_SEEK_DELTA.equals(action)) {
            long delta = intent.getLongExtra(EXTRA_DELTA_MS, 0L);
            if (player != null) {
                player.seekTo(Math.max(0L, player.getCurrentPosition() + delta));
                return START_NOT_STICKY;
            }
            long target = Math.max(0L, currentPositionMs + delta);
            if (currentDurationMs > 0L) {
                target = Math.min(target, currentDurationMs);
            }
            if (callback != null) callback.onSeekTo(target);
        } else if (ACTION_SKIP.equals(action)) {
            skip(intent.getBooleanExtra(EXTRA_SKIP_FORWARD, true));
        } else if (ACTION_NATIVE_PLAY.equals(action)) {
            applyIntent(intent);
            startInForeground(buildNotification());
            startNativePlayer(intent);
        } else if (ACTION_STOP.equals(action)) {
            stopPlayback();
        }

        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public void onDestroy() {
        releasePlayer();
        instance = null;
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        // Канал уже есть — создание обновит только имя и описание: после смены
        // языка системы они на новом языке.
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.media_channel_name),
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(getString(R.string.media_channel_description));
        channel.setShowBadge(false);
        nm.createNotificationChannel(channel);
    }

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, "BastyonMediaSession");
        mediaSession.setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS
                        | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                if (player != null) {
                    player.play();
                    return;
                }
                if (callback != null) callback.onPlay();
            }

            @Override
            public void onPause() {
                if (player != null) {
                    player.pause();
                    return;
                }
                if (callback != null) callback.onPause();
            }

            @Override
            public void onSeekTo(long pos) {
                if (player != null) {
                    player.seekTo(pos);
                    return;
                }
                if (callback != null) callback.onSeekTo(pos);
            }

            @Override
            public void onStop() {
                releasePlayer();
                if (callback != null) callback.onStop();
            }

            @Override
            public void onSkipToNext() {
                skip(true);
            }

            @Override
            public void onSkipToPrevious() {
                skip(false);
            }
        });
        mediaSession.setActive(true);
    }

    private void applyIntent(Intent intent) {
        if (intent.hasExtra(EXTRA_TITLE)) currentTitle = nullSafe(intent.getStringExtra(EXTRA_TITLE));
        if (intent.hasExtra(EXTRA_ARTIST)) currentArtist = nullSafe(intent.getStringExtra(EXTRA_ARTIST));
        if (intent.hasExtra(EXTRA_DURATION_MS)) currentDurationMs = intent.getLongExtra(EXTRA_DURATION_MS, 0L);
        if (intent.hasExtra(EXTRA_HAS_QUEUE)) webQueue = intent.getBooleanExtra(EXTRA_HAS_QUEUE, false);
        // Пока звук у ExoPlayer, место и состояние — его, а не вставшего видео.
        if (player == null) {
            if (intent.hasExtra(EXTRA_POSITION_MS)) currentPositionMs = intent.getLongExtra(EXTRA_POSITION_MS, 0L);
            if (intent.hasExtra(EXTRA_IS_PLAYING)) currentIsPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, false);
            if (intent.hasExtra(EXTRA_PLAYBACK_SPEED)) currentSpeed = intent.getFloatExtra(EXTRA_PLAYBACK_SPEED, 1.0f);
        }

        if (intent.hasExtra(EXTRA_ARTWORK_URL)) {
            String url = intent.getStringExtra(EXTRA_ARTWORK_URL);
            if (url != null && !url.equals(currentArtworkUrl)) {
                currentArtworkUrl = url;
                currentArtwork = null;
                fetchArtworkAsync(url);
            }
        }

        updateMediaSessionMetadata();
        updatePlaybackState();
    }

    private void updateMediaSessionMetadata() {
        if (mediaSession == null) return;
        MediaMetadataCompat.Builder builder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION,
                        currentDurationMs > 0 ? currentDurationMs : -1L);
        if (currentArtwork != null) {
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentArtwork);
        }
        mediaSession.setMetadata(builder.build());
    }

    private void updatePlaybackState() {
        if (mediaSession == null) return;
        long actions = PlaybackStateCompat.ACTION_PLAY
                | PlaybackStateCompat.ACTION_PAUSE
                | PlaybackStateCompat.ACTION_PLAY_PAUSE
                | PlaybackStateCompat.ACTION_SEEK_TO
                | PlaybackStateCompat.ACTION_STOP;
        if (hasQueue()) {
            actions |= PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                    | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS;
        }
        int state = currentIsPlaying
                ? PlaybackStateCompat.STATE_PLAYING
                : PlaybackStateCompat.STATE_PAUSED;
        PlaybackStateCompat playbackState = new PlaybackStateCompat.Builder()
                .setActions(actions)
                .setState(state, currentPositionMs, currentSpeed)
                .build();
        mediaSession.setPlaybackState(playbackState);
    }

    private Notification buildNotification() {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle(currentTitle.isEmpty() ? "Bastyon" : currentTitle)
                .setContentText(currentArtist)
                .setLargeIcon(currentArtwork)
                .setContentIntent(buildContentIntent())
                .setDeleteIntent(MediaButtonReceiver.buildMediaButtonPendingIntent(
                        this, PlaybackStateCompat.ACTION_STOP))
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setOngoing(currentIsPlaying);

        // Очередь — «предыдущий» и «следующий», один ролик — перемотка на 10 с.
        builder.addAction(hasQueue()
                ? new NotificationCompat.Action(
                        android.R.drawable.ic_media_previous, getString(R.string.media_previous),
                        buildSkipPendingIntent(false))
                : new NotificationCompat.Action(
                        android.R.drawable.ic_media_rew, getString(R.string.media_rewind),
                        buildSeekDeltaPendingIntent(-10_000L)));

        if (currentIsPlaying) {
            builder.addAction(new NotificationCompat.Action(
                    android.R.drawable.ic_media_pause,
                    getString(R.string.media_pause),
                    MediaButtonReceiver.buildMediaButtonPendingIntent(
                            this, PlaybackStateCompat.ACTION_PAUSE)
            ));
        } else {
            builder.addAction(new NotificationCompat.Action(
                    android.R.drawable.ic_media_play,
                    getString(R.string.media_play),
                    MediaButtonReceiver.buildMediaButtonPendingIntent(
                            this, PlaybackStateCompat.ACTION_PLAY)
            ));
        }

        builder.addAction(hasQueue()
                ? new NotificationCompat.Action(
                        android.R.drawable.ic_media_next, getString(R.string.media_next),
                        buildSkipPendingIntent(true))
                : new NotificationCompat.Action(
                        android.R.drawable.ic_media_ff, getString(R.string.media_forward),
                        buildSeekDeltaPendingIntent(10_000L)));

        MediaStyle style = new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2)
                .setShowCancelButton(true)
                .setCancelButtonIntent(MediaButtonReceiver.buildMediaButtonPendingIntent(
                        this, PlaybackStateCompat.ACTION_STOP));
        builder.setStyle(style);

        return builder.build();
    }

    private PendingIntent buildContentIntent() {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(this, 0, launchIntent, flags);
    }

    private PendingIntent buildSeekDeltaPendingIntent(long deltaMs) {
        Intent intent = new Intent(this, MediaPlaybackService.class)
                .setAction(ACTION_SEEK_DELTA)
                .putExtra(EXTRA_DELTA_MS, deltaMs);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getService(this, deltaMs > 0 ? 1 : 2, intent, flags);
    }

    private PendingIntent buildSkipPendingIntent(boolean forward) {
        Intent intent = new Intent(this, MediaPlaybackService.class)
                .setAction(ACTION_SKIP)
                .putExtra(EXTRA_SKIP_FORWARD, forward);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getService(this, forward ? 3 : 4, intent, flags);
    }

    private boolean hasQueue() {
        return player != null ? nativeQueue.size() > 1 : webQueue;
    }

    /** «Следующий» / «предыдущий»: в ExoPlayer — сам, в WebView — сказать мини-плееру. */
    private void skip(boolean forward) {
        if (player != null) {
            if (forward) {
                if (player.hasNextMediaItem()) player.seekToNextMediaItem();
            } else if (player.getCurrentPosition() > 3_000L || !player.hasPreviousMediaItem()) {
                player.seekTo(0L);
            } else {
                player.seekToPreviousMediaItem();
            }
            return;
        }
        if (callback == null) return;
        if (forward) callback.onNext();
        else callback.onPrevious();
    }

    private void startInForeground(Notification notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    @OptIn(markerClass = UnstableApi.class)
    private void startNativePlayer(Intent intent) {
        String url = intent.getStringExtra(EXTRA_URL);
        if (url == null || url.isEmpty()) return;
        if (player == null) {
            // Загрузки — через Tor, когда он включён (TorHttpDataSource).
            player = new ExoPlayer.Builder(this, TorHttpDataSource.mediaSourceFactory(this)).build();
            // Фокусом управляет плеер: звонок — пауза, вернулись в приложение —
            // отпустил, и фокус снова берёт WebView.
            player.setAudioAttributes(new androidx.media3.common.AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                    .build(), true);
            // Держит процессор и Wi-Fi, пока играет, — экран погашен.
            player.setWakeMode(C.WAKE_MODE_NETWORK);
            // Картинку никто не видит: только звук, из самого лёгкого качества.
            player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon()
                    .setTrackTypeDisabled(C.TRACK_TYPE_VIDEO, true)
                    .setForceLowestBitrate(true)
                    .build());
            player.addListener(new Player.Listener() {
                @Override
                public void onEvents(Player p, Player.Events events) {
                    onNativeStateChanged();
                }

                @Override
                public void onMediaItemTransition(MediaItem item, int reason) {
                    onNativeTrackChanged();
                }
            });
        }
        nativeQueue.clear();
        List<MediaItem> items = new ArrayList<>();
        String queueJson = intent.getStringExtra(EXTRA_QUEUE);
        if (queueJson != null) {
            try {
                JSONArray arr = new JSONArray(queueJson);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject entry = arr.getJSONObject(i);
                    String entryUrl = entry.optString("url", "");
                    if (entryUrl.isEmpty()) continue;
                    nativeQueue.add(entry);
                    items.add(new MediaItem.Builder()
                            .setUri(entryUrl)
                            .setMediaMetadata(new MediaMetadata.Builder()
                                    .setTitle(entry.optString("title", ""))
                                    .setArtist(entry.optString("artist", ""))
                                    .build())
                            .build());
                }
            } catch (Exception ignored) {
                // Битая очередь — играем один трек, как раньше.
                nativeQueue.clear();
                items.clear();
            }
        }
        long startMs = intent.getLongExtra(EXTRA_POSITION_MS, 0L);
        if (items.isEmpty()) {
            player.setMediaItem(MediaItem.fromUri(url), startMs);
        } else {
            // Первый в очереди — текущий трек мини-плеера.
            player.setMediaItems(items, 0, startMs);
        }
        player.setPlaybackParameters(new PlaybackParameters(intent.getFloatExtra(EXTRA_PLAYBACK_SPEED, 1.0f)));
        player.setVolume(intent.getFloatExtra(EXTRA_VOLUME, 1.0f));
        player.prepare();
        player.play();
    }

    private boolean nativePlaying() {
        // Пока догружается — уже «играет»: так и в уведомлении.
        return player != null && player.getPlayWhenReady() && player.getPlaybackState() != Player.STATE_ENDED;
    }

    private void onNativeStateChanged() {
        if (player == null) return;
        currentIsPlaying = nativePlaying();
        currentPositionMs = player.getCurrentPosition();
        currentSpeed = player.getPlaybackParameters().speed;
        updatePlaybackState();
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification());
    }

    /** ExoPlayer перешёл к другому треку очереди: подписи и обложка уведомления — его. */
    private void onNativeTrackChanged() {
        if (player == null) return;
        int index = player.getCurrentMediaItemIndex();
        if (index < 0 || index >= nativeQueue.size()) return;
        JSONObject entry = nativeQueue.get(index);
        currentTitle = entry.optString("title", "");
        currentArtist = entry.optString("artist", "");
        currentDurationMs = entry.optLong("durationMs", 0L);
        String art = entry.optString("artworkUrl", "");
        if (!art.isEmpty() && !art.equals(currentArtworkUrl)) {
            currentArtworkUrl = art;
            currentArtwork = null;
            fetchArtworkAsync(art);
        }
        updateMediaSessionMetadata();
        onNativeStateChanged();
    }

    private void releasePlayer() {
        if (player == null) return;
        player.release();
        player = null;
        nativeQueue.clear();
    }

    /**
     * Приложение снова на экране: звук возвращается в WebView. Позиция в мс,
     * играл ли и номер трека в очереди; null — ExoPlayer не играл. Только из
     * главного потока.
     */
    public static long[] stopNativePlayback() {
        MediaPlaybackService service = instance;
        if (service == null || service.player == null) return null;
        long[] state = {
                service.player.getCurrentPosition(),
                service.nativePlaying() ? 1L : 0L,
                Math.max(0, service.player.getCurrentMediaItemIndex())
        };
        service.releasePlayer();
        return state;
    }

    private void stopPlayback() {
        releasePlayer();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    private static String nullSafe(String s) {
        return s == null ? "" : s;
    }

    private void fetchArtworkAsync(final String url) {
        new Thread(() -> {
            try {
                URL u = new URL(url);
                HttpURLConnection conn = (HttpURLConnection) u.openConnection(TorNetwork.proxy());
                conn.setConnectTimeout(5_000);
                conn.setReadTimeout(5_000);
                conn.setDoInput(true);
                conn.connect();
                InputStream in = conn.getInputStream();
                Bitmap bmp = BitmapFactory.decodeStream(in);
                in.close();
                if (bmp != null && url.equals(currentArtworkUrl)) {
                    currentArtwork = bmp;
                    updateMediaSessionMetadata();
                    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null) {
                        nm.notify(NOTIFICATION_ID, buildNotification());
                    }
                }
            } catch (Exception ignored) {
                // Artwork is optional; ignore network/decode failures.
            }
        }).start();
    }
}
