package com.bastyon.app.plugins.voice;

/**
 * Распознавание речи из libbastyon_asr_jni.so (src-tauri/crates/bastyon-asr-jni):
 * whisper.cpp и детектор речи — тот же движок, что на компьютере. Ошибки —
 * RuntimeException «код: подробности». Библиотеки может не быть (APK собран
 * без Rust или телефон 32-битный) — тогда {@link #LOADED} false.
 */
final class AsrNative {
    static final boolean LOADED = load();

    private AsrNative() {}

    private static boolean load() {
        try {
            // whisper.cpp — C++: стандартная библиотека NDK лежит рядом.
            System.loadLibrary("c++_shared");
            System.loadLibrary("bastyon_asr_jni");
            return true;
        } catch (UnsatisfiedLinkError e) {
            return false;
        }
    }

    /** События сессии JSON-строкой ({event: state|text|end, session, …}); из потока сессии. */
    interface Events {
        void onEvent(String json);
    }

    /** Процессор подходит для распознавания. */
    static native boolean supported();

    /** Начать диктовку (прежняя отменяется). Возвращает id сессии. */
    static native int start(String modelFile, String vadFile, String language, String prompt, Events events);

    /** Кусок записи: 16 кГц, моно, -1..1. */
    static native void push(int session, float[] samples);

    /** Закончить: сказанное дораспознается. */
    static native void stop(int session);

    /** Прервать без распознавания хвоста. */
    static native void cancel(int session);

    /** Детектор слышит речь прямо сейчас. */
    static native boolean speaking();
}
