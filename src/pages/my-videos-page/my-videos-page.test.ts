// «Мои видео» как раздел «Контент» студии YouTube: «Загрузить видео» открывает
// окно загрузки, свои ролики с серверов — с «Создать пост»; не вошли —
// приглашение войти; на компьютере — сжатые копии с кнопкой «Загрузить».

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
  getVideoBlob: vi.fn(async () => new Blob(['x'], { type: 'video/mp4' })),
  localVideos: [] as unknown[],
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
vi.mock('@/b-components/video-uploader/composables/use-video-manager', () => ({
  useVideoManager: () => ({
    videos: ref(mocks.localVideos),
    isLoadingVideos: ref(false),
    selectedVideo: ref(null),
    videoUrl: ref(null),
    infoVideo: ref(null),
    isInfoModalOpen: ref(false),
    deleteVideo: ref(null),
    isDeleteModalOpen: ref(false),
    loadVideos: vi.fn(),
    playVideo: vi.fn(),
    showVideoInfo: vi.fn(),
    closeVideoInfo: vi.fn(),
    confirmDelete: vi.fn(),
    deleteVideoConfirm: vi.fn(),
    cancelDelete: vi.fn(),
    downloadVideo: vi.fn(),
    closePlayer: vi.fn(),
  }),
}))
vi.mock('@/b-components/video-studio/use-open-composer-with-video', () => ({
  useOpenComposerWithVideo: () => mocks.openComposer,
}))
vi.mock('@/db/apis/transcoded-video-api', () => ({
  transcodedVideoAPI: { getVideoBlob: mocks.getVideoBlob },
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
    mocks.localVideos = []
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

  it('«Загрузить видео» открывает окно загрузки; в вебе сжатых копий нет', async () => {
    await mountPage()
    await button('Загрузить видео')!.trigger('click')
    expect(useVideoUploadsStore().dialogOpen).toBe(true)
    expect(wrapper!.text()).not.toContain('Сжатые на этом компьютере')
  })

  it('на компьютере сжатую копию можно загрузить на видеосервер — уже без сжатия', async () => {
    mocks.desktop = true
    mocks.localVideos = [
      {
        id: 'video_1',
        originalFileName: 'Отпуск.mov',
        resolution: '720p',
        mimeType: 'video/mp4',
      },
    ]
    await mountPage()
    expect(wrapper!.text()).toContain('Сжатые на этом компьютере')
    const store = useVideoUploadsStore()
    const start = vi.spyOn(store, 'start').mockReturnValue('job1')
    await wrapper!.find('button[aria-label="Загрузить на видеосервер"]').trigger('click')
    await flushPromises()
    expect(mocks.getVideoBlob).toHaveBeenCalledWith('video_1')
    const [file, options] = start.mock.calls[0]!
    expect((file as File).name).toBe('Отпуск.mp4')
    expect(options).toEqual({ compress: false })
    expect(store.dialogOpen).toBe(true)
  })
})
