package com.bastyon.app.plugins.save;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.After;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Random;

/**
 * Запись файла на телефон: куски по порядку, итог — имя от цели; отмена и
 * любой сбой записи убирают недописанное; копия скачанного ролика с диска;
 * имя из страницы — начисто.
 */
public class SaveSessionsTest {
    /** Цель в памяти: что записано, закрыто ли, видим ли файл, убран ли. */
    private static final class FakeTarget implements SaveSessions.Target {
        final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        boolean closed;
        boolean committed;
        boolean discarded;
        boolean failOpen;
        boolean failCommit;
        int failWriteAfter = -1;

        @Override
        public OutputStream open() throws IOException {
            if (failOpen) throw new IOException("no space");
            return new OutputStream() {
                @Override
                public void write(int b) throws IOException {
                    write(new byte[] {(byte) b}, 0, 1);
                }

                @Override
                public void write(byte[] b, int off, int len) throws IOException {
                    if (failWriteAfter >= 0 && bytes.size() + len > failWriteAfter) {
                        throw new IOException("disk full");
                    }
                    bytes.write(b, off, len);
                }

                @Override
                public void close() {
                    closed = true;
                }
            };
        }

        @Override
        public SaveSessions.Saved commit() throws IOException {
            if (failCommit) throw new IOException("provider gone");
            committed = true;
            return new SaveSessions.Saved("Ролик (1).mp4", "Download/Bastyon");
        }

        @Override
        public void discard() {
            discarded = true;
        }
    }

    private File temp;

    @After
    public void cleanup() {
        if (temp != null) temp.delete();
    }

    private static byte[] utf8(String s) {
        return s.getBytes(StandardCharsets.UTF_8);
    }

    @Test
    public void кускиПоПорядкуИтогОтЦели() throws IOException {
        SaveSessions sessions = new SaveSessions();
        FakeTarget target = new FakeTarget();
        String token = sessions.start(target);
        sessions.append(token, utf8("раз "));
        sessions.append(token, utf8("два"));
        SaveSessions.Saved saved = sessions.finish(token);

        assertEquals("раз два", target.bytes.toString("UTF-8"));
        assertTrue(target.closed);
        assertTrue(target.committed);
        assertFalse(target.discarded);
        assertEquals("Ролик (1).mp4", saved.name);
        assertEquals("Download/Bastyon", saved.folder);
        assertEquals(0, sessions.openCount());
    }

    @Test
    public void законченнаяЗаписьБольшеНеПринимаетКуски() throws IOException {
        SaveSessions sessions = new SaveSessions();
        String token = sessions.start(new FakeTarget());
        sessions.finish(token);
        try {
            sessions.append(token, utf8("x"));
            fail("кусок после конца");
        } catch (SaveSessions.UnknownSession expected) {
            // так и надо
        }
        try {
            sessions.finish(token);
            fail("второй конец");
        } catch (SaveSessions.UnknownSession expected) {
            // так и надо
        }
        try {
            sessions.append(null, utf8("x"));
            fail("без токена");
        } catch (SaveSessions.UnknownSession expected) {
            // так и надо
        }
    }

    @Test
    public void отменаУбираетНедописанное() throws IOException {
        SaveSessions sessions = new SaveSessions();
        FakeTarget target = new FakeTarget();
        String token = sessions.start(target);
        sessions.append(token, utf8("половина"));
        sessions.abort(token);

        assertTrue(target.closed);
        assertTrue(target.discarded);
        assertFalse(target.committed);
        assertEquals(0, sessions.openCount());
        // Повторная отмена и чужой токен — ничего.
        sessions.abort(token);
        sessions.abort("чужой");
        sessions.abort(null);
    }

    @Test
    public void сбойЗаписиКускаУбираетФайлИЗакрываетЗапись() throws IOException {
        SaveSessions sessions = new SaveSessions();
        FakeTarget target = new FakeTarget();
        target.failWriteAfter = 4;
        String token = sessions.start(target);
        sessions.append(token, utf8("abcd"));
        try {
            sessions.append(token, utf8("e"));
            fail("место кончилось");
        } catch (SaveSessions.UnknownSession e) {
            fail("должна прийти ошибка записи, а не «нет записи»");
        } catch (IOException expected) {
            assertEquals("disk full", expected.getMessage());
        }
        assertTrue(target.discarded);
        assertEquals(0, sessions.openCount());
    }

