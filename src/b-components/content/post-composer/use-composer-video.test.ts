import { describe, expect, it, vi } from 'vitest'

import { t } from '@/i18n'
import type { KeyPair } from '@/blockchain/types/keys'
import { QuotaExceededError } from '@/services/peertube/peertube-quota'
import { PeertubeUploadError } from '@/services/peertube/peertube-upload'
import { VideoValidationError } from '@/services/peertube/peertube-validation'
import type { UploadVideoParams } from '@/services/peertube/peertube-video-service'
import {
  describeVideoUploadError,
  titleFromFileName,
  useComposerVideo,
  type UseComposerVideoOptions,
} from './use-composer-video'

const auth = { keyPair: {} as KeyPair, address: 'PAddr' }
const file = (name = 'Отпуск 2026.mp4', size = 1024) => new File([new Uint8Array(size)], name)
const flush = () => new Promise((r) => setTimeout(r, 0))

function setup(overrides: Partial<UseComposerVideoOptions> = {}) {
  const options: UseComposerVideoOptions = {
    getAuth: () => auth,
    getTitle: () => '',
    onUploaded: vi.fn(),
    onRemoved: vi.fn(),
    onAuthRequired: vi.fn(),
    upload: vi.fn(),
    ...overrides,
  }
  return { options, video: useComposerVideo(options) }
}

describe('titleFromFileName', () => {
  it('убирает расширение', () => {
    expect(titleFromFileName('Отпуск 2026.mp4')).toBe('Отпуск 2026')
    expect(titleFromFileName('clip.final.webm')).toBe('clip.final')
    expect(titleFromFileName('без расширения')).toBe('без расширения')
  })
})

describe('useComposerVideo', () => {
  it('загрузка: прогресс, затем указатель и заголовок из имени файла', async () => {
    let finish!: (v: unknown) => void
    const upload = vi.fn((params: UploadVideoParams) => {
      params.onProgress?.({ bytesUploaded: 512, total: 1024, percent: 50 })
      return new Promise((resolve) => (finish = resolve))
    })
    const { options, video } = setup({ upload: upload as never })

    const run = video.start(file())
    expect(video.state.value).toBe('uploading')
    expect(video.percent.value).toBe(50)
    expect(upload.mock.calls[0]![0]).toMatchObject({ name: 'Отпуск 2026', address: 'PAddr' })

    finish({ pointer: 'peertube://h/uuid', host: 'h', uuid: 'uuid', isAudio: false })
    await run
    expect(video.state.value).toBe('done')
    expect(options.onUploaded).toHaveBeenCalledWith({
      pointer: 'peertube://h/uuid',
      isAudio: false,
      title: 'Отпуск 2026',
    })
  })

  it('имя видео на сервере — заголовок поста, если он уже написан', async () => {
    const upload = vi.fn().mockResolvedValue({ pointer: 'p', host: 'h', uuid: 'u', isAudio: true })
    const { video } = setup({ upload, getTitle: () => '  Мой заголовок ' })
    await video.start(file())
    expect(upload.mock.calls[0]![0].name).toBe('Мой заголовок')
    expect(video.isAudio.value).toBe(true)
  })

  it('без входа — просит войти и ничего не грузит', async () => {
    const { options, video } = setup({ getAuth: () => null })
    await video.start(file())
    expect(options.onAuthRequired).toHaveBeenCalled()
    expect(options.upload).not.toHaveBeenCalled()
    expect(video.state.value).toBe('idle')
  })

  it('отмена: сигнал прерван, поздний отказ не превращается в ошибку', async () => {
    let signal!: AbortSignal
    let fail!: (e: unknown) => void
    const upload = vi.fn((params: UploadVideoParams) => {
      signal = params.signal!
      return new Promise((_, reject) => (fail = reject))
    })
    const { options, video } = setup({ upload: upload as never })
    const run = video.start(file())
    video.cancel()
    expect(signal.aborted).toBe(true)
    fail(new PeertubeUploadError('peertube_upload_cancelled', { cancelled: true }))
    await run
    expect(video.state.value).toBe('idle')
    expect(options.onUploaded).not.toHaveBeenCalled()
  })

  it('ошибка → текст и «Повторить» с тем же файлом', async () => {
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new Error('peertube_no_host'))
      .mockResolvedValueOnce({ pointer: 'p', host: 'h', uuid: 'u', isAudio: false })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const picked = file()
    const { video } = setup({ upload })
    await video.start(picked)
    expect(video.state.value).toBe('error')
    expect(video.errorText.value).toBe(t('postComposer.videoErrNoServer'))
    video.retry()
    await flush()
    expect(upload.mock.calls[1]![0].file).toBe(picked)
    expect(video.state.value).toBe('done')
    errSpy.mockRestore()
  })

  it('«Убрать» — видео уходит из поста, панель снова предлагает файл', async () => {
    const upload = vi.fn().mockResolvedValue({ pointer: 'p', host: 'h', uuid: 'u', isAudio: false })
    const { options, video } = setup({ upload })
    await video.start(file())
    video.remove()
    expect(options.onRemoved).toHaveBeenCalled()
    expect(video.state.value).toBe('idle')
  })

  it('заново смонтированная панель видит уже прикреплённое видео', () => {
    const { video } = setup()
    video.restore('peertube://h/uuid/audio')
    expect(video.state.value).toBe('done')
    expect(video.isAudio.value).toBe(true)
  })
})

describe('describeVideoUploadError', () => {
  it.each([
    [new VideoValidationError('video_format_unsupported'), 'postComposer.videoErrFormat'],
    [
      new PeertubeUploadError('peertube_upload_too_large', { status: 413 }),
      'postComposer.videoErrServerSize',
    ],
    [
      new PeertubeUploadError('peertube_upload_unsupported_type', { status: 415 }),
      'postComposer.videoErrFormat',
    ],
    [new Error('peertube_no_host'), 'postComposer.videoErrNoServer'],
    [new Error('peertube_blockchain_auth_401'), 'postComposer.videoErrAuth'],
    [new Error('peertube_no_channel'), 'postComposer.videoErrAuth'],
    [
      new PeertubeUploadError('peertube_chunk_retryable_503', { status: 503 }),
      'postComposer.videoErrNetwork',
    ],
    [new Error('Request timeout'), 'postComposer.videoErrNetwork'],
    [new PeertubeUploadError('peertube_chunk_timeout'), 'postComposer.videoErrNetwork'],
    [new TypeError('Failed to fetch'), 'postComposer.videoErrNetwork'],
    [new Error('something else'), 'postComposer.videoErrGeneric'],
    [new PeertubeUploadError('peertube_no_location'), 'postComposer.videoErrGeneric'],
    [
      new PeertubeUploadError('peertube_chunk_500', { status: 500 }),
      'postComposer.videoErrGeneric',
    ],
  ])('%s', (error, key) => {
    expect(describeVideoUploadError(error)).toBe(t(key))
  })

  it('размер и квота называют числа', () => {
    expect(describeVideoUploadError(new VideoValidationError('video_too_large'))).toContain('4')
    expect(describeVideoUploadError(new QuotaExceededError(100 * 1024 * 1024))).toContain('100')
  })
})
