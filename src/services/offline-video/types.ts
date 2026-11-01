// Скачанные ролики: общий вид для всех платформ. Качает и ведёт список
// бэкенд — Rust на компьютере (src-tauri/src/offline), служба на Android
// (plugins/offline), воркер в вебе (web-worker.ts); страница только читает
// список и подписана на события. Папка ролика везде одна:
//
//   offline/<id>/video.mp4        ролик (на время загрузки video.mp4.part)
//   offline/<id>/thumb.jpg        обложка
//   offline/<id>/avatar.jpg       аватар автора
//   offline/<id>/captions/<язык>.vtt
//   offline/<id>/playlist.m3u8     плейлист качества для ExoPlayer (только Android)
//   offline/<id>/meta.json        OfflineMeta — что показать без сети
//   offline/<id>/state.json       OfflineState — ход загрузки
//   offline/<id>/job.json         OfflineJob — откуда качать после перезапуска
//
// id — `<uuid>-<высота>`: буквы, цифры, `-` и `_`.

export type OfflineStatus = 'queued' | 'downloading' | 'paused' | 'failed' | 'done'

/**
 * Причина паузы или сбоя:
 * - `network` — ни один адрес не ответил после повторов;
 * - `not_found` — файла нет ни на одной ноде (404);
 * - `hash_mismatch` — фрагмент дважды не сошёлся с суммой;
 * - `no_space` — места не хватит заранее; `disk_full` — кончилось по ходу;
 * - `tor_not_ready` — Tor включён, но ещё не готов;
 * - `wifi` — только по Wi-Fi, а его нет (Android);
 * - `quota` — Android 15 исчерпал суточное время фоновой загрузки;
 * - `io` — ошибка записи.
 */
export type OfflineError =
  | 'network'
  | 'not_found'
  | 'hash_mismatch'
  | 'no_space'
  | 'disk_full'
  | 'tor_not_ready'
  | 'wifi'
  | 'quota'
  | 'io'

export interface OfflineState {
  status: OfflineStatus
  /** Скачано подряд с начала файла, байт. */
  received: number
  /** Размер файла; 0 — ещё не известен. */
  total: number
  error?: OfflineError | string
}

export interface OfflineCaption {
  language: string
  label: string
  /** `captions/<язык>.vtt` в папке ролика. */
  file: string
}

/** Снимок для показа без сети. Пишет страница, бэкенд хранит как есть. */
export interface OfflineMeta {
  id: string
  /** `peertube://host/videoId[/audio]` — тот же ключ, что у плеера. */
  peertubeUrl: string
  kind: 'video' | 'audio'
  uuid: string
  /** txid поста. */
  postId?: string
  title: string
  /** Текст поста — описание и главы. */
  description?: string
  author: { address: string; name?: string }
  /** Скачаны ли обложка и аватар. */
  thumb?: boolean
  avatar?: boolean
  /** Секунды. */
  duration?: number
  height: number
  /** Ожидаемый размер файла, байт. */
  size: number
  captions?: OfflineCaption[]
  /** Когда поставлено, мс. */
  createdAt: number
  /** Аккаунты, которые скачали ролик. Пусто — файл удаляется. */
  accounts: string[]
  /** Когда выяснилось, что автор удалил ролик (мс). Файл остаётся. */
  authorDeleted?: number
  /** Когда последний раз проверяли, не удалён ли (мс). */
  checkedAt?: number
  /**
   * Скачано само — новый ролик подписок (мс). Через AUTO_KEEP_MS удаляется,
   * если человек не нажал «Оставить» (тогда поля нет).
   */
  auto?: number
}

export interface OfflineItem {
  id: string
  meta: OfflineMeta
  state: OfflineState
}

export interface OfflineExtra {
  /**
   * `thumb.jpg`, `avatar.jpg`, `captions/<язык>.vtt`; на Android ещё
   * `playlist.m3u8` — плейлист качества для ExoPlayer (имя файла в нём служба
   * меняет на `video.mp4`).
   */
  name: string
  url: string
}

