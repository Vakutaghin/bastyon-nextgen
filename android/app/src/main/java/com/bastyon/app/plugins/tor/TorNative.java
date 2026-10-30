package com.bastyon.app.plugins.tor;

/**
 * Tor из libbastyon_tor_jni.so (src-tauri/crates/bastyon-tor-jni): тот же
 * код, что у компьютера. Команды — {@code tor_*} компьютера с теми же JSON
 * аргументов и ответов. Библиотеки может не быть (APK собран без Rust) —
 * тогда {@link #LOADED} false.
 */
final class TorNative {
    static final boolean LOADED = load();

    private TorNative() {}

    private static boolean load() {
        try {
            System.loadLibrary("bastyon_tor_jni");
            return true;
        } catch (UnsatisfiedLinkError e) {
            return false;
        }
    }

    /** События ({@code tor:state}, {@code tor:ws:<id>:*}) из потоков Tor. */
    interface Events {
        void onEvent(String name, String json);
    }

    /** Ответ команды из потока Tor: JSON или текст ошибки. */
    interface Reply {
        void onReply(String result, String error);
    }

    /**
     * Один раз на процесс. root — каталог Tor в данных приложения, libDir —
     * каталог библиотек APK (там libtor.so и liblyrebird.so), ptConfig —
     * pt_config.json бандла (null — встроенная копия).
     */
    static native void init(String root, String libDir, String ptConfig, Events events);

    static native void call(String command, String argsJson, Reply reply);

    /** Tor включён или работает: прямые соединения запрещены. */
    static native boolean directRefused();

    static native void kill();
}
