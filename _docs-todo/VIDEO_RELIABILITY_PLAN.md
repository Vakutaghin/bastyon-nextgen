# PLAN: Надёжность видео — остаток работ

Phase 1–6 аудита видео-пайплайна **реализованы**: стабилизация плеера/сети, H.264/MP4,
single-copy IPC (commits `2773e5b`, `73c0923`, `30170cb`), браузерный транскодинг на
ffmpeg.wasm (single-thread), SW-кэш HLS-сегментов и клиентская деградация плеера
(HLS→mp4 fallback на той же ноде, watchdog загрузки, retry-кнопка, network-aware качество).
Ниже — только **несделанное**: задачи, заблокированные инфраструктурой / устройствами /
ручной проверкой, и отложенные UX-переписи.

**Принцип** (см. память: децентрализация): видео должно работать standalone, без посредников
и без обязательной нативной обвязки.

---

## ⚠️ Незакрытая верификация (требует ручного прогона)

Код и сборка зелёные (eslint + vitest + production build), но в реальном рантайме **не прогонялись**:

- **ffmpeg.wasm-транскод** реального видео в браузере (выбор файла → preview → publish, до 200MB).
- **SW-кэш HLS-сегментов** на живой PeerTube-ноде (CacheFirst / byte-range / LRU; нужен built
  preview + CORS-нода, т.к. opaque-ответы намеренно не кэшируются).
- **Phase 6 HLS→MP4 fallback** на живой ноде: реальный фатальный сбой HLS (битый сегмент /
  обрыв) должен переключать на прямой mp4 без перезагрузки; проверить и Safari-ветку (нативный HLS).

Нужен headed-браузер + видеофайл + `pnpm preview`. До этого Phase 4/5 — «реализовано», а не «принято».

---

## Остаток задач

### P1 — Zero-copy через native file picker (отложено из Phase 3, §4.2)

HTML `<input type="file">` не даёт абсолютный путь → файл копируется в temp (1× после Phase 3).
Для 4GB это всё равно ~4GB диск + IPC.

- Tauri-режим [upload-dropzone.vue](../src/b-components/video-uploader/components/upload-dropzone/upload-dropzone.vue):
  кнопку «выбрать файл» → `@tauri-apps/plugin-dialog.open({ filters: [{ extensions: ['mp4','mov','webm','mkv','avi'] }] })`.
- Новый `TranscodeSource = File | { path: string; name: string; size: number }`;
  `TauriTranscoder.transcode(source)` принимает оба, при `source.path` не зовёт `saveFileToTemp`.
- Drag&drop: Tauri-событие `onDragDrop` (даёт пути) вместо HTML `dragover/drop`.
- TS-API не ломать для wasm-пути (он всегда работает с `File`).

> ⚠️ path-ветка `TauriTranscoder` в `finally` **НЕ** должна удалять входной файл — это реальный
> файл пользователя, а не temp-копия. Ошибка здесь = потеря исходного видео. Ветка не исполняется
> вне Tauri-рантайма, а gates (eslint/vitest/build) её не покрывают. **Делать только с прогоном в Tauri-сборке.**

### P2 — Бенчмарки wasm-пути

Замерить транскод на типовых файлах (10MB / 100MB / 500MB) на разных устройствах; решить,
нужен ли потолок жёстче текущих 200MB (`WASM_RECOMMENDED_MAX_SIZE` в
[constants.ts](../src/b-components/video-uploader/utils/constants.ts)). Ручной прогон.

### P2 — Capacitor-нативный плеер

iOS/Android WebView сейчас гоняет hls.js (CPU/батарея). Перейти на нативный AVPlayer/ExoPlayer
через [capacitor-video-player](https://github.com/jepiqueau/capacitor-video-player) или свой
плагин. Требует нативного модуля + теста на устройстве.

### P2 — PeerTube mirror-fallback (отложено из Phase 1, N2) — заблокировано инфраструктурой

Если нода из `peertube://host/id` упала, fallback'а нет. `src/servers.json` содержит только
pocketnet RPC-прокси (`*.pocketnet.app:8899`), не PeerTube-зеркала — падать некуда.

Нужно: источник списка зеркал (новое поле в `servers.json` или DNS-discovery), логика перебора
в [peertube-api.ts](../src/helpers/api/peertube-api.ts) `getPeerTubeVideoInfo()` (при
`cors-or-network` после исчерпания retry — следующий mirror), TTL-кэш «этот mirror знает это видео».
Не client-fixable без mirror-инфраструктуры pocketnet.

---

## Вне scope (намеренно НЕ реализуем в рамках этого плана)

- DASH/MSE, WebRTC live-streaming, замена hls.js на shaka-player, P2P-сегменты — отдельные инициативы.
- Background playback / drag-seek — отдельная ветка (`use-background-playback.ts`), не про надёжность.

## Метрики приёмки (для верификации выше)

- Open-rate видео из ленты на мобильном Safari: >95%.
- Время до первого кадра (TTFB → first decoded frame): <3s broadband, <8s 3G.
- Транскод 1 минуты 1080p: <30s в Tauri, <3min в браузере (ffmpeg.wasm).
- OOM-краши при транскоде до 2GB: 0. Crash-free playback session: >99%.