    @Test
    public void неОткрылосьЦельУбрана() {
        SaveSessions sessions = new SaveSessions();
        FakeTarget target = new FakeTarget();
        target.failOpen = true;
        try {
            sessions.start(target);
            fail("не открылось");
        } catch (IOException expected) {
            assertEquals("no space", expected.getMessage());
        }
        assertTrue(target.discarded);
        assertEquals(0, sessions.openCount());
    }

    @Test
    public void неСталВидимымУбран() throws IOException {
        SaveSessions sessions = new SaveSessions();
        FakeTarget target = new FakeTarget();
        target.failCommit = true;
        String token = sessions.start(target);
        sessions.append(token, utf8("всё"));
        try {
            sessions.finish(token);
            fail("провайдер пропал");
        } catch (IOException expected) {
            assertEquals("provider gone", expected.getMessage());
        }
        assertTrue(target.discarded);
        assertEquals(0, sessions.openCount());
    }

    @Test
    public void закрытиеПриложенияОтменяетВсеЗаписи() throws IOException {
        SaveSessions sessions = new SaveSessions();
        FakeTarget a = new FakeTarget();
        FakeTarget b = new FakeTarget();
        sessions.start(a);
        sessions.start(b);
        sessions.abortAll();
        assertTrue(a.discarded);
        assertTrue(b.discarded);
        assertEquals(0, sessions.openCount());
    }

    @Test
    public void копияСДискаЦеликом() throws IOException {
        // Больше буфера копирования (64 КБ) и не кратно ему.
        byte[] data = new byte[200_003];
        new Random(7).nextBytes(data);
        temp = File.createTempFile("video", ".mp4");
        Files.write(temp.toPath(), data);

        FakeTarget target = new FakeTarget();
        SaveSessions.Saved saved = SaveSessions.copy(temp, target);

        assertArrayEquals(data, target.bytes.toByteArray());
        assertTrue(target.closed);
        assertTrue(target.committed);
        assertFalse(target.discarded);
        assertEquals("Ролик (1).mp4", saved.name);
    }

    @Test
    public void копияОборваласьФайлУбранНеВиден() throws IOException {
        temp = File.createTempFile("video", ".mp4");
        Files.write(temp.toPath(), new byte[300_000]);
        FakeTarget target = new FakeTarget();
        target.failWriteAfter = 100_000;
        try {
            SaveSessions.copy(temp, target);
            fail("место кончилось");
        } catch (IOException expected) {
            assertEquals("disk full", expected.getMessage());
        }
        assertTrue(target.discarded);
        assertFalse(target.committed);
        assertTrue(target.closed);
    }

    @Test
    public void копияНетФайлаЦельУбрана() {
        FakeTarget target = new FakeTarget();
        try {
            SaveSessions.copy(new File("нет-такого-файла.mp4"), target);
            fail("файла нет");
        } catch (IOException expected) {
            // так и надо
        }
        assertTrue(target.discarded);
        assertFalse(target.committed);
    }

    @Test
    public void имяНачисто() {
        assertEquals("Ролик.mp4", SaveSessions.cleanName("Ролик.mp4"));
        assertEquals("passwd", SaveSessions.cleanName("../../etc/passwd"));
        assertEquals("b.txt", SaveSessions.cleanName("a\\b.txt"));
        assertEquals("Трек для дороги.m4a", SaveSessions.cleanName("Трек: для* дороги?.m4a"));
        assertEquals("hidden", SaveSessions.cleanName("...hidden"));
        assertEquals("ab", SaveSessions.cleanName("a\u0000\u001fb\u007f"));
        assertEquals("download", SaveSessions.cleanName("  "));
        assertEquals("download", SaveSessions.cleanName(null));
        assertEquals("download", SaveSessions.cleanName("dir/"));
    }

    @Test
    public void имяНеДлиннее150ЗнаковИЭмодзиНеРазрезается() {
        String smile = new String(Character.toChars(0x1F600));
        StringBuilder long1 = new StringBuilder();
        for (int i = 0; i < 200; i++) long1.append(smile);
        String cut = SaveSessions.cleanName(long1.toString());
        assertEquals(150, cut.codePointCount(0, cut.length()));
        assertEquals(300, cut.length());
        assertTrue(cut.endsWith(smile));
    }
}
