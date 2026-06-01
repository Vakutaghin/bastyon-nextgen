# PLAN: Надёжность загрузки и декодирования видео

**Статус: Phase 1–3 завершены (commits `2773e5b`, `73c0923`, `30170cb`). Phase 4–5 — pending.**

## 0. Контекст

Документ описывает план устранения проблем загрузки, кодирования и воспроизведения
видео в `bastyon-nextgen`, выявленных аудитом видео-пайплайна.

Связанный документ: [VIDEO_ARCHITECTURE_SCHEMA.md](./VIDEO_ARCHITECTURE_SCHEMA.md) — текущая
архитектура (как было в `pocketnet.gui` через PlyrEx + PeerTubeEmbeding + P2P Manager).
Этот план описывает новый стек nextgen (hls.js + Tauri FFmpeg + Dexie/IndexedDB) и его проблемы.

**Принципиальное ограничение** (см. память: децентрализация и self-custody): видео-функциональность
должна работать standalone, без посредников и без обязательной нативной обвязки. Любой fallback,
требующий централизованного сервиса, обсуждается отдельно.

---

## 1. Текущий стек (что реализовано)

**Воспроизведение:**
- [src/b-components/content/video-player/video-player.ts](../src/b-components/content/video-player/video-player.ts) — Vue-компонент плеера (915 строк)
- [src/b-components/content/video-player/composables/use-video-hls.ts](../src/b-components/content/video-player/composables/use-video-hls.ts) — инициализация HLS, выбор качества
- [src/b-components/content/video-player/video-player-manager.ts](../src/b-components/content/video-player/video-player-manager.ts) — singleton, гарантирует один активный плеер
- Библиотека: `hls.js@^1.6.15` (нативный Safari HLS как fallback)

**Загрузка / транскодинг:**
- [src/b-components/video-uploader/video-uploader.ts](../src/b-components/video-uploader/video-uploader.ts) — UI загрузчика
- [src/b-components/video-uploader/transcoder/index.ts](../src/b-components/video-uploader/transcoder/index.ts) — `UniversalTranscoder` (на деле — только Tauri)
- [src/b-components/video-uploader/transcoder/tauri-transcoder.ts](../src/b-components/video-uploader/transcoder/tauri-transcoder.ts) — IPC к Rust
- [src-tauri/src/lib.rs](../src-tauri/src/lib.rs) — `save_temp_file`, `get_video_metadata` (ffprobe), `transcode_video` (libvpx-vp9 / libopus / WebM)
- [src/db/apis/transcoded-video-api.ts](../src/db/apis/transcoded-video-api.ts) — Dexie/IndexedDB

**Источник видео (PeerTube):**
- [src/helpers/api/peertube-url.ts](../src/helpers/api/peertube-url.ts) — парсинг `peertube://host/id` → API → HLS playlist URL

**Конфигурация:**
- [src/b-components/video-uploader/utils/constants.ts](../src/b-components/video-uploader/utils/constants.ts) — лимиты битрейта, разрешения, FPS, IndexedDB

---

## 2. Карта проблем

Приоритет: **P0** (критично/блокирует), **P1** (важно), **P2** (желательно).
Сложность: **XS** (час), **S** (1–2 дня), **M** (3–7 дней), **L** (>1 нед).

### 2.1 Декодирование / Транскодирование

