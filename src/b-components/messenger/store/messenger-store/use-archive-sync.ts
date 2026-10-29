// Пополнение копии переписки на устройстве (messenger-archive-store).
//
// Новое — из живой ленты комнаты: после её событий (сообщение, реакция,
// подтверждение своего, ключ группы) — то, чего в копии ещё нет. Пропуски —
// проходом истории назад через /messages, без ленты в памяти:
//   - между копией и лентой этого запуска (приложение долго не открывали, синк
//     пришёл «с разрывом») — до первого уже сохранённого сообщения;
//   - всё, что сервер ещё хранит раньше копии, — один раз до начала.
// Проход идёт по странице раз в полторы секунды, место запоминается в записи о
// чате и продолжается после перезапуска. Удаления (redaction) стирают из копии.

import { matrixService } from '../../services/matrix-service'
import { getEventId, getRoomTimelineEvents, isMessageEvent, type RoomLike } from '../../helpers'
import { isNotFoundError } from '../../lib/archive-merge'
import { archiveRedactIds } from '../../lib/archive-redact'
import { canRedactOthers } from '../../lib/redaction-rights'
import { reachedHistoryStart, redactionOf, type HistoryRoom } from '../../lib/chat-history'
import type { ChatArchiveWalk } from '@/db/types'
import type { Message } from '../../types'
import type { ArchiveChatInfo, useMessengerArchiveStore } from '../messenger-archive-store'

const LIVE_DELAY = 1000
const PAGE_DELAY = 1500
const ROOM_DELAY = 500
const PAGE_LIMIT = 100

export interface ArchiveSyncDeps {
  archive: ReturnType<typeof useMessengerArchiveStore>
  /** Разбор события в сообщение (с расшифровкой), как в ленте чата. */
  mapEvent: (event: unknown) => Promise<Message | null>
  /** Реакции к сообщениям из связей комнаты. */
  enrich: (room: unknown, list: Message[]) => void
  /** Подпись чата для настроек: из списка диалогов. */
  info: (chatId: string) => ArchiveChatInfo | null
  /** Синк идёт и шифрование готово: иначе сообщения не расшифруются. */
  canRun: () => boolean
}

interface RawEvent {
  event_id?: string
  type?: string
  sender?: string
  redacts?: string
  content?: { redacts?: unknown }
}

type PowerRoom = Parameters<typeof canRedactOthers>[0]

interface WalkRoom extends HistoryRoom {
  getMyMembership?: () => string
  getLiveTimeline?: () => {
    getPaginationToken?: (direction: 'b' | 'f') => string | null
    getEvents?: () => ReadonlyArray<{ getType?: () => string }>
  }
}

