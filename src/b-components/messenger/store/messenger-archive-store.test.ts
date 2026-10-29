// Копия переписки на устройстве (настоящий Dexie поверх fake-indexeddb):
// настройки по аккаунту, что пишется и что нет, шифротекст на диске, лента с
// сохранённым раньше сервера по страницам, граница стёртого, удаление сообщений,
// чата и всего — и чужой аккаунт копию не читает.

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../services/matrix-service', () => ({ matrixService: { getClient: () => null } }))

import { db } from '@/db/database'
import type { Message } from '../types'
import { ENCRYPTED_MESSAGE_PLACEHOLDER } from './consts'
import { useMessengerArchiveStore } from './messenger-archive-store'

const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const CHAT = '!dm:host'
const keyOf = (fill: number) => new Uint8Array(32).fill(fill)

function msg(id: string, timestamp: number, over: Partial<Message> = {}): Message {
  return {
    id,
    chatId: CHAT,
    senderId: '@bob:host',
    text: `секрет ${id}`,
    timestamp,
    read: false,
    status: 'sent',
    ...over,
  }
}

async function opened(address = ALICE, fill = 1) {
  const archive = useMessengerArchiveStore()
  await archive.attach(address, keyOf(fill))
  return archive
}

beforeEach(async () => {
  setActivePinia(createPinia())
  await Promise.all([db.chatArchive.clear(), db.chatArchiveChats.clear(), db.settings.clear()])
})

