/**
 * Сериализация и экспорт поста (Share) для блокчейн-транзакции.
 *
 * Портировано 1:1 из старого приложения `pocketnet.gui/js/kit.js` (класс `Share`):
 *   - serialize()  — kit.js:1595
 *   - export()     — kit.js:1731
 *   - typeop()     — kit.js:1800
 *
 * ВАЖНО: строка `serializePost()` хешируется (hash256) в OP_RETURN транзакции
 * (см. transaction-builder.ts), а нода реконструирует её из payload и сверяет хэш.
 * Поэтому порядок и кодировка полей здесь должны точно совпадать с легаси —
 * любое расхождение приведёт к отклонению транзакции нодой.
 */

/** Тип операции поста (3-й параметр sendrawtransactionwithmessage и тип в OP_RETURN). */
export type SharePostOperationType = 'share' | 'video' | 'audio' | 'article'

/** Настройки поста (поле `s` в payload). Не участвуют в хэше serialize(). */
export interface SharePostSettings {
  /** Порядок блоков в композере (drag&drop). */
  a?: string[]
  /** Тип контента: 'p' — обычный пост, 'a' — статья. */
  v?: string
  /** Версия (для статей v2+). */
  version?: number
  /** Список видео (легаси-поле). */
  videos?: unknown[]
  /** Режим OG-картинки для ссылок. */
  image?: string
  /** Видимость: '0' — все, '1' — подписчики, '2' — зарегистрированные, '3' — платные. */
  f?: string
  /** id чат-комнаты стрима. */
  c?: string
  /** Unix-таймстамп отложенной публикации (> 1 — запланировано). */
  t?: number
}

/** Опрос (поле `p` в payload). */
export interface SharePostPoll {
  title: string
  list: string[]
}

/** Содержимое статьи Editor.js (поле `m` для article — ОБЪЕКТ, не строка). */
export interface ArticleContent {
  blocks: unknown[]
  time?: number
  version?: string
  [key: string]: unknown
}

/** Данные поста для сериализации/экспорта. */
export interface SharePostData {
  /** Заголовок (для видео/статей). */
  caption?: string
  /** Тело поста (для обычных постов). */
  message?: string
  /**
   * Тело статьи в формате Editor.js (`{ blocks }`). Используется ТОЛЬКО для article v2.
   * В legacy `message.v` для статьи — это объект: serialize делает JSON.stringify(объект),
   * а в payload `m` уходит самим объектом (kit.js:1599,1706).
   */
  articleContent?: ArticleContent | null
  /** Внешняя ссылка / видео / аудио URL. */
  url?: string
  /** Теги (макс. 5). */
  tags?: string[]
  /** URL картинок (макс. 10). */
  images?: string[]
  /** Опрос. */
  poll?: SharePostPoll | Record<string, never>
  /** Язык поста ('en' | 'ru' | …). */
  language: string
  /** Настройки. */
  settings?: SharePostSettings
  /** txid редактируемого поста (пусто — новый пост). */
  txidEdit?: string
  /** txid репостируемого поста (пусто — не репост). */
  txidRepost?: string
}

/** Дефолтные настройки поста (kit.js:1464, self.default). */
const DEFAULT_SETTINGS = {
  a: ['cm', 'r', 'i', 'u', 'p'],
  v: 'p',
  videos: [] as unknown[],
  image: 'a',
  f: '0',
  c: '',
} as const

/** Статья версии 2+ (kit.js:1599, 1696). */
function isArticleV2(settings?: SharePostSettings): boolean {
  return settings?.v === 'a' && typeof settings.version === 'number' && settings.version >= 2
}

/** peertube-видео? (kit.js:1621 itisvideo) — учитывает только схему peertube://, не youtube/vimeo. */
function isPeertubeVideo(post: SharePostData): boolean {
  if (isArticleV2(post.settings)) return false
  const url = post.url || ''
  if (!url.startsWith('peertube://')) return false
  const segments = url.replace('peertube://', '').split('/')
  return segments[segments.length - 1] !== 'audio'
}

