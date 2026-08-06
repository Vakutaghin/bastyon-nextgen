import { describe, it, expect, vi } from 'vitest'
import { uploadVideoToPeertube, type VideoServiceDeps } from './peertube-video-service'
import { PeertubeUploadError } from './peertube-upload'
import { QuotaExceededError } from './peertube-quota'
import { VideoValidationError } from './peertube-validation'
import type { KeyPair } from '@/blockchain/types/keys'

const KEYPAIR = {} as unknown as KeyPair

const TOKEN = {
  access_token: 'AT',
  refresh_token: 'RT',
  expires_in: 9999,
  refresh_token_expires_in: 9999,
  isNewUser: false,
}

const CHANNEL = { channelId: 5, videoQuotaDaily: 1000, videoQuota: -1, username: 'u' }
const UPLOAD_RESULT = { host: 'true.host', uuid: 'VID', isAudio: false }

const file = (name = 'clip.mp4', size = 100): File =>
  ({ name, size, type: 'video/mp4', lastModified: 0 }) as unknown as File

/** Полный набор замоканных шагов; order — для проверки последовательности. */
function buildDeps(order: string[] = []): VideoServiceDeps {
  const track =
    (label: string, ret: unknown) =>
    async (...args: unknown[]) => {
      order.push(label)
      void args
      return ret
    }
  return {
    validate: vi.fn(track('validate', { file: file(), isAudio: false })),
    resolveHost: vi.fn(track('resolveHost', 'host.app')),
    buildSignature: vi.fn(() => {
      order.push('buildSignature')
      return { nonce: 'n', signature: 's', pubkey: 'p', address: 'ADDR', v: 1 }
    }),
    ensureToken: vi.fn(track('ensureToken', TOKEN)),
    getChannel: vi.fn(track('getChannel', CHANNEL)),
    checkQuota: vi.fn(
      track('checkQuota', { allowed: true, remainingDaily: 900, unlimited: false })
    ),
    upload: vi.fn(track('upload', UPLOAD_RESULT)),
    authenticate: vi.fn(track('authenticate', TOKEN)),
    saveToken: vi.fn(() => order.push('saveToken')),
  } as unknown as VideoServiceDeps
}

/** metadata, с которой был вызван upload (типизированный доступ без индекс-варнингов). */
const uploadedMetadata = (deps: VideoServiceDeps): { name: string; channelId: number } => {
  const call = (deps.upload as ReturnType<typeof vi.fn>).mock.calls[0]
  if (!call) throw new Error('upload was not called')
  return (call[0] as { metadata: { name: string; channelId: number } }).metadata
}

const run = (deps: VideoServiceDeps, over: Record<string, unknown> = {}) =>
  uploadVideoToPeertube({
    file: file(),
    keyPair: KEYPAIR,
    address: 'ADDR',
    nowIso: () => '2026-01-01T00:00:00.000Z',
    deps,
    ...over,
  })

describe('uploadVideoToPeertube — happy path', () => {
  it('возвращает указатель; порядок validate→host→auth→channel→quota→upload', async () => {
    const order: string[] = []
    const deps = buildDeps(order)
    const r = await run(deps)

    expect(r).toEqual({
      pointer: 'peertube://true.host/VID',
      host: 'true.host',
      uuid: 'VID',
      isAudio: false,
    })
    expect(order).toEqual([
      'validate',
      'resolveHost',
      'buildSignature',
      'ensureToken',
      'getChannel',
      'checkQuota',
      'upload',
    ])
    // квота проверяется ДО аплоуда
    expect(order.indexOf('checkQuota')).toBeLessThan(order.indexOf('upload'))
  })

  it('аудио → суффикс /audio по результату инстанса', async () => {
    const deps = buildDeps()
    ;(deps.upload as ReturnType<typeof vi.fn>).mockResolvedValue({
      host: 'h',
      uuid: 'A1',
      isAudio: true,
    })
    const r = await run(deps)
    expect(r.pointer).toBe('peertube://h/A1/audio')
    expect(r.isAudio).toBe(true)
  })
})

describe('uploadVideoToPeertube — метаданные (имя)', () => {
  it('имя из params имеет приоритет', async () => {
    const deps = buildDeps()
    await run(deps, { name: '  My Clip  ' })
    const metadata = uploadedMetadata(deps)
    expect(metadata.name).toBe('My Clip')
    expect(metadata.channelId).toBe(5)
  })

  it('нет имени + пустое имя файла → фолбэк PocketVideo:<ISO>', async () => {
    const deps = buildDeps()
    ;(deps.validate as ReturnType<typeof vi.fn>).mockResolvedValue({
      file: file('', 100),
      isAudio: false,
    })
    await run(deps)
    const metadata = uploadedMetadata(deps)
    expect(metadata.name).toBe('PocketVideo:2026-01-01T00:00:00.000Z')
  })

  it('нет имени, но есть имя файла → имя файла', async () => {
    const deps = buildDeps()
    await run(deps)
    const metadata = uploadedMetadata(deps)
    expect(metadata.name).toBe('clip.mp4')
  })
})

describe('uploadVideoToPeertube — invalid_token retry', () => {
  it('401 на аплоуде → полная переавторизация + повтор, saveToken вызван', async () => {
    const deps = buildDeps()
    const upload = deps.upload as ReturnType<typeof vi.fn>
    upload.mockReset()
    upload
      .mockRejectedValueOnce(new PeertubeUploadError('peertube_init_401', { status: 401 }))
      .mockResolvedValueOnce(UPLOAD_RESULT)

    const r = await run(deps)
    expect(r.uuid).toBe('VID')
    expect(deps.authenticate).toHaveBeenCalledTimes(1)
    expect(deps.saveToken).toHaveBeenCalledTimes(1)
    expect(upload).toHaveBeenCalledTimes(2)
  })

  it('не-401 ошибка (422) → без переавторизации, пробрасывается', async () => {
    const deps = buildDeps()
    const upload = deps.upload as ReturnType<typeof vi.fn>
    upload.mockReset()
    upload.mockRejectedValue(new PeertubeUploadError('peertube_chunk_422', { status: 422 }))

    await expect(run(deps)).rejects.toMatchObject({ status: 422 })
    expect(deps.authenticate).not.toHaveBeenCalled()
    expect(upload).toHaveBeenCalledTimes(1)
  })
})

describe('uploadVideoToPeertube — короткие замыкания', () => {
  it('перебор квоты → upload не вызывается', async () => {
    const deps = buildDeps()
    ;(deps.checkQuota as ReturnType<typeof vi.fn>).mockRejectedValue(new QuotaExceededError(-100))
    await expect(run(deps)).rejects.toBeInstanceOf(QuotaExceededError)
    expect(deps.upload).not.toHaveBeenCalled()
  })

  it('ошибка валидации → host/auth/upload не вызываются', async () => {
    const deps = buildDeps()
    ;(deps.validate as ReturnType<typeof vi.fn>).mockRejectedValue(
      new VideoValidationError('video_too_large')
    )
    await expect(run(deps)).rejects.toBeInstanceOf(VideoValidationError)
    expect(deps.resolveHost).not.toHaveBeenCalled()
    expect(deps.upload).not.toHaveBeenCalled()
  })
})
