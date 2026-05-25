# PLAN: Надёжность загрузки и декодирования видео

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

### Phase 1 — Стабилизация плеера и сети (P0/P1, быстрые победы)

Цель: одно видео из ленты ВСЕГДА открывается или показывает понятное сообщение об ошибке.

- [ ] **P1, XS** — Раскомментировать и подобрать `maxBufferSize` в [use-video-hls.ts:274](../src/b-components/content/video-player/composables/use-video-hls.ts#L274) (рекомендация: `60_000_000` байт).
- [ ] **P1, XS** — Hls.js error handling: `bufferStalledError` → `hls.startLoad(-1)`; счётчик попыток для `MEDIA_ERROR` + `swapAudioCodec()` на 2-й.
- [ ] **P1, S** — `NETWORK_ERROR` retry с exponential backoff (макс 3 попытки, 1s / 2s / 4s).
- [ ] **P1, S** — Muted-autoplay fallback: при reject `play()` → `video.muted = true; play()`. Извлечь в утилиту `tryAutoplay(video)`, заменить 3 дублирующих места.
- [ ] **P1, S** — Retry + таймаут в [peertube-url.ts:107](../src/helpers/api/peertube-url.ts#L107) (`AbortController`, 10s timeout, 3 попытки).
- [ ] **P1, S** — Fallback на альтернативный хост из `servers.json` при недоступности основного.
- [ ] **P1, XS** — Чинит UI: убрать "Нет (временно отключено)" в [video-info-panel.vue:71](../src/b-components/video-uploader/components/video-info-panel/video-info-panel.vue#L71), показывать реальное состояние из метаданных.

**Критерий приёмки:** плеер не залипает на мобильном Safari, видео из ленты открывается даже при первой неудаче сети, временные glitch'и буфера не дают чёрный экран навсегда.

### Phase 2 — H.264 fallback и предсказуемые лимиты (P0)

Цель: транскодированные видео играются на iOS Safari нативно (без VP9 issues).

- [ ] **P0, S** — В [src-tauri/src/lib.rs:230](../src-tauri/src/lib.rs#L230) добавить опцию `codec: "h264" | "vp9"`, маппить на `libx264` + `aac` + `mp4` container. По умолчанию — `h264` для совместимости.
- [ ] **P0, S** — В [tauri-transcoder.ts:194](../src/b-components/video-uploader/transcoder/tauri-transcoder.ts#L194) брать `mimeType` из выбранного кодека, не хардкодить `video/webm`.
- [ ] **P0, XS** — Проверка наличия `ffmpeg` и `ffprobe` на старте Tauri (новая команда `check_ffmpeg_available`), показывать инструкцию по установке в UI до выбора файла.
- [ ] **P1, XS** — Поднять потолок: 1080p / 4000 kbps / 60 FPS как опции, оставить 720p/30/1.5Mbps как preset "data-saver".

**Критерий приёмки:** видео, загруженное через Tauri, открывается на iPhone Safari нативно; не-Tauri пользователь получает понятное сообщение, а не "Failed to execute ffprobe".

### Phase 3 — Большие файлы через IPC (P0)

Цель: транскодинг 4GB файлов не падает по памяти.

- [ ] **P0, M** — Заменить `save_temp_file(Vec<u8>)` на путь через `tauri-plugin-fs` или передачу пути исходного файла напрямую (через `tauri-plugin-dialog` уже получаем абсолютный путь — использовать его без копирования).
- [ ] **P1, S** — `getMetadata()` не должна копировать файл; принимать `filePath` если он уже известен. Кэшировать результат на уровне `UniversalTranscoder`.
- [ ] **P1, S** — `transcode()` переиспользует уже сохранённый файл вместо нового копирования.
- [ ] **P2, XS** — TTL-cleanup `tauri_video_*` / `tauri_output_*` старше 24ч при старте Tauri.

**Критерий приёмки:** транскодинг файла 2GB не выжирает >2.5GB RAM (текущий пик — ~6GB+).

### Phase 4 — Браузерный транскодинг (P0, отдельный трек)

Цель: standalone-работа без Tauri.

- [ ] **P0, L** — Подключить `@ffmpeg/ffmpeg` (ffmpeg.wasm) как второй `Transcoder`-имплементация в [transcoder/index.ts](../src/b-components/video-uploader/transcoder/index.ts).
- [ ] **P0, M** — `UniversalTranscoder.selectTranscoder()` → Tauri > ffmpeg.wasm > null. На мобильных Capacitor — ffmpeg.wasm.
- [ ] **P1, M** — Понизить дефолтные лимиты для wasm-пути (он медленнее в ~5–10× от нативного): 480p как дефолт, 720p как опция.
- [ ] **P1, S** — Прогресс из ffmpeg.wasm через `logger` callback, унифицировать с `transcode-progress` событием Tauri.

**Критерий приёмки:** пользователь без Tauri может выбрать локальный файл, дождаться транскода, увидеть preview и опубликовать.

### Phase 5 — Кэширование и UX (P2)

- [ ] **P2, M** — Service Worker для кэширования HLS-сегментов (`.m4s` / `.ts`) с lru-eviction.
- [ ] **P2, S** — Уведомление пользователя при auto-cleanup IndexedDB ("Удалено N черновиков старше 30 дней"), кнопка "не удалять" для текущего.
- [ ] **P2, S** — Различать CORS-ошибку от network-ошибки в `peertube-url.ts`; показывать другое сообщение ("Сервер ноды не настроен на CORS").
- [ ] **P2, L** — Capacitor-нативный плеер через [capacitor-video-player](https://github.com/jepiqueau/capacitor-video-player) или собственный плагин (AVPlayer/ExoPlayer).

---

## 4. Что НЕ входит в этот план

- DASH/MSE улучшения — нет реальных DASH-источников в pocketnet.
- WebRTC live-streaming — отдельная инициатива.
- Замена hls.js на shaka-player — пока нет драйвера (не упирается ни в один из багов).
- P2P сегменты (как в legacy PeerTubeEmbeding) — отдельный проект, требует трекеров.

---

## 5. Метрики успеха

- **Open-rate** видео из ленты на мобильном Safari: с текущих ~? до >95% (нужен baseline).
- **Время до первого кадра** (TTFB → first decoded frame): <3s на широкополосном, <8s на 3G.
- **Транскод 1 минуты 1080p видео**: <30s в Tauri, <3min в браузере (ffmpeg.wasm).
- **OOM-краши** при транскоде: 0 для файлов до 2GB.
- **Crash-free playback session**: >99% (без чёрных экранов из-за stalled buffer).
