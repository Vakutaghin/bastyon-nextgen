package com.bastyon.app.plugins.offline;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.After;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;

/**
 * Отдача скачанного странице ({@code /_offline_/<id>/<файл>}) и проверки
 * имён — как у компьютера (src-tauri/src/offline/protocol.rs, store.rs).
 */
public class OfflineFilesTest {
    private File root;

    @After
    public void cleanup() {
        if (root != null) OfflineStore.deleteRecursive(root);
    }

    private static byte[] readAll(InputStream in) throws IOException {
        try (InputStream s = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = s.read(buf)) != -1) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    /**
     * Как WebView читает тело ответа на запрос с Range (Chromium, android_webview
     * InputStreamReader::Seek): available() — длина, по ней границы, начало —
     * через skip(); available() == 0 — пропускает только явно заданное начало.
     */
    private static byte[] webView(OfflineFiles.Response r, String range) throws IOException {
        InputStream in = r.body;
        if (range != null) {
            String spec = range.substring("bytes=".length());
            int dash = spec.indexOf('-');
            String a = spec.substring(0, dash);
            String b = spec.substring(dash + 1);
            long first = a.isEmpty() ? -1 : Long.parseLong(a);
            int size = in.available();
            if (size > 0) {
                if (a.isEmpty()) first = Math.max(0, size - Long.parseLong(b));
                if (first >= size) throw new IOException("ERR_REQUEST_RANGE_NOT_SATISFIABLE");
            }
            long toSkip = first;
            while (toSkip > 0) {
                // Ответ skip() WebView кладёт в int.
                int skipped = (int) in.skip(toSkip);
                if (skipped < 0) throw new IOException("ERR_FAILED");
                if (skipped == 0) throw new IOException("ERR_REQUEST_RANGE_NOT_SATISFIABLE");
                toSkip -= skipped;
            }
        }
        return readAll(in);
    }

    @Test
    public void ranges() {
        assertArrayEquals(new long[] {0, 1}, OfflineFiles.parseRange("bytes=0-1", 10));
        assertArrayEquals(new long[] {5, 9}, OfflineFiles.parseRange("bytes=5-", 10));
        assertArrayEquals(new long[] {7, 9}, OfflineFiles.parseRange("bytes=-3", 10));
        assertArrayEquals(new long[] {0, 9}, OfflineFiles.parseRange("bytes=-30", 10));
        assertArrayEquals(new long[] {8, 9}, OfflineFiles.parseRange("bytes=8-100", 10));
        assertNull(OfflineFiles.parseRange("bytes=10-", 10));
        assertNull(OfflineFiles.parseRange("bytes=3-2", 10));
        assertNull(OfflineFiles.parseRange("items=0-1", 10));
        assertNull(OfflineFiles.parseRange("bytes=-0", 10));
        assertNull(OfflineFiles.parseRange("bytes=0-1", 0));
        assertArrayEquals(new long[] {0, 1}, OfflineFiles.parseRange("bytes=0-1,4-5", 10));
        long big = 5_000_000_000L;
        assertArrayEquals(new long[] {4_000_000_000L, big - 1}, OfflineFiles.parseRange("bytes=4000000000-", big));
    }

    @Test
    public void idsAndNamesCannotLeaveTheFolder() {
        assertTrue(OfflineStore.validId("238e3bd3-e707-4cb1-acb2-06b8594b71a5-360"));
        assertFalse(OfflineStore.validId(""));
        assertFalse(OfflineStore.validId(null));
        assertFalse(OfflineStore.validId("../x"));
        assertFalse(OfflineStore.validId("a/b"));
        assertFalse(OfflineStore.validId("a.b"));
        assertFalse(OfflineStore.validId(new String(new char[101]).replace('\0', 'a')));
        assertTrue(OfflineStore.validExtraName("thumb.jpg"));
        assertTrue(OfflineStore.validExtraName("avatar.jpg"));
        assertTrue(OfflineStore.validExtraName("captions/pt-BR.vtt"));
        assertTrue(OfflineStore.validExtraName("playlist.m3u8"));
        assertFalse(OfflineStore.validExtraName("other.m3u8"));
        assertFalse(OfflineStore.validExtraName("captions/x.m3u8"));
        assertFalse(OfflineStore.validExtraName("playlist.m3u8.tmp"));
        assertFalse(OfflineStore.validExtraName("captions/../meta.vtt"));
        assertFalse(OfflineStore.validExtraName("captions/.vtt"));
        assertFalse(OfflineStore.validExtraName("captions/a/b.vtt"));
        assertFalse(OfflineStore.validExtraName("video.mp4"));
        assertFalse(OfflineStore.validExtraName("meta.json"));
        assertTrue(OfflineStore.validUrl("https://peertube701.pocketnet.app/static/x.mp4"));
        assertTrue(OfflineStore.validUrl("http://127.0.0.1:8765/video.mp4"));
        assertFalse(OfflineStore.validUrl("file:///etc/passwd"));
        assertFalse(OfflineStore.validUrl("bastyon-offline://localhost/x"));
        assertFalse(OfflineStore.validUrl("https:///nohost"));
        assertFalse(OfflineStore.validUrl(null));
    }

