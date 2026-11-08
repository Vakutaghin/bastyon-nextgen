// Голосовое зашифрованного чата: волна открывается ключом файла без скачивания
// звука; ключ pcrypto разворачивает один раз — и для волны, и для звука по
// «Слушать»; не развернулся (ключи собеседника ещё не пришли) — пробует снова.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const { matrix, crypto } = vi.hoisted(() => ({
  matrix: { getRoom: vi.fn(() => ({ roomId: '!c:host' })) },
  crypto: {
    openWaveform: vi.fn(async (_sealed: string, _secret: string) => [0.5, 1]),
    decryptAudioBlob: vi.fn(async (_blob: Blob, _secret: string) => new Blob(['plain'])),
  },
}))

vi.mock('../../services/matrix-service', () => ({ matrixService: matrix }))
vi.mock('../../services/encryption-service', () => crypto)

import { useMediaTransfer } from './use-media-transfer'
import type { Message } from '../../types'

function voice(info: Message['info']): Message {
  return {
    id: '$voice',
    chatId: '!c:host',
    senderId: '@bob:host',
    text: '',
    type: 'audio',
    url: 'https://srv/voice',
    info,
    timestamp: 1,
    read: true,
    status: 'sent',
  }
}

function setup(secret: string | null = ' S ') {
  const decryptEvent = vi.fn(async () => secret)
  const api = useMediaTransfer({
    pcryptoService: ref({ decryptEvent }),
    getOrderedMemberIds: () => ['@me:host', '@bob:host'],
    collectPcryptoUsers: async () => [],
  } as never)
  return { api, decryptEvent }
}

beforeEach(() => vi.clearAllMocks())

describe('useMediaTransfer: голосовое зашифрованного чата', () => {
  it('волна — ключом файла; звук потом — без второго разворота ключа', async () => {
    const { api, decryptEvent } = setup()
    const message = voice({ secrets: { keys: 'k' }, waveformEncrypted: 'ab12' })

    expect(await api.decryptVoiceWaveform(message)).toEqual([0.5, 1])
    expect(crypto.openWaveform).toHaveBeenCalledWith('ab12', 'S')
    await api.decryptAudioData(new Blob(['enc']), message)
    expect(crypto.decryptAudioBlob).toHaveBeenLastCalledWith(expect.any(Blob), 'S')
    expect(decryptEvent).toHaveBeenCalledTimes(1)
  })

  it('волны в событии нет — ключ не трогаем', async () => {
    const { api, decryptEvent } = setup()
    expect(await api.decryptVoiceWaveform(voice({ secrets: { keys: 'k' } }))).toBeNull()
    expect(decryptEvent).not.toHaveBeenCalled()
  })

  it('ключ не развернулся — не запоминается, следующий раз пробует снова', async () => {
    const { api, decryptEvent } = setup(null)
    const message = voice({ secrets: { keys: 'k' }, waveformEncrypted: 'ab12' })
    expect(await api.decryptVoiceWaveform(message)).toBeNull()
    await Promise.resolve()
    expect(await api.decryptVoiceWaveform(message)).toBeNull()
    expect(decryptEvent).toHaveBeenCalledTimes(2)
    expect(crypto.openWaveform).not.toHaveBeenCalled()
  })
})
