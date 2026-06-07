/**
 * Браузерные уведомления (Web Notification API) на новые события сети.
 * Показываем ТОЛЬКО когда вкладка в фоне (`document.hidden`), включён тоггл
 * `browserNotif` в настройках уведомлений и пользователь дал разрешение. Серверный/FCM-пуш —
 * вне скоупа (см. roadmap); это локальные нотификации поверх уже получаемых
 * через getmissedinfo событий.
 */

import { t } from '@/i18n'
import { useNotificationSettingsStore } from '@/stores/notification-settings-store'
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

function show(title: string, body: string, tag: string): void {
  try {
    const n = new Notification(title, { body, tag } as NotificationOptions)
    n.onclick = () => {
      try {
        window.focus()
      } catch {
        /* noop */
      }
      n.close()
    }
  } catch {
    /* конструктор Notification может бросить в некоторых окружениях — игнорируем */
  }
}

/**
 * Показывает браузерное уведомление для новых событий ленты (если уместно).
 * Вызывается из колбэка onNewNotifications рядом с тостами/звуком.
 */
export function notifyNewNotifications(items: NotificationItem[]): void {
  if (!items || items.length === 0 || !canShow()) return
  show('Bastyon', bodyFor(items), 'bastyon-notifications')
}

/** Браузерное уведомление о новом сообщении мессенджера (вкладка в фоне). */
export function notifyMessage(senderName: string, text: string): void {
  if (!canShow()) return
  show(senderName || 'Bastyon', text || '', 'bastyon-message')
}
