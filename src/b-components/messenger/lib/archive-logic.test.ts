// Копия переписки на устройстве, чистая логика: шифрование ключом аккаунта
// (другой аккаунт не прочтёт), какие чаты сохранять, как лента сервера
// сводится с копией, как ищется граница стёртого сервером, кто вправе
// удалить чужое сообщение у всех.

import { describe, expect, it } from 'vitest'

import type { Message } from '../types'
import { ENCRYPTED_MESSAGE_PLACEHOLDER } from '../store/consts'
import { deriveArchiveKey, openJson, sealJson } from './archive-crypto'
import {
  earliestServerTs,
  findGoneBoundary,
  isNotFoundError,
  mergeWithArchive,
} from './archive-merge'
import {
  DEFAULT_ARCHIVE_PREFS,
  isChatArchived,
  sanitizeArchivePrefs,
  withChat,
} from './archive-prefs'
import { ARCHIVE_REDACT_EVENT, archiveRedactIds } from './archive-redact'
import { canRedactOthers } from './redaction-rights'

const key32 = (fill: number) => new Uint8Array(32).fill(fill)

function msg(id: string, timestamp: number, over: Partial<Message> = {}): Message {
  return {
    id,
    chatId: '!a:host',
    senderId: '@bob:host',
    text: `text ${id}`,
    timestamp,
    read: true,
    status: 'sent',
    ...over,
  }
}

describe('archive-crypto', () => {
  it('тот же приватный ключ открывает запись, другой — нет', async () => {
    const sealed = await sealJson(await deriveArchiveKey(key32(1)), { text: 'Привет' })
    expect(await openJson(await deriveArchiveKey(key32(1)), sealed)).toEqual({ text: 'Привет' })
    expect(await openJson(await deriveArchiveKey(key32(2)), sealed)).toBeNull()
  })

  it('Buffer-подобный ключ годится, шифротекст каждый раз новый', async () => {
    const key = await deriveArchiveKey(Array.from(key32(7)))
    const a = await sealJson(key, 'одно и то же')
    const b = await sealJson(key, 'одно и то же')
    expect(a.data).not.toEqual(b.data)
    expect(new TextDecoder().decode(a.data)).not.toContain('одно')
  })
})

describe('archive-prefs', () => {
  it('по умолчанию выключено и ничего не сохраняется', () => {
    expect(isChatArchived(DEFAULT_ARCHIVE_PREFS, '!a:host')).toBe(false)
    expect(sanitizeArchivePrefs(null)).toEqual(DEFAULT_ARCHIVE_PREFS)
  })

  it('«все» — кроме выключенных, «выбранные» — только включённые; mesh и каналы никогда', () => {
    const all = { enabled: true, mode: 'all' as const, chats: { '!off:host': false } }
    expect(isChatArchived(all, '!a:host')).toBe(true)
    expect(isChatArchived(all, '!off:host')).toBe(false)
    expect(isChatArchived(all, 'mesh:mc:1:u:2')).toBe(false)
    expect(isChatArchived(all, 'channel:PAddr')).toBe(false)
    const selected = { enabled: true, mode: 'selected' as const, chats: { '!on:host': true } }
    expect(isChatArchived(selected, '!on:host')).toBe(true)
    expect(isChatArchived(selected, '!a:host')).toBe(false)
  })

  it('включили один чат при выключенном сохранении — сохраняется только он', () => {
    const next = withChat(DEFAULT_ARCHIVE_PREFS, '!one:host', true)
    expect(next).toMatchObject({ enabled: true, mode: 'selected' })
    expect(isChatArchived(next, '!one:host')).toBe(true)
    expect(isChatArchived(next, '!other:host')).toBe(false)
  })

  it('из хранилища — только понятное', () => {
    expect(
      sanitizeArchivePrefs({
        enabled: 'yes',
        mode: 'some',
        chats: { '!a:host': true, 'mesh:x': true, '!b:host': 1 },
      })
    ).toEqual({ enabled: false, mode: 'all', chats: { '!a:host': true } })
  })
})

