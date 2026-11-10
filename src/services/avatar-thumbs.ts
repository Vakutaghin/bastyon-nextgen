/**
 * Аватарки на устройстве — маленькие превью.
 *
 * Серверы картинок отдают аватарки с `Cache-Control: max-age=0` (проверено
 * 10.11.2026: pocketnet.app:8092 и peertube*), и это оригиналы по 40–140 КБ.
 * Браузер на каждом запуске перепроверял каждую аватарку, а без сети не
 * показывал их вовсе. В приложениях для компьютера и Android service worker
 * выключен — кэша картинок там нет совсем.
 *
 * Теперь с уже показанной аватарки снимается превью THUMB_PX×THUMB_PX и
 * кладётся в базу (avatar-thumbs-api): картинка загружена с `crossorigin`, а
 * серверы разрешают CORS, так что лишнего запроса нет. Следующий показ того же
 * адреса берёт превью — без сети и без запроса. Адрес картинки привязан к её
 * содержимому (новая аватарка — новый адрес), поэтому превью не устаревает.
 *
 * Превью заменяет картинку только у аватарок до SHOW_MAX_PX: крупным (страница
 * профиля) его разрешения мало, им оно — запасное, когда сеть не дала картинку.
 */

import { reactive, ref } from 'vue'

import { avatarThumbsAPI, thumbKey } from '@/db/apis/avatar-thumbs-api'

/** Сторона превью: аватарке 64 px на экране с двойной плотностью хватает. */
export const THUMB_PX = 128
/** До какого размера аватарки превью заменяет картинку. */
export const SHOW_MAX_PX = 64
/** Дольше индекс превью не ждём: база зависла — аватарки идут из сети. */
export const INDEX_WAIT_MS = 1_500
/** Столько ждём само превью, прежде чем идти в сеть. */
export const READ_WAIT_MS = 1_000
/** Превью старше этого освежается при показе — давно не виденные вытесняются первыми. */
export const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000
/** Пауза перед записью: превью одного экрана уходят одной пачкой. */
export const SAVE_DELAY_MS = 2_000
/** Превью крупнее — значит, кодировщик не сжал (PNG): такое не храним. */
const MAX_DATA_LENGTH = 40_000

type IndexState = 'idle' | 'reading' | 'ready' | 'off'

/** Индекс сохранённого; пока он читается, аватарки ждут превью, а не идут в сеть. */
const indexState = ref<IndexState>('idle')
let stored = new Set<string>()
/** Прочитанные превью: адрес картинки → data URL. Реактивно. */
const loaded = reactive(new Map<string, string>())
/** Адреса, чьё превью не пришло вовремя или не читается, — идут в сеть. */
const skipped = reactive(new Set<string>())
const toRead = new Map<string, string>()
let readTimer: ReturnType<typeof setTimeout> | null = null
/** Снять превью: картинки ждут свободного времени. */
const toMake = new Map<string, HTMLImageElement>()
/** С этих снять не вышло (нет CORS) — больше не пробуем. */
const unmakeable = new Set<string>()
let making = false
/** Готовые к записи. */
const toSave = new Map<string, string>()
let saveTimer: ReturnType<typeof setTimeout> | null = null
let saving: Promise<void> = Promise.resolve()
let generation = 0

export interface AvatarSource {
  /** Что показать: превью, адрес картинки или ничего. */
  src?: string
  /** Превью есть на устройстве и вот-вот прочитается: сеть не трогаем, инициалы не показываем. */
  wait: boolean
}

function scheduleRead(): void {
  readTimer ??= setTimeout(() => {
    readTimer = null
    void readPending()
  }, 0)
}

async function readPending(): Promise<void> {
  const batch = [...toRead]
  toRead.clear()
  if (!batch.length) return
  const gen = generation
  const timeout = setTimeout(() => {
    for (const [, url] of batch) if (!loaded.has(url)) skipped.add(url)
  }, READ_WAIT_MS)
  const rows = await avatarThumbsAPI.get(batch)
  clearTimeout(timeout)
  if (gen !== generation) return
  const now = Date.now()
  const stale: Array<{ url: string; data: string }> = []
  for (const row of rows) {
    loaded.set(row.url, row.data)
    if (now - row.savedAt > REFRESH_AFTER_MS) stale.push(row)
  }
  // Не нашлось (стёрли, хэш совпал у другого адреса) — забываем ключ: аватарка
  // пойдёт в сеть, и с неё снимется новое превью.
  for (const [key, url] of batch) if (!loaded.has(url)) stored.delete(key)
  for (const { url, data } of stale) queueSave(url, data)
}

/**
 * Откуда брать аватарку `url` размера `sizePx`. Реактивно: превью, прочитанное
 * позже, подставится само.
 */
