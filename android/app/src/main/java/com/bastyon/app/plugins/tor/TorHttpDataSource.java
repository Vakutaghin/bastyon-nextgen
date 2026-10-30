package com.bastyon.app.plugins.tor;

import android.content.Context;
import android.net.Uri;

import androidx.annotation.Nullable;
import androidx.annotation.OptIn;
import androidx.media3.common.C;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.BaseDataSource;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DataSpec;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.source.MediaSource;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

/**
 * Загрузка звука для ExoPlayer (MediaPlaybackService) через Tor: у
 * DefaultHttpDataSource прокси не задать. Без Tor плеер берёт обычный
 * DefaultHttpDataSource — выбор при каждой загрузке, так что включённый на
 * ходу Tor действует и на играющую очередь.
 */
@OptIn(markerClass = UnstableApi.class)
public final class TorHttpDataSource extends BaseDataSource {
    private static final int TIMEOUT_MS = 60_000;

    /** Источник медиа плеера: http(s) — через {@link #factory()}. */
    public static MediaSource.Factory mediaSourceFactory(Context context) {
        return new DefaultMediaSourceFactory(new DefaultDataSource.Factory(context, factory()));
    }

    static DataSource.Factory factory() {
        DefaultHttpDataSource.Factory direct = new DefaultHttpDataSource.Factory();
        return () -> TorNetwork.wanted() ? new TorHttpDataSource() : direct.createDataSource();
    }

    @Nullable private HttpURLConnection connection;
    @Nullable private InputStream stream;
    @Nullable private Uri uri;
    private long bytesRemaining;
    private boolean opened;

    private TorHttpDataSource() {
        super(/* isNetwork= */ true);
    }

    @Override
    public long open(DataSpec spec) throws IOException {
        uri = spec.uri;
        transferInitializing(spec);
        HttpURLConnection conn = (HttpURLConnection) new URL(spec.uri.toString()).openConnection(TorNetwork.proxy());
        connection = conn;
        conn.setConnectTimeout(TIMEOUT_MS);
        conn.setReadTimeout(TIMEOUT_MS);
        conn.setInstanceFollowRedirects(true);
        // Без сжатия: иначе длина ответа — не длина звука.
        conn.setRequestProperty("Accept-Encoding", "identity");
        for (Map.Entry<String, String> header : spec.httpRequestHeaders.entrySet()) {
            conn.setRequestProperty(header.getKey(), header.getValue());
        }
        boolean ranged = spec.position != 0 || spec.length != C.LENGTH_UNSET;
        if (ranged) {
            String end = spec.length != C.LENGTH_UNSET ? String.valueOf(spec.position + spec.length - 1) : "";
            conn.setRequestProperty("Range", "bytes=" + spec.position + "-" + end);
        }

        int code = conn.getResponseCode();
        if (code == 416 && spec.position > 0) {
            // Просили с конца файла: читать нечего.
            bytesRemaining = 0;
        } else if (code < 200 || code > 299) {
            close();
            throw new IOException("HTTP " + code + " " + spec.uri);
        } else {
            stream = conn.getInputStream();
            long length = conn.getContentLengthLong();
            if (code == 200 && spec.position > 0) {
                // Сервер не понял Range — пропускаем начало сами.
                skipFully(stream, spec.position);
                if (length >= 0) length -= spec.position;
            }
            bytesRemaining = spec.length != C.LENGTH_UNSET ? spec.length : (length >= 0 ? length : C.LENGTH_UNSET);
        }
        opened = true;
        transferStarted(spec);
        return bytesRemaining;
    }

    @Override
    public int read(byte[] buffer, int offset, int length) throws IOException {
        if (length == 0) return 0;
        if (bytesRemaining == 0 || stream == null) return C.RESULT_END_OF_INPUT;
        int want = bytesRemaining == C.LENGTH_UNSET ? length : (int) Math.min(length, bytesRemaining);
        int read = stream.read(buffer, offset, want);
        if (read == -1) return C.RESULT_END_OF_INPUT;
        if (bytesRemaining != C.LENGTH_UNSET) bytesRemaining -= read;
        bytesTransferred(read);
        return read;
    }

    @Nullable
    @Override
    public Uri getUri() {
        HttpURLConnection conn = connection;
        return conn != null ? Uri.parse(conn.getURL().toString()) : uri;
    }

    @Override
    public void close() {
        InputStream in = stream;
        stream = null;
        if (in != null) {
            try {
                in.close();
            } catch (IOException ignored) {
                // Соединение всё равно закрывается ниже.
            }
        }
        HttpURLConnection conn = connection;
        connection = null;
        if (conn != null) conn.disconnect();
        if (opened) {
            opened = false;
            transferEnded();
        }
    }

    private static void skipFully(InputStream in, long count) throws IOException {
        byte[] buf = new byte[8192];
        while (count > 0) {
            int read = in.read(buf, 0, (int) Math.min(buf.length, count));
            if (read == -1) throw new IOException("unexpected end of stream");
            count -= read;
        }
    }
}
