package com.bastyon.app.plugins.offline;

import android.content.Context;

import androidx.annotation.Nullable;

import java.io.File;

/**
 * Что из скачанного можно отдать наружу («Сохранить файлом», плагин
 * DeviceSave): только целиком скачанный {@code video.mp4} по проверенному id.
 * Путь страница не передаёт и не видит — иначе через сохранение в общую
 * папку можно было бы вынести любой файл приложения.
 */
public final class OfflineExport {
    private OfflineExport() {}

    /** null — id неверный или ролик ещё не скачан (пока качается, это video.mp4.part). */
    @Nullable
    public static File finishedVideo(Context context, @Nullable String id) {
        if (!OfflineStore.validId(id)) return null;
        File video = new File(OfflineManager.get(context).dir(id), OfflineStore.VIDEO);
        return video.isFile() ? video : null;
    }
}
