import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

const { room, matrix, chat } = vi.hoisted(() => {
  const room = {
    roomId: '!c:host',
    loadMembersIfNeeded: vi.fn(async () => {}),
    getJoinRule: vi.fn(() => 'invite'),
  }
  /** Личный ли чат — подменяет isTetatetchat. */
  const chat = { direct: true }
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
    makeTxnId: vi.fn(() => 'm1.1'),
  }
  return { room, matrix, chat }
})

vi.mock('../../services/matrix-service', () => ({ matrixService: matrix }))
vi.mock('../../services/encryption-service', () => ({
  encryptAudioBlob: vi.fn(async () => ({ encryptedBlob: new Blob(['enc']), secretStr: 'S' })),
  sealWaveform: vi.fn(
    async (samples: number[], secret: string) => `sealed:${secret}:${samples.length}`
  ),
}))
/** Что декодер «услышал» в записи: null — формат движку не знаком. */
const decoded = vi.hoisted(() => ({ samples: [0.1, 0.5, 0.2, 1] as number[] | null }))
vi.mock('../../lib/voice-waveform', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/voice-waveform')>()),
  decodeVoice: vi.fn(async () =>
    decoded.samples ? { samples: decoded.samples, duration: 3 } : null
  ),
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
  // По умолчанию фото уже чистое и небольшое; свой тест подменяет результат.
  stripPhotoMetadata: vi.fn(async (blob: Blob) => blob),
  prepareChatPhoto: vi.fn(async (blob: Blob) => blob),
  extractVideoMetadata: vi.fn(async () => ({ duration: 1.5, w: 30, h: 40, posterBlob: null })),
}))
vi.mock('../../helpers', async (importOriginal) => ({
  // Лента комнаты — настоящая: по ней txn-state ищет дошедшее событие.
  getRoomTimelineEvents: (await importOriginal<typeof import('../../helpers')>())
    .getRoomTimelineEvents,
  isTetatetchat: () => chat.direct,
}))

import { useMediaSending } from './use-media-sending'
import { encryptAudioBlob } from '../../services/encryption-service'
import { encryptBlobWithRandomKey } from '../../services/media-encrypt'
import {
  extractImageDimensions,
  prepareChatPhoto,
  stripPhotoMetadata,
} from '../../services/media-metadata'

/** Outbox без базы: что сохранили бы на устройстве. */
function fakeOutbox() {
  const payloads = new Map<string, unknown>()
  return {
    kept: [] as string[],
    forgotten: [] as string[],
    attach: vi.fn(),
    detach: vi.fn(),
    hold(id: string, payload: unknown) {
      payloads.set(id, payload)
    },
    payload: (id: string) => payloads.get(id),
    async keep(message: { id: string }) {
      this.kept.push(message.id)
    },
    async forget(id: string) {
      this.forgotten.push(id)
      payloads.delete(id)
    },
  }
}

function setup(memberIds: string[] = ['@me:host', '@peer:host']) {
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
    getOrderedMemberIds: vi.fn(() => memberIds),
    collectPcryptoUsers: vi.fn(async () => []),
    getCurrentBlockHeight: vi.fn(async () => 100),
    pickRoomBlock: vi.fn(async () => 42),
  }
  const outbox = fakeOutbox()
  const api = useMediaSending(ctx as never, chatCrypto as never, outbox as never)
  return { api, messages, chatCrypto, outbox }
}

