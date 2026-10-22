/**
 * Звуки приложения — у каждого своё событие:
 *
 *  - монетка (`coin`) — монеты на самом деле ушли или пришли: отправлены
 *    перевод, чаевые, буст, оплата подписки; пришло уведомление о переводе,
 *    чаевых, донате в комментарии, оплате подписки, выигрыше лотереи;
 *  - капля (`notification`) — остальные уведомления: оценки, комментарии,
 *    подписчики;
 *  - стекло (`message`) — новое сообщение в чате или mesh-чате.
 *
 * Все звуки выключает «Звук» в настройках уведомлений. Пачка одинаковых
 * событий звучит один раз: тот же звук повторно не играет `REPEAT_GAP_MS`.
 */

import { getActivePinia } from 'pinia'

import coinSound from '@/b-components/donate/sounds/donate.mp3'
import notificationSound from '@/b-components/header/header-notifications/sounds/notification.mp3'
import messageSound from '@/b-components/messenger/sounds/glass.mp3'

export type AppSound = 'coin' | 'notification' | 'message'

const SOURCES: Record<AppSound, string> = {
  coin: coinSound,
  notification: notificationSound,
  message: messageSound,
}

/** Громкость как у старого клиента (ion.sound, volume 0.5). */
const VOLUME = 0.5

/** Тот же звук не чаще раза за это время: десять сообщений подряд — один звук. */
export const REPEAT_GAP_MS = 1500

const players = new Map<AppSound, HTMLAudioElement>()
const lastPlayed = new Map<AppSound, number>()

/**
 * «Звук» в настройках уведомлений (стор `notificationSettings`). Читаем
 * состояние pinia, а не сам стор: так модуль не тянет за собой базу настроек.
 * Стор ещё не создан — значение по умолчанию, звук включён.
 */
function soundEnabled(): boolean {
  const state = getActivePinia()?.state.value.notificationSettings as
    | { sound?: boolean }
    | undefined
  return state?.sound !== false
}

export function playSound(sound: AppSound): void {
  if (!soundEnabled()) return
  const now = Date.now()
  if (now - (lastPlayed.get(sound) ?? -Infinity) < REPEAT_GAP_MS) return
  lastPlayed.set(sound, now)
  try {
    let player = players.get(sound)
    if (!player) {
      player = new Audio(SOURCES[sound])
      player.volume = VOLUME
      players.set(sound, player)
    }
    player.currentTime = 0
    // Автоплей до первого действия человека браузер может запретить — не беда.
    void player.play()?.catch(() => {})
  } catch {
    // Нет звука — не беда.
  }
}

/** Для тестов: забыть плееры и паузы между повторами. */
export function resetAppSoundsForTests(): void {
  players.clear()
  lastPlayed.clear()
}
