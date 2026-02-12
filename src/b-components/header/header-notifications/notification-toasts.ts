import type { Pinia } from 'pinia'
import { useNotificationSettingsStore } from '@/stores'
import { appToast } from '@/b-components/app-toast'
import type { NotificationItem } from '@/stores/notifications-store'

/**
 * Проверка: разрешено ли уведомление по настройкам пользователя.
 * mesType из getmissedinfo: comment, answer, upvoteShare, subscribe, subscribePrivate, unsubscribe, post, userInfo, repost.
 */
function isAllowedBySettings(settings: ReturnType<typeof useNotificationSettingsStore>, item: NotificationItem): boolean {
  const mesType = item.mesType ?? item.type
  switch (mesType) {
    case 'comment':
      return settings.comments
    case 'answer':
      return settings.answers
    case 'upvoteShare': {
      const val = item.upvoteVal ?? 0
      return val > 2 ? settings.upvotes : settings.downvotes
    }
    case 'subscribe':
    case 'subscribePrivate':
      return settings.followers
    case 'unsubscribe':
      return false
    case 'post':
    case 'userInfo':
    case 'repost':
      return true
    default:
      return true
  }
}

/** Один раз за сессию проигрываем короткий звук (чтобы при пачке уведомлений не было какофонии). */
let soundPlayedInSession = false

function playNotificationSoundOnce(): void {
  if (soundPlayedInSession) return
  soundPlayedInSession = true
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 800
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
    setTimeout(() => {
      soundPlayedInSession = false
    }, 2000)
  } catch {
    soundPlayedInSession = false
  }
}

/**
 * Показать тосты для новых уведомлений и один раз проиграть звук.
 * Вызывается из колбэка store (при опросе getmissedinfo раз в 30 сек).
 */
export function showToastsForNewNotifications(pinia: Pinia, items: NotificationItem[]): void {
  if (items.length === 0) return
  const settings = useNotificationSettingsStore(pinia)
  const allowed = items.filter((item) => isAllowedBySettings(settings, item))
  if (allowed.length === 0) return

  for (const item of allowed) {
    appToast.info({
      message: item.title,
      description: item.description ?? (item.from ? `От: ${item.from}` : undefined),
      key: item.id,
      duration: 4
    })
  }

  if (settings.sound) {
    playNotificationSoundOnce()
  }
}
