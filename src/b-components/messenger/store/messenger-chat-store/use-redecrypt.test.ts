// Сообщение, которое с первого раза осталось «*** Encrypted Message ***»,
// расшифровывается повторно: по таймеру с растущей паузой и сразу — по поводу
// (ключ группы пришёл, шифрование готово, связь вернулась).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { room } = vi.hoisted(() => ({
  room: { roomId: '!room:host', findEventById: vi.fn((id: string) => ({ event_id: id })) },
}))

vi.mock('../../services/matrix-service', () => ({
  matrixService: {
    getRoom: () => room,
    getClient: () => ({ getUserId: () => '@me:host' }),
  },
}))

import { ENCRYPTED_MESSAGE_PLACEHOLDER } from '../consts'
import type { Message } from '../../types'
import { REDECRYPT_DELAYS, REDECRYPT_NUDGE_DELAY, useRedecrypt } from './use-redecrypt'

const ROOM = '!room:host'

const message = (id: string, text = ENCRYPTED_MESSAGE_PLACEHOLDER): Message => ({
  id,
  chatId: ROOM,
  senderId: '@peer:host',
  senderName: 'peer',
  text,
  type: 'text',
  rawContent: null,
  timestamp: 1,
  read: true,
  status: 'sent',
})

function setup(list: Message[]) {
  const messages: Record<string, Message[]> = { [ROOM]: list }
  const mapEventToMessage = vi.fn(async (e: { event_id: string }) =>
    message(e.event_id, ENCRYPTED_MESSAGE_PLACEHOLDER)
  )
  const enrichMessagesWithReactions = vi.fn()
  const api = useRedecrypt(
    { messages } as never,
    {
      mapEventToMessage,
      enrichMessagesWithReactions,
    } as never
  )
  /** Дальше сообщение расшифровывается. */
  const decryptable = () =>
    mapEventToMessage.mockImplementation(async (e) => message(e.event_id, 'Привет'))
  return { api, messages, mapEventToMessage, enrichMessagesWithReactions, decryptable }
}

beforeEach(() => {
  vi.useFakeTimers()
  room.findEventById.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useRedecrypt', () => {
  it('заглушка расшифровывается со второй попытки — текст встаёт на её место', async () => {
    const { api, messages, mapEventToMessage, enrichMessagesWithReactions, decryptable } = setup([
      message('$a', 'Уже видно'),
      message('$b'),
    ])
    api.watchChat(ROOM)

    await vi.advanceTimersByTimeAsync(REDECRYPT_DELAYS[0]!)
    expect(mapEventToMessage).toHaveBeenCalledTimes(1)
    expect(messages[ROOM]![1]!.text).toBe(ENCRYPTED_MESSAGE_PLACEHOLDER)

    decryptable()
    await vi.advanceTimersByTimeAsync(REDECRYPT_DELAYS[1]!)
    expect(messages[ROOM]!.map((m) => m.text)).toEqual(['Уже видно', 'Привет'])
    expect(enrichMessagesWithReactions).toHaveBeenCalledWith(room, messages[ROOM], '@me:host')

    // Заглушек не осталось — таймеров тоже.
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(mapEventToMessage).toHaveBeenCalledTimes(2)
  })

  it('не расшифровать — после последней паузы попытки прекращаются', async () => {
    const { api, mapEventToMessage } = setup([message('$b')])
    api.watchChat(ROOM)
    await vi.advanceTimersByTimeAsync(REDECRYPT_DELAYS.reduce((a, b) => a + b, 0))
    expect(mapEventToMessage).toHaveBeenCalledTimes(REDECRYPT_DELAYS.length)
    await vi.advanceTimersByTimeAsync(60 * 60_000)
    expect(mapEventToMessage).toHaveBeenCalledTimes(REDECRYPT_DELAYS.length)
  })

  it('повод — попытка сразу, отсчёт пауз заново', async () => {
    const { api, messages, mapEventToMessage, decryptable } = setup([message('$b')])
    api.watchChat(ROOM)
    await vi.advanceTimersByTimeAsync(REDECRYPT_DELAYS[0]! + REDECRYPT_DELAYS[1]!)
    expect(mapEventToMessage).toHaveBeenCalledTimes(2)

    decryptable()
    api.retryNow(ROOM)
    await vi.advanceTimersByTimeAsync(REDECRYPT_NUDGE_DELAY)
    expect(messages[ROOM]![0]!.text).toBe('Привет')
  })

  it('повод без комнаты — во всех чатах с заглушками', async () => {
    const { api, mapEventToMessage } = setup([message('$b')])
    api.retryNow()
    await vi.advanceTimersByTimeAsync(REDECRYPT_NUDGE_DELAY)
    expect(mapEventToMessage).toHaveBeenCalledTimes(1)
  })

  it('свою копию `~…` и расшифрованные не трогает; повторный присмотр не множит таймеры', async () => {
    const { api, mapEventToMessage } = setup([message('~!room:host:m1.1'), message('$a', 'Текст')])
    api.watchChat(ROOM)
    api.watchChat(ROOM)
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(mapEventToMessage).not.toHaveBeenCalled()
  })

  it('reset снимает таймеры', async () => {
    const { api, mapEventToMessage } = setup([message('$b')])
    api.watchChat(ROOM)
    api.reset()
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(mapEventToMessage).not.toHaveBeenCalled()
  })
})
