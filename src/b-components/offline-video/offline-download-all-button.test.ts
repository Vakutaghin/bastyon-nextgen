// «Скачать всё»: видна, только если на платформе можно скачивать и в списке
// есть ролики; нажатие отдаёт все посты списка; всё уже своё — «Всё скачано»
// или «Всё в «Скачанном»», кнопка не нажимается; не всё показано — не врёт.

import { flushPromises, mount } from '@vue/test-utils'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'

import { i18n, setI18nLocale } from '@/i18n'

const h = vi.hoisted(() => ({
  store: null as unknown as {
    available: boolean
    hydrate: () => Promise<void>
    mineFor: (url?: string) => { state: { status: string } } | null
  },
  mine: new Map<string, string>(),
  downloadAll: vi.fn(),
}))

vi.mock('@/stores/offline-videos-store', () => ({ useOfflineVideosStore: () => h.store }))
vi.mock('./use-offline-download', async (orig) => ({
  ...(await orig<typeof import('./use-offline-download')>()),
  useOfflineDownload: () => ({ batchProgress: ref(null), downloadAll: h.downloadAll }),
}))

import OfflineDownloadAllButton from './offline-download-all-button.vue'

const post = (n: number, type = 'video') => ({
  type,
  txid: `tx${n}`,
  title: `Ролик ${n}`,
  videoUrl: `peertube://h/v${n}`,
  author: { address: 'PA' },
})

function mountButton(props: Record<string, unknown>) {
  return mount(OfflineDownloadAllButton, {
    props: props as never,
    global: { plugins: [i18n], provide: { theme: {} } },
  })
}

describe('OfflineDownloadAllButton', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    h.mine = new Map()
    h.downloadAll.mockReset()
    h.store = reactive({
      available: true,
      hydrate: vi.fn(async () => {}),
      mineFor: (url?: string) => {
        const status = url ? h.mine.get(url) : undefined
        return status ? { state: { status } } : null
      },
    })
  })

  it('нажатие отдаёт все посты списка; свой загрузчик — если показаны не все', async () => {
    const posts = [post(1), post(2), { ...post(3), type: 'share', videoUrl: undefined }]
    const wrapper = mountButton({ posts })
    await flushPromises()
    expect(wrapper.text()).toBe('Скачать всё')
    await wrapper.find('button').trigger('click')
    const resolve = h.downloadAll.mock.calls[0]![0] as () => Promise<unknown[]>
    expect(await resolve()).toEqual(posts)

    const all = vi.fn(async () => posts)
    const partial = mountButton({ posts, resolve: all, complete: false })
    await partial.find('button').trigger('click')
    expect(h.downloadAll.mock.calls[1]![0]).toBe(all)
  })

  it('всё своё: скачано — «Всё скачано», ещё качается — «Всё в «Скачанном»»; кнопка не нажимается', async () => {
    h.mine.set('peertube://h/v1', 'done')
    h.mine.set('peertube://h/v2', 'downloading')
    const wrapper = mountButton({ posts: [post(1), post(2)] })
    expect(wrapper.text()).toBe('Всё в «Скачанном»')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()

    h.mine.set('peertube://h/v2', 'done')
    await wrapper.setProps({ posts: [post(2), post(1)] })
    expect(wrapper.text()).toBe('Всё скачано')

    // Показаны не все — про остальные неизвестно, кнопка остаётся.
    await wrapper.setProps({ complete: false })
    expect(wrapper.text()).toBe('Скачать всё')
  })

  it('скачивать негде или роликов нет — кнопки нет', async () => {
    h.store.available = false
    expect(
      mountButton({ posts: [post(1)] })
        .find('button')
        .exists()
    ).toBe(false)
    h.store.available = true
    expect(
      mountButton({ posts: [post(1, 'share')] })
        .find('button')
        .exists()
    ).toBe(false)
  })
})
