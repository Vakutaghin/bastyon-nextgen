import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Router } from 'vue-router'
import { createChatMethods } from './chat'

// --- mocks for the lazily-imported messenger modules ---
const initMatrix = vi.fn(async () => {})
const addressToHex = vi.fn((addr: string) => `HEX_${addr}`)
const getRooms = vi.fn<() => unknown[]>(() => [])
const createDirectRoom = vi.fn<(id: string) => Promise<string | undefined>>(async () => 'newRoom')
// P0-2: mini-app chat action теперь шлёт через зашифрованный sendTextContent
// (per-user pcrypto для DM), а НЕ через сырой matrixService.sendMessage.
const sendTextContent = vi.fn<(roomid: string, text: string) => Promise<unknown>>(async () => ({
  event_id: 'e1',
}))

vi.mock('@/b-components/messenger/services/matrix-service', () => ({
  matrixService: {
    addressToHex: (addr: string) => addressToHex(addr),
    getRooms: () => getRooms(),
    createDirectRoom: (id: string) => createDirectRoom(id),
  },
}))

vi.mock('@/b-components/messenger/helpers', () => ({
  resolveMatrixHost: () => 'matrix.example',
}))

vi.mock('@/b-components/messenger/store/messenger-store', () => ({
  useMessengerStore: () => ({ initMatrix: () => initMatrix() }),
}))

vi.mock('@/b-components/messenger/store/messenger-chat-store', () => ({
  useMessengerChatStore: () => ({
    sendTextContent: (roomid: string, text: string) => sendTextContent(roomid, text),
  }),
}))

function makeRouter() {
  return { push: vi.fn(async () => {}) } as unknown as Router
}

beforeEach(() => {
  vi.clearAllMocks()
  getRooms.mockReturnValue([])
  createDirectRoom.mockResolvedValue('newRoom')
  sendTextContent.mockResolvedValue({ event_id: 'e1' })
})

describe('chatOpenRoom', () => {
  it('пушит /messages с room в query', async () => {
    const router = makeRouter()
    const { chatOpenRoom } = createChatMethods({ router })

    await chatOpenRoom('!abc')

    expect(router.push).toHaveBeenCalledWith({ path: '/messages', query: { room: '!abc' } })
  })
})

describe('chatGetOrCreateRoom', () => {
  it('throw chat_no_users при пустом массиве', async () => {
    const { chatGetOrCreateRoom } = createChatMethods({ router: makeRouter() })
    await expect(chatGetOrCreateRoom([], undefined)).rejects.toThrow('chat_no_users')
  })

  it('throw chat_no_users если передан не массив', async () => {
    const { chatGetOrCreateRoom } = createChatMethods({ router: makeRouter() })
    await expect(chatGetOrCreateRoom(undefined as unknown as string[], undefined)).rejects.toThrow(
      'chat_no_users'
    )
  })

  it('throw chat_group_rooms_not_supported при >1 пользователе', async () => {
    const { chatGetOrCreateRoom } = createChatMethods({ router: makeRouter() })
    await expect(chatGetOrCreateRoom(['a', 'b'], undefined)).rejects.toThrow(
      'chat_group_rooms_not_supported'
    )
  })

  it('throw chat_no_users если первый адрес пустой', async () => {
    const { chatGetOrCreateRoom } = createChatMethods({ router: makeRouter() })
    await expect(chatGetOrCreateRoom([''], undefined)).rejects.toThrow('chat_no_users')
  })

  it('возвращает существующую комнату не создавая новую', async () => {
    getRooms.mockReturnValue([{ roomId: '!existing', getMember: () => ({ userId: 'x' }) }])
    const { chatGetOrCreateRoom } = createChatMethods({ router: makeRouter() })

    const res = await chatGetOrCreateRoom(['ADDR1'], undefined)

    expect(res).toEqual({ roomid: '!existing' })
    expect(initMatrix).toHaveBeenCalledTimes(1)
    expect(createDirectRoom).not.toHaveBeenCalled()
  })

  it('строит partnerId из hex-адреса в нижнем регистре и хоста', async () => {
    addressToHex.mockReturnValue('ABCDEF')
    getRooms.mockReturnValue([])
    const { chatGetOrCreateRoom } = createChatMethods({ router: makeRouter() })

    await chatGetOrCreateRoom(['ADDR1'], undefined)

    expect(addressToHex).toHaveBeenCalledWith('ADDR1')
    expect(createDirectRoom).toHaveBeenCalledWith('@abcdef:matrix.example')
  })

  it('создаёт новую DM-комнату если существующей нет', async () => {
    getRooms.mockReturnValue([{ roomId: '!other', getMember: () => undefined }])
    createDirectRoom.mockResolvedValue('!created')
    const { chatGetOrCreateRoom } = createChatMethods({ router: makeRouter() })

    const res = await chatGetOrCreateRoom(['ADDR1'], undefined)

    expect(res).toEqual({ roomid: '!created' })
  })

  it('throw chat_create_room_failed если createDirectRoom вернул falsy', async () => {
    getRooms.mockReturnValue([])
    createDirectRoom.mockResolvedValue(undefined)
    const { chatGetOrCreateRoom } = createChatMethods({ router: makeRouter() })

    await expect(chatGetOrCreateRoom(['ADDR1'], undefined)).rejects.toThrow(
      'chat_create_room_failed'
    )
  })
})

describe('chatSendMessage', () => {
  it('throw chat_no_roomid если roomid пустой', async () => {
    const { chatSendMessage } = createChatMethods({ router: makeRouter() })
    await expect(chatSendMessage('', 'hi')).rejects.toThrow('chat_no_roomid')
  })

  it('throw chat_no_roomid если roomid не строка', async () => {
    const { chatSendMessage } = createChatMethods({ router: makeRouter() })
    await expect(chatSendMessage(123 as unknown as string, 'hi')).rejects.toThrow('chat_no_roomid')
  })

  it('отправляет строковый content (через зашифрованный sendTextContent)', async () => {
    sendTextContent.mockResolvedValue({ event_id: 'e9' })
    const { chatSendMessage } = createChatMethods({ router: makeRouter() })

    const res = await chatSendMessage('!r', 'hello')

    expect(initMatrix).toHaveBeenCalledTimes(1)
    expect(sendTextContent).toHaveBeenCalledWith('!r', 'hello')
    expect(res).toEqual({ event_id: 'e9' })
  })

  it('извлекает body из объектного content', async () => {
    const { chatSendMessage } = createChatMethods({ router: makeRouter() })

    await chatSendMessage('!r', { body: 'from-body' } as unknown as string)

    expect(sendTextContent).toHaveBeenCalledWith('!r', 'from-body')
  })

  it('throw chat_empty_content при пустой строке', async () => {
    const { chatSendMessage } = createChatMethods({ router: makeRouter() })
    await expect(chatSendMessage('!r', '')).rejects.toThrow('chat_empty_content')
  })

  it('throw chat_empty_content при объекте без body', async () => {
    const { chatSendMessage } = createChatMethods({ router: makeRouter() })
    await expect(chatSendMessage('!r', { foo: 'bar' } as unknown as string)).rejects.toThrow(
      'chat_empty_content'
    )
  })

  it('возвращает { ok: true } если sendTextContent вернул null', async () => {
    sendTextContent.mockResolvedValue(null)
    const { chatSendMessage } = createChatMethods({ router: makeRouter() })

    const res = await chatSendMessage('!r', 'hi')

    expect(res).toEqual({ ok: true })
  })
})
