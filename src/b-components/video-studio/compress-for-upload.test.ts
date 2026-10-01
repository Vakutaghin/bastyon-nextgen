// Сжатие перед загрузкой: FFmpeg у приложения один, поэтому сжатия идут по
// очереди, а отмена гасит FFmpeg, только если он занят именно этим файлом.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMetadata: vi.fn(),
  transcode: vi.fn(),
  destroy: vi.fn(),
  save: vi.fn(async () => undefined),
}))

vi.mock('@/b-components/video-uploader/transcoder', () => ({
  transcoder: {
    getMetadata: mocks.getMetadata,
    transcode: mocks.transcode,
    destroy: mocks.destroy,
    checkFfmpegAvailable: vi.fn(),
  },
}))
vi.mock('@/b-components/video-uploader/utils/storage-manager', () => ({
  storageManager: { saveWithCleanup: mocks.save },
}))

import { compressForUpload } from './compress-for-upload'

type Progress = (p: { progress: number }) => void

const META = { width: 1920, height: 1080, duration: 10, videoBitrate: 8_000_000 }
const file = (name: string) => new File([new Uint8Array(100)], name, { type: 'video/quicktime' })

/** Транскод, который тест завершает сам. */
function heldTranscodes() {
  const runs: { finish: () => void; progress: Progress }[] = []
  mocks.transcode.mockImplementation(
    (_f: File, _o: unknown, onProgress: Progress) =>
      new Promise((resolve) => {
        runs.push({
          progress: onProgress,
          finish: () =>
            resolve({
              blob: new Blob([new Uint8Array(10)], { type: 'video/mp4' }),
              mimeType: 'video/mp4',
              resolution: '1080p',
            }),
        })
      })
  )
  return runs
}

const options = (controller = new AbortController()) => ({
  signal: controller.signal,
  onProgress: vi.fn(),
  onStart: vi.fn(),
})

describe('compressForUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMetadata.mockResolvedValue(META)
  })

  it('сжатия идут по очереди: второе начинается, когда закончилось первое', async () => {
    const runs = heldTranscodes()
    const first = options()
    const second = options()
    const a = compressForUpload(file('a.mov'), first)
    const b = compressForUpload(file('b.mov'), second)

    await vi.waitFor(() => expect(runs).toHaveLength(1))
    expect(first.onStart).toHaveBeenCalledTimes(1)
    expect(second.onStart).not.toHaveBeenCalled()
    runs[0]!.progress({ progress: 40 })
    expect(first.onProgress).toHaveBeenCalledWith(40)
    expect(second.onProgress).not.toHaveBeenCalled()

    runs[0]!.finish()
    expect((await a).name).toBe('a.mp4')
    await vi.waitFor(() => expect(runs).toHaveLength(2))
    expect(second.onStart).toHaveBeenCalledTimes(1)
    runs[1]!.finish()
    expect((await b).name).toBe('b.mp4')
    expect(mocks.save).toHaveBeenCalledTimes(2)
  })

  it('отмена видео в очереди не трогает FFmpeg чужого видео', async () => {
    const runs = heldTranscodes()
    const queued = new AbortController()
    const a = compressForUpload(file('a.mov'), options())
    const b = compressForUpload(file('b.mov'), options(queued))
    await vi.waitFor(() => expect(runs).toHaveLength(1))

    queued.abort()
    expect(mocks.destroy).not.toHaveBeenCalled()
    runs[0]!.finish()
    expect((await a).name).toBe('a.mp4')
    await expect(b).rejects.toMatchObject({ name: 'AbortError' })
    expect(runs).toHaveLength(1)
  })

  it('отмена идущего сжатия останавливает FFmpeg, а очередь идёт дальше', async () => {
    const runs = heldTranscodes()
    const running = new AbortController()
    const a = compressForUpload(file('a.mov'), options(running))
    const b = compressForUpload(file('b.mov'), options())
    await vi.waitFor(() => expect(runs).toHaveLength(1))

    running.abort()
    expect(mocks.destroy).toHaveBeenCalledTimes(1)
    runs[0]!.finish()
    await expect(a).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(runs).toHaveLength(2))
    runs[1]!.finish()
    expect((await b).name).toBe('b.mp4')
  })

  it('отменили до запуска FFmpeg — его гасит первый же отклик прогресса', async () => {
    const runs = heldTranscodes()
    const controller = new AbortController()
    const opts = options(controller)
    const a = compressForUpload(file('a.mov'), opts)
    await vi.waitFor(() => expect(runs).toHaveLength(1))
    controller.abort()
    mocks.destroy.mockClear()

    runs[0]!.progress({ progress: 3 })
    expect(mocks.destroy).toHaveBeenCalledTimes(1)
    expect(opts.onProgress).not.toHaveBeenCalled()
    runs[0]!.finish()
    await expect(a).rejects.toMatchObject({ name: 'AbortError' })
    expect(mocks.save).not.toHaveBeenCalled()
  })
})
