import { db } from '../database'
import type { DecryptedMessage } from '../types'

/**
 * Хелперы для персистентного кэша расшифрованных matrix-сообщений.
 *
 * События в матрице иммутабельны (тело и ключи закреплены за event_id и не меняются),
 * поэтому расшифровку можно безопасно хранить «вечно» и поднимать между сессиями.
 *
 * Ключ — пара (userId, eventId). userId нужен, чтобы при смене аккаунта чужие
 * расшифровки не утекали. Все методы — best-effort: при сбое IDb они тихо
 * возвращают пустой результат, мессенджер просто пересчитает крипту в памяти.
 */

/** Поднять весь кэш для указанного юзера (одной выборкой, быстро). */
export const loadAllDecryptedForUser = async (userId: string): Promise<DecryptedMessage[]> => {
  if (!userId) return []
  try {
    return await db.decryptedMessages.where('userId').equals(userId).toArray()
  } catch (e) {
    console.warn('[DecryptedMessagesApi] loadAllDecryptedForUser failed:', e)
    return []
  }
}

/** Записать одну расшифровку (fire-and-forget вызывающей стороной). */
export const saveDecrypted = async (userId: string, eventId: string, text: string): Promise<void> => {
  if (!userId || !eventId || typeof text !== 'string') return
  try {
    await db.decryptedMessages.put({
      userId,
      eventId,
      text,
      createdAt: Date.now(),
    })
  } catch (e) {
    console.warn('[DecryptedMessagesApi] saveDecrypted failed:', e)
  }
}

/** Удалить весь кэш данного юзера (например, при логауте/деинициализации). */
export const clearDecryptedForUser = async (userId: string): Promise<void> => {
  if (!userId) return
  try {
    await db.decryptedMessages.where('userId').equals(userId).delete()
  } catch (e) {
    console.warn('[DecryptedMessagesApi] clearDecryptedForUser failed:', e)
  }
}
