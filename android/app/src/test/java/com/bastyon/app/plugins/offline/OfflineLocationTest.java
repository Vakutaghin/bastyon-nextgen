package com.bastyon.app.plugins.offline;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.After;
import org.junit.Test;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Перенос скачанного во внутреннюю память и на карту — как у компьютера (location.rs). */
public class OfflineLocationTest {
    private File base;

    @After
    public void cleanup() {
        if (base != null) OfflineStore.deleteRecursive(base);
    }

    private File video(File root, String id) throws IOException {
        File dir = new File(root, id);
        assertTrue(new File(dir, "captions").mkdirs());
        Files.write(new File(dir, "video.mp4").toPath(), id.getBytes(StandardCharsets.UTF_8));
        Files.write(new File(dir, "captions/ru.vtt").toPath(), "WEBVTT".getBytes(StandardCharsets.UTF_8));
        Files.write(new File(dir, "meta.json").toPath(), "{}".getBytes(StandardCharsets.UTF_8));
        return dir;
    }

    private static byte[] read(File f) throws IOException {
        return Files.readAllBytes(f.toPath());
    }

    @Test
    public void movesEveryFileAndLeavesNothingBehind() throws Exception {
        base = Files.createTempDirectory("offline-loc").toFile();
        File from = new File(base, "internal");
        File to = new File(base, "sd");
        video(from, "v1-360");
        video(from, "v2-144");
        List<String> steps = new ArrayList<>();
        OfflineLocation.moveItems(from, to, Arrays.asList("v1-360", "v2-144"),
                (done, total) -> steps.add(done + "/" + total));
        assertEquals(Arrays.asList("1/2", "2/2"), steps);
        assertArrayEquals("v1-360".getBytes(StandardCharsets.UTF_8), read(new File(to, "v1-360/video.mp4")));
        assertArrayEquals("WEBVTT".getBytes(StandardCharsets.UTF_8), read(new File(to, "v2-144/captions/ru.vtt")));
        assertFalse(new File(from, "v1-360").exists());
        assertFalse(new File(from, "v2-144").exists());
    }

    @Test
    public void collisionRollsBack() throws Exception {
        base = Files.createTempDirectory("offline-loc").toFile();
        File from = new File(base, "internal");
        File to = new File(base, "sd");
        video(from, "v1-360");
        video(from, "v2-144");
        video(to, "v2-144");
        try {
            OfflineLocation.moveItems(from, to, Arrays.asList("v1-360", "v2-144"), null);
            fail("ожидалась ошибка");
        } catch (OfflineStore.OfflineException e) {
            assertEquals("target_busy", e.code);
        }
        assertTrue(new File(from, "v1-360/video.mp4").isFile());
        assertFalse(new File(to, "v1-360").exists());
        assertTrue(new File(from, "v2-144/meta.json").isFile());
    }

    @Test
    public void spaceCheck() {
        assertTrue(OfflineLocation.enoughSpace(10, -1));
        assertTrue(OfflineLocation.enoughSpace(10, 10 + OfflineLocation.SPARE));
        assertFalse(OfflineLocation.enoughSpace(10, 9 + OfflineLocation.SPARE));
    }
}
