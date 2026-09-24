/**
 * Позиция просмотра видео: ключ и правила «стоит ли продолжать с этого места».
 *
 * Чистая логика отдельно от хранилища и от плеера — её можно проверить тестами,
 * не поднимая ни IndexedDB, ни <video>.
 */

/** Ниже этой отметки продолжать нечего — проще начать сначала. */
export const MIN_RESUME_SECONDS = 15

/** Хвост ролика: дальше него позиция означает «досмотрел», а не «прервался». */
export const TAIL_SECONDS = 20

/** Короткие ролики не продолжаем: на такой длине это только раздражает. */
export const MIN_TRACKED_DURATION_SECONDS = 90

/**
 * Идентификатор видео для хранения позиции.
 *
 * Берём хост и путь, отбрасывая query и фрагмент: у ссылок на медиа там живут
 * одноразовые токены и параметры плеера, и с ними один и тот же ролик каждый
 * раз выглядел бы новым.
 */
export function videoProgressKey(url: string): string | null {
  const raw = (url || '').trim()
  if (!raw) return null
  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.href : undefined)
    if (parsed.protocol === 'blob:' || parsed.protocol === 'data:') return null
    return `${parsed.host}${parsed.pathname}`
  } catch {
    // Не URL (например, локальный путь) — ключом служит сама строка.
    return raw.slice(0, 512)
  }
}

/** Позицию имеет смысл хранить только для достаточно длинного ролика. */
export function isTrackableDuration(duration: number): boolean {
  return Number.isFinite(duration) && duration >= MIN_TRACKED_DURATION_SECONDS
}

/** Стоит ли записывать эту позицию: не начало и не самый хвост. */
export function shouldSavePosition(position: number, duration: number): boolean {
  if (!isTrackableDuration(duration)) return false
  if (!Number.isFinite(position) || position < MIN_RESUME_SECONDS) return false
  return position <= duration - TAIL_SECONDS
}

/**
 * Позиция, с которой продолжить, или `null`, если продолжать не нужно
 * (слишком близко к началу, к концу или к текущей длительности ролика).
 */
export function resumePosition(saved: number, duration: number): number | null {
  if (!isTrackableDuration(duration)) return null
  if (!Number.isFinite(saved) || saved < MIN_RESUME_SECONDS) return null
  if (saved > duration - TAIL_SECONDS) return null
  return saved
}
