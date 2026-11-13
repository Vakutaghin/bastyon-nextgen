// Предел размера тела комментария у ноды.

import type { CommentMessageBody } from '@/types/rpc-requests/send-raw-transaction-with-message'

/**
 * Предел тела комментария у ноды, байт: `msg` после URL-декодирования
 * (pocketnet.core: CommentConsensus `payload_size` = 2000, Comment::PayloadSize).
 * Длиннее — транзакцию сеть отклонит.
 */
export const COMMENT_PAYLOAD_MAX_BYTES = 2000

/**
 * Влезает ли тело в предел ноды. Считаются байты UTF-8 (кириллица — по два),
 * а не символы: 915 символов текста и десять адресов картинок вместе могут
 * не поместиться. Без URL-декодирования счёт не меньше, чем у ноды.
 */
export function commentBodyFits(body: CommentMessageBody): boolean {
  return new TextEncoder().encode(JSON.stringify(body)).length <= COMMENT_PAYLOAD_MAX_BYTES
}
