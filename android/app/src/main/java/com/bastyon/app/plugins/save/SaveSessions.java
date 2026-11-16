package com.bastyon.app.plugins.save;

import androidx.annotation.Nullable;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Запись файла на устройство — без Android, чтобы проверять JVM-тестами.
 * Куда пишем (MediaStore «Загрузки» или документ из окна «Сохранить как») —
 * за {@link Target}. Страница шлёт файл кусками: {@link #start} →
 * {@link #append}… → {@link #finish} или {@link #abort}; готовый файл с диска
 * копируется целиком ({@link #copy}). Любой сбой записи убирает недописанный
 * файл: обрезок в «Загрузках» не остаётся.
 */
final class SaveSessions {
    /** Куда пишется файл. */
    interface Target {
        OutputStream open() throws IOException;

        /** Файл дописан и закрыт: сделать его видимым, вернуть итоговое имя. */
        Saved commit() throws IOException;

        /** Убрать недописанное; ошибки глотаются. */
        void discard();
    }

    /** Что получилось: имя (система могла добавить « (1)») и папка, если она известна. */
    static final class Saved {
        final String name;
        @Nullable final String folder;

        Saved(String name, @Nullable String folder) {
            this.name = name;
            this.folder = folder;
        }
    }

    /** Нет такой записи: закончилась, отменена или токен чужой. */
    static final class UnknownSession extends IOException {
        UnknownSession() {
            super("unknown_session");
        }
    }

    private static final class Session {
        final Target target;
        final OutputStream out;

        Session(Target target, OutputStream out) {
            this.target = target;
            this.out = out;
        }
    }

    /** Как в JS (safeFileName): имя файла не длиннее 150 знаков. */
    static final int NAME_MAX = 150;
    private static final String FORBIDDEN = ":*?\"<>|";
    private static final int BUFFER = 64 * 1024;

    private final Map<String, Session> open = new ConcurrentHashMap<>();

    /** Открыть запись; не открылась — цель убрана. */
    String start(Target target) throws IOException {
        OutputStream out;
        try {
            out = target.open();
        } catch (IOException | RuntimeException e) {
            target.discard();
            throw e;
        }
        String token = UUID.randomUUID().toString();
        open.put(token, new Session(target, out));
        return token;
    }

    void append(@Nullable String token, byte[] data) throws IOException {
        Session s = token != null ? open.get(token) : null;
        if (s == null) throw new UnknownSession();
        try {
            s.out.write(data);
        } catch (IOException | RuntimeException e) {
            abort(token);
            throw e;
        }
    }

    Saved finish(@Nullable String token) throws IOException {
        Session s = token != null ? open.remove(token) : null;
        if (s == null) throw new UnknownSession();
        try {
            s.out.close();
            return s.target.commit();
        } catch (IOException | RuntimeException e) {
            s.target.discard();
            throw e;
        }
    }

    /** Отмена: недописанное удаляется. Неизвестный токен — ничего. */
    void abort(@Nullable String token) {
        Session s = token != null ? open.remove(token) : null;
        if (s == null) return;
        closeQuietly(s.out);
        s.target.discard();
    }

    /** Приложение закрывается: незаконченные записи не оставляем. */
    void abortAll() {
        for (String token : new ArrayList<>(open.keySet())) abort(token);
    }

    int openCount() {
        return open.size();
    }

    /** Файл с диска целиком — мимо моста Capacitor. */
    static Saved copy(File from, Target to) throws IOException {
        try (InputStream in = new FileInputStream(from)) {
            OutputStream out = to.open();
            try {
                byte[] buf = new byte[BUFFER];
                for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
            } finally {
                out.close();
            }
            return to.commit();
        } catch (IOException | RuntimeException e) {
            to.discard();
            throw e;
        }
    }

    /**
     * Имя из страницы — ещё раз начисто, как safeFileName в JS: без пути,
     * управляющих и запрещённых в именах знаков, без точек в начале.
     */
    static String cleanName(@Nullable String raw) {
        String base = raw == null ? "" : raw;
        base = base.substring(Math.max(base.lastIndexOf('/'), base.lastIndexOf('\\')) + 1);
        StringBuilder b = new StringBuilder(base.length());
        for (int i = 0; i < base.length(); i++) {
            char c = base.charAt(i);
            if (c < 0x20 || c == 0x7f || FORBIDDEN.indexOf(c) >= 0) continue;
            b.append(c);
        }
        String name = b.toString().trim();
        int start = 0;
        while (start < name.length() && name.charAt(start) == '.') start++;
        name = name.substring(start);
        int points = name.codePointCount(0, name.length());
        if (points > NAME_MAX) name = name.substring(0, name.offsetByCodePoints(0, NAME_MAX));
        return name.isEmpty() ? "download" : name;
    }

    private static void closeQuietly(OutputStream out) {
        try {
            out.close();
        } catch (IOException ignored) {
            // Отмена: файл всё равно удаляется.
        }
    }
}
