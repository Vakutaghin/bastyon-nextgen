// Загрузки видео живут в сторе, а не в окне: идут, пока человек ходит по
// приложению; сжатие на компьютере — шагом перед загрузкой; отмена, повтор с
// места обрыва; название, дописанное во время загрузки, уходит на сервер.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getKeyPair: { privateKey: 'k' } as unknown, getUserAddress: 'PMe' as string | null },
  openAuthModal: vi.fn(),
  ensureToken: vi.fn(async () => ({ access_token: 'AT' })),
}))

vi.mock('@/i18n', () => ({ t: (k: string) => k }))
vi.mock('@/blockchain/store/auth-store', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('./modal-store', () => ({ useModalStore: () => ({ openAuthModal: mocks.openAuthModal }) }))
vi.mock('@/services/peertube/peertube-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/peertube/peertube-auth')>()),
  buildPeertubeSignature: () => ({ signature: 'sig' }),
  ensurePeertubeToken: mocks.ensureToken,
}))

import { PeertubeUploadError } from '@/services/peertube/peertube-upload'
import { useVideoUploadsStore } from './video-uploads-store'

const file = (name = 'Отпуск 2026.mp4', size = 1000) =>
  new File([new Uint8Array(size)], name, { type: 'video/mp4' })

const RESULT = {
  pointer: 'peertube://pt.host/uuid1',
  host: 'pt.host',
  uuid: 'uuid1',
  isAudio: false,
}

/** Загрузка, которую тест отпускает сам. */
function controllableUpload() {
  let finish: (v: typeof RESULT) => void = () => {}
  let fail: (e: unknown) => void = () => {}
  let progress: (p: { percent: number }) => void = () => {}
  const upload = vi.fn(
    (params: { onProgress?: (p: { percent: number }) => void; name?: string }) =>
      new Promise<typeof RESULT>((resolve, reject) => {
        finish = resolve
        fail = reject
        progress = (p) => params.onProgress?.(p)
      })
  )
  return {
    upload,
    finish: (v = RESULT) => finish(v),
    fail: (e: unknown) => fail(e),
    progress: (percent: number) => progress({ percent }),
  }
}

