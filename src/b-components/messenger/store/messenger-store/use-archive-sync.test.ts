// Пополнение копии переписки: новое — из живой ленты комнаты; пустая копия
// догружает всё, что хранит сервер, до начала; разрыв между копией и лентой
// закрывается до первого сохранённого; удаления стирают из копии; место
// прохода запоминается. Сервер — подменный /messages и /context.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  client: null as unknown,
  rooms: new Map<string, unknown>(),
}))

vi.mock('../../services/matrix-service', () => ({
  matrixService: {
    getClient: () => h.client,
    getRoom: (id: string) => h.rooms.get(id) ?? null,
    getRooms: () => [...h.rooms.values()],
  },
}))

import type { Message } from '../../types'
import type { ChatArchiveChat } from '@/db/types'
import { useArchiveSync } from './use-archive-sync'

const ROOM = '!dm:host'

interface Raw {
  event_id: string
  type: string
  sender?: string
  room_id: string
  origin_server_ts: number
  content: Record<string, unknown>
  redacts?: string
  unsigned?: Record<string, unknown>
}

const text = (id: string, ts: number): Raw => ({
  event_id: id,
  type: 'm.room.message',
  room_id: ROOM,
  origin_server_ts: ts,
  content: { msgtype: 'm.text', body: id },
})

/** Подменная копия: то же, что спрашивает синхронизация у messenger-archive-store. */
function fakeArchive(savedIds: string[] = []) {
  const saved = new Set(savedIds)
  const row: ChatArchiveChat = {
    account: 'P',
    chatId: ROOM,
    goneBefore: 0,
    walks: [],
    backfilled: false,
    updatedAt: 0,
  }
  return {
    saved,
    row,
    removed: [] as string[],
    isArchived: () => true,
    hasCopy: () => saved.size > 0,
    savedAmong: async (_chatId: string, ids: string[]) =>
      new Set(ids.filter((id) => saved.has(id))),
    save: vi.fn(async (_chatId: string, list: Message[]) => {
      list.forEach((m) => saved.add(m.id))
      return list.length
    }),
    async remove(_chatId: string, ids: string[]) {
      ids.forEach((id) => saved.delete(id))
      this.removed.push(...ids)
    },
    removeAuthored: vi.fn(async (_chatId: string, ids: string[]) => ids),
    meta: async () => row,
    patchMeta: async (_chatId: string, patch: Partial<ChatArchiveChat>) => {
      Object.assign(row, JSON.parse(JSON.stringify(patch)))
    },
    oldestId: async () => [...saved].sort()[0] ?? null,
    noteInfo: vi.fn(async () => {}),
  }
}

function setup(opts: {
  live: Raw[]
  backToken: string | null
  pages: Record<string, { chunk: Raw[]; end?: string }>
  context?: (eventId: string) => Promise<{ start?: string }>
  saved?: string[]
}) {
  const archive = fakeArchive(opts.saved)
  const requests: string[] = []
  h.client = {
    createMessagesRequest: vi.fn(async (_room: string, from: string) => {
      requests.push(from)
      return opts.pages[from] ?? { chunk: [] }
    }),
    http: {
      authedRequest: vi.fn(async (_m: string, path: string) =>
        opts.context ? opts.context(decodeURIComponent(path.split('/').pop()!)) : {}
      ),
    },
  }
  h.rooms.set(ROOM, {
    roomId: ROOM,
    getMyMembership: () => 'join',
    getLiveTimeline: () => ({
      getEvents: () => opts.live,
      getPaginationToken: () => opts.backToken,
    }),
  })
  const sync = useArchiveSync({
    archive: archive as never,
    mapEvent: async (event) => {
      const e = event as Raw
      return e.unsigned?.redacted_because
        ? null
        : ({ id: e.event_id, chatId: ROOM, timestamp: e.origin_server_ts } as Message)
    },
    enrich: () => {},
    info: () => ({ name: 'bob_ng' }),
    canRun: () => true,
  })
  return { archive, sync, requests }
}

