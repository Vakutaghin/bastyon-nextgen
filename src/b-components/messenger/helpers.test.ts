import { describe, it, expect, vi } from 'vitest'
import {
  getEventId,
  getEventContent,
  getEventType,
  getEventRoomId,
  getEventSender,
  getEventTs,
  isRenderableMessageEvent,
  isMessageEvent,
  getMatrixId,
  tetatetid,
  getAddressFromMatrixId,
  getRoomTimelineEvents,
  hexStringToUint8Array,
  base64StringToUint8Array,
  detectAudioMime,
  extractUrl,
  parseProfileKeys,
  applyBlockToContent,
  formatDuration,
  resolveMatrixHost,
} from './helpers'

// matrixService — singleton с тяжёлыми зависимостями; мокаем только нужное.
const { _hexToAddress, _getBaseUrl } = vi.hoisted(() => ({
  _hexToAddress: vi.fn(),
  _getBaseUrl: vi.fn(),
}))
vi.mock('./services/matrix-service', () => ({
  matrixService: { hexToAddress: _hexToAddress, getBaseUrl: _getBaseUrl },
}))

describe('извлечение полей события (SDK-методы и raw JSON)', () => {
  const sdkEvent = {
    getId: () => 'e1',
    getContent: () => ({ body: 'hi' }),
    getType: () => 'm.room.message',
    getRoomId: () => 'r1',
    getSender: () => '@u:s',
    getTs: () => 123,
  }
  const rawEvent = {
    event_id: 'e2',
    content: { body: 'raw' },
    type: 'm.room.message',
    room_id: 'r2',
    sender: '@v:s',
    origin_server_ts: 456,
  }

  it('из SDK-обёртки', () => {
    expect(getEventId(sdkEvent)).toBe('e1')
    expect(getEventContent(sdkEvent)).toEqual({ body: 'hi' })
    expect(getEventType(sdkEvent)).toBe('m.room.message')
    expect(getEventRoomId(sdkEvent)).toBe('r1')
    expect(getEventSender(sdkEvent)).toBe('@u:s')
    expect(getEventTs(sdkEvent)).toBe(123)
  })

  it('из raw JSON', () => {
    expect(getEventId(rawEvent)).toBe('e2')
    expect(getEventContent(rawEvent)).toEqual({ body: 'raw' })
    expect(getEventType(rawEvent)).toBe('m.room.message')
    expect(getEventRoomId(rawEvent)).toBe('r2')
    expect(getEventSender(rawEvent)).toBe('@v:s')
    expect(getEventTs(rawEvent)).toBe(456)
  })

  it('дефолты для null', () => {
    expect(getEventId(null)).toBe('unknown')
    expect(getEventContent(null)).toEqual({})
    expect(getEventType(null)).toBe('unknown')
    expect(getEventTs(null)).toBe(0)
  })
})

describe('isRenderableMessageEvent / isMessageEvent', () => {
  const msg = (content: Record<string, unknown>, type = 'm.room.message') => ({ type, content })

  it('зашифрованное событие — renderable', () => {
    expect(isRenderableMessageEvent(msg({}, 'm.room.encrypted'))).toBe(true)
  })

  it('m.text / m.audio — renderable', () => {
    expect(isRenderableMessageEvent(msg({ msgtype: 'm.text' }))).toBe(true)
    expect(isRenderableMessageEvent(msg({ msgtype: 'm.audio' }))).toBe(true)
  })

  it('сообщение с непустым body — renderable', () => {
    expect(isRenderableMessageEvent(msg({ body: 'hello' }))).toBe(true)
  })

  it('сообщение без msgtype и пустым body — нет', () => {
    expect(isRenderableMessageEvent(msg({ body: '   ' }))).toBe(false)
  })

  it('не-message событие — нет', () => {
    expect(isRenderableMessageEvent(msg({}, 'm.reaction'))).toBe(false)
  })

  it('isMessageEvent: message/encrypted → true, прочее → false', () => {
    expect(isMessageEvent(msg({}, 'm.room.message'))).toBe(true)
    expect(isMessageEvent(msg({}, 'm.room.encrypted'))).toBe(true)
    expect(isMessageEvent(msg({}, 'm.reaction'))).toBe(false)
  })
})

describe('getMatrixId', () => {
  it('извлекает локальную часть без @ и :server', () => {
    expect(getMatrixId('@abc123:matrix.org')).toBe('abc123')
  })
  it('пустой ввод → пустая строка', () => {
    expect(getMatrixId('')).toBe('')
  })
})

describe('tetatetid', () => {
  it('детерминированный hex (SHA224), симметрии нет (произведение коммутативно)', () => {
    const a = tetatetid('1a', '2b')
    expect(a).toMatch(/^[0-9a-f]{56}$/) // SHA224 = 56 hex
    expect(tetatetid('2b', '1a')).toBe(a) // id1*id2 коммутативно
  })

  it('null для равных/пустых/не-hex', () => {
    expect(tetatetid('1a', '1a')).toBeNull()
    expect(tetatetid('', '2b')).toBeNull()
    expect(tetatetid('zz', '2b')).toBeNull()
  })
})

