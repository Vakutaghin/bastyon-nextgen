import type { Pinia } from 'pinia'
import { useNotificationSettingsStore, useNotificationsStore } from '@/stores'
import { isNotificationAllowed } from '@/stores/notification-filtering'
import { appToast } from '@/b-components/app-toast'
import { t } from '@/i18n'
import type { NotificationItem } from '@/stores/notifications-store'
import { bringsCoins } from '@/stores/notifications-mappers'
import { playSound } from '@/services/app-sounds'

/** Максимум тостов за раз при пачке уведомлений — показываем только последние 2. */
const MAX_TOASTS_AT_ONCE = 2

/** «От кого»: ник, если уже известен, иначе начало адреса — как в списке. */
function senderLabel(pinia: Pinia, item: NotificationItem): string | undefined {
  if (!item.from) return undefined
  const name = useNotificationsStore(pinia).getEnrichment(item).from?.name?.trim()
  return name || `${item.from.slice(0, 8)}…`
}

/**
 * Показать тосты для новых уведомлений и один раз проиграть звук.
 * Вызывается из колбэка store (при опросе getmissedinfo раз в 30 сек).
 * Если пришло больше двух уведомлений — показываем только последние 2.
 * Нажатие на тост — `open`: туда же, куда уведомление в списке.
 */
export function showToastsForNewNotifications(
  pinia: Pinia,
  items: NotificationItem[],
  open?: (item: NotificationItem) => void
): void {
  if (items.length === 0) return
  const settings = useNotificationSettingsStore(pinia)
  const allowed = items.filter((item) => isNotificationAllowed(settings, item))
  if (allowed.length === 0) return

  const toShow =
    allowed.length > MAX_TOASTS_AT_ONCE ? allowed.slice(0, MAX_TOASTS_AT_ONCE) : allowed
  for (const item of toShow) {
    appToast.info({
      // item.title — i18n-ключ заголовка (см. notifications-mappers).
      message: item.title ? t(item.title) : '',
      // Текст оценки и «от кого» собираем здесь, на текущем языке: в IDB
      // хранится число, иначе после смены языка тост оставался бы на прежнем.
      description:
        item.description ??
        (item.mesType === 'upvoteComment'
          ? (item.upvoteVal ?? 0) < 0
            ? '👎'
            : '👍'
          : item.upvoteVal != null
            ? t('notif.scoreValue', { n: item.upvoteVal })
            : item.from
              ? t('notif.from', { name: senderLabel(pinia, item) })
              : undefined),
      key: item.id,
      duration: 4,
      ...(open
        ? {
            onClick: () => {
              appToast.close(item.id)
              open(item)
            },
          }
        : {}),
    })
  }

  // Пришли монеты — монетка, иначе капля. Один звук на пачку; «Звук» в
  // настройках проверяет playSound.
  playSound(allowed.some(bringsCoins) ? 'coin' : 'notification')
}
