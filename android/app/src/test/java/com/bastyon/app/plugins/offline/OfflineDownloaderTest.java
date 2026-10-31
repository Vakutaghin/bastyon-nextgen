package com.bastyon.app.plugins.offline;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.After;
import org.junit.Test;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Загрузка ролика — те же случаи, что у компьютера
 * (src-tauri/src/offline/download.rs): куски, докачка с начала фрагмента,
 * побитый фрагмент, обрыв, нода без Range, следующий адрес, пауза, место.
 * Нода — свой сокет-сервер: файл по Range, обрывы и порча по заказу.
 */
public class OfflineDownloaderTest {

    /** Подменная нода. */
    static final class Node implements AutoCloseable {
        final ServerSocket server;
        final String base;
        final byte[] data;
        /** Отдать столько байт тела и оборвать соединение (один раз). */
        final AtomicReference<Integer> cutAfter = new AtomicReference<>();
        /** Испортить байт по этому смещению {смещение, сколько раз}. */
        final AtomicReference<long[]> corruptAt = new AtomicReference<>();
        volatile boolean missing;
        volatile boolean noRange;
        /** Отвечать этим кодом вместо файла. */
        volatile int failWith;
        /** С этого места — 206 без единого байта тела; −1 — нет. */
        volatile long emptyFrom = -1;
        /** Небольшие файлы по пути (обложки, плейлист). */
        final Map<String, byte[]> small = new java.util.concurrent.ConcurrentHashMap<>();
        final AtomicLong served = new AtomicLong();
        final AtomicInteger requests = new AtomicInteger();

        Node(byte[] data) throws IOException {
            this.data = data;
            server = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
            base = "http://127.0.0.1:" + server.getLocalPort();
            Thread t = new Thread(this::acceptLoop, "node");
            t.setDaemon(true);
            t.start();
        }

        private void acceptLoop() {
            while (!server.isClosed()) {
                try {
                    Socket s = server.accept();
                    Thread t = new Thread(() -> handle(s));
                    t.setDaemon(true);
                    t.start();
                } catch (IOException e) {
                    return;
                }
            }
        }