describe('messenger-archive-store', () => {
  it('выключено по умолчанию; настройки свои у каждого аккаунта и переживают выход', async () => {
    const archive = await opened()
    expect(archive.isArchived(CHAT)).toBe(false)
    expect(await archive.save(CHAT, [msg('$1', 1)])).toBe(0)

    await archive.setEnabled(true)
    expect(archive.isArchived(CHAT)).toBe(true)

    await archive.attach(BOB, keyOf(2))
    expect(archive.isArchived(CHAT)).toBe(false)

    archive.reset()
    await archive.attach(ALICE, keyOf(1))
    expect(archive.isArchived(CHAT)).toBe(true)
  })

  it('пишет только дошедшее и прочитанное, без повторов; на диске шифротекст', async () => {
    const archive = await opened()
    await archive.setEnabled(true)
    const added = await archive.save(CHAT, [
      msg('$1', 10),
      msg('$1', 10),
      msg('~echo', 11, { status: 'sending' }),
      msg('$2', 12, { text: ENCRYPTED_MESSAGE_PLACEHOLDER }),
      msg('$3', 13, { status: 'failed' }),
      msg('$4', 14, { deleted: { by: '@bob:host', at: 15 } }),
      msg('$5', 16, { transport: 'meshtastic' }),
      msg('$6', 17),
    ])
    expect(added).toBe(2)
    expect(await archive.save(CHAT, [msg('$1', 10), msg('$6', 17)])).toBe(0)
    expect(archive.stats[CHAT]).toEqual({ count: 2, firstTs: 10, lastTs: 17 })

    const rows = await db.chatArchive.toArray()
    expect(rows.map((r) => r.id).sort()).toEqual(['$1', '$6'])
    const raw = new TextDecoder().decode(rows[0]!.data)
    expect(raw).not.toContain('секрет')
  })

  it('чужой ключ копию не открывает', async () => {
    const archive = await opened()
    await archive.setEnabled(true)
    await archive.save(CHAT, [msg('$1', 10)])

    archive.reset()
    await archive.attach(ALICE, keyOf(9))
    const { messages } = await archive.mergeInto(CHAT, [], { exhausted: true, reachedStart: false })
    expect(messages).toEqual([])
  })

  it('пока сервер листает — копия молчит; кончил — сохранённое страницами раньше его ленты', async () => {
    const archive = await opened()
    await archive.setEnabled(true)
    await archive.save(
      CHAT,
      Array.from({ length: 60 }, (_, i) => msg(`$${String(i).padStart(2, '0')}`, 1000 + i))
    )
    const server = [msg('$59', 1059), msg('$new', 2000)]

    const busy = await archive.mergeInto(CHAT, server, { exhausted: false, reachedStart: false })
    expect(busy.messages.map((m) => m.id)).toEqual(['$59', '$new'])

    const first = await archive.mergeInto(CHAT, server, { exhausted: true, reachedStart: false })
    expect(first.messages).toHaveLength(52)
    expect(first.messages[0]).toMatchObject({ id: '$09', text: 'секрет $09', archived: true })
    expect(first.more).toBe(true)

    const rest = await archive.mergeInto(CHAT, server, {
      exhausted: true,
      reachedStart: false,
      older: true,
    })
    expect(rest.messages).toHaveLength(61)
    expect(rest.more).toBe(false)
  })

  it('лента сервера с начала — всё сохранённое раньше неё стёрто сервером', async () => {
    const archive = await opened()
    await archive.setEnabled(true)
    await archive.save(CHAT, [msg('$1', 10), msg('$2', 20), msg('$3', 30)])
    const { messages } = await archive.mergeInto(CHAT, [msg('$3', 30)], {
      exhausted: true,
      reachedStart: true,
    })
    expect(messages.map((m) => [m.id, !!m.localOnly])).toEqual([
      ['$1', true],
      ['$2', true],
      ['$3', false],
    ])
    expect(archive.goneBefore[CHAT]).toBe(29)
    await vi.waitFor(async () =>
      expect((await db.chatArchiveChats.get([ALICE, CHAT]))?.goneBefore).toBe(29)
    )
  })

  it('граница стёртого — по ответам сервера', async () => {
    const archive = await opened()
    await archive.setEnabled(true)
    await archive.save(
      CHAT,
      Array.from({ length: 20 }, (_, i) => msg(`$${i}`, 100 + i))
    )
    const moved = await archive.probeGone(CHAT, 200, async (id) => Number(id.slice(1)) < 7)
    expect(moved).toBe(true)
    expect(archive.goneBefore[CHAT]).toBe(106)
  })

  it('удаление: сообщение, копия чата целиком, всё сразу', async () => {
    const archive = await opened()
    await archive.setEnabled(true)
    await archive.save(CHAT, [msg('$1', 10), msg('$2', 20)])
    await archive.save('!other:host', [msg('$x', 5, { chatId: '!other:host' })])
    const removed: string[] = []
    archive.onChatRemoved((chatId) => removed.push(chatId))

    await archive.remove(CHAT, ['$1', '$unknown'])
    expect(archive.stats[CHAT]?.count).toBe(1)
    // Удалённое на сервере стирается и при записи.
    await archive.save(CHAT, [msg('$2', 20, { deleted: { by: '@bob:host', at: 30 } })])
    expect(archive.stats[CHAT]).toBeUndefined()

    await archive.save(CHAT, [msg('$3', 40)])
    await archive.removeChat(CHAT)
    expect(removed).toEqual([CHAT])
    expect((await db.chatArchive.toArray()).filter((r) => r.chatId === CHAT)).toEqual([])
    expect(await db.chatArchiveChats.get([ALICE, CHAT])).toBeUndefined()

    await archive.removeAll()
    expect(await db.chatArchive.count()).toBe(0)
    expect(archive.stats).toEqual({})
    expect(removed).toContain('!other:host')
  })

  it('удаление от участника: без прав — только своё, с правами — любое', async () => {
    const archive = await opened()
    await archive.setEnabled(true)
    await archive.save(CHAT, [
      msg('$bob', 10, { senderId: '@bob:host' }),
      msg('$me', 20, { senderId: '@me:host' }),
    ])
    expect(await archive.removeAuthored(CHAT, ['$bob', '$me'], '@bob:host', false)).toEqual([
      '$bob',
    ])
    expect(await archive.removeAuthored(CHAT, ['$me'], '@bob:host', true)).toEqual(['$me'])
    expect(archive.stats[CHAT]).toBeUndefined()
  })

  it('подпись чата хранится шифротекстом и видна после перезапуска', async () => {
    const archive = await opened()
    await archive.setEnabled(true)
    await archive.noteInfo(CHAT, { name: 'bob_ng', avatar: 'data:' + 'x'.repeat(5000) })
    const row = await db.chatArchiveChats.get([ALICE, CHAT])
    expect(new TextDecoder().decode(row!.data)).not.toContain('bob_ng')

    archive.reset()
    await archive.attach(ALICE, keyOf(1))
    expect(archive.infos[CHAT]).toEqual({ name: 'bob_ng' })
  })
})
