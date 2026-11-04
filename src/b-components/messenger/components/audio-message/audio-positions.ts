/**
 * Где остановили голосовое — как в Telegram. Пауза, другое голосовое в чате,
 * уход в другой чат или из мессенджера оставляют сообщение на месте
 * остановки: на волне прослушанная часть, вместо длительности — время
 * остановки, «Воспроизвести» продолжает с него. Дослушали до конца — снова с
 * начала.
 *
 * Компонент сообщения при этом пересоздаётся (смена чата, окно ленты), поэтому
 * позиции живут здесь, пока открыто приложение.
 */

import type { Message } from '../../types'

/** Сколько остановок помнить: самые давние вытесняются. */
export const POSITIONS_LIMIT = 200

const positions = new Map<string, number>()

export function positionKey(message: Pick<Message, 'chatId' | 'id'>): string {
  return `${message.chatId}|${message.id}`
}

/** Где остановили, с; 0 — не начинали или дослушали. */
export function rememberedPosition(key: string): number {
  return positions.get(key) ?? 0
}

/** Запомнить остановку; 0 (или не число) — забыть: снова с начала. */
export function rememberPosition(key: string, seconds: number): void {
  positions.delete(key)
  if (!Number.isFinite(seconds) || seconds <= 0) return
  positions.set(key, seconds)
  if (positions.size > POSITIONS_LIMIT) {
    const oldest = positions.keys().next().value
    if (oldest !== undefined) positions.delete(oldest)
  }
}