/** Откуда качать. Собирает страница: она знает архивы, зеркала и прокси. */
export interface OfflineJob {
  id: string
  /** Адреса одного файла по порядку: рядом с плейлистом, исходная нода, архив. */
  sources: string[]
  /** Имя файла в ответе `segmentsSha256Url` (последняя часть `fileUrl`). */
  fileName: string
  sha256Urls: string[]
  extras: OfflineExtra[]
  size: number
}

export interface OfflineProgress {
  id: string
  received: number
  total: number
}

export interface OfflineChanged {
  id: string
  /** null — ролик удалён. */
  item: OfflineItem | null
}

export interface OfflineUsage {
  /** Занято скачанным, байт. */
  used: number
  /** Свободно на диске; null — не узнать. */
  free: number | null
}

/** Файлы ролика, которые бэкенд отдаёт странице. */
export type OfflineFile = 'video.mp4' | 'thumb.jpg' | 'avatar.jpg' | `captions/${string}.vtt`

/** Где лежит скачанное: папка на компьютере, память или карта на Android. */
export interface OfflineLocation {
  /** Папка (компьютер) — показать человеку. */
  path?: string
  /** Android: внутренняя память или карта. */
  current?: 'internal' | 'sd'
  /** Стандартное место: своя папка приложения или память телефона. */
  isDefault: boolean
  /**
   * Выбранное место не подключено (диск, карта): новое качается в стандартное,
   * а скачанное там не видно. Строка — путь папки, true — карта.
   */
  unavailable: string | boolean | null
  /** Свободно там, где скачанное сейчас; null — не узнать. */
  free: number | null
  /** Android: карта вставлена — сколько на ней свободно; null — карты нет. */
  sd?: { free: number | null } | null
}

export interface OfflineMoving {
  done: number
  total: number
}

export interface OfflineBackend {
  readonly kind: 'tauri' | 'android' | 'web'
  list(): Promise<OfflineItem[]>
  /** Уже есть — вернуть как есть. */
  enqueue(job: OfflineJob, meta: OfflineMeta): Promise<OfflineItem>
  pause(id: string): Promise<void>
  /** Продолжить приостановленное или упавшее. */
  resume(id: string): Promise<void>
  /** Удалить ролик или отменить загрузку вместе с недокачанным. */
  remove(id: string): Promise<void>
  /** Слить поля в meta.json (null — убрать поле). */
  patchMeta(id: string, patch: Partial<Record<keyof OfflineMeta, unknown>>): Promise<OfflineItem>
  usage(): Promise<OfflineUsage>
  clear(): Promise<void>
  /** Адрес файла для `<video>`, `<img>` и `fetch`. */
  fileUrl(id: string, file: OfflineFile): Promise<string>
  /**
   * Адрес для нативного плеера (ExoPlayer фонового звука на Android).
   * null — нативного плеера нет.
   */
  nativeUrl?(id: string): Promise<string | null>
  /** Только по Wi-Fi (Android). */
  setWifiOnly?(on: boolean): Promise<void>
  /**
   * Сеть сейчас безлимитная — Wi-Fi (Android). Нет метода — платформа не
   * знает, смотрим `navigator.connection`.
   */
  unmetered?(): Promise<boolean>
  /** Где лежит скачанное (компьютер, Android); нет метода — выбрать нельзя (веб). */
  location?(): Promise<OfflineLocation>
  /**
   * Перенести скачанное: компьютер — путь папки или null (стандартная),
   * Android — 'internal' или 'sd'. Ошибка — код: `no_space`, `not_writable`,
   * `inside_current`, `target_busy`, `busy`, `no_sd`, `moving`, `io`.
   */
  moveTo?(target: string | null): Promise<OfflineLocation>
  onMoving?(cb: (p: OfflineMoving) => void): Promise<() => void>
  onProgress(cb: (p: OfflineProgress) => void): Promise<() => void>
  onChanged(cb: (e: OfflineChanged) => void): Promise<() => void>
}
