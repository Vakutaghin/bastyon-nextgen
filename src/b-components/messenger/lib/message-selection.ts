/**
 * Выделение нескольких сообщений, как в Telegram: долгое нажатие на телефоне,
 * протяжка мышью или «Выбрать» в меню сообщения, дальше щелчок отмечает и
 * снимает. Над выделенными — «Ответить» (одно), «Копировать» и «Удалить».
 * Здесь — то, что не зависит от экрана: диапазоны, текст для буфера обмена,
 * какие действия доступны.
 */

import { isMeshTransport, type Message } from '../types'

/** id от `from` до `to` включительно, в порядке ленты; кого-то нет в ленте — пусто. */
export function rangeIds(order: readonly string[], from: string, to: string): string[] {
  const a = order.indexOf(from)
  const b = order.indexOf(to)
  if (a < 0 || b < 0) return []
  return order.slice(Math.min(a, b), Math.max(a, b) + 1)
}

/** Как подписать сообщение в скопированном тексте. */
export interface CopyParts {
  name: (message: Message) => string
  time: (message: Message) => string
  body: (message: Message) => string
}

/**
 * Текст выделенных для буфера обмена, как «Копировать» в Telegram: одно
 * сообщение — только его текст, несколько — по порядку ленты, у каждого
 * «Имя, [время]» и пустая строка между ними.
 */
export function selectionText(messages: readonly Message[], parts: CopyParts): string {
  if (messages.length === 1) return parts.body(messages[0]!)
  return messages.map((m) => `${parts.name(m)}, [${parts.time(m)}]\n${parts.body(m)}`).join('\n\n')
}

/** Сообщение уже на сервере Matrix (event id `$…`), а не отправляется и не mesh-черновик. */
export function isServerMessage(message: Message): boolean {
  return typeof message.id === 'string' && message.id.startsWith('$')
}

/** Meshtastic передаёт ответы и реакции по радио — если у сообщения есть id пакета. */
export function isMeshReplyable(message: Message): boolean {
  return message.transport === 'meshtastic' && !!message.meshReplyable
}

/** Ответить можно на любое сообщение с сервера и на сообщение Meshtastic с id пакета. */
export function canReplyTo(message: Message): boolean {
  return isServerMessage(message) || isMeshReplyable(message)
}

/**
 * Удалить у всех: только сообщения Matrix с сервера; своё — всегда, чужое —
 * если права в комнате позволяют (`othersAllowed`, спрашивается, только когда
 * среди выделенных есть чужое).
 */
export function canDeleteAll(
  messages: readonly Message[],
  isMine: (message: Message) => boolean,
  othersAllowed: (chatId: string) => boolean
): boolean {
  if (!messages.length) return false
  if (!messages.every((m) => isServerMessage(m) && !isMeshTransport(m.transport))) return false
  const foreign = messages.find((m) => !isMine(m))
  return !foreign || othersAllowed(foreign.chatId)
}
