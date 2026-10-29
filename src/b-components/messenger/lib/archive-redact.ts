/**
 * Удаление из копий переписки на устройствах. Удаление (redaction) того,
 * что сервер уже стёр по сроку хранения, он принимает, но собеседнику не
 * отдаёт — и в его копии сообщение оставалось. Поэтому вместе с ним уходит
 * своё событие комнаты с id удалённого. Прежний клиент незнакомые события не
 * показывает, сервер их не считает непрочитанными.
 *
 * Проверка — у получателя, по тем же правилам, что у redaction: своё
 * сообщение удалить может автор, чужое — тот, чей уровень в комнате позволяет.
 */

export const ARCHIVE_REDACT_EVENT = 'app.bastyon.archive.redact'

/** Сколько id в одном событии — с запасом до предела размера события. */
const MAX_IDS = 100

/** Id удалённых из события; пусто — событие не такое или битое. */
export function archiveRedactIds(type: unknown, content: unknown): string[] {
  if (type !== ARCHIVE_REDACT_EVENT || !content || typeof content !== 'object') return []
  const ids = (content as { redacts?: unknown }).redacts
  if (!Array.isArray(ids)) return []
  return ids
    .filter((id): id is string => typeof id === 'string' && id.startsWith('$'))
    .slice(0, MAX_IDS)
}
