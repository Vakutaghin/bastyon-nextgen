// «Скачать» и «Скачать всё»: гость сначала входит, нехватка места — понятная
// ошибка без загрузки, запомненное качество ставит сразу, иначе — лист выбора;
// уже скачанное другим аккаунтом — без вопросов; итог пачки — одним тостом.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { OfflineBatch, OfflineChoice } from '@/stores/offline-videos-store'
import type { OfflineQuality, OfflineSource } from '@/services/offline-video/offline-job'

const m = vi.hoisted(() => ({
  authed: true,
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  requireAuth: vi.fn(),
  store: {
    available: true,
    qualityPref: 'ask' as number | 'ask',
    hydrate: vi.fn(),
    itemFor: vi.fn(),
    claim: vi.fn(),
    prepare: vi.fn(),
    autoQuality: vi.fn(),
    start: vi.fn(),
    openSheet: vi.fn(),
    prepareMany: vi.fn(),
    batchSize: vi.fn(),
    startMany: vi.fn(),
    openBatchSheet: vi.fn(),
  },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
    locale: { value: 'ru' },
  }),
}))
vi.mock('@/b-components/app-toast', () => ({ appToast: m.toast }))
vi.mock('@/composables/use-auth-gate', () => ({ requireAuth: m.requireAuth }))
vi.mock('@/blockchain/store/auth-store', () => ({
  useAuthStore: () => ({
    get isUserAuthenticated() {
      return m.authed
    },
  }),
}))
vi.mock('@/stores/offline-videos-store', () => ({ useOfflineVideosStore: () => m.store }))
vi.mock('@/services/offline-video/offline-source', () => ({
  offlineSourceFromPost: (p: { videoUrl?: string; type?: string; title?: string }) =>
    p.videoUrl?.startsWith('peertube://')
      ? { peertubeUrl: p.videoUrl, kind: p.type, title: p.title ?? '', author: { address: '' } }
      : null,
}))

import { OFFLINE_SPARE_BYTES, useOfflineDownload } from './use-offline-download'

const MB = 1024 * 1024
const SOURCE: OfflineSource = {
  peertubeUrl: 'peertube://v1.example/abc',
  kind: 'video',
  title: 'Ролик',
  author: { address: 'PAuthor' },
}
const q = (height: number, size = 100 * MB): OfflineQuality => ({
  height,
  size,
  fileUrl: `https://v1.example/${height}.mp4`,
})
const choice = (over: Partial<OfflineChoice> = {}): OfflineChoice =>
  ({
    source: SOURCE,
    info: {},
    qualities: [q(360), q(720)],
    free: 10_000 * MB,
    ...over,
  }) as OfflineChoice
const batch = (over: Partial<OfflineBatch> = {}): OfflineBatch => ({
  choices: [choice(), choice()],
  rows: [],
  free: 10_000 * MB,
  claimed: 0,
  skipped: 0,
  ...over,
})

function setup() {
  const scope = effectScope()
  return scope.run(() => useOfflineDownload())!
}

/** Дождаться фоновой работы run()/runMany(): download() её не ждёт. */
const settle = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  m.authed = true
  m.store.available = true
  m.store.qualityPref = 'ask'
  for (const fn of [...Object.values(m.toast), m.requireAuth]) fn.mockReset()
  for (const value of Object.values(m.store)) {
    if (typeof value === 'function' && 'mockReset' in value) value.mockReset()
  }
  m.store.hydrate.mockResolvedValue(undefined)
  m.store.itemFor.mockReturnValue(null)
  m.store.start.mockResolvedValue(undefined)
})

