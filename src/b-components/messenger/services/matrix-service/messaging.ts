/**
 * Send-эвент билдеры Matrix: обычные и зашифрованные текстовые сообщения,
 * редакция (удаление), state-события, реакции.
 *
 * Каждая — чистая функция от (client, args), как медиа-сендеры в
 * `./media-sender` — это позволяет тестировать send-логику без поднятия
 * полноценного MatrixService. Null-check клиента остаётся в фасаде.
 *
 * См. CODE_AUDIT.md §1.
 */
import type { MatrixClient, MatrixEventContent } from './types'

export function sendMessage(
  client: MatrixClient,
  roomId: string,
  content: string,
  extraContent?: Record<string, unknown>
) {
  return client.sendEvent(roomId, 'm.room.message', {
    msgtype: 'm.text',
    body: content,
    // extraContent — relation-метаданные (m.relates_to / m.new_content) для
    // ответа/редактирования. См. use-message-sending (reply/edit).
    ...extraContent,
  })
}

/**
 * Redact (удалить) событие — удаление своего сообщения.
 * @param reason — опциональная причина (в content m.room.redaction).
 */
export function redactEvent(client: MatrixClient, roomId: string, eventId: string, reason?: string) {
  return client.redactEvent(roomId, eventId, undefined, reason ? { reason } : undefined)
}

/**
 * Отправить state-событие (например `m.room.encryption` с общим ключом группы).
 */
export function sendStateEvent(
  client: MatrixClient,
  roomId: string,
  type: string,
  content: MatrixEventContent,
  stateKey: string
) {
  return client.sendStateEvent(roomId, type, content, stateKey)
}

/**
 * Отправить групповое зашифрованное сообщение.
 * Соответствует формату bastyon-chat: m.room.message с msgtype "m.encrypted",
 * body = hex(AES-CBC ciphertext), hash + block — для поиска state-события общего ключа.
 * Payload — уже готовый ciphertext (шифрование выполнено выше по стеку).
 */
export function sendEncryptedTextMessage(
  client: MatrixClient,
  roomId: string,
  payload: { body: string; hash: string; block: number },
  extraContent?: Record<string, unknown>
) {
  return client.sendEvent(roomId, 'm.room.message', {
    msgtype: 'm.encrypted',
    body: payload.body,
    hash: payload.hash,
    block: payload.block,
    // extraContent — relation-метаданные (m.relates_to / m.new_content).
    ...extraContent,
  })
}

/**
 * Отправить личное (1:1) зашифрованное текстовое сообщение (E2E).
 * Формат — как forta.chat / bastyon-chat `encryptEvent` для tetatet: m.room.message
 * с msgtype 'm.encrypted', body = Base64(JSON per-user AES-SIV map), block +
 * version на верхнем уровне content (БЕЗ `hash` — это признак группового пути).
 * Приёмный путь (`tryDecrypt`) распознаёт такой body по base64-эвристике и
 * расшифровывает через `pcrypto.decryptEvent`.
 */
export function sendEncryptedDirectMessage(
  client: MatrixClient,
  roomId: string,
  payload: { body: string; block: number; version: number },
  extraContent?: Record<string, unknown>
) {
  return client.sendEvent(roomId, 'm.room.message', {
    msgtype: 'm.encrypted',
    body: payload.body,
    block: payload.block,
    version: payload.version,
    // extraContent — relation-метаданные (m.relates_to) для ответа. Лежат на
    // внешнем (открытом) content, как и у группового зашифрованного сообщения.
    ...extraContent,
  })
}

/**
 * Отправить реакцию на сообщение (m.reaction с m.annotation).
 * @param eventId — ID события (сообщения), на которое ставим реакцию
 * @param key — эмодзи или текст реакции (например "👍", "❤️")
 */
export function sendReaction(client: MatrixClient, roomId: string, eventId: string, key: string) {
  return client.sendEvent(roomId, 'm.reaction', {
    'm.relates_to': {
      event_id: eventId,
      key,
      rel_type: 'm.annotation',
    },
  })
}