    @Test
    public void jobsAreCheckedLikeOnTheDesktop() {
        OfflineStore.Job ok = new OfflineStore.Job("abc-360", Collections.singletonList("https://a.b/x.mp4"),
                "x.mp4", Collections.singletonList("https://a.b/sha.json"),
                Collections.singletonList(new OfflineStore.Extra("captions/ru.vtt", "https://a.b/ru.vtt")), 10);
        assertNull(ok.validate());
        assertEquals("invalid_id", new OfflineStore.Job("../x", ok.sources, "x", ok.sha256Urls, ok.extras, 1).validate());
        assertEquals("invalid_sources", new OfflineStore.Job("a", new ArrayList<>(), "x", ok.sha256Urls, ok.extras, 1).validate());
        assertEquals("invalid_sources", new OfflineStore.Job("a", Collections.singletonList("file:///x"), "x",
                ok.sha256Urls, ok.extras, 1).validate());
        assertEquals("invalid_sources", new OfflineStore.Job("a", ok.sources, "x",
                Collections.singletonList("ftp://a/b"), ok.extras, 1).validate());
        assertEquals("invalid_extras", new OfflineStore.Job("a", ok.sources, "x", ok.sha256Urls,
                Collections.singletonList(new OfflineStore.Extra("meta.json", "https://a.b/m")), 1).validate());
    }

    @Test
    public void servesRangesAndOnlyKnownFiles() throws Exception {
        root = Files.createTempDirectory("bastyon-offline-files").toFile();
        File dir = new File(root, "abc-360");
        assertTrue(new File(dir, "captions").mkdirs());
        byte[] video = new byte[3 * 1024 * 1024 + 17];
        for (int i = 0; i < video.length; i++) video[i] = (byte) i;
        Files.write(new File(dir, "video.mp4").toPath(), video);
        Files.write(new File(dir, "captions/ru.vtt").toPath(), "WEBVTT".getBytes(StandardCharsets.UTF_8));
        Files.write(new File(dir, "thumb.jpg").toPath(), new byte[] {1, 2, 3});
        Files.write(new File(dir, "meta.json").toPath(), "{}".getBytes(StandardCharsets.UTF_8));
        Files.write(new File(dir, "video.mp4.part").toPath(), "x".getBytes(StandardCharsets.UTF_8));

        OfflineFiles.Response r = OfflineFiles.respond(root, "/_offline_/abc-360/video.mp4", "GET", "bytes=100-199");
        assertEquals(206, r.status);
        assertEquals("Partial Content", r.reason);
        assertEquals("video/mp4", r.mime);
        assertEquals("bytes 100-199/" + video.length, r.headers.get("Content-Range"));
        assertEquals("bytes", r.headers.get("Accept-Ranges"));
        assertEquals("*", r.headers.get("Access-Control-Allow-Origin"));
        // Длину ставит WebView сам, по available().
        assertNull(r.headers.get("Content-Length"));
        assertEquals(200, r.body.available());
        assertArrayEquals(Arrays.copyOfRange(video, 100, 200), webView(r, "bytes=100-199"));

        // Конец файла: bytes=-n.
        r = OfflineFiles.respond(root, "/_offline_/abc-360/video.mp4", "GET", "bytes=-10");
        assertEquals("bytes " + (video.length - 10) + "-" + (video.length - 1) + "/" + video.length,
                r.headers.get("Content-Range"));
        assertArrayEquals(Arrays.copyOfRange(video, video.length - 10, video.length), webView(r, "bytes=-10"));

        // Открытый диапазон — с нужного места до конца.
        r = OfflineFiles.respond(root, "/_offline_/abc-360/video.mp4", "GET", "bytes=2000000-");
        assertEquals(206, r.status);
        assertEquals("bytes 2000000-" + (video.length - 1) + "/" + video.length, r.headers.get("Content-Range"));
        assertArrayEquals(Arrays.copyOfRange(video, 2_000_000, video.length), webView(r, "bytes=2000000-"));

        // Без Range — весь файл потоком.
        r = OfflineFiles.respond(root, "/_offline_/abc-360/video.mp4", "GET", null);
        assertEquals(200, r.status);
        assertNull(r.headers.get("Content-Range"));
        assertArrayEquals(video, readAll(r.body));

        r = OfflineFiles.respond(root, "/_offline_/abc-360/video.mp4", "HEAD", "bytes=10-19");
        assertEquals(206, r.status);
        assertEquals(0, webView(r, "bytes=10-19").length);

        r = OfflineFiles.respond(root, "/_offline_/abc-360/video.mp4", "GET", "bytes=999999999-");
        assertEquals(416, r.status);
        assertEquals("bytes */" + video.length, r.headers.get("Content-Range"));
        // Ответ доходит до страницы статусом, а не сетевой ошибкой.
        assertEquals(0, webView(r, "bytes=999999999-").length);

        r = OfflineFiles.respond(root, "/_offline_/abc-360/captions/ru.vtt", "GET", null);
        assertEquals(200, r.status);
        assertEquals("text/vtt", r.mime);
        assertEquals("utf-8", r.encoding);
        assertArrayEquals("WEBVTT".getBytes(StandardCharsets.UTF_8), readAll(r.body));

        r = OfflineFiles.respond(root, "/_offline_/abc-360/thumb.jpg", "GET", null);
        assertEquals("image/jpeg", r.mime);
        assertArrayEquals(new byte[] {1, 2, 3}, readAll(r.body));

        assertEquals(405, OfflineFiles.respond(root, "/_offline_/abc-360/thumb.jpg", "POST", null).status);

        for (String path : new String[] {
                "/_offline_/abc-360/meta.json",
                "/_offline_/abc-360/state.json",
                "/_offline_/abc-360/video.mp4.part",
                "/_offline_/abc-360/../../etc/passwd",
                "/_offline_/../abc-360/video.mp4",
                "/_offline_/abc-360",
                "/_offline_/abc-360/",
                "/_offline_/other/video.mp4",
                "/_offline_/abc-360/avatar.jpg",
                "/other/abc-360/video.mp4",
        }) {
            assertEquals(path, 404, OfflineFiles.respond(root, path, "GET", null).status);
        }
    }

