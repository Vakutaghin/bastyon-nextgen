package com.bastyon.app.plugins.voice;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;

/**
 * Модели голосового ввода: те же файлы, ревизии и SHA-256, что у компьютера
 * (src-tauri/src/asr/models.rs). Самой большой модели (turbo) на телефоне нет:
 * она занимает полгигабайта памяти и распознаёт медленнее, чем человек говорит.
 *
 * Модели лежат во внутренней памяти приложения (files/asr). Скачанный файл
 * принимается, только если совпали размер и SHA-256.
 */
final class VoiceModels {
    private static final String WHISPER_REPO =
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1";
    private static final String VAD_REPO =
            "https://huggingface.co/ggml-org/whisper-vad/resolve/9ffd54a1e1ee413ddf265af9913beaf518d1639b";

    private static final int CONNECT_TIMEOUT_MS = 20_000;
    private static final int READ_TIMEOUT_MS = 30_000;

    static final class Spec {
        final String id;
        final String file;
        final String sha256;
        final long size;
        final String baseUrl;

        Spec(String id, String file, String sha256, long size, String baseUrl) {
            this.id = id;
            this.file = file;
            this.sha256 = sha256;
            this.size = size;
            this.baseUrl = baseUrl;
        }

        String url() {
            return baseUrl + "/" + file;
        }
    }

    static final Spec[] MODELS = {
        new Spec("base", "ggml-base-q5_1.bin",
                "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898", 59_707_625L, WHISPER_REPO),
        new Spec("small", "ggml-small-q5_1.bin",
                "ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb", 190_085_487L, WHISPER_REPO),
    };

    /** Детектор речи Silero: режет запись на фразы по паузам. */
    static final Spec VAD = new Spec("vad", "ggml-silero-v6.2.0.bin",
            "2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987", 885_098L, VAD_REPO);

    interface Progress {
        void onProgress(long received);
    }

    /** Скачивание прервали или сломалось; сообщение — «код: подробности». */
    static final class ModelException extends Exception {
        ModelException(String message) {
            super(message);
        }
    }

    private final File dir;

    VoiceModels(File dir) {
        this.dir = dir;
    }

    static Spec spec(String id) {
        for (Spec s : MODELS) {
            if (s.id.equals(id)) return s;
        }
        return null;
    }

    File file(Spec spec) {
        return new File(dir, spec.file);
    }

    /** Скачан целиком: размер проверен при скачивании и не изменился. */
    boolean isInstalled(Spec spec) {
        File f = file(spec);
        return f.isFile() && f.length() == spec.size;
    }

    void remove(Spec spec) {
        //noinspection ResultOfMethodCallIgnored
        file(spec).delete();
    }

    /** Недокачанное с прошлого раза. */
    void removeParts() {
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            //noinspection ResultOfMethodCallIgnored
            if (f.getName().endsWith(".part")) f.delete();
        }
    }

    void download(Spec spec, Progress progress, java.util.concurrent.atomic.AtomicBoolean cancelled)
            throws ModelException {
        if (!dir.mkdirs() && !dir.isDirectory()) throw new ModelException("download_failed: no models dir");
        File part = new File(dir, spec.file + ".part");
        File dest = file(spec);
        HttpURLConnection conn;
        try {
            // Hugging Face отвечает переадресацией на своё хранилище — тоже https.
            conn = (HttpURLConnection) new URL(spec.url()).openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            int status = conn.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) {
                conn.disconnect();
                throw new ModelException("download_failed: HTTP " + status);
            }
        } catch (IOException e) {
            throw new ModelException("download_failed: " + e.getMessage());
        }

        long received = 0;
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (Exception e) {
            conn.disconnect();
            throw new ModelException("download_failed: " + e.getMessage());
        }
        try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(part)) {
            byte[] buffer = new byte[64 * 1024];
            int n;
            while ((n = in.read(buffer)) != -1) {
                if (cancelled.get()) throw new ModelException("cancelled");
                out.write(buffer, 0, n);
                digest.update(buffer, 0, n);
                received += n;
                if (received > spec.size) throw new ModelException("size_mismatch: more than " + spec.size);
                progress.onProgress(received);
            }
        } catch (ModelException e) {
            //noinspection ResultOfMethodCallIgnored
            part.delete();
            throw e;
        } catch (IOException e) {
            //noinspection ResultOfMethodCallIgnored
            part.delete();
            // Обрыв сети и нехватка места выглядят одинаково — IOException.
            String code = dir.getUsableSpace() < spec.size - received ? "no_space" : "download_failed";
            throw new ModelException(code + ": " + e.getMessage());
        } finally {
            conn.disconnect();
        }

        if (received != spec.size) {
            //noinspection ResultOfMethodCallIgnored
            part.delete();
            throw new ModelException("size_mismatch: got " + received + ", expected " + spec.size);
        }
        String actual = hex(digest.digest());
        if (!actual.equals(spec.sha256)) {
            //noinspection ResultOfMethodCallIgnored
            part.delete();
            throw new ModelException("hash_mismatch: got " + actual);
        }
        if (!part.renameTo(dest)) throw new ModelException("download_failed: rename failed");
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format(Locale.ROOT, "%02x", b));
        return sb.toString();
    }
}
