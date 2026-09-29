package com.bastyon.app.plugins.radio;

import android.content.Context;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Одно постоянное уведомление на радио и узел Reticulum: служба
 * MeshRadioService жива, пока её держит хоть кто-то. У каждого держателя
 * (радио-соединения, узел) свои тексты на языке интерфейса и своя подпись;
 * заголовок — радио, если оно держит, иначе первого из держателей.
 */
final class MeshKeepAlive {
    static final String RADIO = "radio";
    static final String RNS = "rns";

    /** Держатель → подпись в уведомлении (имена радио, «Reticulum»). */
    private static final Map<String, String> holders = new LinkedHashMap<>();
    /** Держатель → {заголовок, текст, имя канала уведомлений}. */
    private static final Map<String, String[]> texts = new HashMap<>();

    private MeshKeepAlive() {}

    static synchronized void setTexts(Context ctx, String key, String title, String text, String channel) {
        texts.put(key, new String[] {title, text, channel});
        if (!holders.isEmpty()) refresh(ctx);
    }

    static synchronized void hold(Context ctx, String key, String label) {
        holders.put(key, label);
        refresh(ctx);
    }

    static synchronized void release(Context ctx, String key) {
        if (holders.remove(key) != null) refresh(ctx);
    }

    private static void refresh(Context ctx) {
        if (holders.isEmpty()) {
            MeshRadioService.stop(ctx);
            return;
        }
        String lead = holders.containsKey(RADIO) ? RADIO : holders.keySet().iterator().next();
        String[] t = texts.get(lead);
        String title = t != null ? t[0] : "Bastyon";
        String text = t != null ? t[1] : "";
        String channel = t != null ? t[2] : "Mesh";
        // Подпись ведущего держателя уже в заголовке у узла («Узел Reticulum
        // работает») — повторять её не нужно; имена радио — нужно.
        List<String> labels = new ArrayList<>();
        for (Map.Entry<String, String> h : holders.entrySet()) {
            if (!(h.getKey().equals(lead) && h.getKey().equals(RNS))) labels.add(h.getValue());
        }
        String joined = String.join(", ", labels);
        try {
            String body = text.isEmpty() ? joined : joined.isEmpty() ? text : text + " · " + joined;
            MeshRadioService.start(ctx, title, body, channel);
        } catch (RuntimeException ignored) {
            // Android 12+ не даёт поднять службу из фона — всё работает и без неё.
        }
    }
}
