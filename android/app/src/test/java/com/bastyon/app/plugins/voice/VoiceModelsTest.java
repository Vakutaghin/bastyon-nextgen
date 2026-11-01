package com.bastyon.app.plugins.voice;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.After;
import org.junit.Test;

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.file.Files;

/** Прежний файл модели (q5_1) работает, пока не скачан нынешний (q8_0), — как у компьютера. */
public class VoiceModelsTest {
    private File dir;

    @After
    public void cleanup() {
        if (dir == null) return;
        File[] files = dir.listFiles();
        if (files != null) for (File f : files) //noinspection ResultOfMethodCallIgnored
            f.delete();
        //noinspection ResultOfMethodCallIgnored
        dir.delete();
    }

    private static void sized(File f, long size) throws IOException {
        try (RandomAccessFile raf = new RandomAccessFile(f, "rw")) {
            raf.setLength(size);
        }
    }

    @Test
    public void legacyFileWorksUntilTheCurrentOneIsDownloaded() throws Exception {
        dir = Files.createTempDirectory("voice-models").toFile();
        VoiceModels models = new VoiceModels(dir);
        VoiceModels.Spec small = VoiceModels.spec("small");
        File legacy = new File(dir, small.legacyFile);
        sized(legacy, small.legacySize);

        assertTrue(models.isInstalled(small));
        assertTrue(models.isUpgradable(small));
        assertFalse(models.isCurrent(small));
        assertEquals(legacy, models.installedFile(small));

        sized(models.file(small), small.size);
        assertFalse(models.isUpgradable(small));
        assertEquals(models.file(small), models.installedFile(small));

        models.remove(small);
        assertFalse(legacy.exists());
        assertFalse(models.file(small).exists());
        assertFalse(models.isInstalled(small));
    }
}
