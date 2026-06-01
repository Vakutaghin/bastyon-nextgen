// Форматтеры для дропдауна нотификаций: время + обрезка текста.

import { t } from '@/i18n'

/** Лимит для превью текста комментария (символов). */
export const COMMENT_PREVIEW_LIMIT = 160

/** Лимит для превью текста родительского поста (символов). */
export const POST_REF_PREVIEW_LIMIT = 80

/**
 * Форматирует unix-таймстемп (секунды) как «X мин. / X ч. / X дн. / DD.MM.YYYY».
 * Для свежих (<60 сек) — «только что».
 */
export function formatNotificationTime(ts: number): string {
  const d = new Date(ts * 1000)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffM = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)
  if (diffM < 1) return t('appMsg.time.justNow')
  if (diffM < 60) return t('appMsg.time.minutesShort', { n: diffM })
  if (diffH < 24) return t('appMsg.time.hoursShort', { n: diffH })
  if (diffD < 7) return t('appMsg.time.daysShort', { n: diffD })
  return d.toLocaleDateString()
}

/** Сжимает пробелы и обрезает текст до max символов с многоточием. */
export function trimText(text: string | undefined, max: number): string {
  if (!text) return ''
  const plain = text.replace(/\s+/g, ' ').trim()
  if (plain.length <= max) return plain
  return plain.slice(0, max).trimEnd() + '…'
}
