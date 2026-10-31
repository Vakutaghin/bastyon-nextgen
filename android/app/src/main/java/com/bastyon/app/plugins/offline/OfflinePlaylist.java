package com.bastyon.app.plugins.offline;

import androidx.annotation.Nullable;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Плейлист качества PeerTube ({@code <имя>-144.m3u8} рядом с
 * {@code <имя>-144-fragmented.mp4}) для ExoPlayer фонового звука: файл
 * fMP4 без общего индекса ({@code sidx} на каждые 2 с) ExoPlayer с середины
 * не начинает, а по плейлисту с {@code EXT-X-BYTERANGE} — начинает.
 *
 * Плейлист должен ссылаться только на наш файл: имя файла с ноды
 * ({@code job.fileName}) в {@code URI="…"} и в строках сегментов меняется на
 * {@code video.mp4}, любой другой адрес (чужой файл, абсолютный URL, ключ
 * шифрования, вложенный плейлист) — отказ, плейлист не сохраняется.
 */
final class OfflinePlaylist {
    static final String NAME = "playlist.m3u8";

    private static final Pattern URI_ATTR = Pattern.compile("URI=\"([^\"]*)\"");
    private static final Pattern MAP_RANGE = Pattern.compile("BYTERANGE=\"(\\d+)(?:@(\\d+))?\"");

    private OfflinePlaylist() {}

    /**
     * Плейлист для папки ролика; null — не годится (не M3U, чужие адреса, нет
     * сегментов, не VOD).
     */
    @Nullable
    static String rewrite(String text, String fileName) {
        if (fileName.isEmpty()) return null;
        String t = text.startsWith("﻿") ? text.substring(1) : text;
        if (!t.startsWith("#EXTM3U")) return null;
        StringBuilder out = new StringBuilder(t.length());
        int segments = 0;
        boolean ended = false;
        for (String raw : t.split("\r?\n", -1)) {
            String line = raw.trim();
            if (line.isEmpty()) {
                out.append('\n');
                continue;
            }
            if (line.startsWith("#")) {
                if (line.startsWith("#EXT-X-ENDLIST")) ended = true;
                // Плейлист вариантов: в строке после него — другой плейлист.
                if (line.startsWith("#EXT-X-STREAM-INF") || line.startsWith("#EXT-X-I-FRAME-STREAM-INF")) {
                    return null;
                }
                Matcher m = URI_ATTR.matcher(line);
                StringBuffer tag = new StringBuffer();
                while (m.find()) {
                    if (!m.group(1).equals(fileName)) return null;
                    m.appendReplacement(tag, Matcher.quoteReplacement("URI=\"" + OfflineStore.VIDEO + "\""));
                }
                m.appendTail(tag);
                out.append(tag).append('\n');
                continue;
            }
            // Строка сегмента — только наш файл.
            if (!line.equals(fileName)) return null;
            out.append(OfflineStore.VIDEO).append('\n');
            segments++;
        }
        if (segments == 0 || !ended) return null;
        // Последний перевод строки уже есть у последней строки.
        while (out.length() > 1 && out.charAt(out.length() - 1) == '\n' && out.charAt(out.length() - 2) == '\n') {
            out.setLength(out.length() - 1);
        }
        return out.toString();
    }

    /**
     * Куски плейлиста помещаются в файл длиной {@code length}: плейлист и
     * файл с одной ноды, но файл мог смениться (загрузка началась заново).
     */
    static boolean fits(String text, long length) {
        long prevEnd = 0;
        long maxEnd = 0;
        try {
            for (String raw : text.split("\r?\n")) {
                String line = raw.trim();
                long len;
                long off;
                if (line.startsWith("#EXT-X-BYTERANGE:")) {
                    String spec = line.substring("#EXT-X-BYTERANGE:".length()).trim();
                    int at = spec.indexOf('@');
                    len = Long.parseLong(at < 0 ? spec : spec.substring(0, at));
                    off = at < 0 ? prevEnd : Long.parseLong(spec.substring(at + 1));
                } else if (line.startsWith("#EXT-X-MAP:")) {
                    Matcher m = MAP_RANGE.matcher(line);
                    if (!m.find()) continue;
                    len = Long.parseLong(m.group(1));
                    off = m.group(2) != null ? Long.parseLong(m.group(2)) : 0;
                } else {
                    continue;
                }
                if (len < 0 || off < 0) return false;
                prevEnd = off + len;
                maxEnd = Math.max(maxEnd, prevEnd);
            }
        } catch (NumberFormatException e) {
            return false;
        }
        return maxEnd > 0 && maxEnd <= length;
    }
}
