package com.bastyon.app.plugins.radio;

/**
 * Узел Reticulum из libbastyon_rns_jni.so (src-tauri/crates/bastyon-rns-jni):
 * тот же узел, что на десктопе. Настройки и ответы — JSON, ошибки —
 * RuntimeException «код: подробности». Библиотеки может не быть (APK собран
 * без Rust) — тогда {@link #LOADED} false.
 */
final class RnsNative {
    static final boolean LOADED = load();

    private RnsNative() {}

    private static boolean load() {
        try {
            System.loadLibrary("bastyon_rns_jni");
            return true;
        } catch (UnsatisfiedLinkError e) {
            return false;
        }
    }

    /** События узла JSON-строкой; вызываются из потоков узла. */
    interface Events {
        void onEvent(String json);
    }

    /** Поднять узел; данные — в baseDir/&lt;хэш identity&gt;. Возвращает {address, identityHash}. */
    static native String start(String optionsJson, String baseDir, Events events);

    static native void stop();

    static native String status();

    static native String announce();

    /** Возвращает id сообщения. */
    static native String send(String to, String title, String content, String method);

    static native String requestPath(String to);

    /** Пустая строка — без узла доставки. */
    static native String setPropagationNode(String hash);

    static native String sync();

    /** Страница NomadNet: {content, binary}; блокирует до ответа узла. */
    static native String page(String node, String path, String dataJson);
}