describe('download — один ролик', () => {
  it('гость — сначала вход, загрузка после него', async () => {
    m.authed = false
    const { download } = setup()
    download(SOURCE)
    expect(m.requireAuth).toHaveBeenCalledTimes(1)
    expect(m.store.prepare).not.toHaveBeenCalled()
  })

  it('ничего не скачать (нет ролика в посте) — ничего не происходит', () => {
    const { download } = setup()
    download(null)
    expect(m.store.hydrate).not.toHaveBeenCalled()
  })

  it('где скачивать нельзя (браузер без OPFS) — сказать об этом', async () => {
    m.store.available = false
    const { download } = setup()
    download(SOURCE)
    await settle()
    expect(m.toast.info).toHaveBeenCalledWith({ message: 'offlineVideo.notHere' })
    expect(m.store.prepare).not.toHaveBeenCalled()
  })

  it('уже на устройстве у другого аккаунта — дописать себя без вопросов', async () => {
    const item = { id: 'x' }
    m.store.itemFor.mockReturnValue(item)
    m.store.claim.mockResolvedValue(undefined)
    const { download } = setup()
    download(SOURCE)
    await settle()
    expect(m.store.itemFor).toHaveBeenCalledWith(SOURCE.peertubeUrl)
    expect(m.store.claim).toHaveBeenCalledWith(item)
    expect(m.store.prepare).not.toHaveBeenCalled()
    expect(m.toast.success).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'offlineVideo.started' })
    )
  })

  it('запомненное качество — сразу в очередь', async () => {
    const c = choice()
    m.store.prepare.mockResolvedValue({ kind: 'ready', choice: c })
    m.store.autoQuality.mockReturnValue(q(720))
    const { download, busy } = setup()
    download(SOURCE)
    await settle()
    expect(m.store.start).toHaveBeenCalledWith(c, q(720))
    expect(m.store.openSheet).not.toHaveBeenCalled()
    expect(busy.value).toBe(false)
  })

  it('качество не запомнено — лист выбора', async () => {
    const c = choice()
    m.store.prepare.mockResolvedValue({ kind: 'ready', choice: c })
    m.store.autoQuality.mockReturnValue(null)
    const { download } = setup()
    download(SOURCE)
    await settle()
    expect(m.store.openSheet).toHaveBeenCalledWith(c)
    expect(m.store.start).not.toHaveBeenCalled()
  })

  it('пока готовится — повторное нажатие не запускает вторую загрузку', async () => {
    m.store.prepare.mockReturnValue(new Promise(() => {}))
    const { download, busy } = setup()
    download(SOURCE)
    await settle()
    expect(busy.value).toBe(true)
    download(SOURCE)
    await settle()
    expect(m.store.prepare).toHaveBeenCalledTimes(1)
  })

  it('ролик ещё обрабатывается — сказать, ничего не ставить', async () => {
    m.store.prepare.mockResolvedValue({ kind: 'processing' })
    const { download, busy } = setup()
    download(SOURCE)
    await settle()
    expect(m.toast.info).toHaveBeenCalledWith({ message: 'offlineVideo.processing' })
    expect(m.store.start).not.toHaveBeenCalled()
    expect(busy.value).toBe(false)
  })

  it('сервер не ответил или файлов нет — ошибка', async () => {
    m.store.prepare.mockResolvedValueOnce({ kind: 'unavailable' })
    const { download } = setup()
    download(SOURCE)
    await settle()
    m.store.prepare.mockResolvedValueOnce({ kind: 'ready', choice: choice({ qualities: [] }) })
    download(SOURCE)
    await settle()
    expect(m.toast.error).toHaveBeenCalledTimes(2)
    expect(m.toast.error).toHaveBeenCalledWith({ message: 'offlineVideo.unavailableNow' })
  })
})

describe('begin — место на диске', () => {
  it('места хватает с запасом — ставит в очередь', async () => {
    const { begin } = setup()
    const size = 500 * MB
    const ok = await begin(choice({ free: size + OFFLINE_SPARE_BYTES }), q(720, size))
    expect(ok).toBe(true)
    expect(m.store.start).toHaveBeenCalled()
  })

  it('без запаса в 200 МБ — ошибка с тем, сколько нужно и сколько есть', async () => {
    const { begin } = setup()
    const size = 500 * MB
    const ok = await begin(choice({ free: size + OFFLINE_SPARE_BYTES - 1 }), q(720, size))
    expect(ok).toBe(false)
    expect(m.store.start).not.toHaveBeenCalled()
    const [arg] = m.toast.error.mock.calls[0]!
    expect(arg.message).toBe('offlineVideo.noSpace')
    expect(arg.description).toMatch(/^offlineVideo\.noSpaceHint /)
    expect(arg.description).toContain('"need"')
    expect(arg.description).toContain('"free"')
  })

  it('размер или свободное место неизвестны — не мешает', async () => {
    const { begin } = setup()
    expect(await begin(choice({ free: null }), q(720))).toBe(true)
    expect(await begin(choice({ free: 1 }), q(720, 0))).toBe(true)
  })

  it('очередь не приняла — ошибка, false', async () => {
    m.store.start.mockRejectedValue(new Error('quota'))
    const { begin } = setup()
    expect(await begin(choice(), q(720))).toBe(false)
    expect(m.toast.error).toHaveBeenCalledWith({ message: 'offlineVideo.startFailed' })
  })
})