beforeEach(() => {
  vi.clearAllMocks()
  matrix.getRoom.mockReturnValue(room)
  room.getJoinRule.mockReturnValue('invite')
  chat.direct = true
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
    // Первая ссылка — выбранный снимок в пузыре до подготовки.
    vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:preview')
    matrix.sendImage.mockImplementationOnce(async () => {
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
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

  it('stageImage: пузырь — сразу, до подготовки фото; отправка — по вызову', async () => {
    const { api, messages, outbox } = setup()
    let prepared: (blob: Blob) => void = () => {}
    vi.mocked(prepareChatPhoto).mockImplementationOnce(
      () => new Promise<Blob>((resolve) => (prepared = resolve))
    )
    vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:preview')
    const original = new File(['exif+pixels'], 'IMG_3.jpg', { type: 'image/jpeg' })

    const send = api.stageImage('!c:host', original)
    // Ещё ничего не ждали — пузырь уже в ленте, с выбранным снимком и «0%».
    expect(messages['!c:host']).toEqual([
      expect.objectContaining({
        type: 'image',
        status: 'sending',
        url: 'blob:preview',
        info: expect.objectContaining({ uploadProgress: 0, size: original.size }),
      }),
    ])
    expect(prepareChatPhoto).not.toHaveBeenCalled()

    const sending = send!()
    await Promise.resolve()
    expect(prepareChatPhoto).toHaveBeenCalledWith(original)
    expect(matrix.sendImage).not.toHaveBeenCalled()
    // До конца подготовки в outbox (на повтор и на устройство) — ничего: там
    // мог бы оказаться снимок с местом съёмки.
    expect(outbox.payload(messages['!c:host']![0]!.id)).toBeUndefined()

    prepared(new Blob(['pixels'], { type: 'image/jpeg' }))
    await sending
    expect(matrix.sendImage).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
    expect(messages['!c:host']).toEqual([])
  })

  it('stageImage: подготовка не удалась — пузырь убирается, ошибка наружу', async () => {
    const { api, messages } = setup()
    vi.mocked(prepareChatPhoto).mockRejectedValueOnce(new Error('decode'))
    vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:preview')
    const send = api.stageImage('!c:host', new Blob(['img']))
    await expect(send!()).rejects.toThrow('decode')
    expect(messages['!c:host']).toEqual([])
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
    expect(matrix.sendImage).not.toHaveBeenCalled()
  })

  it('stageImage: пузырь убрали, пока фото готовилось, — не отправляется', async () => {
    const { api, messages } = setup()
    const send = api.stageImage('!c:host', new Blob(['img']))
    messages['!c:host']!.splice(0, 1)
    await send!()
    expect(matrix.sendImage).not.toHaveBeenCalled()
  })

  it('stageImage: больше лимита — ни пузыря, ни отправки', () => {
    const { api, messages } = setup()
    const huge = { size: 101 * 1024 * 1024, type: 'image/jpeg' } as Blob
    expect(api.stageImage('!c:host', huge)).toBeNull()
    expect(messages['!c:host']).toBeUndefined()
  })

  it('sendImage: уходит уменьшенное фото без метаданных — и в пузырь, и в загрузку', async () => {
    const { api, messages } = setup()
    const original = new File(['exif+pixels'], 'IMG_1.jpg')
    // Файл без типа (облако на Android): тип — по байтам очищенного.
    const clean = new Blob(['pixels'], { type: 'image/png' })
    vi.mocked(prepareChatPhoto).mockResolvedValueOnce(clean)
    let shown: Record<string, unknown> | undefined
    matrix.sendImage.mockImplementationOnce(async () => {
      shown = (messages['!c:host']![0] as { info?: Record<string, unknown> }).info
    })
    await api.sendImage('!c:host', original)
    expect(prepareChatPhoto).toHaveBeenCalledWith(original)
    expect(stripPhotoMetadata).not.toHaveBeenCalled()
    // Пузырь до отправки — с размером очищенного файла.
    expect(shown).toMatchObject({ mimetype: 'image/png', size: 6 })
    expect(extractImageDimensions).toHaveBeenCalledWith(clean)
    expect(encryptBlobWithRandomKey).toHaveBeenCalledWith(clean)
    const data = matrix.sendImage.mock.calls[0]![1] as Record<string, unknown>
    expect(data).toMatchObject({ name: 'IMG_1.jpg', mimetype: 'image/png' })
  })

  it('sendFile: картинка файлом — оригинал без уменьшения, но без метаданных', async () => {
    const { api, messages } = setup()
    const original = new File(['exif+pixels'], 'IMG_2.jpg', { type: 'image/jpeg' })
    const clean = new Blob(['pixels'], { type: 'image/jpeg' })
    vi.mocked(stripPhotoMetadata).mockResolvedValueOnce(clean)
    let shown: Record<string, unknown> | undefined
    matrix.sendFile.mockImplementationOnce(async () => {
      shown = (messages['!c:host']![0] as { info?: Record<string, unknown> }).info
    })
    await api.sendFile('!c:host', original)
    expect(stripPhotoMetadata).toHaveBeenCalledWith(original)
    expect(prepareChatPhoto).not.toHaveBeenCalled()
    expect(shown).toMatchObject({ mimetype: 'image/jpeg', size: 6, name: 'IMG_2.jpg' })
    expect(encryptBlobWithRandomKey).toHaveBeenCalledWith(clean)
  })

  it('sendFile: не картинка — те же байты, без разбора', async () => {
    const { api } = setup()
    const doc = new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })
    await api.sendFile('!c:host', doc)
    expect(stripPhotoMetadata).not.toHaveBeenCalled()
    expect(encryptBlobWithRandomKey).toHaveBeenCalledWith(doc)
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

  it('sendAudio: волна по записи — в шифрованном чате под ключом голосового, открыто её нет', async () => {
    const { api } = setup()
    await api.sendAudio('!c:host', new Blob(['a']), { duration: 3 })
    const data = matrix.sendAudio.mock.lastCall![1] as Record<string, unknown>
    expect(data.waveformEncrypted).toBe('sealed:S:4')
    expect(data).not.toHaveProperty('waveform')
  })

  it('sendAudio: волна в открытой группе — целыми 0…1024, как у Forta Chat', async () => {
    const { api } = setup()
    chat.direct = false
    room.getJoinRule.mockReturnValue('public')
    await api.sendAudio('!c:host', new Blob(['a']), { duration: 3 })
    const data = matrix.sendAudio.mock.lastCall![1] as Record<string, unknown>
    expect(data.waveform).toEqual([102, 512, 205, 1024])
    expect(data).not.toHaveProperty('waveformEncrypted')
  })

  it('sendAudio: волну не разобрать — голосовое уходит без неё', async () => {
    const { api } = setup()
    decoded.samples = null
    try {
      await api.sendAudio('!c:host', new Blob(['a']), { duration: 3 })
    } finally {
      decoded.samples = [0.1, 0.5, 0.2, 1]
    }
    const data = matrix.sendAudio.mock.lastCall![1] as Record<string, unknown>
    expect(data).not.toHaveProperty('waveformEncrypted')
    expect(data).not.toHaveProperty('waveform')
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

  it('нет комнаты → фото остаётся неотправленным, с повтором, ошибка проглатывается', async () => {
    const { api, messages, outbox } = setup()
    matrix.getRoom.mockReturnValueOnce(null as never)
    await api.sendImage('!c:host', new Blob(['img']))
    expect(messages['!c:host']).toEqual([
      expect.objectContaining({ type: 'image', status: 'failed' }),
    ])
    expect(matrix.sendImage).not.toHaveBeenCalled()
    expect(outbox.kept).toEqual([messages['!c:host']![0]!.id])
  })

  it('голосовое не ушло, а после него ушёл текст — помечено именно голосовое', async () => {
    const { api, messages } = setup()
    matrix.sendAudio.mockImplementationOnce(async () => {
      // Пока голосовое грузилось, в чат ушло другое сообщение.
      messages['!c:host']!.push({ id: '$text', type: 'text', status: 'sent' })
      throw new Error('network')
    })
    await api.sendAudio('!c:host', new Blob(['a']), { duration: 2 })
    expect(messages['!c:host']!.map((m) => [m.type, m.status])).toEqual([
      ['audio', 'failed'],
      ['text', 'sent'],
    ])
  })

  it('«Повторить» у голосового отправляет тот же файл и убирает сообщение после отправки', async () => {
    const { api, messages, outbox } = setup()
    const voice = new Blob(['voice'], { type: 'audio/webm' })
    matrix.sendAudio.mockRejectedValueOnce(new Error('network'))
    await api.sendAudio('!c:host', voice, { duration: 2 })
    const id = messages['!c:host']![0]!.id
    expect(outbox.kept).toEqual([id])

    expect(await api.retryMedia('!c:host', id)).toBe(true)
    expect(encryptAudioBlob).toHaveBeenLastCalledWith(voice)
    expect(matrix.sendAudio).toHaveBeenCalledTimes(2)
    expect(messages['!c:host']).toEqual([])
    expect(outbox.forgotten).toEqual([id])
  })

  // ─── Повтор и транзакция: дошедшее сообщение второй раз не создаётся ───────

  it('вложение уходит со своим txnId, повтор — с тем же, а не с новым', async () => {
    const { api, messages } = setup()
    matrix.sendImage.mockRejectedValueOnce(new Error('timeout'))
    await api.sendImage('!c:host', new Blob(['img'], { type: 'image/png' }))
    const id = messages['!c:host']![0]!.id
    expect(matrix.sendImage.mock.calls[0]![1]).toMatchObject({ txnId: 'm1.1' })

    matrix.makeTxnId.mockImplementation(() => 'm2.2')
    try {
      expect(await api.retryMedia('!c:host', id)).toBe(true)
    } finally {
      matrix.makeTxnId.mockImplementation(() => 'm1.1')
    }
    expect(matrix.sendImage).toHaveBeenCalledTimes(2)
    expect(matrix.sendImage.mock.calls[1]![1]).toMatchObject({ txnId: 'm1.1' })
    expect(messages['!c:host']).toEqual([])
  })

  it('txnId доходит до каждого вида вложений', async () => {
    const { api } = setup()
    await api.sendAudio('!c:host', new Blob(['a'], { type: 'audio/webm' }), { duration: 1 })
    await api.sendVideo('!c:host', new Blob(['v'], { type: 'video/mp4' }))
    await api.sendFile('!c:host', new Blob(['f']), { name: 'a.txt' })
    for (const send of [matrix.sendAudio, matrix.sendVideo, matrix.sendFile]) {
      expect(send.mock.calls[0]![1]).toMatchObject({ txnId: 'm1.1' })
    }
  })

  it('повтор, а вложение на деле дошло (синк принёс событие с этим txnId) — второй раз не уходит', async () => {
    const { api, messages, outbox } = setup()
    matrix.sendFile.mockRejectedValueOnce(new Error('timeout'))
    await api.sendFile('!c:host', new Blob(['f']), { name: 'a.txt' })
    const id = messages['!c:host']![0]!.id
    const arrived = { getId: () => '$file', getUnsigned: () => ({ transaction_id: 'm1.1' }) }
    matrix.getRoom.mockReturnValueOnce({
      ...room,
      getLiveTimeline: () => ({ getEvents: () => [arrived] }),
    } as never)
    expect(await api.retryMedia('!c:host', id)).toBe(true)
    expect(matrix.sendFile).toHaveBeenCalledTimes(1)
    expect(encryptBlobWithRandomKey).toHaveBeenCalledTimes(1)
    expect(messages['!c:host']).toEqual([])
    expect(outbox.forgotten).toEqual([id])
  })

  it('копия в SDK «не ушла» — её повторяет SDK, без новой загрузки и шифрования', async () => {
    const { api, messages } = setup()
    matrix.sendImage.mockRejectedValueOnce(new Error('connection reset'))
    await api.sendImage('!c:host', new Blob(['img'], { type: 'image/png' }))
    const id = messages['!c:host']![0]!.id
    const unsent = { status: 'not_sent' }
    const resendEvent = vi.fn(async () => ({ event_id: '$img' }))
    matrix.getClient.mockReturnValueOnce({ resendEvent, cancelPendingEvent: vi.fn() } as never)
    matrix.getRoom.mockReturnValueOnce({
      ...room,
      getEventForTxnId: (txn: string) => (txn === 'm1.1' ? unsent : undefined),
    } as never)
    expect(await api.retryMedia('!c:host', id)).toBe(true)
    expect(resendEvent).toHaveBeenCalledWith(unsent, expect.objectContaining({ roomId: '!c:host' }))
    expect(matrix.sendImage).toHaveBeenCalledTimes(1)
    expect(encryptBlobWithRandomKey).toHaveBeenCalledTimes(1)
    expect(messages['!c:host']).toEqual([])
  })

  it('копия ещё в пути — повтор не шлёт второй раз, сообщение остаётся с «Повторить»', async () => {
    const { api, messages } = setup()
    matrix.sendFile.mockRejectedValueOnce(new Error('timeout'))
    await api.sendFile('!c:host', new Blob(['f']), { name: 'a.txt' })
    const id = messages['!c:host']![0]!.id
    matrix.getRoom.mockReturnValueOnce({
      ...room,
      getEventForTxnId: () => ({ status: 'sending' }),
    } as never)
    expect(await api.retryMedia('!c:host', id)).toBe(true)
    expect(matrix.sendFile).toHaveBeenCalledTimes(1)
    expect(messages['!c:host']!.map((m) => m.status)).toEqual(['failed'])
  })

  it('вложение из записи без txnId (до обновления) — txnId появляется и держится между повторами', async () => {
    const { api, messages, outbox } = setup()
    const payload = { kind: 'file' as const, blob: new Blob(['f']), name: 'old.txt' }
    outbox.hold('local-old', payload)
    messages['!c:host'] = [{ id: 'local-old', type: 'file', status: 'failed' }]
    matrix.sendFile.mockRejectedValueOnce(new Error('offline'))
    await api.retryMedia('!c:host', 'local-old')
    expect(payload).toMatchObject({ txnId: 'm1.1' })
    matrix.makeTxnId.mockImplementation(() => 'm2.2')
    try {
      await api.retryMedia('!c:host', 'local-old')
    } finally {
      matrix.makeTxnId.mockImplementation(() => 'm1.1')
    }
    expect(matrix.sendFile.mock.calls.map((c) => (c[1] as { txnId?: string }).txnId)).toEqual([
      'm1.1',
      'm1.1',
    ])
  })

  it('повтор без вложения (текст, чужое) — не наше дело, false', async () => {
    const { api, messages } = setup()
    messages['!c:host'] = [{ id: '~t', type: 'text', status: 'failed' }]
    expect(await api.retryMedia('!c:host', '~t')).toBe(false)
    expect(messages['!c:host']![0]!.status).toBe('failed')
  })

  it('слишком большой файл отбрасывается до любых сетевых вызовов', async () => {
    const { api, messages } = setup()
    const big = { size: 26 * 1024 * 1024, type: 'application/zip' } as Blob
    await api.sendFile('!c:host', big)
    expect(matrix.getRoom).not.toHaveBeenCalled()
    expect(messages['!c:host']).toBeUndefined()
  })

  // ─── Открытые группы: вложения без шифрования, как у прежнего клиента ──────

  const members = (n: number) => Array.from({ length: n }, (_, i) => `@u${i}:host`)

  it('публичная группа: фото уходит как есть, без ключей', async () => {
    chat.direct = false
    room.getJoinRule.mockReturnValue('public')
    const { api, chatCrypto } = setup(members(3))
    const file = new Blob(['img'], { type: 'image/png' })
    await api.sendImage('!c:host', file)
    const data = matrix.sendImage.mock.calls[0]![1] as Record<string, unknown>
    expect(data.blob).toBe(file)
    expect(data.size).toBe(file.size)
    expect(data).not.toHaveProperty('secrets')
    expect(data).not.toHaveProperty('block')
    expect(encryptBlobWithRandomKey).not.toHaveBeenCalled()
    expect(chatCrypto.collectPcryptoUsers).not.toHaveBeenCalled()
  })

  it('группа от 50 участников: файл и видео уходят открыто', async () => {
    chat.direct = false
    const { api } = setup(members(50))
    const file = new Blob(['f'])
    await api.sendFile('!c:host', file, { name: 'a.txt' })
    await api.sendVideo('!c:host', file)
    const sentFile = matrix.sendFile.mock.calls[0]![1] as Record<string, unknown>
    const sentVideo = matrix.sendVideo.mock.calls[0]![1] as Record<string, unknown>
    expect(sentFile.blob).toBe(file)
    expect(sentFile).not.toHaveProperty('secrets')
    expect(sentVideo.blob).toBe(file)
    expect(sentVideo).not.toHaveProperty('secrets')
    expect(encryptBlobWithRandomKey).not.toHaveBeenCalled()
  })

  it('публичная группа: голосовое уходит открыто', async () => {
    chat.direct = false
    room.getJoinRule.mockReturnValue('public')
    const { api } = setup(members(3))
    const voice = new Blob(['a'], { type: 'audio/webm' })
    await api.sendAudio('!c:host', voice, { duration: 3 })
    const data = matrix.sendAudio.mock.calls[0]![1] as Record<string, unknown>
    expect(data.blob).toBe(voice)
    expect(data).toMatchObject({ duration: 3, size: voice.size, mimetype: 'audio/webm' })
    expect(data).not.toHaveProperty('secrets')
    expect(encryptAudioBlob).not.toHaveBeenCalled()
  })

  it('закрытая группа до 50 участников: вложения по-прежнему шифруются', async () => {
    chat.direct = false
    const { api, chatCrypto } = setup(members(49))
    await api.sendFile('!c:host', new Blob(['f']), { name: 'a.txt' })
    await api.sendAudio('!c:host', new Blob(['a']), { duration: 1 })
    expect(matrix.sendFile).toHaveBeenCalledWith(
      '!c:host',
      expect.objectContaining({ block: 42, secrets: { wrapped: true } }),
      expect.any(Function)
    )
    // Голосовое группы — блок от текущей высоты.
    expect(chatCrypto.pcryptoService.value.encryptKey).toHaveBeenCalledWith('S', [], 100, 2)
  })
})
