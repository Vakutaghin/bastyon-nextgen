// Загрузки видео живут в сторе, а не в окне: идут, пока человек ходит по
// приложению; сжатие на компьютере — шагом перед загрузкой; отмена, повтор с
// места обрыва; название, дописанное во время загрузки, уходит на сервер.

import type { CompressOutcome } from '@/b-components/video-studio/compress-for-upload'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { getKeyPair: { privateKey: 'k' } as unknown, getUserAddress: 'PMe' as string | null },
  openAuthModal: vi.fn(),
  ensureToken: vi.fn(async () => ({ access_token: 'AT' })),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  track: vi.fn(),
}))

vi.mock('@/services/peertube/peertube-videos', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/peertube/peertube-videos')>()),
  // Обложка от видеосервера — без сети.
  getInstanceVideoCover: vi.fn(async () => null),
}))
vi.mock('@/i18n', () => ({
  t: (k: string) => k,
  i18n: { global: { locale: { value: 'ru' } } },
}))
vi.mock('@/blockchain/store/auth-store', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('./modal-store', () => ({ useModalStore: () => ({ openAuthModal: mocks.openAuthModal }) }))
vi.mock('@/b-components/app-toast', () => ({
  appToast: { success: mocks.toastSuccess, error: mocks.toastError, info: vi.fn() },
}))
vi.mock('@/helpers/common/haptics', () => ({ haptic: vi.fn() }))
// Пост в сеть — через deps.send; здесь только чтобы не тянуть блокчейн.
vi.mock('@/b-components/content/post-composer/post-sender', () => ({ sendPost: vi.fn() }))
vi.mock('@/b-components/content/post-composer/pending-post', () => ({
  trackPendingPost: mocks.track,
}))
vi.mock('@/services/peertube/peertube-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/peertube/peertube-auth')>()),
  buildPeertubeSignature: () => ({ signature: 'sig' }),
  ensurePeertubeToken: mocks.ensureToken,
}))