/** peertube-аудио? (kit.js:1635 itisaudio). */
function isPeertubeAudio(post: SharePostData): boolean {
  if (isArticleV2(post.settings)) return false
  const url = post.url || ''
  if (!url.startsWith('peertube://')) return false
  const segments = url.replace('peertube://', '').split('/')
  return segments[segments.length - 1] === 'audio'
}

/**
 * Определяет тип операции поста (kit.js:1800 typeop / kit.js:1791 optstype).
 * video → audio → article → share (в этом порядке приоритета).
 */
export function resolvePostOperationType(post: SharePostData): SharePostOperationType {
  if (isPeertubeVideo(post)) return 'video'
  if (isPeertubeAudio(post)) return 'audio'
  if (isArticleV2(post.settings)) return 'article'
  return 'share'
}

/**
 * Строка для хэширования в OP_RETURN (kit.js:1595 serialize).
 * Порядок (СЫРЫЕ значения, без encodeURIComponent):
 *   url + caption + message + tags.join(',') + images.join(',') + txidEdit + txidRepost
 * Для статьи v2 message предварительно оборачивается в JSON.stringify.
 */
export function serializePost(post: SharePostData): string {
  const url = post.url || ''
  const caption = post.caption || ''

  // Для статьи v2 в позицию message идёт JSON.stringify(объекта Editor.js), как в legacy.
  const message = isArticleV2(post.settings)
    ? JSON.stringify(post.articleContent ?? { blocks: [] })
    : post.message || ''

  const tags = (post.tags || []).join(',')
  const images = (post.images || []).join(',')
  const txidEdit = post.txidEdit || ''
  const txidRepost = post.txidRepost || ''

  return url + caption + message + tags + images + txidEdit + txidRepost
}

/** Собирает объект настроек с дефолтами (kit.js export использует _.clone(settings)). */
function buildSettings(settings?: SharePostSettings): Record<string, unknown> {
  const result: Record<string, unknown> = {
    a: settings?.a ?? [...DEFAULT_SETTINGS.a],
    v: settings?.v ?? DEFAULT_SETTINGS.v,
    videos: settings?.videos ?? [...DEFAULT_SETTINGS.videos],
    image: settings?.image ?? DEFAULT_SETTINGS.image,
    f: settings?.f ?? DEFAULT_SETTINGS.f,
    c: settings?.c ?? DEFAULT_SETTINGS.c,
  }
  if (settings?.version !== undefined) result.version = settings.version
  if (settings?.t !== undefined) result.t = settings.t
  return result
}

/**
 * Экспортирует пост в payload для sendrawtransactionwithmessage (kit.js:1731 export).
 *
 * Краткий формат (по умолчанию): { c, m, u, p, t, i, s, l, txidEdit, txidRepost }.
 * Расширенный (extended=true): полные ключи + type — для отладки/локального хранения.
 *
 * ВНИМАНИЕ: в легаси `m` в export НЕ оборачивается в JSON.stringify для статей
 * (в отличие от serialize) — воспроизводим это поведение точно (kit.js:1706-1712).
 */
export function exportPost(
  post: SharePostData,
  extended: boolean = false
): Record<string, unknown> {
  // Для статьи `m` — это ОБЪЕКТ Editor.js (как в legacy), для остальных — строка тела.
  const messageValue: string | ArticleContent = isArticleV2(post.settings)
    ? (post.articleContent ?? { blocks: [] })
    : post.message || ''

  if (extended) {
    return {
      type: 'share',
      caption: post.caption || '',
      message: messageValue,
      url: post.url || '',
      tags: post.tags || [],
      images: post.images || [],
      settings: buildSettings(post.settings),
      language: post.language,
      txidEdit: post.txidEdit || '',
      txidRepost: post.txidRepost || '',
      poll: post.poll || {},
    }
  }

  return {
    c: post.caption || '',
    m: messageValue,
    u: post.url || '',
    p: post.poll || {},
    t: post.tags || [],
    i: post.images || [],
    s: buildSettings(post.settings),
    l: post.language,
    txidEdit: post.txidEdit || '',
    txidRepost: post.txidRepost || '',
  }
}
