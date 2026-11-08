// Неотправленное на устройстве (настоящий Dexie поверх fake-indexeddb):
// голосовое и текст, которые не ушли, после перезапуска снова в ленте с
// повтором; на диске — шифротекст; ушедшее или удалённое забывается; чужой
// аккаунт неотправленное не видит.

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/db/database'
import type { Message } from '../../types'
import { localMediaBlob } from '../../services/local-media'
import { createOutbox } from './outbox'

const ALICE = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
const BOB = 'PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82'
const CHAT = '!dm:host'
const keyOf = (fill: number) => new Uint8Array(32).fill(fill)

function failed(id: string, over: Partial<Message> = {}): Message {
  return {
    id,
    chatId: CHAT,
    senderId: '@alice:host',
    text: '',
    timestamp: 1_000,
    read: true,
    status: 'failed',
    ...over,
  }
}

/** Запуск приложения: пустые ленты и outbox, открытый для аккаунта. */
async function launch(address = ALICE, fill = 1) {
  const messages: Record<string, Message[]> = {}
  const outbox = createOutbox(messages)
  await outbox.attach(address, keyOf(fill))
  return { messages, outbox }
}

describe('outbox', () => {
  beforeEach(async () => {
    await db.chatOutbox.clear()
  })

  it('голосовое не ушло — после перезапуска оно в ленте, с записью для повтора', async () => {
    const first = await launch()
    const voice = new Blob(['голос'], { type: 'audio/webm' })
    first.outbox.hold('local-1', { kind: 'audio', blob: voice, name: 'voice-message', duration: 2 })
    await first.outbox.keep(
      failed('local-1', {
        type: 'audio',
        url: 'blob:old',
        info: { mimetype: 'audio/webm', size: voice.size, duration: 2000, uploadProgress: 40 },
      })
    )

    const next = await launch()
    const [restored] = next.messages[CHAT]!
    expect(restored).toMatchObject({ id: 'local-1', type: 'audio', status: 'failed' })
    expect(restored!.info).not.toHaveProperty('uploadProgress')
    // Плеер берёт запись из local-media по новой ссылке.
    expect(restored!.url).toMatch(/^blob:/)
    expect(await localMediaBlob(restored!.url!)?.text()).toBe('голос')
    const payload = next.outbox.payload('local-1')
    expect(payload).toMatchObject({ kind: 'audio', name: 'voice-message', duration: 2 })
    expect(await payload!.blob.text()).toBe('голос')
    expect(payload!.blob.type).toBe('audio/webm')
  })

  it('текст не ушёл — возвращается с текстом; на диске шифротекст', async () => {
    const first = await launch()
    await first.outbox.keep(failed('~!dm:host:t1', { type: 'text', text: 'секрет' }))

    const [row] = await db.chatOutbox.toArray()
    expect(row).toMatchObject({ account: ALICE, id: '~!dm:host:t1', chatId: CHAT })
    expect(new TextDecoder().decode(row!.data)).not.toContain('секрет')

    const next = await launch()
    expect(next.messages[CHAT]).toEqual([
      expect.objectContaining({ id: '~!dm:host:t1', text: 'секрет', status: 'failed' }),
    ])
  })

  it('ушло или удалено — забывается; keep, отменённый forget, не записывается', async () => {
    const first = await launch()
    await first.outbox.keep(failed('a', { text: 'раз' }))
    await first.outbox.forget('a')
    // Повтор начался раньше, чем запись легла на диск.
    const pending = first.outbox.keep(failed('b', { text: 'два' }))
    await first.outbox.forget('b')
    await pending

    expect(await db.chatOutbox.count()).toBe(0)
    expect((await launch()).messages[CHAT]).toBeUndefined()
  })

  it('чужой аккаунт неотправленное не видит', async () => {
    const alice = await launch(ALICE, 1)
    await alice.outbox.keep(failed('a', { text: 'Алиса' }))

    expect((await launch(BOB, 2)).messages[CHAT]).toBeUndefined()
    expect((await launch(ALICE, 1)).messages[CHAT]).toHaveLength(1)
  })
})
