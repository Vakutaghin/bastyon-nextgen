import { t } from '@/i18n'

/**
 * Название кнопки с числом на значке — для диктора: «Сообщения, непрочитанных: 3».
 * У кнопки с aria-label диктор читает только его, и число на значке
 * пропадало. `count` — как на значке («3», «99+»), пусто — без числа.
 */
export function unreadLabel(name: string, count: string | number | null | undefined): string {
  const n = count == null ? '' : String(count).trim()
  if (!n || n === '0') return name
  return t('a11y.withUnread', { name, n })
}