beforeEach(() => {
  vi.useFakeTimers()
  h.rooms.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('use-archive-sync', () => {
  it('пустая копия: живая лента и вся история сервера до начала, место прохода запомнено', async () => {
    const { archive, sync, requests } = setup({
      live: [text('$5', 50), text('$6', 60)],
      backToken: 't0',
      pages: {
        t0: { chunk: [text('$4', 40), text('$3', 30)], end: 't1' },
        t1: { chunk: [text('$2', 20), text('$1', 10)] },
      },
    })
    sync.scheduleWalk(ROOM)
    await vi.runAllTimersAsync()

    expect([...archive.saved].sort()).toEqual(['$1', '$2', '$3', '$4', '$5', '$6'])
    expect(requests).toEqual(['t0', 't1'])
    expect(archive.row).toMatchObject({ walks: [], backfilled: true })
    expect(archive.noteInfo).toHaveBeenCalledWith(ROOM, { name: 'bob_ng' })
  })

  it('разрыв между копией и лентой — до первого сохранённого; раньше копии сервер уже стёр', async () => {
    const context = vi.fn(async () => {
      throw { errcode: 'M_NOT_FOUND', httpStatus: 404 }
    })
    const { archive, sync, requests } = setup({
      saved: ['$1', '$2'],
      live: [text('$9', 90)],
      backToken: 'gap',
      pages: {
        gap: { chunk: [text('$8', 80), text('$7', 70)], end: 'gap2' },
        gap2: { chunk: [text('$3', 30), text('$2', 20), text('$1', 10)], end: 'deeper' },
      },
      context,
    })
    sync.scheduleWalk(ROOM)
    await vi.runAllTimersAsync()

    expect([...archive.saved].sort()).toEqual(['$1', '$2', '$3', '$7', '$8', '$9'])
    // На сохранённом проход остановился — дальше копия и так есть.
    expect(requests).toEqual(['gap', 'gap2'])
    expect(context).toHaveBeenCalledWith('$1')
    expect(archive.row).toMatchObject({ walks: [], backfilled: true })
  })

  it('удаления в истории стирают из копии, удалённое не сохраняется', async () => {
    const redaction: Raw = {
      event_id: '$r',
      type: 'm.room.redaction',
      room_id: ROOM,
      origin_server_ts: 35,
      content: {},
      redacts: '$2',
    }
    const redacted: Raw = { ...text('$3', 30), content: {}, unsigned: { redacted_because: {} } }
    const archiveRedact = {
      event_id: '$ar',
      type: 'app.bastyon.archive.redact',
      sender: '@alice:host',
      room_id: ROOM,
      origin_server_ts: 36,
      content: { redacts: ['$1'] },
    } as Raw
    const { archive, sync } = setup({
      saved: ['$1', '$2'],
      live: [text('$4', 40)],
      backToken: 't0',
      pages: { t0: { chunk: [archiveRedact, redaction, redacted, text('$2', 20)] } },
      context: async () => ({ start: 'old' }),
    })
    sync.scheduleWalk(ROOM)
    await vi.runAllTimersAsync()

    expect(archive.removed).toContain('$2')
    expect(archive.saved.has('$3')).toBe(false)
    // Удаление стёртого сервером — с правами собеседника в комнате.
    expect(archive.removeAuthored).toHaveBeenCalledWith(ROOM, ['$1'], '@alice:host', false)
    expect(archive.saved.has('$4')).toBe(true)
  })

  it('после смены аккаунта проход не продолжается, место остаётся', async () => {
    const { archive, sync, requests } = setup({
      live: [text('$5', 50)],
      backToken: 't0',
      pages: {
        t0: { chunk: [text('$4', 40)], end: 't1' },
        t1: { chunk: [text('$3', 30)], end: 't2' },
      },
    })
    sync.scheduleWalk(ROOM)
    await vi.advanceTimersByTimeAsync(100)
    sync.stop()
    await vi.runAllTimersAsync()

    expect(requests).toEqual(['t0'])
    expect(archive.row.walks).toEqual([{ token: 't1', until: 'start' }])
  })
})