    @Test
    public void filesOverTwoGigabytesSeekByLong() throws Exception {
        root = Files.createTempDirectory("bastyon-offline-big").toFile();
        File dir = new File(root, "big-1080");
        assertTrue(dir.mkdirs());
        long len = 3L * 1024 * 1024 * 1024 + 5;
        // Разреженный файл: места на диске почти не занимает. ext4 и APFS
        // разрежают сами, NTFS — только с SPARSE при создании: без него Windows
        // писала на диск все 3 ГБ нулей, и тест шёл минуту.
        Files.newByteChannel(new File(dir, "video.mp4").toPath(),
                StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE, StandardOpenOption.SPARSE).close();
        try (RandomAccessFile f = new RandomAccessFile(new File(dir, "video.mp4"), "rw")) {
            f.setLength(len);
            f.seek(3_000_000_000L);
            f.write(new byte[] {9, 8, 7});
        }
        OfflineFiles.Response r = OfflineFiles.respond(root, "/_offline_/big-1080/video.mp4", "GET",
                "bytes=3000000000-3000000009");
        assertEquals(206, r.status);
        assertEquals("bytes 3000000000-3000000009/" + len, r.headers.get("Content-Range"));
        // available() — int: у такого файла молчит, и WebView не режет границы по 2 ГБ.
        assertEquals(0, r.body.available());
        assertArrayEquals(new byte[] {9, 8, 7, 0, 0, 0, 0, 0, 0, 0}, webView(r, "bytes=3000000000-3000000009"));

        r = OfflineFiles.respond(root, "/_offline_/big-1080/video.mp4", "GET", "bytes=-4");
        assertEquals("bytes " + (len - 4) + "-" + (len - 1) + "/" + len, r.headers.get("Content-Range"));
        try (RandomAccessFile f = new RandomAccessFile(new File(dir, "video.mp4"), "rw")) {
            f.seek(len - 4);
            f.write(new byte[] {1, 2, 3, 4});
        }
        assertArrayEquals(new byte[] {1, 2, 3, 4}, webView(r, "bytes=-4"));
    }
}