describe('video-uploads-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.auth.getKeyPair = { privateKey: 'k' }
    mocks.auth.getUserAddress = 'PMe'
  })

  it('загрузка идёт в фоне: прогресс, затем указатель для поста', async () => {
    const store = useVideoUploadsStore()
    const up = controllableUpload()
    store.setDepsForTests({ upload: up.upload as never, rename: vi.fn() })
    const id = store.start(file())!
    const job = store.jobs[0]!
    expect(job).toMatchObject({ id, status: 'uploading', title: 'Отпуск 2026', progress: 0 })
    expect(up.upload).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Отпуск 2026', address: 'PMe' })
    )
    // Окно закрыли — загрузка не прерывается.
    store.openDialog(id)
    store.closeDialog()
    up.progress(42.4)
    expect(store.jobs[0]!.progress).toBe(42)
    up.finish()
    await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('done'))
    expect(store.jobs[0]!.result).toEqual(RESULT)
    expect(store.activeJobs).toHaveLength(0)
  })

  it('не вошли — открывается вход, загрузка не начинается', () => {
    mocks.auth.getKeyPair = null
    const store = useVideoUploadsStore()
    const upload = vi.fn()
    store.setDepsForTests({ upload: upload as never })
    expect(store.start(file())).toBeNull()
    expect(mocks.openAuthModal).toHaveBeenCalledWith('login')
    expect(upload).not.toHaveBeenCalled()
  })

  it('сжатие на компьютере — шаг перед загрузкой; грузится сжатый файл', async () => {
    const store = useVideoUploadsStore()
    const compressed = file('Отпуск 2026.mp4', 10)
    const compress = vi.fn(async (_f: File, o: { onProgress: (p: number) => void }) => {
      o.onProgress(50)
      return compressed
    })
    const up = controllableUpload()
    store.setDepsForTests({ upload: up.upload as never, compress, rename: vi.fn() })
    store.start(file('Отпуск 2026.mov'), { compress: true })
    expect(store.jobs[0]!.status).toBe('compressing')
    await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('uploading'))
    expect(up.upload.mock.calls[0]![0]).toMatchObject({ file: compressed })
  })

  it('отмена: загрузка прерывается и пропадает из списка; во время сжатия — сжатие этого видео', async () => {
    const store = useVideoUploadsStore()
    const up = controllableUpload()
    const compress = vi.fn((_f: File, _o: { signal: AbortSignal }) => new Promise<File>(() => {}))
    store.setDepsForTests({ upload: up.upload as never, compress })
    const uploading = store.start(file())!
    const signal = (up.upload.mock.calls[0]![0] as unknown as { signal: AbortSignal }).signal
    store.cancel(uploading)
    expect(signal.aborted).toBe(true)
    expect(store.jobs).toHaveLength(0)

    const compressing = store.start(file(), { compress: true })!
    const other = store.start(file(), { compress: true })!
    store.cancel(compressing)
    expect(compress.mock.calls[0]![1].signal.aborted).toBe(true)
    expect(compress.mock.calls[1]![1].signal.aborted).toBe(false)
    expect(store.jobs.map((j) => j.id)).toEqual([other])
  })

  it('сжатие ждёт очереди, пока FFmpeg занят другим видео', async () => {
    const store = useVideoUploadsStore()
    let begin: () => void = () => {}
    const compress = vi.fn(
      (_f: File, o: { onStart?: () => void }) =>
        new Promise<File>(() => {
          begin = () => o.onStart?.()
        })
    )
    store.setDepsForTests({ upload: controllableUpload().upload as never, compress })
    store.start(file(), { compress: true })
    expect(store.jobs[0]).toMatchObject({ status: 'compressing', waiting: true })
    begin()
    expect(store.jobs[0]!.waiting).toBe(false)
  })

  it('сбой — понятная причина; «Повторить» продолжает тем же файлом, без нового сжатия', async () => {
    const store = useVideoUploadsStore()
    const compress = vi.fn(async () => file('a.mp4', 5))
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce(RESULT)
    store.setDepsForTests({ upload, compress, rename: vi.fn() })
    const id = store.start(file(), { compress: true })!
    await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('error'))
    expect(store.jobs[0]!.error).toBe('postComposer.videoErrNetwork')
    store.retry(id)
    await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('done'))
    expect(compress).toHaveBeenCalledTimes(1)
    expect(upload.mock.calls[1]![0].file).toBe(upload.mock.calls[0]![0].file)
  })

  it('отмена изнутри транспорта — не ошибка', async () => {
    const store = useVideoUploadsStore()
    const up = controllableUpload()
    store.setDepsForTests({ upload: up.upload as never })
    store.start(file())
    up.fail(new PeertubeUploadError('cancelled', { cancelled: true }))
    await Promise.resolve()
    await Promise.resolve()
    expect(store.jobs[0]!.status).toBe('uploading')
  })

  it('название дописали во время загрузки — после неё видео переименовывается на сервере', async () => {
    const store = useVideoUploadsStore()
    const up = controllableUpload()
    const rename = vi.fn(async () => {})
    store.setDepsForTests({ upload: up.upload as never, rename })
    const id = store.start(file())!
    store.setTitle(id, 'Сочи, июль')
    up.finish()
    await vi.waitFor(() =>
      expect(rename).toHaveBeenCalledWith({
        host: 'pt.host',
        id: 'uuid1',
        name: 'Сочи, июль',
        accessToken: 'AT',
      })
    )
    // Имя не менялось — второго запроса нет.
    await store.commitTitle(id)
    expect(rename).toHaveBeenCalledTimes(1)
  })

  it('плашку закрыли: законченные уходят, идущие продолжаются', async () => {
    const store = useVideoUploadsStore()
    const done = controllableUpload()
    store.setDepsForTests({ upload: done.upload as never, rename: vi.fn() })
    store.start(file('a.mp4'))
    done.finish()
    await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('done'))
    const running = controllableUpload()
    store.setDepsForTests({ upload: running.upload as never })
    store.start(file('b.mp4'))
    store.hidePanel()
    expect(store.jobs.map((j) => j.fileName)).toEqual(['b.mp4'])
    expect(store.panelHidden).toBe(true)
  })
})