import { PeertubeUploadError } from '@/services/peertube/peertube-upload'
import { validatePost } from '@/b-components/content/post-composer/validate-post'
import { COVER_WAIT_MS, useVideoUploadsStore } from './video-uploads-store'

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
      return { file: compressed, skipped: null }
    })
    const up = controllableUpload()
    store.setDepsForTests({ upload: up.upload as never, compress, rename: vi.fn() })
    store.start(file('Отпуск 2026.mov'), { compress: true })
    expect(store.jobs[0]!.status).toBe('compressing')
    await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('uploading'))
    expect(up.upload.mock.calls[0]![0]).toMatchObject({ file: compressed })
    expect(store.jobs[0]!.compressSkipped).toBeNull()
  })

  it('сжимать не стоило — грузится исходный файл, причина видна', async () => {
    const store = useVideoUploadsStore()
    const original = file('Кот.mp4', 10)
    const compress = vi.fn(async (f: File) => ({ file: f, skipped: 'small' as const }))
    const up = controllableUpload()
    store.setDepsForTests({ upload: up.upload as never, compress, rename: vi.fn() })
    store.start(original, { compress: true })
    await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('uploading'))
    expect(up.upload.mock.calls[0]![0]).toMatchObject({ file: original })
    expect(store.jobs[0]!.compressSkipped).toBe('small')
  })

  it('отмена: загрузка прерывается и пропадает из списка; во время сжатия — сжатие этого видео', async () => {
    const store = useVideoUploadsStore()
    const up = controllableUpload()
    const compress = vi.fn(
      (_f: File, _o: { signal: AbortSignal }) => new Promise<CompressOutcome>(() => {})
    )
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
        new Promise<CompressOutcome>(() => {
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
    const compress = vi.fn(async () => ({ file: file('a.mp4', 5), skipped: null }))
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

  it('обложка: первый кадр по умолчанию, уходит на сервер, когда видео загружено', async () => {
    const store = useVideoUploadsStore()
    const up = controllableUpload()
    const saveCover = vi.fn(async () => {})
    const frame = new Blob(['first'], { type: 'image/jpeg' })
    store.setDepsForTests({
      upload: up.upload as never,
      rename: vi.fn(),
      firstFrame: async () => frame,
      saveCover,
    })
    const id = store.start(file())!
    await vi.waitFor(() => expect(store.jobs[0]!.cover?.source).toBe('first'))
    expect(store.jobs[0]!.cover?.status).toBe('pending')
    expect(store.fileOf(id)?.name).toBe('Отпуск 2026.mp4')
    expect(saveCover).not.toHaveBeenCalled()

    up.finish()
    await vi.waitFor(() => expect(store.jobs[0]!.cover?.status).toBe('saved'))
    expect(saveCover).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'pt.host', uuid: 'uuid1', address: 'PMe' })
    )
  })

  it('обложку выбрали во время загрузки — сервер получает её, а не первый кадр', async () => {
    const store = useVideoUploadsStore()
    const up = controllableUpload()
    const images: string[] = []
    const saveCover = vi.fn(async ({ image }: { image: File }) => {
      images.push(await image.text())
    })
    store.setDepsForTests({
      upload: up.upload as never,
      rename: vi.fn(),
      firstFrame: async () => new Blob(['first']),
      saveCover: saveCover as never,
    })
    const id = store.start(file())!
    await vi.waitFor(() => expect(store.jobs[0]!.cover?.source).toBe('first'))
    store.setCover(id, new Blob(['frame 12']), 'frame', 12)
    up.finish()
    await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('done'))
    await store.commitCover(id)
    expect(images).toEqual(['frame 12'])
    expect(store.jobs[0]!.cover).toMatchObject({ source: 'frame', time: 12, status: 'saved' })
  })

  it('«Медиастудия» узнаёт о ролике, когда обложка уже на сервере, а не раньше', async () => {
    const store = useVideoUploadsStore()
    const up = controllableUpload()
    let saved: () => void = () => {}
    const saveCover = vi.fn(() => new Promise<void>((resolve) => (saved = resolve)))
    const rename = vi.fn(async () => {})
    store.setDepsForTests({
      upload: up.upload as never,
      rename,
      firstFrame: async () => new Blob(['first']),
      saveCover,
    })
    const id = store.start(file())!
    await vi.waitFor(() => expect(store.jobs[0]!.cover?.source).toBe('first'))
    up.finish()
    await vi.waitFor(() => expect(saveCover).toHaveBeenCalledTimes(1))
    // Ролик загружен, но сервер ещё держит свою миниатюру — список не трогаем.
    expect(store.jobs[0]!.status).toBe('done')
    expect(store.serverChanges).toBe(0)

    saved()
    await vi.waitFor(() => expect(store.serverChanges).toBe(1))

    // Другая обложка после загрузки — снова, когда она дошла.
    store.setCover(id, new Blob(['own']), 'image')
    await vi.waitFor(() => expect(saveCover).toHaveBeenCalledTimes(2))
    expect(store.serverChanges).toBe(1)
    saved()
    await vi.waitFor(() => expect(store.serverChanges).toBe(2))

    // Новое название дошло до сервера — тоже.
    store.setTitle(id, 'Сочи, июль')
    await store.commitTitle(id)
    expect(store.serverChanges).toBe(3)
  })

  it('обложка не уходит на сервер — ролик всё равно появляется в списке, не позже чем через COVER_WAIT_MS', async () => {
    vi.useFakeTimers()
    try {
      const store = useVideoUploadsStore()
      const up = controllableUpload()
      const saveCover = vi.fn(() => new Promise<void>(() => {}))
      store.setDepsForTests({
        upload: up.upload as never,
        rename: vi.fn(),
        firstFrame: async () => new Blob(['first']),
        saveCover,
      })
      store.start(file())
      await vi.waitFor(() => expect(store.jobs[0]!.cover?.source).toBe('first'))
      up.finish()
      await vi.waitFor(() => expect(saveCover).toHaveBeenCalledTimes(1))
      // waitFor с поддельными часами сам двигает их понемногу — запас в секунду.
      await vi.advanceTimersByTimeAsync(COVER_WAIT_MS - 1_000)
      expect(store.serverChanges).toBe(0)
      await vi.advanceTimersByTimeAsync(1_000)
      expect(store.serverChanges).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('у звука кадров нет: своя картинка уходит на сервер, а без неё видна обложка сервера', async () => {
    const store = useVideoUploadsStore()
    const up = controllableUpload()
    const firstFrame = vi.fn(async () => null)
    const saveCover = vi.fn(async () => {})
    const serverCover = vi.fn(async () => 'https://pt.host/lazy-static/previews/art.jpg')
    store.setDepsForTests({
      upload: up.upload as never,
      rename: vi.fn(),
      firstFrame,
      saveCover,
      serverCover,
    })
    const id = store.start(new File(['x'], 'song.mp3', { type: 'audio/mpeg' }))!
    expect(store.jobs[0]!.cover).toMatchObject({ audio: true, status: 'none' })
    expect(firstFrame).not.toHaveBeenCalled()

    up.finish({ ...RESULT, isAudio: true })
    await vi.waitFor(() => expect(store.jobs[0]!.cover?.source).toBe('server'))
    expect(store.jobs[0]!.cover?.url).toBe('https://pt.host/lazy-static/previews/art.jpg')
    expect(serverCover).toHaveBeenCalledWith({ host: 'pt.host', id: 'uuid1' })
    expect(saveCover).not.toHaveBeenCalled()

    store.setCover(id, new Blob(['album art']), 'image')
    await store.commitCover(id)
    expect(saveCover).toHaveBeenCalledTimes(1)
    expect(store.jobs[0]!.cover).toMatchObject({ source: 'image', status: 'saved' })
  })

  it('файл без MIME оказался звуком — сервер говорит об этом, кадров больше не ищем', async () => {
    const store = useVideoUploadsStore()
    const up = controllableUpload()
    const saveCover = vi.fn(async () => {})
    store.setDepsForTests({
      upload: up.upload as never,
      rename: vi.fn(),
      firstFrame: async () => null,
      saveCover,
      serverCover: async () => null,
    })
    const id = store.start(new File(['x'], 'song.flac'))!
    expect(store.jobs[0]!.cover?.audio).toBe(false)
    up.finish({ ...RESULT, isAudio: true })
    await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('done'))
    expect(store.jobs[0]!.cover?.audio).toBe(true)
    await store.commitCover(id)
    expect(saveCover).not.toHaveBeenCalled()
  })

  it('сменили аккаунт посреди сжатия: ролик уходит в канал начавшего, новому не виден', async () => {
    const store = useVideoUploadsStore()
    let compressed: (o: CompressOutcome) => void = () => {}
    const compress = vi.fn(() => new Promise<CompressOutcome>((resolve) => (compressed = resolve)))
    const up = controllableUpload()
    const rename = vi.fn(async () => {})
    store.setDepsForTests({ upload: up.upload as never, compress, rename })
    const id = store.start(file('Отпуск.mov'), { compress: true })!
    store.openDialog(id)

    mocks.auth.getKeyPair = { privateKey: 'other' }
    mocks.auth.getUserAddress = 'POther'
    store.attach('POther')
    expect(store.jobs).toHaveLength(0)
    expect(store.dialogOpen).toBe(false)

    compressed({ file: file('Отпуск.mp4', 10), skipped: null })
    await vi.waitFor(() => expect(up.upload).toHaveBeenCalled())
    expect(up.upload.mock.calls[0]![0]).toMatchObject({
      address: 'PMe',
      keyPair: { privateKey: 'k' },
    })
    // Название, дописанное во время загрузки, сервер получает от того же аккаунта.
    store.setTitle(id, 'Отпуск на море')
    up.finish()
    await vi.waitFor(() => expect(rename).toHaveBeenCalled())
    expect(mocks.ensureToken).toHaveBeenCalledWith(expect.objectContaining({ address: 'PMe' }))
    expect(store.jobs).toHaveLength(0)

    // Вернулись на начавший аккаунт — его загрузка снова видна.
    store.attach('PMe')
    expect(store.jobs.map((j) => [j.id, j.status])).toEqual([[id, 'done']])
  })

  it('аккаунт ушёл с устройства — его загрузки отменяются, чужие идут', () => {
    const store = useVideoUploadsStore()
    const up = controllableUpload()
    store.setDepsForTests({ upload: up.upload as never, rename: vi.fn() })
    const mine = store.start(file('Моё.mp4'))!
    mocks.auth.getUserAddress = 'POther'
    store.attach('POther')
    const other = store.start(file('Чужое.mp4'))!

    store.forgetAccount('PMe')
    store.attach('PMe')
    expect(store.jobs.find((j) => j.id === mine)).toBeUndefined()
    store.attach('POther')
    expect(store.jobs.map((j) => j.id)).toEqual([other])

    store.forgetAccount(null)
    expect(store.jobs).toHaveLength(0)
  })

  describe('пост к ролику', () => {
    it('«Опубликовать» во время загрузки — пост уходит сам, когда ролик загрузился', async () => {
      const store = useVideoUploadsStore()
      const up = controllableUpload()
      const send = vi.fn(async () => 'tx1')
      store.setDepsForTests({ upload: up.upload as never, rename: vi.fn(), send })
      const id = store.start(file())!
      // Тег «море» набран, но не добавлен: с постом он тоже уходит.
      store.updatePost(id, { message: ' Смотрите ', tags: ['отпуск'], tagInput: 'Море' })
      store.publish(id)
      expect(store.jobs[0]!.postStatus).toBe('waiting')
      expect(send).not.toHaveBeenCalled()

      up.finish()
      await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          caption: 'Отпуск 2026',
          message: 'Смотрите',
          url: RESULT.pointer,
          tags: ['отпуск', 'море'],
          language: 'ru',
          settings: { f: '0' },
        })
      )
      await vi.waitFor(() => expect(store.jobs).toHaveLength(0))
      expect(mocks.track).toHaveBeenCalledWith(
        expect.objectContaining({ url: RESULT.pointer }),
        'tx1'
      )
      expect(mocks.toastSuccess).toHaveBeenCalled()
    })

    it('ролик уже загружен — пост уходит сразу, но после обложки', async () => {
      const store = useVideoUploadsStore()
      let saved: () => void = () => {}
      const send = vi.fn(async () => 'tx1')
      store.setDepsForTests({
        upload: vi.fn(async () => RESULT) as never,
        rename: vi.fn(),
        send,
        firstFrame: async () => new Blob(['first'], { type: 'image/jpeg' }),
        saveCover: vi.fn(() => new Promise<void>((resolve) => (saved = resolve))),
      })
      const id = store.start(file())!
      await vi.waitFor(() => expect(store.jobs[0]!.cover?.status).toBe('saving'))
      store.updatePost(id, { tags: ['отпуск'] })
      store.openDialog(id)
      store.publish(id)
      await Promise.resolve()
      expect(store.jobs[0]!.postStatus).toBe('sending')
      expect(send).not.toHaveBeenCalled()
      saved()
      await vi.waitFor(() => expect(send).toHaveBeenCalled())
      await vi.waitFor(() => expect(store.dialogOpen).toBe(false))
    })

    it('«Не публиковать» до конца загрузки — ролик загружается, пост не уходит', async () => {
      const store = useVideoUploadsStore()
      const up = controllableUpload()
      const send = vi.fn(async () => 'tx1')
      store.setDepsForTests({ upload: up.upload as never, rename: vi.fn(), send })
      const id = store.start(file())!
      store.updatePost(id, { tags: ['отпуск'] })
      store.publish(id)
      store.cancelPublish(id)
      up.finish()
      await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('done'))
      await Promise.resolve()
      expect(send).not.toHaveBeenCalled()
      expect(store.jobs[0]!.postStatus).toBe('none')
    })

    it('сеть не приняла пост — причина видна, ролик остаётся, «Опубликовать» ещё раз', async () => {
      const store = useVideoUploadsStore()
      const send = vi
        .fn()
        .mockRejectedValueOnce(new Error('Суточный лимит постов исчерпан'))
        .mockResolvedValueOnce('tx2')
      store.setDepsForTests({ upload: vi.fn(async () => RESULT) as never, rename: vi.fn(), send })
      const id = store.start(file())!
      await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('done'))
      store.updatePost(id, { tags: ['отпуск'] })
      store.publish(id)
      await vi.waitFor(() => expect(store.jobs[0]!.postStatus).toBe('error'))
      expect(store.jobs[0]!.postError).toBe('Суточный лимит постов исчерпан')
      expect(mocks.toastError).toHaveBeenCalled()

      store.publish(id)
      await vi.waitFor(() => expect(store.jobs).toHaveLength(0))
      expect(send).toHaveBeenCalledTimes(2)
    })

    it('ролик загрузился под другим аккаунтом — пост ждёт, пока вернутся на автора', async () => {
      const store = useVideoUploadsStore()
      const up = controllableUpload()
      const send = vi.fn(async () => 'tx1')
      store.setDepsForTests({ upload: up.upload as never, rename: vi.fn(), send })
      const id = store.start(file())!
      store.updatePost(id, { tags: ['отпуск'] })
      store.publish(id)

      mocks.auth.getUserAddress = 'POther'
      store.attach('POther')
      up.finish()
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(send).not.toHaveBeenCalled()

      mocks.auth.getUserAddress = 'PMe'
      store.attach('PMe')
      await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
      expect(store.jobs.find((j) => j.id === id)).toBeUndefined()
    })

    it('пока ролик грузится, пост проверяется как видео: без названия и тегов — нельзя', () => {
      const store = useVideoUploadsStore()
      store.setDepsForTests({ upload: (() => new Promise(() => {})) as never })
      const id = store.start(file())!
      expect(store.postFor(id)!.url).toMatch(/^peertube:\/\/uploading\//)
      expect(validatePost(store.postFor(id)!)).toBe('tags')
      store.updatePost(id, { tagInput: 'отпуск' })
      expect(validatePost(store.postFor(id)!)).toBeNull()
      store.updatePost(id, { message: 'Смотрите' })
      store.setTitle(id, '  ')
      expect(validatePost(store.postFor(id)!)).toBe('videoCaption')

      const audio = store.start(new File(['x'], 'Песня.mp3', { type: 'audio/mpeg' }))!
      expect(store.postFor(audio)!.url).toMatch(/\/audio$/)
    })
  })
})