interface MessagesClient {
  createMessagesRequest?: (
    roomId: string,
    from: string | null,
    limit: number,
    dir: 'b' | 'f'
  ) => Promise<{ chunk?: RawEvent[]; end?: string }>
  http?: {
    authedRequest: (
      method: string,
      path: string,
      query?: Record<string, string>
    ) => Promise<{ start?: string }>
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const redactedIdOf = (e: RawEvent): string | null => {
  const id = e.redacts ?? e.content?.redacts
  return typeof id === 'string' ? id : null
}

export function useArchiveSync(deps: ArchiveSyncDeps) {
  const { archive } = deps
  const liveTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const reactionTargets = new Map<string, Set<string>>()
  const walkQueue: string[] = []
  const queued = new Set<string>()
  let walking = false
  let session = 0

  /** Сохранить события в обход ленты: из прохода истории. */
  async function saveEvents(roomId: string, events: unknown[], run: number): Promise<void> {
    const list: Message[] = []
    for (const event of events) {
      if (run !== session) return
      const message = await deps.mapEvent(event)
      if (message) list.push(message)
    }
    if (run === session) await archive.save(roomId, list)
  }

  function noteInfo(roomId: string): void {
    const info = deps.info(roomId)
    if (info) void archive.noteInfo(roomId, info)
  }

  /** В комнате что-то произошло: сохранить новое из её ленты (с задержкой, пачкой). */
  function noteRoom(roomId: string, reactionTarget?: string): void {
    if (!archive.isArchived(roomId)) return
    if (reactionTarget) {
      const set = reactionTargets.get(roomId) ?? new Set<string>()
      set.add(reactionTarget)
      reactionTargets.set(roomId, set)
    }
    if (liveTimers.has(roomId)) return
    liveTimers.set(
      roomId,
      setTimeout(() => {
        liveTimers.delete(roomId)
        void archiveLive(roomId)
      }, LIVE_DELAY)
    )
  }

  async function archiveLive(roomId: string): Promise<void> {
    const run = session
    if (!deps.canRun() || !archive.isArchived(roomId)) return
    const room = matrixService.getRoom(roomId)
    if (!room) return
    const events = getRoomTimelineEvents(room).filter(
      (e) => isMessageEvent(e) && getEventId(e).startsWith('$')
    )
    const redacted = events.filter((e) => redactionOf(e)).map((e) => getEventId(e))
    if (redacted.length) await archive.remove(roomId, redacted)
    const targets = reactionTargets.get(roomId)
    reactionTargets.delete(roomId)
    const saved = await archive.savedAmong(
      roomId,
      events.map((e) => getEventId(e))
    )
    const pick = events.filter((e) => {
      const id = getEventId(e)
      return (!saved.has(id) || targets?.has(id)) && !redactionOf(e)
    })
    const list: Message[] = []
    for (const event of pick) {
      if (run !== session) return
      const message = await deps.mapEvent(event)
      if (message) list.push(message)
    }
    if (run !== session) return
    if (list.length) {
      deps.enrich(room, list)
      await archive.save(roomId, list, { refresh: targets })
    }
    noteInfo(roomId)
  }

  /** Токен «до этого события» — продолжить историю назад от самого раннего сохранённого. */
  async function tokenBefore(
    client: MessagesClient,
    roomId: string,
    eventId: string
  ): Promise<string | 'gone' | null> {
    if (!client.http) return null
    try {
      const path = `/rooms/${encodeURIComponent(roomId)}/context/${encodeURIComponent(eventId)}`
      const res = await client.http.authedRequest('GET', path, { limit: '0' })
      return typeof res?.start === 'string' ? res.start : null
    } catch (e) {
      // Самого раннего сохранённого на сервере уже нет — раньше него тем более.
      return isNotFoundError(e) ? 'gone' : null
    }
  }

  async function walkRoom(roomId: string, run: number): Promise<void> {
    const client = matrixService.getClient() as MessagesClient | null
    const room = matrixService.getRoom(roomId) as WalkRoom | null
    if (!client?.createMessagesRequest || !room || room.getMyMembership?.() !== 'join') return
    const meta = await archive.meta(roomId)
    if (!meta || run !== session) return
    const walks: ChatArchiveWalk[] = meta.walks.map((w) => ({ ...w }))
    let backfilled = meta.backfilled

    const timeline = room.getLiveTimeline?.()
    const backToken = timeline?.getPaginationToken?.('b') ?? null
    const firstLive = getRoomTimelineEvents(room as RoomLike).find(
      (e) => isMessageEvent(e) && getEventId(e).startsWith('$')
    )
    const hadCopy = archive.hasCopy(roomId)
    if (backToken && !walks.some((w) => w.token === backToken)) {
      if (!hadCopy && !walks.length) {
        walks.push({ token: backToken, until: 'start' })
      } else if (hadCopy && firstLive) {
        const saved = await archive.savedAmong(roomId, [getEventId(firstLive)])
        // Первое сообщение этого запуска не сохранено: между ним и копией разрыв.
        if (!saved.size) walks.unshift({ token: backToken, until: 'overlap' })
      }
    }

    await archiveLive(roomId)
    if (run !== session) return

    if (!backfilled && reachedHistoryStart(room)) backfilled = true
    if (!backfilled && !walks.some((w) => w.until === 'start')) {
      const oldest = await archive.oldestId(roomId)
      const token = oldest ? await tokenBefore(client, roomId, oldest) : null
      if (token === 'gone') backfilled = true
      else if (token) walks.push({ token, until: 'start' })
    }
    await archive.patchMeta(roomId, { walks, backfilled })

    while (walks.length && run === session && deps.canRun() && archive.isArchived(roomId)) {
      const walk = walks[0]!
      const page = await client.createMessagesRequest(roomId, walk.token, PAGE_LIMIT, 'b')
      if (run !== session) return
      const chunk = page?.chunk ?? []
      const redacted = chunk
        .filter((e) => e.type === 'm.room.redaction')
        .map(redactedIdOf)
        .filter((id): id is string => !!id)
      if (redacted.length) await archive.remove(roomId, redacted)
      // Удаления стёртого сервером (lib/archive-redact), пока приложение было закрыто.
      for (const e of chunk) {
        const ids = archiveRedactIds(e.type, e.content)
        if (ids.length && e.sender) {
          const privileged = canRedactOthers(room as PowerRoom, e.sender)
          await archive.removeAuthored(roomId, ids, e.sender, privileged)
        }
      }
      const messages = chunk.filter((e) => isMessageEvent(e) && typeof e.event_id === 'string')
      const saved = await archive.savedAmong(
        roomId,
        messages.map((e) => e.event_id!)
      )
      await saveEvents(
        roomId,
        messages.filter((e) => !saved.has(e.event_id!) && !redactionOf(e)),
        run
      )
      const overlap = walk.until === 'overlap' && saved.size > 0
      if (overlap || !page?.end || !chunk.length) {
        walks.shift()
        if (walk.until === 'start') backfilled = true
      } else {
        walk.token = page.end
      }
      await archive.patchMeta(roomId, { walks, backfilled })
      await sleep(PAGE_DELAY)
    }
  }

  async function pump(): Promise<void> {
    if (walking) return
    walking = true
    const run = session
    try {
      while (walkQueue.length && run === session && deps.canRun()) {
        const roomId = walkQueue.shift()!
        queued.delete(roomId)
        try {
          await walkRoom(roomId, run)
        } catch (e) {
          console.warn('[archive] history walk failed:', roomId, e)
        }
        await sleep(ROOM_DELAY)
      }
    } finally {
      walking = false
      // Пока доходил прежний проход, сменился аккаунт и очередь уже новая.
      if (run !== session && walkQueue.length) void pump()
    }
  }

  /** Проверить разрывы и догрузить историю чата. */
  function scheduleWalk(roomId: string): void {
    if (!archive.isArchived(roomId) || queued.has(roomId)) return
    queued.add(roomId)
    walkQueue.push(roomId)
    void pump()
  }

  /** Все сохраняемые чаты — после входа, при включении сохранения. */
  function scheduleAll(): void {
    for (const room of matrixService.getRooms() as { roomId?: string }[]) {
      if (room?.roomId) scheduleWalk(room.roomId)
    }
  }

  /** Синк снова идёт: продолжить отложенное. */
  function kick(): void {
    void pump()
  }

  function stop(): void {
    session++
    liveTimers.forEach((timer) => clearTimeout(timer))
    liveTimers.clear()
    reactionTargets.clear()
    walkQueue.length = 0
    queued.clear()
  }

  return { noteRoom, scheduleWalk, scheduleAll, kick, stop }
}

export type ArchiveSync = ReturnType<typeof useArchiveSync>