| # | Проблема | Приоритет | Сложность |
|---|----------|-----------|-----------|
| D1 | Транскодинг работает **только в Tauri**. В браузере и Capacitor — сразу `NOT_SUPPORTED`. Нарушает standalone-цель. | **P0** | **L** |
| D2 | Кодек захардкожен `libvpx-vp9` → выход всегда `.webm`. iOS Safari нативно не играет VP9 в WebM — локальный blob-предпросмотр сломается. | **P0** | **S** |
| D3 | Аудио в UI помечено `Нет (временно отключено)`, при этом Rust его кодирует. Расхождение UI/логики. | **P1** | **XS** |
| D4 | `save_temp_file` принимает `Vec<u8>` через IPC — для 4GB файла это серилизация всего буфера через JSON-IPC. Не выдержит заявленный `MAX_ORIGINAL_SIZE: 4GB`. | **P0** | **M** |
| D5 | `getMetadata()` копирует файл во временный путь и удаляет; `transcode()` вызывает `getMetadata()` **повторно** и **снова** копирует файл — 3× copy на 4GB. | **P1** | **S** |
| D6 | Потолок параметров: 720p / 1500 kbps / 30 FPS. Для 2026 года — устаревший минимум. | **P1** | **XS** (константы) / **M** (UI на выбор качества) |
| D7 | Нет проверки наличия системного `ffmpeg` при старте Tauri. Ошибка приходит как невнятное "Failed to execute ffprobe" в момент загрузки. | **P2** | **XS** |
| D8 | Утечка temp-файлов при ошибке: `delete_temp_file` вызывается только в happy-path; нет TTL-cleanup для `tauri_video_*` / `tauri_output_*` при старте. | **P2** | **XS** |
| D9 | Web Worker для чтения файла читает весь `arrayBuffer()` в основном потоке перед transfer, что и есть основной блокирующий шаг ([tauri-transcoder.ts:258](../src/b-components/video-uploader/transcoder/tauri-transcoder.ts#L258)). | **P2** | **S** |

### 2.2 Воспроизведение / HLS

| # | Проблема | Приоритет | Сложность |
|---|----------|-----------|-----------|
| P1 | `bufferStalledError` игнорируется без recovery ([use-video-hls.ts:330](../src/b-components/content/video-player/composables/use-video-hls.ts#L330)). | **P1** | **XS** |
| P2 | `NETWORK_ERROR` только ставит сообщение, без `hls.startLoad()` retry с backoff. | **P1** | **S** |
| P3 | `MEDIA_ERROR` пытается `recoverMediaError()` один раз, без счётчика и без `swapAudioCodec()` на второй попытке (рекомендованный hls.js паттерн). | **P1** | **S** |
| P4 | `maxBufferSize` закомментирован → на 4K-стриме буфер может занять >1GB RAM, что убьёт мобильный браузер ([use-video-hls.ts:274](../src/b-components/content/video-player/composables/use-video-hls.ts#L274)). | **P1** | **XS** |
| P5 | Autoplay не делает muted-fallback. На мобильном Safari `play()` фейлится → залипший постер без сообщения. 3 места одинакового кода. | **P1** | **S** |
| P6 | Нет segment-cache между сессиями (Service Worker / Cache Storage). Повторное открытие видео = заново трафик. | **P2** | **M** |
| P7 | Capacitor / iOS WebView использует hls.js вместо нативного AVPlayer/ExoPlayer. CPU/батарея страдают. | **P2** | **L** |

### 2.3 Загрузка манифеста (PeerTube API)

| # | Проблема | Приоритет | Сложность |
|---|----------|-----------|-----------|
| N1 | `appFetch` идёт без retry, без таймаута, без backoff. Один сбой PeerTube-ноды = видео не открывается ([peertube-url.ts:107](../src/helpers/api/peertube-url.ts#L107)). | **P1** | **S** |
| N2 | Нет fallback на альтернативный PeerTube-хост из [`src/servers.json`](../src/servers.json). | **P1** | **S** |
| N3 | Нет явного `redirect: 'follow'` — `appFetch` зависит от дефолтов; PeerTube часто отдаёт 302 при балансировке. | **P2** | **XS** |
| N4 | В production билде запрос идёт прямым `https://${host}/...` — CORS должен быть открыт на каждой ноде, иначе ничего не работает. Нет диагностики "это CORS, а не сеть". | **P2** | **S** |

### 2.4 Хранилище (IndexedDB / Dexie)

| # | Проблема | Приоритет | Сложность |
|---|----------|-----------|-----------|
| S1 | Тихий auto-cleanup по `MAX_AGE_DAYS: 30` / `MAX_COUNT: 50` / `MAX_SIZE_MB: 500` — пользователь не уведомляется ([constants.ts:122](../src/b-components/video-uploader/utils/constants.ts#L122)). | **P2** | **XS** |
| S2 | `delete()` в [transcoded-video-api.ts](../src/db/apis/transcoded-video-api.ts) бросает Error без контекста при сбое IDB. | **P2** | **XS** |

---

## 3. Фазы реализации

### Phase 1 — Стабилизация плеера и сети (P0/P1, быстрые победы) ✅

**Commit:** `2773e5b` fix(video): harden HLS player + PeerTube fetch resilience.

Цель: одно видео из ленты ВСЕГДА открывается или показывает понятное сообщение об ошибке.

- [x] **P1, XS** — `maxBufferSize: 60_000_000` в [use-video-hls.ts:274](../src/b-components/content/video-player/composables/use-video-hls.ts#L274).
- [x] **P1, XS** — Hls.js error handling: `bufferStalledError` → throttled `hls.startLoad(-1)`; счётчик попыток для `MEDIA_ERROR` + `swapAudioCodec()` на 2-й; сброс счётчиков на `FRAG_LOADED`.
- [x] **P1, S** — `NETWORK_ERROR` retry с exponential backoff 1s/2s/4s (макс 3 попытки).
- [x] **P1, S** — Утилита `tryAutoplay(video)` в [utils.ts](../src/b-components/content/video-player/composables/utils.ts) с muted-fallback; заменены 3 дублирующих места в use-video-hls.ts.
- [x] **P1, S** — Retry + таймаут в [peertube-url.ts](../src/helpers/api/peertube-url.ts) (`AbortController`, 10s timeout, 3 попытки, 404 fast-fail).
- [ ] **P1, S** — ~~Fallback на альтернативный хост из `servers.json`~~ — **отложено** (см. §6.1: `servers.json` не содержит PeerTube-зеркал, нужен отдельный mirror-список).
- [x] **P1, XS** — UI: "Нет (временно отключено)" заменено на реальное состояние из `sourceMetadata.hasAudio` в [video-info-panel.vue](../src/b-components/video-uploader/components/video-info-panel/video-info-panel.vue).

**Критерий приёмки:** плеер не залипает на мобильном Safari, видео из ленты открывается даже при первой неудаче сети, временные glitch'и буфера не дают чёрный экран навсегда.

### Phase 2 — H.264 fallback и предсказуемые лимиты (P0) ✅

**Commit:** `73c0923` feat(video): H.264/MP4 transcoding + ffmpeg availability check.

Цель: транскодированные видео играются на iOS Safari нативно (без VP9 issues).

- [x] **P0, S** — `transcode_video` принимает `codec: Option<String>` ("h264" default / "vp9"); h264 → libx264 + AAC + MP4 (`+faststart`, `yuv420p`); vp9 → libvpx-vp9 + libopus + WebM.
- [x] **P0, S** — `mimeType` вычисляется из codec; экспортирован тип `TranscodeCodec`.
- [x] **P0, XS** — Новая команда `check_ffmpeg_available` (возвращает `{ ffmpeg, ffprobe, ffmpeg_version }`); uploader показывает в UI инструкцию `brew install ffmpeg` / `winget install ffmpeg` / `sudo apt install ffmpeg` в зависимости от платформы.
- [x] **P1, XS** — `TARGET_RESOLUTIONS` теперь включает `1080`; `MAX_RESOLUTION=1080`, `MAX_VIDEO_BITRATE=4000`, `MAX_FPS=60`; добавлен `DATA_SAVER_PRESET` (720p/1.5Mbps/30fps) как explicit fallback.

**Критерий приёмки:** видео, загруженное через Tauri, открывается на iPhone Safari нативно; не-Tauri пользователь получает понятное сообщение, а не "Failed to execute ffprobe".

### Phase 3 — Большие файлы через IPC (P0) ✅

**Commit:** `30170cb` perf(video): single temp-file copy per transcode + orphan cleanup.

Цель: транскодинг 4GB файлов не падает по памяти.

- [ ] **P0, M** — ~~Заменить `save_temp_file(Vec<u8>)` на путь через `tauri-plugin-fs`~~ — **частично, отложено** (см. §6.2: нужен переход на нативный file picker, меняет UX).
- [x] **P1, S** — `getMetadata()` рефакторена: один проход через `saveFileToTemp` → `getMetadataByPath` → cleanup в finally.
- [x] **P1, S** — `transcode()` не вызывает `getMetadata(file)` повторно; единственный `saveFileToTemp` в начале + `getMetadataByPath(savedPath)` + cleanup input + output в finally.
- [x] **P2, XS** — `cleanup_orphaned_temp_files(24h)` запускается в background-потоке при старте Tauri.
- [x] Cleanup: удалён мёртвый `createBlobInWorker` (~50 строк).

**Критерий приёмки:** транскодинг файла 2GB не выжирает >2.5GB RAM (раньше пик ~6GB+).

**Реальный эффект:** 3× копий → 1×. Полный zero-copy требует переключения на нативный диалог (§6.2).

### Phase 4 — Браузерный транскодинг (P0, отдельный трек) ⬜

Цель: standalone-работа без Tauri (см. принцип децентрализации в [памяти](../../../.claude/projects/-private-var-www-pocketnet/memory/principle_decentralization.md)).

- [ ] **P0, L** — Подключить `@ffmpeg/ffmpeg` (ffmpeg.wasm) как второй `Transcoder`-реализация в [transcoder/index.ts](../src/b-components/video-uploader/transcoder/index.ts). Lazy-load (бандл ~30MB), CDN или self-hosted.
- [ ] **P0, M** — `UniversalTranscoder.selectTranscoder()` → Tauri > ffmpeg.wasm > null. На мобильных Capacitor — ffmpeg.wasm (если есть память).
- [ ] **P0, M** — Настроить cross-origin isolation (`COOP: same-origin` + `COEP: require-corp`) для SharedArrayBuffer — **внимание: ломает embedded видео и postMessage с другими доменами**. Решить через `credentialless` COEP или service worker для нужных ресурсов.
- [ ] **P1, M** — Дефолты для wasm-пути: 480p как стандарт (vs 720p в Tauri), потому что wasm в 5–10× медленнее нативного; preset выбора качества с предупреждением "wasm: ожидайте ~N минут".
- [ ] **P1, S** — Прогресс из ffmpeg.wasm через `logger` callback, унифицировать с `transcode-progress` событием Tauri.
- [ ] **P2, S** — Замерить производительность на типовых файлах (10MB / 100MB / 500MB) на разных устройствах. Решить нужен ли upper limit для wasm-пути (например, файлы >200MB → "используйте десктоп-приложение").

**Критерий приёмки:** пользователь без Tauri может выбрать локальный файл до 200MB, дождаться транскода с прогрессом, увидеть preview и опубликовать.

### Phase 5 — Кэширование и UX (P2) ⬜

- [ ] **P2, M** — Service Worker для кэширования HLS-сегментов (`.m4s` / `.ts`) с lru-eviction.
- [ ] **P2, S** — Уведомление пользователя при auto-cleanup IndexedDB ("Удалено N черновиков старше 30 дней"), кнопка "не удалять" для текущего.
- [ ] **P2, S** — Различать CORS-ошибку от network-ошибки в `peertube-url.ts`; показывать другое сообщение ("Сервер ноды не настроен на CORS").
- [ ] **P2, L** — Capacitor-нативный плеер через [capacitor-video-player](https://github.com/jepiqueau/capacitor-video-player) или собственный плагин (AVPlayer/ExoPlayer) — экономия CPU/батареи vs hls.js в WebView.
- [ ] **P2, XS** — `delete()` в [transcoded-video-api.ts](../src/db/apis/transcoded-video-api.ts) — добавить контекст к Error при сбое IDB.
- [ ] **P2, XS** — Resolution-selector docstring и комментарии упоминают только до 720p — обновить под 1080p (см. [resolution-selector.ts:14](../src/b-components/video-uploader/transcoder/resolution-selector.ts#L14)).
- [ ] **P2, XS** — `appFetch` в [peertube-url.ts:125](../src/helpers/api/peertube-url.ts#L125) без явного `redirect: 'follow'` — добавить.

---

## 4. Отложенные доделки

Задачи, которые были выявлены аудитом, но требуют отдельной инфраструктуры или
архитектурного решения. Не блокируют Phase 4–5.

### 4.1 PeerTube mirror-fallback (отложено из Phase 1, N2)

**Проблема:** если PeerTube-нода из `peertube://host/id` упала, fallback'а нет.

**Почему отложено:** `src/servers.json` содержит только pocketnet RPC-прокси
(`*.pocketnet.app:8899`), не PeerTube. PeerTube федеративный — реплики живут на разных
независимых нодах, и без отдельного mirror-индекса fallback некуда.

**Что нужно:**
- Источник списка PeerTube-зеркал (новое поле в `servers.json` или DNS-based discovery).
- Логика fallback в [peertube-url.ts](../src/helpers/api/peertube-url.ts) `getPeerTubeVideoInfo()`: при network-ошибке после исчерпания retry — пробовать тот же `videoId` на следующем mirror-хосте.
- TTL-кэш "этот mirror знает это видео" — иначе каждый раз 404 на пол-списке.

**Приоритет:** P2 (без mirror-инфраструктуры pocketnet это не решается).

### 4.2 Полный zero-copy через native file picker (отложено из Phase 3)

**Проблема:** HTML `<input type="file">` не даёт абсолютного пути → файл копируется во временную
директорию (1× с Phase 3, было 3×). Для 4GB файлов это всё равно ~4GB диск + IPC.

**Почему отложено:** требует переключения с HTML-инпута на `@tauri-apps/plugin-dialog.open()` —
это меняет UX (нативный file dialog вместо браузерного), плюс ломает drag&drop в той же
форме (он остаётся на File API).

**Что нужно:**
- В Tauri-режиме [upload-dropzone.vue](../src/b-components/video-uploader/components/upload-dropzone/upload-dropzone.vue): подменить кнопку "выбрать файл" на вызов `dialog.open({ filters: [{ extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] }] })`.
- Новый interface `TranscodeSource = File | { path: string, name: string, size: number }`.
- `TauriTranscoder.transcode(source)` принимает оба; если `source.path` есть — не вызывать `saveFileToTemp`.
- Drag&drop: использовать Tauri-событие `onDragDrop` (даёт пути напрямую) вместо HTML `dragover/drop` (даёт File).
- TS-API не сломать для wasm-пути (он всегда работает с File).

**Приоритет:** P1 (большой UX-выигрыш на крупных файлах, но требует UI-переписи).

### 4.3 Background playback / drag-seek (вне scope)

См. отдельные ветки работы в `use-background-playback.ts` (untracked). Не относится к
аудиту видео-надёжности, отмечено для общей картины.

---

## 5. Что НЕ входит в этот план

- DASH/MSE улучшения — нет реальных DASH-источников в pocketnet.
- WebRTC live-streaming — отдельная инициатива.
- Замена hls.js на shaka-player — пока нет драйвера (не упирается ни в один из багов).
- P2P сегменты (как в legacy PeerTubeEmbeding) — отдельный проект, требует трекеров.

---

## 6. Метрики успеха

- **Open-rate** видео из ленты на мобильном Safari: с текущих ~? до >95% (нужен baseline).
- **Время до первого кадра** (TTFB → first decoded frame): <3s на широкополосном, <8s на 3G.
- **Транскод 1 минуты 1080p видео**: <30s в Tauri, <3min в браузере (ffmpeg.wasm).
- **OOM-краши** при транскоде: 0 для файлов до 2GB.
- **Crash-free playback session**: >99% (без чёрных экранов из-за stalled buffer).
