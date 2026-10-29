/**
 * Лента чата из двух источников: что отдал сервер и что сохранено на
 * устройстве. Сервер стирает переписку старше срока хранения целиком, с
 * начала: что пропало — всегда самое раннее. Поэтому граница одна — время,
 * до которого включительно на сервере уже ничего нет (`goneBefore`).
 */

import { ENCRYPTED_MESSAGE_PLACEHOLDER } from '../store/consts'
import type { Message } from '../types'

/** Время самого раннего настоящего (`$…`) события сервера; Infinity — нет ни одного. */
export function earliestServerTs(server: readonly Message[]): number {
  let min = Infinity
  for (const m of server) if (m.id.startsWith('$') && m.timestamp < min) min = m.timestamp
  return min
}

/**
 * Сервер в приоритете: его копия свежее (реакции, удаление). Исключение —
 * сервер не расшифровал, а на устройстве текст есть. Из копии в ленту идёт
 * только то, что старше ленты сервера: ещё не долистано или уже стёрто. Внутри
 * своей ленты сервер знает всё сам — там копия могла бы задвоить своё
 * сообщение, которое ещё отправляется.
 */
export function mergeWithArchive(
  server: readonly Message[],
  archived: readonly Message[],
  goneBefore: number
): Message[] {
  const byId = new Map(archived.map((m) => [m.id, m]))
  const serverIds = new Set<string>()
  const minServer = earliestServerTs(server)
  const fromServer: Message[] = server.map((m) => {
    serverIds.add(m.id)
    const saved = byId.get(m.id)
    if (saved && !m.deleted && m.text === ENCRYPTED_MESSAGE_PLACEHOLDER) {
      return { ...saved, status: m.status, reactions: m.reactions, archived: undefined }
    }
    return m
  })
  // Порядок сервера не трогаем: у своих сообщений время с часов устройства.
  const older = archived
    .filter((m) => !serverIds.has(m.id) && m.timestamp < minServer)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((m) => ({ ...m, archived: true, localOnly: m.timestamp <= goneBefore || undefined }))
  return [...older, ...fromServer]
}

/**
 * Найти границу стёртого: `candidates` — сохранённые сообщения по возрастанию
 * времени, `isGone` спрашивает сервер (true — нет, false — есть, null — не
 * ответил). Стёрто всегда начало, поэтому хватает двоичного поиска: ~12
 * запросов на четыре тысячи сообщений. Индекс последнего стёртого; -1 — все
 * на месте; null — не узнали ничего.
 */
export async function findGoneBoundary(
  candidates: readonly { id: string }[],
  isGone: (id: string) => Promise<boolean | null>
): Promise<number | null> {
  let lo = 0
  let hi = candidates.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const gone = await isGone(candidates[mid]!.id)
    // Ответы оборвались: известна только уже найденная стёртая часть.
    if (gone === null) return found >= 0 ? found : null
    if (gone) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}

/** Сервер ответил «нет такого события» (стёрто или не было). */
export function isNotFoundError(error: unknown): boolean {
  const e = error as { errcode?: unknown; httpStatus?: unknown; data?: { errcode?: unknown } }
  return e?.errcode === 'M_NOT_FOUND' || e?.data?.errcode === 'M_NOT_FOUND' || e?.httpStatus === 404
}
