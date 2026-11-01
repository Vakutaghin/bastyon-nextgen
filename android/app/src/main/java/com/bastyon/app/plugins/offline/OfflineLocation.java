package com.bastyon.app.plugins.offline;

import android.content.Context;
import android.os.Environment;

import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Где лежит скачанное: во внутренней памяти приложения ({@code files/offline})
 * или на карте памяти ({@code Android/data/<пакет>/files/offline} на съёмном
 * томе — удаляется вместе с приложением, разрешений не нужно). Выбор хранит
 * OfflineManager; карты нет на месте — качаем во внутреннюю, а выбранная
 * помечена недоступной.
 *
 * <p>Перенос — как у компьютера (src-tauri/src/offline/location.rs): папки
 * роликов копируются целиком (между томами переименовать нельзя), старые
 * удаляются, когда на новом месте всё; сбой посередине возвращает всё как было.
 */
final class OfflineLocation {
    static final String INTERNAL = "internal";
    static final String SD = "sd";
    /** Сверх размера скачанного должно оставаться свободным на новом месте. */
    static final long SPARE = 200L * 1024 * 1024;
    private static final String COPYING = ".moving";

    private OfflineLocation() {}

    interface Progress {
        void step(int done, int total);
    }

    /** Папка на подключённой карте памяти; null — карты нет. */
    @Nullable
    static File sdRoot(Context context) {
        File[] dirs = ContextCompat.getExternalFilesDirs(context, null);
        for (File dir : dirs) {
            if (dir == null) continue;
            try {
                if (Environment.isExternalStorageRemovable(dir)
                        && Environment.MEDIA_MOUNTED.equals(Environment.getExternalStorageState(dir))) {
                    return new File(dir, "offline");
                }
            } catch (IllegalArgumentException e) {
                // Том пропал между вызовами.
            }
        }
        return null;
    }

    static File internalRoot(Context context) {
        return OfflineStore.root(context);
    }

    /** Хватит ли места под {@code used} байт; {@code free} −1 — не узнать, не мешаем. */
    static boolean enoughSpace(long used, long free) {
        return free < 0 || free >= used + SPARE;
    }

    /**
     * Перенести папки роликов {@code ids} из {@code from} в {@code to}. Ошибка —
     * всё как было и код: {@code target_busy} (там уже есть такой ролик),
     * {@code no_space}, {@code io}.
     */
    static void moveItems(File from, File to, List<String> ids, @Nullable Progress progress)
            throws OfflineStore.OfflineException {
        //noinspection ResultOfMethodCallIgnored
        to.mkdirs();
        if (!to.isDirectory()) throw new OfflineStore.OfflineException("io");
        List<String> copied = new ArrayList<>();
        for (int i = 0; i < ids.size(); i++) {
            String id = ids.get(i);
            File dst = new File(to, id);
            if (dst.exists()) {
                rollback(to, copied);
                throw new OfflineStore.OfflineException("target_busy");
            }
            File tmp = new File(to, id + COPYING);
            OfflineStore.deleteRecursive(tmp);
            try {
                copyDir(new File(from, id), tmp);
                if (!tmp.renameTo(dst)) throw new IOException("rename");
            } catch (IOException e) {
                OfflineStore.deleteRecursive(tmp);
                rollback(to, copied);
                throw new OfflineStore.OfflineException(isNoSpace(e) ? "no_space" : "io");
            }
            copied.add(id);
            if (progress != null) progress.step(i + 1, ids.size());
        }
        // Всё на новом месте — старые копии больше не нужны.
        for (String id : copied) OfflineStore.deleteRecursive(new File(from, id));
    }

    private static void rollback(File to, List<String> copied) {
        for (String id : copied) OfflineStore.deleteRecursive(new File(to, id));
    }

    private static boolean isNoSpace(IOException e) {
        String m = e.getMessage();
        return m != null && (m.contains("ENOSPC") || m.contains("No space left"));
    }

    static void copyDir(File from, File to) throws IOException {
        if (!to.isDirectory() && !to.mkdirs()) throw new IOException("mkdir " + to);
        File[] children = from.listFiles();
        if (children == null) throw new IOException("list " + from);
        for (File c : children) {
            File target = new File(to, c.getName());
            if (c.isDirectory()) {
                copyDir(c, target);
            } else {
                try (InputStream in = new FileInputStream(c); OutputStream out = new FileOutputStream(target)) {
                    byte[] buf = new byte[1 << 16];
                    int n;
                    while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
                }
            }
        }
    }
}
