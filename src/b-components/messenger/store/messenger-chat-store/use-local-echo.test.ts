// Копия своего события в SDK (`~<комната>:<txnId>`) после ответа сервера
// получает настоящий id. Лента и кэш расшифровок следуют за ней: сообщение
// не остаётся с `~`-id и не появляется второй раз при повторном открытии чата.

import { describe, expect, it, vi } from 'vitest'

vi.mock('../../services/matrix-service', () => ({
  matrixService: { getClient: () => ({ getUserId: () => '@me:host' }) },
}))

import { ENCRYPTED_MESSAGE_PLACEHOLDER } from '../consts'
import type { Message } from '../../types'
import { localEchoId, useLocalEcho } from './use-local-echo'

const ROOM = '!room:host'
const LOCAL = localEchoId(ROOM, 'm1.1')

const event = (id: string) =>
  ({ event_id: id, room_id: ROOM, getId: () => id, getRoomId: () => ROOM }) as never

const message = (id: string, over: Partial<Message> = {}): Message => ({
  id,
  chatId: ROOM,
  senderId: '@me:host',
  senderName: 'me',
  text: 'Привет',
  type: 'text',
  rawContent: null,
  timestamp: 1,
  read: true,
  status: 'sending',
  ...over,
})

function setup(list: Message[], mapped: Partial<Message> = {}) {
  const cache = new Map<string, string>()
  const decryptionCache = {
    get: (id: string) => cache.get(id),
    has: (id: string) => cache.has(id),
    set: vi.fn((id: string, text: string) => cache.set(id, text)),
    persist: vi.fn(),
  }
  const messages: Record<string, Message[]> = { [ROOM]: list }
  const mapEventToMessage = vi.fn(async () => message('$real', { status: 'sent', ...mapped }))
  const { adoptLocalEcho } = useLocalEcho(
    { messages } as never,
    { decryptionCache } as never,
    { mapEventToMessage } as never
  )
  return { adoptLocalEcho, messages, cache, decryptionCache, mapEventToMessage }
}

describe('useLocalEcho', () => {
  it('id копии SDK — `~<комната>:<txnId>`', () => {
    expect(LOCAL).toBe('~!room:host:m1.1')
  })

  it('эхо получает настоящий id и статус «отправлено», текст — в кэш под настоящим id', async () => {
    const { adoptLocalEcho, messages, cache, decryptionCache } = setup([message(LOCAL)])
    cache.set(LOCAL, 'Привет')
    await adoptLocalEcho(event('$real'), LOCAL)
    expect(messages[ROOM]).toHaveLength(1)
    expect(messages[ROOM]![0]).toMatchObject({ id: '$real', status: 'sent', text: 'Привет' })
    expect(cache.get('$real')).toBe('Привет')
    expect(decryptionCache.persist).toHaveBeenCalledWith('@me:host', '$real', 'Привет')
  })

  it('настоящее событие уже пришло синком — копия убирается, а не остаётся второй', async () => {
    const { adoptLocalEcho, messages } = setup([
      message(LOCAL),
      message('$real', { status: 'sent' }),
    ])
    await adoptLocalEcho(event('$real'), LOCAL)
    expect(messages[ROOM]!.map((m) => m.id)).toEqual(['$real'])
  })

  it('копия показывала «*** Encrypted Message ***» — после отправки перерисовывается', async () => {
    const { adoptLocalEcho, messages, mapEventToMessage } = setup(
      [message(LOCAL, { text: ENCRYPTED_MESSAGE_PLACEHOLDER, status: 'sent' })],
      { text: 'Привет' }
    )
    await adoptLocalEcho(event('$real'), LOCAL)
    expect(mapEventToMessage).toHaveBeenCalledTimes(1)
    expect(messages[ROOM]![0]).toMatchObject({ id: '$real', text: 'Привет' })
  })

  it('смена статуса без нового id или чужая лента — ничего не трогает', async () => {
    const { adoptLocalEcho, messages, decryptionCache } = setup([message(LOCAL)])
    await adoptLocalEcho(event(LOCAL), LOCAL)
    await adoptLocalEcho(event('$real'), undefined)
    await adoptLocalEcho(event('$other'), '~!room:host:m9.9')
    expect(messages[ROOM]![0]!.id).toBe(LOCAL)
    expect(decryptionCache.set).not.toHaveBeenCalled()
  })
})
