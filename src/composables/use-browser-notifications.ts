/**
 * Браузерные уведомления (Web Notification API) на новые события сети.
 * Показываем ТОЛЬКО когда вкладка в фоне (`document.hidden`), включён тоггл
 * `browserNotif` в настройках уведомлений и пользователь дал разрешение. Серверный/FCM-пуш —
 * вне скоупа (см. roadmap); это локальные нотификации поверх уже получаемых
 * через getmissedinfo событий.
 */

import { APP_NAME } from '@/config/app-name'
import { t } from '@/i18n'
import { useNotificationSettingsStore } from '@/stores/notification-settings-store'
import { isNotificationAllowed } from '@/stores/notification-filtering'
import type { NotificationItem } from '@/stores/notifications-types'

function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/** Запрашивает разрешение, если оно ещё не выдано/не отклонено. Вызывать по жесту юзера. */
export async function ensureBrowserNotifPermission(): Promise<void> {
  if (!supported() || Notification.permission !== 'default') return
  try {
    await Notification.requestPermission()
  } catch {
    /* пользователь/браузер отклонил — не критично */
  }
}

/** Текст тела по списку новых уведомлений. */
function bodyFor(items: NotificationItem[]): string {
  if (items.length === 1) {
    const it = items[0]
    const title = t(it.title)
    return it.description ? `${title} — ${it.description}` : title
  }
  return t('notif.browserNewCount', { count: items.length })
}

/** Общая проверка условий показа: поддержка + фон + разрешение + тоггл. */
function canShow(): boolean {
  if (!supported() || !document.hidden) return false
  if (Notification.permission !== 'granted') return false
  try {
    return useNotificationSettingsStore().browserNotif
  } catch {
    return false
  }
}

function show(title: string, body: string, tag: string, onOpen?: () => void): void {
  try {
    const n = new Notification(title, { body, tag } as NotificationOptions)
    n.onclick = () => {
      try {
        window.focus()
      } catch {
        /* noop */
      }
      n.close()
      onOpen?.()
    }
  } catch {
    /* конструктор Notification может бросить в некоторых окружениях — игнорируем */
  }
}

/**
 * Показывает браузерное уведомление для новых событий ленты (если уместно).
 * Вызывается из колбэка onNewNotifications рядом с тостами/звуком. Нажатие
 * на уведомление об одном событии — `open`: туда, о чём оно; о нескольких —
 * просто окно приложения.
 */
export function notifyNewNotifications(
  items: NotificationItem[],
  open?: (item: NotificationItem) => void
): void {
  if (!items || items.length === 0 || !canShow()) return
  // Тумблеры типов («Оценки», «Комментарии», «Транзакции», …) до этого
  // фильтровали только тосты — системные уведомления шли мимо них (S56).
  const settings = useNotificationSettingsStore()
  const allowed = items.filter((item) => isNotificationAllowed(settings, item))
  if (allowed.length === 0) return
  const single = allowed.length === 1 ? allowed[0] : undefined
  show(
    APP_NAME,
    bodyFor(allowed),
    'bastyon-notifications',
    single && open ? () => open(single) : undefined
  )
}

/** Браузерное уведомление о новом сообщении мессенджера (вкладка в фоне). */
export function notifyMessage(senderName: string, text: string): void {
  if (!canShow()) return
  show(senderName || APP_NAME, text || '', 'bastyon-message')
}