describe('archive-merge', () => {
  it('сервер в приоритете, сохранённое раньше его ленты — сверху, порядок сервера не трогается', () => {
    const server = [msg('$3', 30), msg('$5', 50), msg('~local', 40, { status: 'sending' })]
    const archived = [msg('$1', 10), msg('$2', 20), msg('$3', 30, { text: 'старая копия' })]
    const merged = mergeWithArchive(server, archived, 0)
    expect(merged.map((m) => m.id)).toEqual(['$1', '$2', '$3', '$5', '~local'])
    expect(merged[2]!.text).toBe('text $3')
    expect(merged[0]).toMatchObject({ archived: true })
    expect(merged[0]!.localOnly).toBeUndefined()
  })

  it('стёртое сервером помечается; внутри его ленты копия ничего не добавляет', () => {
    const merged = mergeWithArchive(
      [msg('$9', 90)],
      [msg('$1', 10), msg('$2', 20), msg('$95', 95)],
      10
    )
    expect(merged.map((m) => [m.id, !!m.localOnly])).toEqual([
      ['$1', true],
      ['$2', false],
      ['$9', false],
    ])
  })

  it('сервер не расшифровал, а в копии текст есть — показывается текст', () => {
    const server = [
      msg('$1', 10, { text: ENCRYPTED_MESSAGE_PLACEHOLDER, reactions: [{ key: '👍', count: 1 }] }),
    ]
    const merged = mergeWithArchive(server, [msg('$1', 10, { text: 'расшифровано' })], 0)
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ text: 'расшифровано', reactions: [{ key: '👍', count: 1 }] })
  })

  it('пустая лента сервера — всё сохранённое', () => {
    expect(earliestServerTs([])).toBe(Infinity)
    expect(mergeWithArchive([], [msg('$1', 10)], 0).map((m) => m.id)).toEqual(['$1'])
  })

  it('граница стёртого — двоичным поиском, за log2 запросов', async () => {
    const candidates = Array.from({ length: 1000 }, (_, i) => ({ id: `$${i}` }))
    const asked: string[] = []
    const last = await findGoneBoundary(candidates, async (id) => {
      asked.push(id)
      return Number(id.slice(1)) <= 640
    })
    expect(last).toBe(640)
    expect(asked.length).toBeLessThanOrEqual(10)
  })

  it('всё на месте — -1; сервер молчит — что успели узнать или null', async () => {
    const candidates = [{ id: '$a' }, { id: '$b' }, { id: '$c' }]
    expect(await findGoneBoundary(candidates, async () => false)).toBe(-1)
    expect(await findGoneBoundary(candidates, async () => null)).toBeNull()
    let calls = 0
    expect(await findGoneBoundary(candidates, async () => (calls++ === 0 ? true : null))).toBe(1)
  })

  it('«нет такого события» узнаётся по коду и по статусу', () => {
    expect(isNotFoundError({ errcode: 'M_NOT_FOUND' })).toBe(true)
    expect(isNotFoundError({ httpStatus: 404 })).toBe(true)
    expect(isNotFoundError({ httpStatus: 502 })).toBe(false)
    expect(isNotFoundError(null)).toBe(false)
  })
})

describe('redaction-rights', () => {
  const room = (content: Record<string, unknown> | null) => ({
    currentState: {
      getStateEvents: (type: string) =>
        type === 'm.room.power_levels' && content ? { getContent: () => content } : null,
    },
  })

  it('личный чат: у обоих 100 — можно удалять и сообщения собеседника', () => {
    const levels = { users: { '@me:host': 100, '@bob:host': 100 } }
    expect(canRedactOthers(room(levels), '@me:host')).toBe(true)
  })

  it('в группе — от уровня redact; без прав и без power_levels — нельзя', () => {
    const levels = { users: { '@admin:host': 100, '@mod:host': 50 }, redact: 50 }
    expect(canRedactOthers(room(levels), '@mod:host')).toBe(true)
    expect(canRedactOthers(room(levels), '@member:host')).toBe(false)
    expect(canRedactOthers(room({ ...levels, redact: 75 }), '@mod:host')).toBe(false)
    expect(canRedactOthers(room(null), '@me:host')).toBe(false)
    expect(canRedactOthers(null, '@me:host')).toBe(false)
  })
})

describe('archive-redact', () => {
  it('из своего события — только id событий, не больше сотни', () => {
    const ids = Array.from({ length: 150 }, (_, i) => `$${i}`)
    expect(archiveRedactIds(ARCHIVE_REDACT_EVENT, { redacts: ['$a', 7, 'x', '$b'] })).toEqual([
      '$a',
      '$b',
    ])
    expect(archiveRedactIds(ARCHIVE_REDACT_EVENT, { redacts: ids })).toHaveLength(100)
    expect(archiveRedactIds('m.room.message', { redacts: ['$a'] })).toEqual([])
    expect(archiveRedactIds(ARCHIVE_REDACT_EVENT, null)).toEqual([])
  })
})