describe('downloadAll — пачка', () => {
  const posts = [
    { type: 'video', videoUrl: 'peertube://v1.example/a', title: 'A' },
    { type: 'video', videoUrl: 'peertube://v1.example/b', title: 'B' },
    { type: 'text', title: 'без ролика' },
  ]

  it('в описания идут только посты с роликом; ход подготовки виден', async () => {
    const seen: Array<{ done: number; total: number } | null> = []
    m.store.prepareMany.mockImplementation(
      async (_s: unknown, progress: (d: number, t: number) => void) => {
        progress(1, 2)
        seen.push(api.batchProgress.value)
        return batch()
      }
    )
    const api = setup()
    api.downloadAll(async () => posts)
    await settle()
    const [sources] = m.store.prepareMany.mock.calls[0]!
    expect((sources as OfflineSource[]).map((s) => s.peertubeUrl)).toEqual([
      'peertube://v1.example/a',
      'peertube://v1.example/b',
    ])
    expect(seen).toEqual([{ done: 1, total: 2 }])
    expect(api.batchProgress.value).toBeNull()
  })

  it('качество не запомнено — лист выбора для всей пачки', async () => {
    const b = batch()
    m.store.prepareMany.mockResolvedValue(b)
    const { downloadAll } = setup()
    downloadAll(async () => posts)
    await settle()
    expect(m.store.openBatchSheet).toHaveBeenCalledWith(b)
  })

  it('запомненное качество — пачка сразу, итог одним тостом с пропущенными', async () => {
    m.store.qualityPref = 720
    const b = batch({ claimed: 1, skipped: 1 })
    m.store.prepareMany.mockResolvedValue(b)
    m.store.batchSize.mockReturnValue(200 * MB)
    m.store.startMany.mockResolvedValue({ started: 2, failed: 1 })
    const { downloadAll } = setup()
    downloadAll(async () => posts)
    await settle()
    expect(m.store.startMany).toHaveBeenCalledWith(b, 720)
    expect(m.toast.success).toHaveBeenCalledWith({
      message: 'offlineVideo.batchStarted {"n":3}',
      description: 'offlineVideo.batchSkipped {"n":2}',
      key: 'offline-started',
    })
  })

  it('треки — самое маленькое качество без вопросов и «аудио» в тосте', async () => {
    const audio = choice({ source: { ...SOURCE, kind: 'audio' } })
    const b = batch({ choices: [audio] })
    m.store.prepareMany.mockResolvedValue(b)
    m.store.batchSize.mockReturnValue(5 * MB)
    m.store.startMany.mockResolvedValue({ started: 1, failed: 0 })
    const { downloadAll } = setup()
    downloadAll(async () => posts)
    await settle()
    expect(m.store.startMany).toHaveBeenCalledWith(b, 0)
    expect(m.store.openBatchSheet).not.toHaveBeenCalled()
    expect(m.toast.success.mock.calls[0]![0].message).toMatch(/^offlineVideo\.batchStartedAudio/)
    expect(m.toast.success.mock.calls[0]![0].description).toBeUndefined()
  })

  it('на пачку не хватает места — ничего не ставит', async () => {
    m.store.qualityPref = 720
    m.store.prepareMany.mockResolvedValue(batch({ free: 100 * MB }))
    m.store.batchSize.mockReturnValue(1000 * MB)
    const { downloadAll } = setup()
    downloadAll(async () => posts)
    await settle()
    expect(m.store.startMany).not.toHaveBeenCalled()
    expect(m.toast.error.mock.calls[0]![0].message).toBe('offlineVideo.noSpace')
  })

  it('ни одна не встала — ошибка вместо «поставлено 0»', async () => {
    m.store.qualityPref = 720
    m.store.prepareMany.mockResolvedValue(batch())
    m.store.batchSize.mockReturnValue(0)
    m.store.startMany.mockResolvedValue({ started: 0, failed: 2 })
    const { beginMany } = setup()
    expect(await beginMany(batch(), 720)).toBe(false)
    expect(m.toast.error).toHaveBeenCalledWith({ message: 'offlineVideo.batchUnavailable' })
  })

  it('всё уже скачано — «всё на устройстве»; часть у другого аккаунта — итог', async () => {
    m.store.prepareMany.mockResolvedValueOnce(batch({ choices: [] }))
    const { downloadAll } = setup()
    downloadAll(async () => posts)
    await settle()
    expect(m.toast.info).toHaveBeenCalledWith({ message: 'offlineVideo.batchAllDone' })

    m.store.prepareMany.mockResolvedValueOnce(batch({ choices: [], claimed: 2 }))
    downloadAll(async () => posts)
    await settle()
    expect(m.toast.success.mock.calls[0]![0].message).toBe('offlineVideo.batchStarted {"n":2}')
  })

  it('список не загрузился — ошибка, индикатор снят', async () => {
    const api = setup()
    api.downloadAll(async () => {
      throw new Error('network')
    })
    await settle()
    expect(m.toast.error).toHaveBeenCalledWith({ message: 'offlineVideo.startFailed' })
    expect(api.batchProgress.value).toBeNull()
  })

  it('пока пачка готовится — второе нажатие игнорируется; гость — сначала вход', async () => {
    m.store.prepareMany.mockReturnValue(new Promise(() => {}))
    const api = setup()
    api.downloadAll(async () => posts)
    await settle()
    api.downloadAll(async () => posts)
    await settle()
    expect(m.store.prepareMany).toHaveBeenCalledTimes(1)

    m.authed = false
    const guest = setup()
    guest.downloadAll(async () => posts)
    expect(m.requireAuth).toHaveBeenCalledTimes(1)
  })
})
