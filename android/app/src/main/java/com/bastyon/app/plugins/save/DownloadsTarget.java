package com.bastyon.app.plugins.save;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import androidx.annotation.RequiresApi;

import java.io.IOException;
import java.io.OutputStream;

/**
 * Файл в «Загрузках» через MediaStore (Android 10+): без разрешений на память.
 * Пока пишется, он помечен IS_PENDING — его не видят другие приложения, а
 * брошенный система сама удалит через неделю. Занятое имя MediaStore меняет
 * на «имя (1).ext» — итоговое берём из него.
 */
@RequiresApi(Build.VERSION_CODES.Q)
final class DownloadsTarget implements SaveSessions.Target {
    private final ContentResolver resolver;
    private final Uri uri;
    private final String folder;
    private final String name;

    private DownloadsTarget(ContentResolver resolver, Uri uri, String folder, String name) {
        this.resolver = resolver;
        this.uri = uri;
        this.folder = folder;
        this.name = name;
    }

    /** @param folder относительный путь, например {@code Download/Bastyon}. */
    static DownloadsTarget create(ContentResolver resolver, String name, String mime, String folder)
            throws IOException {
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, folder);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new IOException("MediaStore insert failed");
        return new DownloadsTarget(resolver, uri, folder, name);
    }

    @Override
    public OutputStream open() throws IOException {
        OutputStream out = resolver.openOutputStream(uri, "w");
        if (out == null) throw new IOException("no output stream");
        return out;
    }

    @Override
    public SaveSessions.Saved commit() {
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(uri, values, null, null);
        return new SaveSessions.Saved(DocumentTarget.displayName(resolver, uri, name), folder);
    }

    @Override
    public void discard() {
        try {
            resolver.delete(uri, null, null);
        } catch (RuntimeException ignored) {
            // Не удалилось — IS_PENDING: система уберёт сама.
        }
    }
}
