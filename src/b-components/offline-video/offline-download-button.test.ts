// Кнопка «Скачать» у поста с несколькими записями: скачивает все, показывает,
// сколько готово, и удаляет тоже все; у обычного трека — как раньше.

import { mount } from '@vue/test-utils'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'

import { i18n, setI18nLocale } from '@/i18n'

const h = vi.hoisted(() => ({
  store: null as unknown as Record<string, unknown>,
  mine: {} as Record<string, string>,
  download: vi.fn(),
  downloadAll: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/stores/offline-videos-store', () => ({ useOfflineVideosStore: () => h.store }))
vi.mock('./use-offline-download', async (orig) => ({
  ...(await orig<typeof import('./use-offline-download')>()),
  useOfflineDownload: () => ({
    busy: ref(false),
    batchProgress: ref(null),
    download: h.download,
    downloadAll: h.downloadAll,
  }),
}))
vi.mock('./use-save-offline-file', () => ({ useSaveOfflineFile: () => ({ save: vi.fn() }) }))
vi.mock('./offline-status', () => ({
  offlineFraction: () => 0.5,
  offlinePercent: () => '50%',
  offlineStatusText: () => '',
}))

import OfflineDownloadButton from './offline-download-button.vue'

const part = (n: number) => `peertube://pt.example/u${n}/audio`
const post = (count: number) => ({
  type: 'audio',
  txid: 'tx1',
  title: 'Книга',
  videoUrl: part(1),
  author: { address: 'PA' },
  ...(count > 1
    ? {
        audios: Array.from({ length: count }, (_, i) => ({
          url: part(i + 1),
          title: `Глава ${i + 1}`,
          duration: 60,
        })),
      }
    : {}),
})

const render = (count: number) =>
  mount(OfflineDownloadButton, {
    props: { post: post(count) },
    global: {
      plugins: [i18n],
      provide: { theme: {} },
      stubs: { Dropdown: { template: '<div><slot /><slot name="overlay" /></div>' } },
    },
  })
const button = (w: ReturnType<typeof render>) => w.find('[data-testid="offline-download"]')

beforeAll(async () => {
  await setI18nLocale('ru')
})
beforeEach(() => {
  h.mine = reactive({})
  for (const fn of [h.download, h.downloadAll, h.remove]) fn.mockReset()
  h.store = {
    progress: new Map(),
    remove: h.remove,
    mineFor: (url: string) =>
      h.mine[url]
        ? { id: url, state: { status: h.mine[url], received: 1, total: 2 }, meta: { size: 2 } }
        : null,
  }
})

describe('OfflineDownloadButton', () => {
  it('обычный трек — один, как раньше', async () => {
    const w = render(1)
    await button(w).trigger('click')
    expect(h.download).toHaveBeenCalledWith(expect.objectContaining({ peertubeUrl: part(1) }))
    expect(h.downloadAll).not.toHaveBeenCalled()
  })

  it('аудиокнига — все записи поста сразу', async () => {
    const w = render(3)
    await button(w).trigger('click')
    expect(h.download).not.toHaveBeenCalled()
    const resolve = h.downloadAll.mock.calls[0]![0] as () => Promise<unknown[]>
    expect(await resolve()).toEqual([post(3)])
  })

  it('скачаны не все записи — предлагает скачать остальные', async () => {
    h.mine[part(1)] = 'done'
    const w = render(3)
    expect(button(w).text()).toBe('Скачать')
  })

  it('качается: сколько записей готово; скачаны все — «Скачано»', () => {
    Object.assign(h.mine, {
      [part(1)]: 'done',
      [part(2)]: 'downloading',
      [part(3)]: 'queued',
    })
    expect(button(render(3)).text()).toBe('1/3')
    Object.assign(h.mine, { [part(2)]: 'done', [part(3)]: 'done' })
    expect(button(render(3)).text()).toBe('Скачано')
  })
})
