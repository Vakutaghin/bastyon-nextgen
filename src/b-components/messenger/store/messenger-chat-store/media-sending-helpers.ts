// Общие шаги отправки медиа (use-media-sending): оптимистичное сообщение,
// прогресс загрузки, уборка после успеха и пометка провала. Все хелперы
// мутируют ТОТ ЖЕ реактивный `messages` чат-стора (push/splice/find), а не
// копию — иначе UI не увидит изменений.

import type { Message } from '../../types'

export type MessagesByChat = Record<string, Message[]>

/** Локальный id оптимистичного сообщения (заменяется/удаляется после отправки). */
export const makeTempId = (): string => 'local-' + Math.random().toString(36).slice(2)

/** Добавляет оптимистичное сообщение в ленту чата (создаёт ленту при необходимости). */
export function pushOptimistic(messages: MessagesByChat, chatId: string, message: Message): void {
  if (!messages[chatId]) messages[chatId] = []
  messages[chatId].push(message)
}

/**
 * Обработчик прогресса загрузки: пишет проценты в `info.uploadProgress`
 * оптимистичного сообщения. Без `total` считает от размера файла.
 */
export function createProgressHandler(messages: MessagesByChat, chatId: string, tempId: string) {
  return (loaded: number, total?: number): void => {
    const msg = messages[chatId]?.find((m) => m.id === tempId)
    if (msg?.info) {
      msg.info.uploadProgress = total
        ? Math.min(100, Math.round((loaded / total) * 100))
        : Math.min(100, Math.round((loaded / (msg.info.size || loaded)) * 100))
    }
  }
}

/** Убирает оптимистичное сообщение после успешной отправки (реальное придёт из Matrix). */
export function removeOptimistic(messages: MessagesByChat, chatId: string, tempId: string): void {
  const list = messages[chatId]
  if (!list) return
  const idx = list.findIndex((m) => m.id === tempId)
  if (idx >= 0) list.splice(idx, 1)
}

/** Освобождает object-URL; вызывать после await отправки, не раньше. */
export function revokeObjectUrlQuiet(url: string | null | undefined): void {
  if (!url) return
  try {
    URL.revokeObjectURL(url)
  } catch {
    /* ignore */
  }
}

/** При ошибке помечает последнее «отправляется» сообщение нужного типа как failed. */
export function markLastSendingFailed(
  messages: MessagesByChat,
  chatId: string,
  type: Message['type']
): void {
  const arr = messages[chatId]
  if (!arr) return
  const last = arr[arr.length - 1]
  if (last?.status === 'sending' && last.type === type) last.status = 'failed'
}
