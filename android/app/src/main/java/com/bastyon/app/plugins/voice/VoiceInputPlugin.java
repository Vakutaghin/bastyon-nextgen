package com.bastyon.app.plugins.voice;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Голосовой ввод на Android (src/stores/voice-input-store.ts): те же команды и
 * события, что у компьютера (src-tauri/src/asr), только вызываются через
 * Capacitor. Распознаёт whisper.cpp прямо на телефоне (AsrNative), запись
 * никуда не уходит; сеть нужна один раз — скачать модель (VoiceModels).
 *
 *   status() — {supported, gpu, models: [{id, size, installed}], installing};
 *   install({model}) — скачать модель и детектор речи; события
 *       `asr:install-progress` {model, received, total};
 *   cancelInstall(), remove({model});
 *   start({model, language, prompt}) — {session}; запись с микрофона, события
 *       `asr:level` {session, level, speaking}, `asr:state` {session, loading,
 *       pending}, `asr:partial` {session, seq, text} — черновик фразы по ходу
 *       речи, `asr:text` {session, seq, text}, `asr:end` {session, reason,
 *       error};
 *   stop({session}) — дораспознать сказанное, cancel({session}) — без хвоста;
 *   openMicSettings() — страница приложения в настройках телефона.
 *
 * Ошибки — «код: подробности», как у компьютера: mic_denied, mic_busy,
 * mic_error, model_missing, unknown_model, unsupported_cpu, busy, cancelled,
 * download_failed, size_mismatch, hash_mismatch, no_space, engine_error.
 */
@CapacitorPlugin(
        name = "VoiceInput",
        permissions = {@Permission(strings = {Manifest.permission.RECORD_AUDIO}, alias = "microphone")}
)
public class VoiceInputPlugin extends Plugin {

    private static final int RATE = 16_000;
    /** Кусок записи: 100 мс. */
    private static final int CHUNK = RATE / 10;
    private static final long LEVEL_INTERVAL_MS = 50;
    private static final long PROGRESS_INTERVAL_MS = 100;
    /** Столько секунд одних нулей — микрофон отдан другому приложению. */
    private static final float SILENT_MIC_SECS = 1.5f;

    private final ExecutorService downloads = Executors.newSingleThreadExecutor();
    private final AtomicBoolean installCancelled = new AtomicBoolean(false);
    private volatile String installing;

    private VoiceModels models;

    private final Object lock = new Object();
    private int session;
    private Capture capture;

    @Override
    public void load() {
        super.load();
        models = new VoiceModels(new File(getContext().getFilesDir(), "asr"));
        downloads.execute(models::removeParts);
    }

    @Override
    protected void handleOnDestroy() {
        stopCapture(true);
        downloads.shutdownNow();
        super.handleOnDestroy();
    }

    private static boolean supported() {
        // Библиотека есть только для 64-битных ABI (scripts/build-asr-android.sh).
        return AsrNative.LOADED && AsrNative.supported();
    }

    // ─── Модели ───────────────────────────────────────────────────────────

    @PluginMethod
    public void status(PluginCall call) {
        boolean vad = models.isInstalled(VoiceModels.VAD);
        JSArray list = new JSArray();
        for (VoiceModels.Spec spec : VoiceModels.MODELS) {
            JSObject m = new JSObject();
            m.put("id", spec.id);
            m.put("size", spec.size + (vad ? 0 : VoiceModels.VAD.size));
            m.put("installed", models.isInstalled(spec));
            list.put(m);
        }
        JSObject ret = new JSObject();
        ret.put("supported", supported());
        ret.put("gpu", false);
        ret.put("models", list);
        ret.put("installing", installing);
        call.resolve(ret);
    }

