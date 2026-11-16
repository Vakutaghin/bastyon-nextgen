package com.bastyon.app.plugins.save;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;

import java.io.IOException;
import java.io.OutputStream;

/**
 * Документ, созданный системным окном «Сохранить как» (Android 7–9, где
 * MediaStore не пускает в «Загрузки» без разрешения на память). Папку выбрал
 * человек — какую, приложение не знает, поэтому в итоге её нет.
 */
final class DocumentTarget implements SaveSessions.Target {
    private final ContentResolver resolver;
    private final Uri uri;
    private final String name;

    DocumentTarget(ContentResolver resolver, Uri uri, String name) {
        this.resolver = resolver;
        this.uri = uri;
        this.name = name;
    }

    @Override
    public OutputStream open() throws IOException {
        OutputStream out = resolver.openOutputStream(uri, "w");
        if (out == null) throw new IOException("no output stream");
        return out;
    }

    @Override
    public SaveSessions.Saved commit() {
        return new SaveSessions.Saved(displayName(resolver, uri, name), null);
    }

    @Override
    public void discard() {
        try {
            DocumentsContract.deleteDocument(resolver, uri);
        } catch (Exception ignored) {
            // Пустой документ останется — удалить его можно в «Файлах».
        }
    }

    /** Имя, под которым файл лёг на самом деле; не узнать — то, что просили. */
    static String displayName(ContentResolver resolver, Uri uri, String fallback) {
        try (Cursor c = resolver.query(uri, new String[] {OpenableColumns.DISPLAY_NAME},
                null, null, null)) {
            if (c != null && c.moveToFirst()) {
                String got = c.getString(0);
                if (got != null && !got.isEmpty()) return got;
            }
        } catch (RuntimeException ignored) {
            // Провайдер не отвечает на запрос — имя как просили.
        }
        return fallback;
    }
}
