// Повторная расшифровка сообщений, которые с первого раза остались
// «*** Encrypted Message ***».
//
// Причина часто временная: модуль шифрования ещё поднимается, нода не отдала
// профиль с ключами (таймаут, мёртвая нода), ключ группы (state-событие
// m.room.encryption) пришёл синком позже самого сообщения. Кэш расшифровок
// хранит только удачи, но второй попытки никто не делал: заглушка висела до
// повторного открытия чата, а то и после него.

import { matrixService } from '../../services/matrix-service'
import type { Message } from '../../types'
import { ENCRYPTED_MESSAGE_PLACEHOLDER } from '../consts'
import type { ChatContext, MxEvent, MxRoom } from './types'
import type { MessageMapping } from './use-message-mapping'

/**
 * Паузы перед попытками. Новый повод — ключ группы пришёл, шифрование
 * готово, связь вернулась — начинает отсчёт заново.
 */
export const REDECRYPT_DELAYS = [2_000, 5_000, 15_000, 30_000, 60_000, 120_000, 300_000]
/** Пауза после повода: state-события приходят пачкой, разбираем их один раз. */
export const REDECRYPT_NUDGE_DELAY = 300
/** За проход — не больше стольких сообщений с конца: расшифровка тяжёлая (PBKDF2). */
const MAX_PER_PASS = 50

type RedecryptRoom = MxRoom & { findEventById?: (eventId: string) => MxEvent | undefined }

export function useRedecrypt(ctx: ChatContext, mapping: MessageMapping) {
  const { messages } = ctx
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const attempts = new Map<string, number>()
  const running = new Set<string>()

  /** Заглушки уже дошедших событий: у копий `~…` своё событие ещё не на сервере. */
  const undecrypted = (chatId: string): Message[] =>
    (messages[chatId] ?? []).filter(
      (m) => m.text === ENCRYPTED_MESSAGE_PLACEHOLDER && m.id.startsWith('$')
    )

  const pass = async (chatId: string): Promise<void> => {
    const room = matrixService.getRoom(chatId) as RedecryptRoom | null
    if (!room?.findEventById) return
    let changed = false
    for (const stale of undecrypted(chatId).slice(-MAX_PER_PASS)) {
      const event = room.findEventById(stale.id)
      if (!event) continue
      const fresh = await mapping.mapEventToMessage(event)
      if (!fresh || fresh.text === ENCRYPTED_MESSAGE_PLACEHOLDER) continue
      const list = messages[chatId]
      const at = list ? list.findIndex((m) => m.id === stale.id) : -1
      if (!list || at === -1) continue
      list.splice(at, 1, { ...fresh, status: list[at]!.status })
      changed = true
    }
    const list = messages[chatId]
    const client = matrixService.getClient()
    if (changed && list && client) {
      mapping.enrichMessagesWithReactions(room, list, client.getUserId() || '')
    }
  }

  const schedule = (chatId: string, delay: number) => {
    if (timers.has(chatId)) return
    timers.set(
      chatId,
      setTimeout(() => void run(chatId), delay)
    )
  }

  const run = async (chatId: string): Promise<void> => {
    timers.delete(chatId)
    if (running.has(chatId)) {
      schedule(chatId, REDECRYPT_NUDGE_DELAY)
      return
    }
    running.add(chatId)
    try {
      await pass(chatId)
    } catch (e) {
      console.warn('[ChatStore] повторная расшифровка не удалась:', e)
    } finally {
      running.delete(chatId)
    }
    // Заглушка могла пропасть и иначе: чат закрыли, сообщение удалили.
    if (!undecrypted(chatId).length) {
      attempts.delete(chatId)
      return
    }
    const attempt = (attempts.get(chatId) ?? 0) + 1
    if (attempt >= REDECRYPT_DELAYS.length) {
      // Дальше не дёргаем: так не расшифровать. Следующий повод начнёт заново.
      attempts.delete(chatId)
      return
    }
    attempts.set(chatId, attempt)
    schedule(chatId, REDECRYPT_DELAYS[attempt]!)
  }

  /** В чате есть заглушки — начать попытки; уже идущие не сбивать. */
  const watchChat = (chatId: string): void => {
    if (attempts.has(chatId) || timers.has(chatId) || running.has(chatId)) return
    if (!undecrypted(chatId).length) return
    attempts.set(chatId, 0)
    schedule(chatId, REDECRYPT_DELAYS[0]!)
  }

  /** Появился повод: попробовать сразу и с первой паузы. Без chatId — во всех чатах. */
  const retryNow = (chatId?: string): void => {
    for (const id of chatId ? [chatId] : Object.keys(messages)) {
      if (!undecrypted(id).length) continue
      const timer = timers.get(id)
      if (timer) clearTimeout(timer)
      timers.delete(id)
      attempts.set(id, 0)
      schedule(id, REDECRYPT_NUDGE_DELAY)
    }
  }

  const reset = (): void => {
    timers.forEach((timer) => clearTimeout(timer))
    timers.clear()
    attempts.clear()
  }

  return { watchChat, retryNow, reset }
}

export type Redecrypt = ReturnType<typeof useRedecrypt>