export function avatarSource(url: string | null | undefined, sizePx: number): AvatarSource {
  if (!url) return { wait: false }
  const thumb = loaded.get(url)
  const small = sizePx <= SHOW_MAX_PX
  if (thumb) return small ? { src: thumb, wait: false } : { src: url, wait: false }
  if (small && !skipped.has(url)) {
    if (indexState.value === 'reading') return { wait: true }
    const key = thumbKey(url)
    if (indexState.value === 'ready' && stored.has(key)) {
      if (!toRead.has(key)) {
        toRead.set(key, url)
        scheduleRead()
      }
      return { wait: true }
    }
  }
  return { src: url, wait: false }
}

/**
 * Запасное превью для аватарки, которую сеть не дала (крупная, без сети).
 * Реактивно: если превью есть на устройстве, оно читается и подставится само.
 */
export function fallbackThumb(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const thumb = loaded.get(url)
  if (thumb || indexState.value !== 'ready') return thumb
  const key = thumbKey(url)
  if (stored.has(key) && !toRead.has(key)) {
    toRead.set(key, url)
    scheduleRead()
  }
  return undefined
}

/**
 * Превью с показанной картинки: квадрат по центру, как `object-fit: cover`.
 * `null` — снять нельзя (картинка без CORS, кодировщик не сжал).
 */
export function makeThumb(img: HTMLImageElement): string | null {
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) return null
  const side = Math.min(w, h)
  const size = Math.min(THUMB_PX, side)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingQuality = 'high'
  const draw = (): void => {
    ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size)
  }
  draw()
  let data: string
  try {
    data = canvas.toDataURL('image/webp', 0.8)
    // WebKit WebP не кодирует и отдаёт PNG — берём JPEG на белом фоне.
    if (!data.startsWith('data:image/webp')) {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, size, size)
      draw()
      data = canvas.toDataURL('image/jpeg', 0.85)
    }
  } catch {
    // Картинка без CORS «пачкает» холст — снять превью нельзя.
    return null
  }
  return data.length <= MAX_DATA_LENGTH ? data : null
}

function idle(run: () => void): void {
  const ric = (
    globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }
  ).requestIdleCallback
  if (ric) ric(run, { timeout: 2_000 })
  else setTimeout(run, 50)
}

function makeNext(): void {
  const next = toMake.entries().next()
  if (next.done) {
    making = false
    return
  }
  const [url, img] = next.value
  toMake.delete(url)
  const data = makeThumb(img)
  if (data) {
    loaded.set(url, data)
    stored.add(thumbKey(url))
    queueSave(url, data)
  } else {
    unmakeable.add(url)
  }
  idle(makeNext)
}

/**
 * Картинка `url` показана: снять с неё превью, когда будет свободное время.
 * GIF не трогаем — превью остановило бы анимацию.
 */
export function rememberThumb(url: string | null | undefined, img: EventTarget | null): void {
  if (!url || !(img instanceof HTMLImageElement) || indexState.value !== 'ready') return
  if (loaded.has(url) || toMake.has(url) || unmakeable.has(url) || stored.has(thumbKey(url))) return
  if (/\.gif(\?|#|$)/i.test(url) || img.currentSrc.startsWith('data:')) return
  toMake.set(url, img)
  if (!making) {
    making = true
    idle(makeNext)
  }
}

function queueSave(url: string, data: string): void {
  toSave.set(url, data)
  saveTimer ??= setTimeout(() => void flushAvatarThumbs(), SAVE_DELAY_MS)
}

/** Записать накопленные превью сейчас. */
export function flushAvatarThumbs(): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  if (!toSave.size) return saving
  const batch = [...toSave].map(([url, data]) => ({ url, data }))
  toSave.clear()
  saving = saving.then(() => avatarThumbsAPI.save(batch))
  return saving
}

/** Прочитать индекс превью. Зовётся один раз при запуске, когда база открыта. */
export async function startAvatarThumbs(): Promise<void> {
  if (indexState.value !== 'idle') return
  indexState.value = 'reading'
  const gen = generation
  const timeout = setTimeout(() => {
    if (indexState.value === 'reading') indexState.value = 'off'
  }, INDEX_WAIT_MS)
  const keys = await avatarThumbsAPI.keys()
  clearTimeout(timeout)
  if (gen !== generation || indexState.value !== 'reading') return
  if (!keys) {
    indexState.value = 'off'
    return
  }
  stored = keys
  indexState.value = 'ready'
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flushAvatarThumbs()
    })
    window.addEventListener('pagehide', () => void flushAvatarThumbs())
  }
}

/** Стереть превью (выход, удаление аккаунта); вернуть, сколько было. */
export async function forgetAvatarThumbs(): Promise<number> {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  toSave.clear()
  toMake.clear()
  stored = new Set()
  await saving
  return avatarThumbsAPI.clear()
}

/** Только для тестов. */
export function __resetAvatarThumbsForTests(): void {
  generation++
  indexState.value = 'idle'
  stored = new Set()
  loaded.clear()
  skipped.clear()
  toRead.clear()
  toMake.clear()
  toSave.clear()
  unmakeable.clear()
  making = false
  saving = Promise.resolve()
  for (const t of [readTimer, saveTimer]) if (t) clearTimeout(t)
  readTimer = null
  saveTimer = null
}
