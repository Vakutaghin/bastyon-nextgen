// Плашка «Загрузки»: видна на любой странице, пока что-то грузится или только
// что загрузилось и окно свёрнуто; строка открывает окно этой загрузки,
// «Создать пост» — у загруженных; закрыть — законченные уходят.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({ openComposer: vi.fn() }))

vi.mock('./use-open-composer-with-video', () => ({
  useOpenComposerWithVideo: () => mocks.openComposer,
}))
vi.mock('@/blockchain/store/auth-store', () => ({
  useAuthStore: () => ({ getKeyPair: { privateKey: 'k' }, getUserAddress: 'PMe' }),
}))

import { useVideoUploadsStore } from '@/stores/video-uploads-store'
import UploadsPanel from './uploads-panel.vue'

let wrapper: VueWrapper | null = null
const RESULT = { pointer: 'peertube://pt.host/u2', host: 'pt.host', uuid: 'u2', isAudio: false }

const text = (): string => wrapper?.text().replace(/\s+/g, ' ') ?? ''
const button = (label: string): HTMLButtonElement | undefined =>
  wrapper?.findAll('button').find((b) => b.text().trim() === label)?.element as
    | HTMLButtonElement
    | undefined

function mountPanel(): void {
  wrapper = mount(UploadsPanel, {
    attachTo: document.body,
    global: { plugins: [i18n], provide: { theme: {} } },
  })
}

describe('UploadsPanel', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('загрузок нет или окно открыто — плашки нет', async () => {
    const store = useVideoUploadsStore()
    mountPanel()
    expect(wrapper!.find('section').exists()).toBe(false)
    store.setDepsForTests({ upload: () => new Promise(() => {}) })
    const id = store.start(new File(['x'], 'a.mp4', { type: 'video/mp4' }))!
    store.openDialog(id)
    await flushPromises()
    expect(wrapper!.find('section').exists()).toBe(false)
    store.closeDialog()
    await flushPromises()
    expect(wrapper!.find('section').exists()).toBe(true)
  })

  it('сжатие второго видео ждёт, пока FFmpeg занят первым', async () => {
    const store = useVideoUploadsStore()
    const starts: (() => void)[] = []
    store.setDepsForTests({
      compress: (_f, o) =>
        new Promise<File>(() => {
          starts.push(() => o.onStart?.())
        }),
    })
    store.start(new File(['x'], 'Первое.mov', { type: 'video/quicktime' }), { compress: true })
    store.start(new File(['x'], 'Второе.mov', { type: 'video/quicktime' }), { compress: true })
    starts[0]!()
    mountPanel()
    await flushPromises()
    const rows = wrapper!.findAll('li').map((row) => row.findAll('span').map((s) => s.text()))
    expect(rows[0]).toEqual(['Второе', 'В очереди на сжатие'])
    expect(rows[1]![1]).toMatch(/^Сжатие: 0\s?%$/)
  })

  it('идёт загрузка и одна готова: заголовок, проценты, «Создать пост» у готовой', async () => {
    const store = useVideoUploadsStore()
    store.setDepsForTests({ upload: vi.fn().mockResolvedValue(RESULT), rename: vi.fn() })
    store.start(new File(['x'], 'Готовое.mp4', { type: 'video/mp4' }))
    await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('done'))
    store.setDepsForTests({ upload: () => new Promise(() => {}) })
    store.start(new File(['x'], 'Грузится.mp4', { type: 'video/mp4' }))
    store.jobs[0]!.progress = 30
    mountPanel()
    await flushPromises()
    expect(text()).toContain('Загружается: 1')
    const rows = wrapper!.findAll('li').map((row) => row.findAll('span').map((s) => s.text()))
    expect(rows[0]![0]).toBe('Грузится')
    expect(rows[0]![1]).toMatch(/^Загрузка: 30\s?%$/)
    expect(rows[1]!.slice(0, 2)).toEqual(['Готовое', 'Загружено'])

    button('Создать пост')!.click()
    await flushPromises()
    expect(mocks.openComposer).toHaveBeenCalledWith({ pointer: RESULT.pointer, title: 'Готовое' })
    expect(store.jobs.map((j) => j.title)).toEqual(['Грузится'])
  })

  it('строка открывает окно своей загрузки; «Закрыть» убирает законченные', async () => {
    const store = useVideoUploadsStore()
    store.setDepsForTests({ upload: vi.fn().mockResolvedValue(RESULT), rename: vi.fn() })
    const id = store.start(new File(['x'], 'a.mp4', { type: 'video/mp4' }))!
    await vi.waitFor(() => expect(store.jobs[0]!.status).toBe('done'))
    mountPanel()
    await flushPromises()
    expect(text()).toContain('Загрузки завершены')
    await wrapper!.find('li button').trigger('click')
    expect(store.dialogOpen).toBe(true)
    expect(store.dialogJobId).toBe(id)

    store.closeDialog()
    await flushPromises()
    await wrapper!.find('button[aria-label="Закрыть"]').trigger('click')
    expect(store.jobs).toHaveLength(0)
    expect(wrapper!.find('section').exists()).toBe(false)
  })

  it('во время загрузки вкладку не закрыть молча', async () => {
    const store = useVideoUploadsStore()
    store.setDepsForTests({ upload: () => new Promise(() => {}) })
    mountPanel()
    const idle = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(idle)
    expect(idle.defaultPrevented).toBe(false)
    store.start(new File(['x'], 'a.mp4', { type: 'video/mp4' }))
    const busy = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(busy)
    expect(busy.defaultPrevented).toBe(true)
  })
})