        private void handle(Socket socket) {
            try (Socket s = socket) {
                InputStream in = s.getInputStream();
                StringBuilder head = new StringBuilder();
                int b;
                while ((b = in.read()) != -1) {
                    head.append((char) b);
                    if (head.length() >= 4 && head.substring(head.length() - 4).equals("\r\n\r\n")) break;
                }
                String[] lines = head.toString().split("\r\n");
                String path = lines[0].split(" ")[1];
                String range = null;
                for (String l : lines) {
                    String low = l.toLowerCase(Locale.ROOT);
                    if (low.startsWith("range: bytes=")) range = l.substring("range: bytes=".length()).trim();
                }
                OutputStream out = s.getOutputStream();
                requests.incrementAndGet();
                if (failWith > 0) {
                    out.write(("HTTP/1.1 " + failWith + " Oops\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                            .getBytes(StandardCharsets.US_ASCII));
                    return;
                }
                byte[] smallBody = small.get(path);
                if (smallBody != null) {
                    out.write(("HTTP/1.1 200 OK\r\nContent-Length: " + smallBody.length + "\r\nConnection: close\r\n\r\n")
                            .getBytes(StandardCharsets.US_ASCII));
                    out.write(smallBody);
                    return;
                }
                if (missing || !path.equals("/video.mp4")) {
                    out.write("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                            .getBytes(StandardCharsets.US_ASCII));
                    return;
                }
                long total = data.length;
                long start = 0;
                long end = total - 1;
                int status = 200;
                if (range != null && !noRange) {
                    String[] ab = range.split("-", -1);
                    start = Long.parseLong(ab[0]);
                    end = ab[1].isEmpty() ? total - 1 : Math.min(Long.parseLong(ab[1]), total - 1);
                    status = 206;
                }
                if (emptyFrom >= 0 && start >= emptyFrom) {
                    out.write(("HTTP/1.1 206 Partial Content\r\nContent-Range: bytes " + start + "-" + end + "/" + total
                            + "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
                    return;
                }
                byte[] body = new byte[(int) (end - start + 1)];
                System.arraycopy(data, (int) start, body, 0, body.length);
                synchronized (corruptAt) {
                    long[] c = corruptAt.get();
                    if (c != null && c[1] > 0 && c[0] >= start && c[0] <= end) {
                        body[(int) (c[0] - start)] ^= (byte) 0xff;
                        corruptAt.set(new long[] {c[0], c[1] - 1});
                    }
                }
                StringBuilder reply = new StringBuilder();
                if (status == 206) {
                    reply.append("HTTP/1.1 206 Partial Content\r\nContent-Range: bytes ")
                            .append(start).append('-').append(end).append('/').append(total).append("\r\n");
                } else {
                    reply.append("HTTP/1.1 200 OK\r\n");
                }
                reply.append("Content-Length: ").append(body.length).append("\r\nConnection: close\r\n\r\n");
                out.write(reply.toString().getBytes(StandardCharsets.US_ASCII));
                Integer cut = cutAfter.getAndSet(null);
                int send = cut != null ? Math.min(cut, body.length) : body.length;
                out.write(body, 0, send);
                out.flush();
                served.addAndGet(send);
            } catch (IOException ignored) {
                // Клиент оборвал — так и задумано в тестах паузы.
            }
        }

        @Override
        public void close() throws IOException {
            server.close();
        }
    }

    private final List<File> dirs = new ArrayList<>();
    private final List<Node> nodes = new ArrayList<>();

    @After
    public void cleanup() throws IOException {
        for (Node n : nodes) n.close();
        for (File d : dirs) OfflineStore.deleteRecursive(d);
    }

    private Node node(byte[] data) throws IOException {
        Node n = new Node(data);
        nodes.add(n);
        return n;
    }

    private File tempDir(String name) throws IOException {
        File d = Files.createTempDirectory("bastyon-offline-" + name).toFile();
        dirs.add(d);
        return d;
    }

    static byte[] sample(int len) {
        byte[] out = new byte[len];
        for (int i = 0; i < len; i++) out[i] = (byte) (i * 7 + i / 251);
        return out;
    }

    /** Суммы как у PeerTube: заголовок без суммы, дальше фрагменты. */
    static List<OfflineDownloader.HashRange> hashes(byte[] data, int header, int fragment) throws Exception {
        List<OfflineDownloader.HashRange> out = new ArrayList<>();
        int start = header;
        while (start < data.length) {
            int end = Math.min(start + fragment, data.length) - 1;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(data, start, end - start + 1);
            out.add(new OfflineDownloader.HashRange(start, end, OfflineDownloader.hex(md.digest())));
            start = end + 1;
        }
        return out;
    }

    static OfflineDownloader.Policy quick() {
        return new OfflineDownloader.Policy(64 * 1024, new long[] {10, 10, 10}, 5_000);
    }

    static OfflineStore.Job job(Node node, long size) {
        return new OfflineStore.Job("v-144", new ArrayList<>(Collections.singletonList(node.base + "/video.mp4")),
                "video.mp4", new ArrayList<>(), new ArrayList<>(), size);
    }

    static final OfflineDownloader.Net DIRECT = url -> (HttpURLConnection) new URL(url).openConnection();

    /** Итог: код ошибки (null — скачано) и все записанные состояния. */
    static final class Result {
        String error;
        final List<OfflineStore.State> persisted = new ArrayList<>();
    }

    private Result download(File dir, OfflineStore.Job job, OfflineStore.State state,
                            List<OfflineDownloader.HashRange> ranges, long free) {
        Result r = new Result();
        OfflineDownloader d = new OfflineDownloader(DIRECT, quick(), dir, job, state,
                (s, persist) -> {
                    if (persist) r.persisted.add(s.copy());
                },
                () -> free, x -> ranges);
        try {
            d.run();
        } catch (OfflineDownloader.DlException e) {
            r.error = e.code;
        }
        return r;
    }

    private static byte[] read(File f) throws IOException {
        return Files.readAllBytes(f.toPath());
    }

    @Test
    public void downloadsInChunksAndChecksEveryFragment() throws Exception {
        byte[] data = sample(300_000);
        Node node = node(data);
        File dir = tempDir("full");
        OfflineStore.State state = OfflineStore.State.queued(0);
        // Размер заранее не известен — его даёт Content-Range первого куска.
        Result r = download(dir, job(node, 0), state, hashes(data, 1343, 50_000), -1);
        assertNull(r.error);
        assertArrayEquals(data, read(new File(dir, OfflineStore.VIDEO)));
        assertFalse(new File(dir, OfflineStore.PART).exists());
        assertEquals(300_000, state.received);
        assertEquals(300_000, state.total);
        // Куски по 64 КиБ.
        assertEquals(5, node.requests.get());
        assertTrue(r.persisted.size() >= 5);
    }

    @Test
    public void resumesFromTheLastWholeFragment() throws Exception {
        byte[] data = sample(300_000);
        Node node = node(data);
        File dir = tempDir("resume");
        // Прошлый запуск записал 120 000 байт, но середину фрагмента 101 343…
        byte[] head = new byte[120_000];
        System.arraycopy(data, 0, head, 0, head.length);
        Files.write(new File(dir, OfflineStore.PART).toPath(), head);
        OfflineStore.State state = new OfflineStore.State(OfflineStore.DOWNLOADING, 120_000, 300_000, null);
        Result r = download(dir, job(node, 300_000), state, hashes(data, 1343, 50_000), -1);
        assertNull(r.error);
        assertArrayEquals(data, read(new File(dir, OfflineStore.VIDEO)));
        // …поэтому продолжили с его начала, а не с нуля.
        assertEquals(300_000 - 101_343, node.served.get());
    }

    @Test
    public void stateAheadOfTheFileResumesFromTheFile() throws Exception {
        byte[] data = sample(200_000);
        Node node = node(data);
        File dir = tempDir("ahead");
        byte[] head = new byte[70_000];
        System.arraycopy(data, 0, head, 0, head.length);
        Files.write(new File(dir, OfflineStore.PART).toPath(), head);
        // state.json успел записать больше, чем дошло до файла.
        OfflineStore.State state = new OfflineStore.State(OfflineStore.DOWNLOADING, 150_000, 200_000, null);
        Result r = download(dir, job(node, 200_000), state, new ArrayList<>(), -1);
        assertNull(r.error);
        assertArrayEquals(data, read(new File(dir, OfflineStore.VIDEO)));
        assertEquals(130_000, node.served.get());
    }

    @Test
    public void brokenFragmentIsFetchedAgain() throws Exception {
        byte[] data = sample(300_000);
        Node node = node(data);
        node.corruptAt.set(new long[] {160_000, 1});
        File dir = tempDir("corrupt-once");
        Result r = download(dir, job(node, 300_000), OfflineStore.State.queued(0), hashes(data, 1343, 50_000), -1);
        assertNull(r.error);
        assertArrayEquals(data, read(new File(dir, OfflineStore.VIDEO)));
    }

    @Test
    public void fragmentBrokenTwiceFails() throws Exception {
        byte[] data = sample(300_000);
        Node node = node(data);
        node.corruptAt.set(new long[] {160_000, 10});
        File dir = tempDir("corrupt-always");
        OfflineStore.State state = OfflineStore.State.queued(0);
        Result r = download(dir, job(node, 300_000), state, hashes(data, 1343, 50_000), -1);
        assertEquals("hash_mismatch", r.error);
        assertFalse(new File(dir, OfflineStore.VIDEO).exists());
        // Побитый фрагмент (151 343…) выброшен: «Повторить» скачает его заново,
        // а не продолжит после него.
        assertEquals(151_343, state.received);
        assertEquals(151_343, r.persisted.get(r.persisted.size() - 1).received);
        assertEquals(151_343, new File(dir, OfflineStore.PART).length());

        // «Повторить» с той же нодой, которая больше не портит, — ролик целиком.
        node.corruptAt.set(null);
        state.status = OfflineStore.QUEUED;
        r = download(dir, job(node, 300_000), state, hashes(data, 1343, 50_000), -1);
        assertNull(r.error);
        assertArrayEquals(data, read(new File(dir, OfflineStore.VIDEO)));
    }

    @Test
    public void fileShorterThanItsHashesFails() throws Exception {
        byte[] data = sample(100_000);
        Node node = node(data);
        File dir = tempDir("short");
        // Суммы от файла длиннее: последний фрагмент так и не придёт.
        OfflineStore.State state = OfflineStore.State.queued(0);
        Result r = download(dir, job(node, 0), state, hashes(sample(150_000), 1343, 40_000), -1);
        assertEquals("hash_mismatch", r.error);
        assertFalse(new File(dir, OfflineStore.VIDEO).exists());
        // Непроверенный хвост с 81 343 выброшен.
        assertEquals(81_343, state.received);
        assertEquals(81_343, new File(dir, OfflineStore.PART).length());
    }

    @Test
    public void cutConnectionIsRetriedFromWhereItStopped() throws Exception {
        byte[] data = sample(200_000);
        Node node = node(data);
        node.cutAfter.set(10_000);
        File dir = tempDir("cut");
        Result r = download(dir, job(node, 200_000), OfflineStore.State.queued(0), new ArrayList<>(), -1);
        assertNull(r.error);
        assertArrayEquals(data, read(new File(dir, OfflineStore.VIDEO)));
        // Оборванные 10 000 байт не качались второй раз.
        assertEquals(200_000, node.served.get());
    }

    @Test
    public void nodeWithoutRangeSupportStillWorks() throws Exception {
        byte[] data = sample(150_000);
        Node node = node(data);
        node.noRange = true;
        File dir = tempDir("no-range");
        Result r = download(dir, job(node, 150_000), OfflineStore.State.queued(0), hashes(data, 1343, 40_000), -1);
        assertNull(r.error);
        assertArrayEquals(data, read(new File(dir, OfflineStore.VIDEO)));
    }

    @Test
    public void nodeWithoutRangeSupportSkipsWhatIsAlreadyThere() throws Exception {
        byte[] data = sample(150_000);
        Node node = node(data);
        node.noRange = true;
        File dir = tempDir("no-range-resume");
        byte[] head = new byte[90_000];
        System.arraycopy(data, 0, head, 0, head.length);
        Files.write(new File(dir, OfflineStore.PART).toPath(), head);
        OfflineStore.State state = new OfflineStore.State(OfflineStore.DOWNLOADING, 90_000, 150_000, null);
        Result r = download(dir, job(node, 150_000), state, new ArrayList<>(), -1);
        assertNull(r.error);
        assertArrayEquals(data, read(new File(dir, OfflineStore.VIDEO)));
    }

    @Test
    public void sizeChangedWhileResumingStartsOver() throws Exception {
        byte[] data = sample(300_000);
        Node node = node(data);
        File dir = tempDir("size-changed");
        // Начало другого файла (400 000 байт) с прошлого раза.
        Files.write(new File(dir, OfflineStore.PART).toPath(), new byte[50_000]);
        OfflineStore.State state = new OfflineStore.State(OfflineStore.DOWNLOADING, 50_000, 400_000, null);
        Result r = download(dir, job(node, 400_000), state, new ArrayList<>(), -1);
        assertNull(r.error);
        assertArrayEquals(data, read(new File(dir, OfflineStore.VIDEO)));
        assertEquals(300_000, state.total);
    }

    @Test
    public void nextSourceWhenTheFirstHasNoFile() throws Exception {
        byte[] data = sample(100_000);
        Node dead = node(data);
        dead.missing = true;
        Node alive = node(data);
        File dir = tempDir("sources");
        OfflineStore.Job j = job(alive, 100_000);
        j.sources.add(0, dead.base + "/video.mp4");
        Result r = download(dir, j, OfflineStore.State.queued(0), new ArrayList<>(), -1);
        assertNull(r.error);
        assertArrayEquals(data, read(new File(dir, OfflineStore.VIDEO)));

        File gone = tempDir("gone");
        r = download(gone, job(dead, 100_000), OfflineStore.State.queued(0), new ArrayList<>(), -1);
        assertEquals("not_found", r.error);
    }

    @Test
    public void emptyBodyInTheMiddleIsANetworkFailure() throws Exception {
        byte[] data = sample(200_000);
        Node node = node(data);
        node.emptyFrom = 64 * 1024;
        File dir = tempDir("empty");
        OfflineStore.State state = OfflineStore.State.queued(0);
        Result r = download(dir, job(node, 200_000), state, new ArrayList<>(), -1);
        // Не крутится на месте: повторы с паузой, потом сбой сети.
        assertEquals("network", r.error);
        assertEquals(64 * 1024, state.received);
        assertEquals(1 + 4, node.requests.get());

        // Со вторым адресом — дальше с него.
        Node good = node(data);
        File dir2 = tempDir("empty-rotate");
        OfflineStore.Job j = job(node, 200_000);
        j.sources.add(good.base + "/video.mp4");
        r = download(dir2, j, OfflineStore.State.queued(0), new ArrayList<>(), -1);
        assertNull(r.error);
        assertArrayEquals(data, read(new File(dir2, OfflineStore.VIDEO)));
    }

    @Test
    public void playlistIsRewrittenToOurFileAndForeignOneIsDropped() throws Exception {
        byte[] data = sample(50_000);
        Node node = node(data);
        String good = "#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-PLAYLIST-TYPE:VOD\n"
                + "#EXT-X-MAP:URI=\"abc-144-fragmented.mp4\",BYTERANGE=\"1343@0\"\n"
                + "#EXTINF:2.000000,\n#EXT-X-BYTERANGE:48657@1343\nabc-144-fragmented.mp4\n#EXT-X-ENDLIST\n";
        node.small.put("/abc-144.m3u8", good.getBytes(StandardCharsets.UTF_8));
        node.small.put("/evil.m3u8", good.replace("\nabc-144-fragmented.mp4\n", "\nhttps://evil.example/x.mp4\n")
                .getBytes(StandardCharsets.UTF_8));
        node.small.put("/thumb.jpg", new byte[] {1, 2, 3});

        File dir = tempDir("playlist");
        OfflineStore.Job j = new OfflineStore.Job("abc-144", new ArrayList<>(Collections.singletonList(node.base + "/video.mp4")),
                "abc-144-fragmented.mp4", new ArrayList<>(), new ArrayList<>(java.util.Arrays.asList(
                        new OfflineStore.Extra("thumb.jpg", node.base + "/thumb.jpg"),
                        new OfflineStore.Extra("playlist.m3u8", node.base + "/abc-144.m3u8"))), data.length);
        Result r = download(dir, j, OfflineStore.State.queued(0), new ArrayList<>(), -1);
        assertNull(r.error);
        String saved = new String(read(new File(dir, "playlist.m3u8")), StandardCharsets.UTF_8);
        assertTrue(saved.contains("#EXT-X-MAP:URI=\"video.mp4\",BYTERANGE=\"1343@0\""));
        assertTrue(saved.contains("#EXT-X-BYTERANGE:48657@1343\nvideo.mp4\n"));
        assertFalse(saved.contains("fragmented"));
        assertTrue(OfflinePlaylist.fits(saved, data.length));
        assertArrayEquals(new byte[] {1, 2, 3}, read(new File(dir, "thumb.jpg")));

        // Плейлист с чужим адресом не сохраняется вовсе, ролик качается.
        File dir2 = tempDir("playlist-evil");
        OfflineStore.Job evil = new OfflineStore.Job("abc-144", j.sources, j.fileName, new ArrayList<>(),
                new ArrayList<>(Collections.singletonList(new OfflineStore.Extra("playlist.m3u8", node.base + "/evil.m3u8"))),
                data.length);
        r = download(dir2, evil, OfflineStore.State.queued(0), new ArrayList<>(), -1);
        assertNull(r.error);
        assertFalse(new File(dir2, "playlist.m3u8").exists());
        assertFalse(new File(dir2, "playlist.m3u8.tmp").exists());
        assertArrayEquals(data, read(new File(dir2, OfflineStore.VIDEO)));
    }

    @Test
    public void serverErrorsRunOutOfRetries() throws Exception {
        Node node = node(sample(1000));
        node.failWith = 503;
        File dir = tempDir("503");
        Result r = download(dir, job(node, 1000), OfflineStore.State.queued(0), new ArrayList<>(), -1);
        assertEquals("network", r.error);
        // Первая попытка и три повтора.
        assertEquals(4, node.requests.get());
    }

    @Test
    public void torNotReadyPausesInsteadOfRetrying() throws Exception {
        File dir = tempDir("tor");
        OfflineStore.Job j = new OfflineStore.Job("v-144", Collections.singletonList("https://example.org/video.mp4"),
                "video.mp4", new ArrayList<>(), new ArrayList<>(), 1000);
        OfflineDownloader d = new OfflineDownloader(
                url -> {
                    throw new IOException("tor_not_ready: status=bootstrapping");
                },
                quick(), dir, j, OfflineStore.State.queued(0), (s, p) -> {}, () -> -1, x -> new ArrayList<>());
        try {
            d.run();
            fail("must not download without Tor");
        } catch (OfflineDownloader.DlException e) {
            assertEquals("tor_not_ready", e.code);
        }
    }

    @Test
    public void pauseKeepsWhatWasDownloaded() throws Exception {
        byte[] data = sample(2_000_000);
        Node node = node(data);
        File dir = tempDir("pause");
        OfflineStore.State state = OfflineStore.State.queued(0);
        AtomicReference<OfflineDownloader> self = new AtomicReference<>();
        OfflineDownloader d = new OfflineDownloader(DIRECT, quick(), dir, job(node, 2_000_000), state,
                (s, persist) -> {
                    if (persist && s.received >= 200_000) self.get().stop(OfflineDownloader.PAUSE, "wifi");
                },
                () -> -1, x -> new ArrayList<>());
        self.set(d);
        try {
            d.run();
            fail("must stop");
        } catch (OfflineDownloader.DlException e) {
            assertEquals("stopped", e.code);
        }
        assertEquals("wifi", d.pauseReason());
        assertTrue(state.received >= 200_000 && state.received < 2_000_000);
        assertTrue(new File(dir, OfflineStore.PART).length() >= state.received);
        assertFalse(new File(dir, OfflineStore.VIDEO).exists());
    }

    @Test
    public void refusesWithoutRoomOnDisk() throws Exception {
        Node node = node(sample(10_000));
        File dir = tempDir("space");
        Result r = download(dir, job(node, 10_000), OfflineStore.State.queued(0), new ArrayList<>(),
                OfflineDownloader.SPARE);
        assertEquals("no_space", r.error);
        assertEquals(0, node.requests.get());
    }

    @Test
    public void hashesParseLikePeerTubeWritesThem() {
        Map<String, String> bad = new LinkedHashMap<>();
        bad.put("1343-101448", "AB");
        bad.put("101449-207003", "00");
        assertEquals(0, OfflineDownloader.fromSpans(bad).size());

        String sha = new String(new char[64]).replace('\0', 'A');
        Map<String, String> spans = new LinkedHashMap<>();
        spans.put("101449-207003", sha);
        spans.put("1343-101448", sha);
        spans.put("junk", sha);
        List<OfflineDownloader.HashRange> ranges = OfflineDownloader.fromSpans(spans);
        assertEquals(2, ranges.size());
        assertEquals(1343, ranges.get(0).start);
        assertEquals(101_448, ranges.get(0).end);
        assertEquals(sha.toLowerCase(Locale.ROOT), ranges.get(0).sha);
        assertEquals(101_449, ranges.get(1).start);

        Map<String, String> overlap = new LinkedHashMap<>();
        overlap.put("0-100", sha);
        overlap.put("100-200", sha);
        assertNull(OfflineDownloader.fromSpans(overlap));

        assertEquals(101_449, OfflineDownloader.snapToFragment(ranges, 120_000));
        assertEquals(101_449, OfflineDownloader.snapToFragment(ranges, 101_449));
        assertEquals(1343, OfflineDownloader.snapToFragment(ranges, 101_448));
        assertEquals(500, OfflineDownloader.snapToFragment(ranges, 500));
        // Больше 2 ГБ — те же long.
        assertEquals(3_000_000_000L, OfflineDownloader.snapToFragment(ranges, 3_000_000_000L));

        assertArrayEquals(new long[] {0, 1234}, OfflineDownloader.parseContentRange("bytes 0-99/1234"));
        assertArrayEquals(new long[] {4_294_967_296L, 5_000_000_000L},
                OfflineDownloader.parseContentRange("bytes 4294967296-4295967295/5000000000"));
        assertNull(OfflineDownloader.parseContentRange("bytes */1234"));
        assertNull(OfflineDownloader.parseContentRange(null));
    }

    @Test
    public void diskFullIsRecognised() throws Exception {
        File dir = tempDir("enospc");
        assertTrue(OfflineDownloader.isDiskFull(new IOException("write failed: ENOSPC (No space left on device)"), dir));
        assertFalse(OfflineDownloader.isDiskFull(new IOException("Permission denied"), dir));
    }
}