    @PluginMethod
    public void install(PluginCall call) {
        String id = call.getString("model", "");
        VoiceModels.Spec spec = VoiceModels.spec(id);
        if (spec == null) {
            call.reject("unknown_model");
            return;
        }
        synchronized (this) {
            if (installing != null) {
                call.reject("busy");
                return;
            }
            installing = id;
        }
        installCancelled.set(false);
        downloads.execute(() -> {
            try {
                boolean needVad = !models.isInstalled(VoiceModels.VAD);
                boolean needModel = !models.isInstalled(spec);
                long total = (needVad ? VoiceModels.VAD.size : 0) + (needModel ? spec.size : 0);
                List<VoiceModels.Spec> steps = new ArrayList<>();
                if (needVad) steps.add(VoiceModels.VAD);
                if (needModel) steps.add(spec);
                long[] done = {0};
                long[] lastEvent = {0};
                for (VoiceModels.Spec step : steps) {
                    models.download(step, received -> {
                        long now = System.currentTimeMillis();
                        if (now - lastEvent[0] >= PROGRESS_INTERVAL_MS || received == step.size) {
                            lastEvent[0] = now;
                            emitProgress(id, done[0] + received, total);
                        }
                    }, installCancelled);
                    done[0] += step.size;
                }
                call.resolve();
            } catch (VoiceModels.ModelException e) {
                call.reject(e.getMessage());
            } catch (Exception e) {
                call.reject("download_failed: " + e.getMessage());
            } finally {
                installing = null;
            }
        });
    }

    private void emitProgress(String model, long received, long total) {
        JSObject ev = new JSObject();
        ev.put("model", model);
        ev.put("received", received);
        ev.put("total", total);
        notifyListeners("asr:install-progress", ev);
    }

    @PluginMethod
    public void cancelInstall(PluginCall call) {
        installCancelled.set(true);
        call.resolve();
    }

    /** Удалить модель. Последняя уходит вместе с детектором речи. */
    @PluginMethod
    public void remove(PluginCall call) {
        VoiceModels.Spec spec = VoiceModels.spec(call.getString("model", ""));
        if (spec == null) {
            call.reject("unknown_model");
            return;
        }
        stopCapture(true);
        models.remove(spec);
        boolean any = false;
        for (VoiceModels.Spec s : VoiceModels.MODELS) any |= models.isInstalled(s);
        if (!any) models.remove(VoiceModels.VAD);
        call.resolve();
    }

