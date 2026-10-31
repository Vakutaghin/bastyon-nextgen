package com.bastyon.app.plugins.offline;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * Плейлист качества PeerTube для ExoPlayer: ссылается только на наш
 * {@code video.mp4}, иначе не сохраняется.
 */
public class OfflinePlaylistTest {
    private static final String FILE = "238e3bd3-e707-4cb1-acb2-06b8594b71a5-144-fragmented.mp4";

    /** Как отдаёт PeerTube 4.2 (проверено на ноде). */
    private static String peertube() {
        return "#EXTM3U\n"
                + "#EXT-X-VERSION:7\n"
                + "#EXT-X-TARGETDURATION:2\n"
                + "#EXT-X-MEDIA-SEQUENCE:0\n"
                + "#EXT-X-PLAYLIST-TYPE:VOD\n"
                + "#EXT-X-MAP:URI=\"" + FILE + "\",BYTERANGE=\"1343@0\"\n"
                + "#EXTINF:2.000000,\n"
                + "#EXT-X-BYTERANGE:14173@1343\n"
                + FILE + "\n"
                + "#EXTINF:2.000000,\n"
                + "#EXT-X-BYTERANGE:13720@15516\n"
                + FILE + "\n"
                + "#EXTINF:1.500000,\n"
                + "#EXT-X-BYTERANGE:9000\n"
                + FILE + "\n"
                + "#EXT-X-ENDLIST\n";
    }

    @Test
    public void rewritesUrisToOurFile() {
        String out = OfflinePlaylist.rewrite(peertube(), FILE);
        assertNotNull(out);
        assertTrue(out.startsWith("#EXTM3U\n"));
        assertTrue(out.contains("#EXT-X-MAP:URI=\"video.mp4\",BYTERANGE=\"1343@0\"\n"));
        // Три строки сегментов.
        assertEquals(3, out.split("\nvideo.mp4\n", -1).length - 1);
        assertFalse(out.contains(FILE));
        assertTrue(out.endsWith("#EXT-X-ENDLIST\n"));
        // Windows-переводы строк и BOM — тоже.
        assertNotNull(OfflinePlaylist.rewrite("\uFEFF" + peertube().replace("\n", "\r\n"), FILE));
    }

    @Test
    public void refusesAnythingButOurFile() {
        assertNull(OfflinePlaylist.rewrite("<html>not found</html>", FILE));
        assertNull(OfflinePlaylist.rewrite("", FILE));
        assertNull(OfflinePlaylist.rewrite(peertube(), ""));
        // Чужой файл, абсолютный адрес, путь наверх.
        assertNull(OfflinePlaylist.rewrite(peertube().replaceFirst("\n" + FILE + "\n", "\nother.mp4\n"), FILE));
        assertNull(OfflinePlaylist.rewrite(peertube().replaceFirst("\n" + FILE + "\n",
                "\nhttps://evil.example/" + FILE + "\n"), FILE));
        assertNull(OfflinePlaylist.rewrite(peertube().replaceFirst("\n" + FILE + "\n", "\n../" + FILE + "\n"), FILE));
        // Чужой URI в теге: инициализация, ключ шифрования.
        assertNull(OfflinePlaylist.rewrite(peertube().replace("URI=\"" + FILE + "\"", "URI=\"init.mp4\""), FILE));
        assertNull(OfflinePlaylist.rewrite(peertube().replace("#EXT-X-PLAYLIST-TYPE:VOD\n",
                "#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-KEY:METHOD=AES-128,URI=\"https://k.example/key\"\n"), FILE));
        // Плейлист вариантов, без сегментов, без конца (живой).
        assertNull(OfflinePlaylist.rewrite("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\n" + FILE + "\n#EXT-X-ENDLIST\n", FILE));
        assertNull(OfflinePlaylist.rewrite("#EXTM3U\n#EXT-X-ENDLIST\n", FILE));
        assertNull(OfflinePlaylist.rewrite(peertube().replace("#EXT-X-ENDLIST\n", ""), FILE));
        // Ключ без адреса — можно.
        assertNotNull(OfflinePlaylist.rewrite(peertube().replace("#EXT-X-PLAYLIST-TYPE:VOD\n",
                "#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-KEY:METHOD=NONE\n"), FILE));
    }

    @Test
    public void rangesMustFitTheFile() {
        String out = OfflinePlaylist.rewrite(peertube(), FILE);
        // Последний кусок без @ — сразу за предыдущим: 15516 + 13720 + 9000.
        long end = 15_516 + 13_720 + 9_000;
        assertTrue(OfflinePlaylist.fits(out, end));
        assertTrue(OfflinePlaylist.fits(out, end + 100));
        assertFalse(OfflinePlaylist.fits(out, end - 1));
        assertFalse(OfflinePlaylist.fits("#EXTM3U\nvideo.mp4\n", 1000));
        assertFalse(OfflinePlaylist.fits("#EXTM3U\n#EXT-X-BYTERANGE:x@1\n", 1000));
        // Больше 2 ГБ — long.
        assertTrue(OfflinePlaylist.fits("#EXTM3U\n#EXT-X-BYTERANGE:1000@3000000000\nvideo.mp4\n", 3_000_001_000L));
    }
}