describe('getAddressFromMatrixId', () => {
  it('hex-id → matrixService.hexToAddress', () => {
    _hexToAddress.mockReturnValue('PDecodedAddress12345')
    expect(getAddressFromMatrixId('@5045613758:matrix.org')).toBe('PDecodedAddress12345')
  })

  it('возвращает null, если декодированный адрес слишком короткий', () => {
    _hexToAddress.mockReturnValue('short')
    expect(getAddressFromMatrixId('@5045613758:matrix.org')).toBeNull()
  })

  it('не-hex локальная часть возвращается как есть', () => {
    expect(getAddressFromMatrixId('@alice:matrix.org')).toBe('alice')
  })

  it('невалидный matrixId → null', () => {
    expect(getAddressFromMatrixId('not-a-matrix-id')).toBeNull()
  })
})

describe('getRoomTimelineEvents', () => {
  it('через getLiveTimeline().getEvents()', () => {
    const room = { getLiveTimeline: () => ({ getEvents: () => [{ id: 1 }] }) }
    expect(getRoomTimelineEvents(room)).toEqual([{ id: 1 }])
  })
  it('через room.timeline массив', () => {
    expect(getRoomTimelineEvents({ timeline: [{ id: 2 }] })).toEqual([{ id: 2 }])
  })
  it('null → []', () => {
    expect(getRoomTimelineEvents(null)).toEqual([])
  })
})

describe('конвертеры байтов', () => {
  it('hexStringToUint8Array', () => {
    expect([...hexStringToUint8Array('48656c6c6f')]).toEqual([72, 101, 108, 108, 111])
  })
  it('base64StringToUint8Array', () => {
    expect([...base64StringToUint8Array(btoa('Hi'))]).toEqual([72, 105])
  })
})

describe('detectAudioMime', () => {
  const u = (...b: number[]) => new Uint8Array(b)
  it.each([
    ['mpeg ID3', u(0x49, 0x44, 0x33, 0), 'audio/mpeg'],
    ['mpeg sync', u(0xff, 0xe0, 0, 0), 'audio/mpeg'],
    ['ogg', u(0x4f, 0x67, 0x67, 0x53), 'audio/ogg'],
    ['wav', u(0x52, 0x49, 0x46, 0x46), 'audio/wav'],
    ['webm', u(0x1a, 0x45, 0xdf, 0xa3), 'audio/webm'],
    ['flac', u(0x66, 0x4c, 0x61, 0x43), 'audio/flac'],
  ])('распознаёт %s', (_name, bytes, mime) => {
    expect(detectAudioMime(bytes as Uint8Array)).toBe(mime)
  })

  it('слишком короткий буфер → null', () => {
    expect(detectAudioMime(u(1, 2))).toBeNull()
  })
  it('неизвестные байты → null', () => {
    expect(detectAudioMime(u(0, 0, 0, 0))).toBeNull()
  })
})

describe('extractUrl / parseProfileKeys / applyBlockToContent', () => {
  it('extractUrl: строка/uri/url/null', () => {
    expect(extractUrl('http://x')).toBe('http://x')
    expect(extractUrl({ uri: 'u' })).toBe('u')
    expect(extractUrl({ url: 'v' })).toBe('v')
    expect(extractUrl(null)).toBeNull()
    expect(extractUrl({ foo: 1 })).toBeNull()
  })

  it('parseProfileKeys: разбивает по запятой, тримит, фильтрует пустые', () => {
    expect(parseProfileKeys('a, b ,,c')).toEqual(['a', 'b', 'c'])
    expect(parseProfileKeys(undefined)).toEqual([])
  })

  it('applyBlockToContent: проставляет block во вложенные secrets', () => {
    const content: Record<string, unknown> = {
      info: { secrets: {} },
      pbody: { secrets: {} },
      secrets: {},
    }
    applyBlockToContent(content, 42)
    type WithSecrets = { secrets: { block?: number } }
    expect((content.info as WithSecrets).secrets.block).toBe(42)
    expect((content.pbody as WithSecrets).secrets.block).toBe(42)
    expect((content.secrets as { block?: number }).block).toBe(42)
    expect(content.block).toBe(42)
  })

  it('applyBlockToContent: no-op без block', () => {
    const content: Record<string, unknown> = {}
    applyBlockToContent(content, 0)
    expect(content.block).toBeUndefined()
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '00:00'],
    [5, '00:05'],
    [65, '01:05'],
    [600, '10:00'],
  ])('%i сек → %s', (sec, expected) => {
    expect(formatDuration(sec)).toBe(expected)
  })
})

describe('resolveMatrixHost', () => {
  it('возвращает host из baseUrl', () => {
    _getBaseUrl.mockReturnValue('https://matrix.pocketnet.app')
    expect(resolveMatrixHost()).toBe('matrix.pocketnet.app')
  })

  it('для localhost возвращает дефолтный host', () => {
    _getBaseUrl.mockReturnValue('http://localhost:8008')
    expect(resolveMatrixHost()).toBe('matrix.pocketnet.app')
  })
})