    // ─── Диктовка ─────────────────────────────────────────────────────────

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "afterMicPermission");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void afterMicPermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) begin(call);
        else call.reject("mic_denied");
    }

    @SuppressLint("MissingPermission")
    private void begin(PluginCall call) {
        if (!supported()) {
            call.reject("unsupported_cpu");
            return;
        }
        VoiceModels.Spec spec = VoiceModels.spec(call.getString("model", ""));
        if (spec == null) {
            call.reject("unknown_model");
            return;
        }
        if (!models.isInstalled(spec) || !models.isInstalled(VoiceModels.VAD)) {
            call.reject("model_missing");
            return;
        }
        stopCapture(true);

        int minBuffer = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (minBuffer <= 0) {
            call.reject("no_microphone");
            return;
        }
        AudioRecord record;
        try {
            record = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, RATE,
                    AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(minBuffer, CHUNK * 4));
        } catch (SecurityException e) {
            call.reject("mic_denied");
            return;
        } catch (Exception e) {
            call.reject("mic_error: " + e.getMessage());
            return;
        }
        if (record.getState() != AudioRecord.STATE_INITIALIZED) {
            record.release();
            call.reject("mic_error: not initialized");
            return;
        }
        try {
            record.startRecording();
        } catch (Exception e) {
            record.release();
            call.reject("mic_busy: " + e.getMessage());
            return;
        }
        if (record.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
            record.release();
            call.reject("mic_busy");
            return;
        }

        int id;
        try {
            id = AsrNative.start(
                    models.file(spec).getAbsolutePath(),
                    models.file(VoiceModels.VAD).getAbsolutePath(),
                    call.getString("language", "auto"),
                    call.getString("prompt", ""),
                    this::onNativeEvent);
        } catch (RuntimeException e) {
            record.stop();
            record.release();
            call.reject(e.getMessage() != null ? e.getMessage() : "engine_error");
            return;
        }
        synchronized (lock) {
            session = id;
            capture = new Capture(id, record);
            capture.start();
        }
        JSObject ret = new JSObject();
        ret.put("session", id);
        call.resolve(ret);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        int id = call.getInt("session", 0);
        if (isCurrent(id)) {
            stopCapture(false);
            AsrNative.stop(id);
        }
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        int id = call.getInt("session", 0);
        if (isCurrent(id)) stopCapture(true);
        call.resolve();
    }

    @PluginMethod
    public void openMicSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", getContext().getPackageName(), null));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("unsupported");
        }
    }

    private boolean isCurrent(int id) {
        synchronized (lock) {
            return capture != null && session == id;
        }
    }

    /** Закрыть микрофон; `cancel` — и прервать распознавание без хвоста. */
    private void stopCapture(boolean cancel) {
        Capture c;
        int id;
        synchronized (lock) {
            c = capture;
            id = session;
            capture = null;
        }
        if (c == null) return;
        c.finish();
        if (cancel) AsrNative.cancel(id);
    }

    /** События сессии из Rust — в JS под теми же именами, что у компьютера. */
    private void onNativeEvent(String json) {
        try {
            JSObject ev = JSObject.fromJSONObject(new JSONObject(json));
            String name = ev.getString("event");
            ev.remove("event");
            if ("end".equals(name)) {
                // Сессия закончилась сама (ошибка движка): микрофон не держим.
                int id = ev.getInteger("session", 0);
                if (isCurrent(id)) stopCapture(false);
            }
            notifyListeners("asr:" + name, ev);
        } catch (Exception e) {
            // Неразборчивое событие пропускаем: следующее придёт целым.
        }
    }

    private void emitLevel(int id, float level, boolean speaking) {
        JSObject ev = new JSObject();
        ev.put("session", id);
        ev.put("level", level);
        ev.put("speaking", speaking);
        notifyListeners("asr:level", ev);
    }

    private void emitMicError(int id, String error) {
        JSObject ev = new JSObject();
        ev.put("session", id);
        ev.put("reason", "error");
        ev.put("error", error);
        notifyListeners("asr:end", ev);
    }

    /** Громкость куска 0..1: -60 дБ и тише — ноль, -10 дБ — максимум (как у компьютера). */
    static float levelOf(float[] samples, int count) {
        if (count <= 0) return 0f;
        double sum = 0;
        for (int i = 0; i < count; i++) sum += samples[i] * samples[i];
        double rms = Math.sqrt(sum / count);
        double db = 20.0 * Math.log10(Math.max(rms, 1e-9));
        return (float) Math.max(0.0, Math.min(1.0, (db + 60.0) / 50.0));
    }

    /** Запись с микрофона в своём потоке: куски по 100 мс уходят в распознавание. */
    private final class Capture extends Thread {
        private final int id;
        private final AudioRecord record;
        private volatile boolean running = true;

        Capture(int id, AudioRecord record) {
            super("asr-capture");
            this.id = id;
            this.record = record;
        }

        @Override
        public void run() {
            short[] pcm = new short[CHUNK];
            float[] samples = new float[CHUNK];
            long lastLevel = 0;
            long heard = 0;
            boolean sound = false;
            try {
                while (running) {
                    int n = record.read(pcm, 0, CHUNK);
                    if (n < 0) {
                        running = false;
                        // Сначала ошибка: «прервано» от движка пришло бы раньше неё.
                        emitMicError(id, "mic_error: read " + n);
                        AsrNative.cancel(id);
                        break;
                    }
                    if (n == 0) continue;
                    for (int i = 0; i < n; i++) {
                        samples[i] = pcm[i] / 32768f;
                        if (!sound && pcm[i] != 0) sound = true;
                    }
                    if (!sound) {
                        heard += n;
                        // Android отдаёт тишину, когда микрофон занят звонком
                        // или другим приложением.
                        if (heard >= RATE * SILENT_MIC_SECS) {
                            running = false;
                            emitMicError(id, "mic_busy");
                            AsrNative.cancel(id);
                            break;
                        }
                    }
                    AsrNative.push(id, n == CHUNK ? samples : Arrays.copyOf(samples, n));
                    long now = System.currentTimeMillis();
                    if (now - lastLevel >= LEVEL_INTERVAL_MS) {
                        lastLevel = now;
                        emitLevel(id, levelOf(samples, n), AsrNative.speaking());
                    }
                }
            } finally {
                try {
                    record.stop();
                } catch (Exception ignored) {
                    // уже остановлен
                }
                record.release();
            }
        }

        /** Остановить запись и дождаться потока: дальше куски не придут. */
        void finish() {
            running = false;
            if (Thread.currentThread() == this) return;
            try {
                join(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }
}
