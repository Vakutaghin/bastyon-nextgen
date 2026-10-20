// «Мои видео» как раздел «Контент» студии YouTube: «Загрузить видео» открывает
// окно загрузки, свои ролики с серверов — с «Создать пост»; не вошли —
// приглашение войти. Сжатых копий нет и на компьютере: загруженный ролик — на
// сервере, а «Повторить» берёт сжатый файл из задачи.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  desktop: false,
  signedIn: true,
  load: vi.fn(),
  openComposer: vi.fn(),
}))

vi.mock('@/b-components/video-uploader/utils/environment', () => ({
  isTauri: () => mocks.desktop,
}))
vi.mock('./use-server-videos', () => ({
  useServerVideos: () => ({
    videos: ref([
      {
        host: 'pt.host',
        id: 1,
        uuid: 'u1',
        name: 'Море',
        pointer: 'peertube://pt.host/u1',
        thumbnailUrl: null,
        duration: 75,
        processing: false,
        posted: true,
      },
      {
        host: 'pt.host',
        id: 2,
        uuid: 'u2',
        name: 'Горы',
        pointer: 'peertube://pt.host/u2',
        thumbnailUrl: null,
        duration: null,
        processing: true,
        posted: false,
      },
    ]),
    loading: ref(false),
    loaded: ref(true),
    failedHosts: ref<string[]>([]),
    signedIn: ref(mocks.signedIn),
    load: mocks.load,
    remove: vi.fn(),
  }),
}))
vi.mock('@/b-components/video-studio/use-open-composer-with-video', () => ({
  useOpenComposerWithVideo: () => mocks.openComposer,
}))
vi.mock('@/blockchain/store/auth-store', () => ({
  useAuthStore: () => ({ getKeyPair: { privateKey: 'k' }, getUserAddress: 'PMe' }),
}))

import { useModalStore } from '@/stores/modal-store'
import { useVideoUploadsStore } from '@/stores/video-uploads-store'
import MyVideosPage from './my-videos-page.vue'

let wrapper: VueWrapper | null = null
const button = (label: string) => wrapper!.findAll('button').find((b) => b.text().trim() === label)

async function mountPage(): Promise<void> {
  wrapper = mount(MyVideosPage, {
    attachTo: document.body,
    global: { plugins: [i18n], provide: { theme: {} } },
  })
  await flushPromises()
}

describe('MyVideosPage', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.desktop = false
    mocks.signedIn = true
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('не вошли — приглашение войти вместо списков', async () => {
    mocks.signedIn = false
    await mountPage()
    expect(wrapper!.text()).toContain('Войдите, чтобы загружать видео')
    expect(wrapper!.text()).not.toContain('На видеосервере')
    await button('Войти')!.trigger('click')
    expect(useModalStore().authModal.isOpen).toBe(true)
  })

  it('свои ролики: обработка и «в посте» видно, «Создать пост» берёт ролик и его имя', async () => {
    await mountPage()
    expect(mocks.load).toHaveBeenCalled()
    const text = wrapper!.text()
    expect(text).toContain('На видеосервере')
    expect(text).toContain('Море')
    expect(text).toContain('В посте')
    expect(text).toContain('Обрабатывается')
    expect(text).toContain('1:15')
    await button('Создать пост')!.trigger('click')
    expect(mocks.openComposer).toHaveBeenCalledWith({
      pointer: 'peertube://pt.host/u1',
      title: 'Море',
    })
  })

  it('«Загрузить видео» открывает окно загрузки', async () => {
    await mountPage()
    await button('Загрузить видео')!.trigger('click')
    expect(useVideoUploadsStore().dialogOpen).toBe(true)
  })

  it('на компьютере только ролики на сервере — без сжатых копий', async () => {
    mocks.desktop = true
    await mountPage()
    expect(wrapper!.text()).toContain('На видеосервере')
    expect(wrapper!.findAll('section')).toHaveLength(1)
  })
})
