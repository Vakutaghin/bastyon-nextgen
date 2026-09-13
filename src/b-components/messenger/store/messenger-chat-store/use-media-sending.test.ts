import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

const { room, matrix } = vi.hoisted(() => {
  const room = { roomId: '!c:host', loadMembersIfNeeded: vi.fn(async () => {}) }
  type Send = (
    chatId: string,
    data: unknown,
    onProgress: (l: number, t?: number) => void
  ) => Promise<void>
  const send = (): Send => async () => {}
  const matrix = {
    getClient: vi.fn(() => ({})),
    getRoom: vi.fn(() => room),
    sendAudio: vi.fn(send()),
    sendImage: vi.fn(send()),
    sendVideo: vi.fn(send()),
    sendFile: vi.fn(send()),
    uploadContent: vi.fn(async () => 'mxc://poster'),
  }
  return { room, matrix }
})

vi.mock('../../services/matrix-service', () => ({ matrixService: matrix }))
vi.mock('../../services/encryption-service', () => ({
  encryptAudioBlob: vi.fn(async () => ({ encryptedBlob: new Blob(['enc']), secretStr: 'S' })),
}))
vi.mock('../../services/media-encrypt', () => ({
  encryptBlobWithRandomKey: vi.fn(async () => ({
    encryptedBlob: new Blob(['enc']),
    secretStr: 'S',
  })),
  wrapKeyForRoom: vi.fn(async () => ({ wrapped: true })),
}))
vi.mock('../../services/media-metadata', () => ({
  extractImageDimensions: vi.fn(async () => ({ w: 10, h: 20 })),
  extractVideoMetadata: vi.fn(async () => ({ duration: 1.5, w: 30, h: 40, posterBlob: null })),
}))
vi.mock('../../helpers', () => ({ isTetatetchat: () => true }))

import { useMediaSending } from './use-media-sending'

function setup() {
  const messages: Record<string, { id: string; type?: string; status: string; url?: string }[]> = {}
  const ctx = {
    messages,
    currentUser: ref({ id: '@me:host', name: 'me' }),
    uiStore: { isInitInProgress: false },
  }
  const chatCrypto = {
    ensurePcryptoInitialized: vi.fn(),
    waitForPcrypto: vi.fn(),
    pcryptoService: ref({ encryptKey: vi.fn(async () => ({ audio: true })) }),
    getOrderedMemberIds: vi.fn(() => ['@me:host', '@peer:host']),
    collectPcryptoUsers: vi.fn(async () => []),
    getCurrentBlockHeight: vi.fn(async () => 100),
    pickRoomBlock: vi.fn(async () => 42),
  }
  const api = useMediaSending(ctx as never, chatCrypto as never)
  return { api, messages, chatCrypto }
}

beforeEach(() => {
  vi.clearAllMocks()
  matrix.getRoom.mockReturnValue(room)
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:local'),
    revokeObjectURL: vi.fn(),
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('useMediaSending', () => {
  it('sendFile: оптимистичное сообщение живёт до отправки и убирается после неё', async () => {
    const { api, messages, chatCrypto } = setup()
    let seenDuringSend: unknown
    matrix.sendFile.mockImplementationOnce(
      async (_chatId: string, _data: unknown, onProgress: (l: number, t?: number) => void) => {
        seenDuringSend = messages['!c:host']?.map((m) => ({ type: m.type, status: m.status }))
        onProgress(5, 10)
        expect(
          (messages['!c:host']![0] as { info?: { uploadProgress?: number } }).info?.uploadProgress
        ).toBe(50)
      }
    )
    await api.sendFile('!c:host', new Blob(['x']), { name: 'a.txt' })
    expect(seenDuringSend).toEqual([{ type: 'file', status: 'sending' }])
    expect(messages['!c:host']).toEqual([])
    expect(chatCrypto.pickRoomBlock).toHaveBeenCalledWith(room)
    expect(matrix.sendFile).toHaveBeenCalledWith(
      '!c:host',
      expect.objectContaining({ name: 'a.txt', block: 42, secrets: { wrapped: true } }),
      expect.any(Function)
    )
    // у файла нет object-URL — revoke не зовётся
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('sendImage: object-URL освобождается только после отправки', async () => {
    const { api, messages } = setup()
    matrix.sendImage.mockImplementationOnce(async () => {
      expect(URL.revokeObjectURL).not.toHaveBeenCalled()
      expect(messages['!c:host']![0]!.url).toBe('blob:local')
    })
    await api.sendImage('!c:host', new Blob(['img']))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local')
    expect(messages['!c:host']).toEqual([])
    expect(matrix.sendImage).toHaveBeenCalledWith(
      '!c:host',
      expect.objectContaining({ width: 10, height: 20, mimetype: 'image/jpeg' }),
      expect.any(Function)
    )
  })

  it('sendAudio: DM → дефолтный блок, ключ заворачивается через pcrypto.encryptKey', async () => {
    const { api, chatCrypto } = setup()
    await api.sendAudio('!c:host', new Blob(['a']), { duration: 3 })
    expect(chatCrypto.pcryptoService.value.encryptKey).toHaveBeenCalledWith('S', [], 10, 2)
    expect(matrix.sendAudio).toHaveBeenCalledWith(
      '!c:host',
      expect.objectContaining({ duration: 3, block: 10, secrets: { audio: true } }),
      expect.any(Function)
    )
  })

  it('sendVideo: постер грузится параллельно, оба object-URL освобождаются', async () => {
    const { api } = setup()
    await api.sendVideo('!c:host', new Blob(['v']))
    expect(matrix.uploadContent).not.toHaveBeenCalled() // posterBlob = null
    expect(matrix.sendVideo).toHaveBeenCalledWith(
      '!c:host',
      expect.objectContaining({ duration: 1.5, width: 30, height: 40, block: 42 }),
      expect.any(Function)
    )
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local')
  })

  it('ошибка отправки: оптимистичное сообщение помечается failed, наружу не летит', async () => {
    const { api, messages } = setup()
    matrix.sendFile.mockRejectedValueOnce(new Error('network'))
    await expect(api.sendFile('!c:host', new Blob(['x']))).resolves.toBeUndefined()
    expect(messages['!c:host']).toEqual([
      expect.objectContaining({ type: 'file', status: 'failed' }),
    ])
  })

  it('нет комнаты → ничего не пушится, ошибка проглатывается', async () => {
    const { api, messages } = setup()
    matrix.getRoom.mockReturnValueOnce(null as never)
    await api.sendImage('!c:host', new Blob(['img']))
    expect(messages['!c:host']).toBeUndefined()
    expect(matrix.sendImage).not.toHaveBeenCalled()
  })

  it('слишком большой файл отбрасывается до любых сетевых вызовов', async () => {
    const { api, messages } = setup()
    const big = { size: 26 * 1024 * 1024, type: 'application/zip' } as Blob
    await api.sendFile('!c:host', big)
    expect(matrix.getRoom).not.toHaveBeenCalled()
    expect(messages['!c:host']).toBeUndefined()
  })
})
