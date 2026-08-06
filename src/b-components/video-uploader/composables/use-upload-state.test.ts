import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── моки тяжёлых зависимостей: сам транскодер и хранилище управляемы из теста ──
const {
  _getMetadata,
  _transcode,
  _getTranscoderInfo,
  _destroy,
  _canSave,
  _autoCleanup,
  _saveWithCleanup,
} = vi.hoisted(() => ({
  _getMetadata: vi.fn(),
  _transcode: vi.fn(),
  _getTranscoderInfo: vi.fn(),
  _destroy: vi.fn(),
  _canSave: vi.fn(),
  _autoCleanup: vi.fn(),
  _saveWithCleanup: vi.fn(),
}))

vi.mock('../transcoder', () => ({
  transcoder: {
    getMetadata: _getMetadata,
    transcode: _transcode,
    getTranscoderInfo: _getTranscoderInfo,
    destroy: _destroy,
  },
}))
vi.mock('../utils', () => ({
  storageManager: {
    canSave: _canSave,
    autoCleanup: _autoCleanup,
    saveWithCleanup: _saveWithCleanup,
  },
}))
vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('ant-design-vue', () => ({ message: { info: vi.fn() } }))

import { useUploadState } from './use-upload-state'

const metadata = {
  width: 640,
  height: 480,
  duration: 10,
  fps: 30,
  hasAudio: false,
  videoBitrate: 1000,
}
const result = {
  blob: new Blob(['x']),
  resolution: '480p',
  videoBitrate: 1000,
  hasAudio: false,
  duration: 10,
  width: 640,
  height: 480,
  mimeType: 'video/mp4',
  fps: 25,
}
const makeFile = () => new File(['data'], 'v.mp4', { type: 'video/mp4' })
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  vi.clearAllMocks()
  _getMetadata.mockResolvedValue(metadata)
  _getTranscoderInfo.mockReturnValue({ method: 'wasm', supported: true })
  _canSave.mockResolvedValue({ canSave: true })
  _saveWithCleanup.mockResolvedValue('video_id')
})

describe('useUploadState — отмена транскода', () => {
  it('нормальный транскод сохраняет и завершается', async () => {
    _transcode.mockResolvedValue(result)
    const s = useUploadState()

    await s.handleFileSelect(makeFile())
    expect(s.uploadState.value).toBe('ready')

    await s.startTranscodingFromReady()
    await flush()

    expect(_saveWithCleanup).toHaveBeenCalledTimes(1)
    expect(s.uploadState.value).toBe('completed')
  })

  it('отмена во время транскода НЕ сохраняет видео и возвращает в idle', async () => {
    let resolveTranscode: (v: unknown) => void = () => {}
    _transcode.mockImplementation(
      () =>
        new Promise((res) => {
          resolveTranscode = res
        })
    )

    const s = useUploadState()
    await s.handleFileSelect(makeFile())

    const run = s.startTranscodingFromReady()
    await flush()
    expect(s.uploadState.value).toBe('transcoding')

    s.cancelTranscoding()
    expect(s.uploadState.value).toBe('idle')
    expect(_destroy).toHaveBeenCalled()

    // Транскод завершается уже ПОСЛЕ отмены — результат должен быть отброшен.
    resolveTranscode(result)
    await run
    await flush()

    expect(_saveWithCleanup).not.toHaveBeenCalled()
    expect(s.uploadState.value).toBe('idle')
    expect(s.uploadError.value).toBeNull()
  })

  it('новый транскод после отмены сохраняется (нет cross-run загрязнения)', async () => {
    let resolveOld: (v: unknown) => void = () => {}
    _transcode.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveOld = res
        })
    )

    const s = useUploadState()
    await s.handleFileSelect(makeFile())
    const oldRun = s.startTranscodingFromReady()
    await flush()

    s.cancelTranscoding()

    // Второй заход завершается сразу.
    _transcode.mockResolvedValueOnce(result)
    await s.handleFileSelect(makeFile())
    await s.startTranscodingFromReady()
    await flush()

    // Поздно резолвим отменённый первый run — он не должен ничего сохранить.
    resolveOld(result)
    await oldRun
    await flush()

    expect(_saveWithCleanup).toHaveBeenCalledTimes(1)
  })
})
