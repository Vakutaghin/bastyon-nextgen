// «Медиастудия» как раздел «Контент» студии YouTube: «Загрузить» открывает
// окно загрузки, «Обновить» — иконка рядом; свои ролики — с «Создать пост» и
// «Открыть пост» (постов несколько — выбор из списка); пост ждёт блока —
// «Публикуется»; не вошли — приглашение войти. Сжатых копий нет и на компьютере: загруженный ролик — на
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
  publishing: new Set<string>(),
  fetchPost: vi.fn(async (txid: string) => ({ id: txid, title: 'Пост' })),
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
        posts: [{ txid: 'p1', caption: 'Море', time: 1_700_000_000_000 }],
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
        posts: [],
      },
      {
        host: 'pt.host',
        id: 3,
        uuid: 'u3',
        name: 'Лес',
        pointer: 'peertube://pt.host/u3',
        thumbnailUrl: null,
        duration: 30,
        processing: false,
        posted: true,
        posts: [
          { txid: 'p3new', caption: 'Лес весной', time: 1_700_000_100_000 },
          { txid: 'p3old', caption: 'Лес зимой', time: 1_700_000_000_000 },
        ],
      },
    ]),
    loading: ref(false),
    loaded: ref(true),
    failedHosts: ref<string[]>([]),
    signedIn: ref(mocks.signedIn),
    load: mocks.load,
    remove: vi.fn(),
    isPublishing: (video: { uuid: string }) => mocks.publishing.has(video.uuid),
  }),
}))
vi.mock('./fetch-video-post', () => ({ fetchVideoPost: mocks.fetchPost }))
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
    mocks.publishing = new Set()
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
    expect(wrapper!.text()).not.toContain('Море')
    expect(wrapper!.find('button[aria-label="Обновить"]').exists()).toBe(false)
    await button('Войти')!.trigger('click')
    expect(useModalStore().authModal.isOpen).toBe(true)
  })

  it('свои ролики: обработка и «в посте» видно, «Создать пост» берёт ролик и его имя', async () => {
    await mountPage()
    expect(mocks.load).toHaveBeenCalled()
    const text = wrapper!.text()
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
    await button('Загрузить')!.trigger('click')
    expect(useVideoUploadsStore().dialogOpen).toBe(true)
  })

  it('на компьютере только свои ролики — без сжатых копий', async () => {
    mocks.desktop = true
    await mountPage()
    expect(wrapper!.text()).toContain('Море')
    expect(wrapper!.findAll('section')).toHaveLength(1)
  })

  it('«Обновить» — иконка рядом с «Загрузить видео»', async () => {
    await mountPage()
    mocks.load.mockClear()
    await wrapper!.find('button[aria-label="Обновить"]').trigger('click')
    expect(mocks.load).toHaveBeenCalledTimes(1)
  })

  it('пост ещё не в блоке — «Публикуется»; обработка видна рядом с состоянием поста', async () => {
    mocks.publishing = new Set(['u2'])
    await mountPage()
    const card = wrapper!.findAll('li').find((li) => li.text().includes('Горы'))!
    expect(card.text()).toContain('Обрабатывается')
    expect(card.text()).toContain('Публикуется')
    expect(card.text()).not.toContain('Не в посте')
  })

  it('«Открыть пост» открывает пост в окне', async () => {
    await mountPage()
    const card = wrapper!.findAll('li').find((li) => li.text().includes('Море'))!
    await card
      .findAll('button')
      .find((b) => b.text() === 'Открыть пост')!
      .trigger('click')
    await flushPromises()
    expect(mocks.fetchPost).toHaveBeenCalledWith('p1')
    const modal = useModalStore().postModal
    expect(modal.isOpen).toBe(true)
    expect(modal.post).toMatchObject({ id: 'p1' })
  })

  it('постов несколько — выбрать, какой открыть', async () => {
    await mountPage()
    const card = wrapper!.findAll('li').find((li) => li.text().includes('Лес'))!
    expect(card.text()).not.toContain('Открыть пост')
    await card
      .findAll('button')
      .find((b) => b.text() === 'Посты: 2')!
      .trigger('click')
    await flushPromises()
    const items = Array.from(document.body.querySelectorAll('.ant-dropdown-menu-item'))
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Лес весной'),
      expect.stringContaining('Лес зимой'),
    ])
    ;(items[1] as HTMLElement).click()
    await flushPromises()
    expect(mocks.fetchPost).toHaveBeenCalledWith('p3old')
    expect(useModalStore().postModal.isOpen).toBe(true)
  })

  it('пост не открылся — сообщение, окно не открывается', async () => {
    mocks.fetchPost.mockResolvedValueOnce(null as never)
    await mountPage()
    const card = wrapper!.findAll('li').find((li) => li.text().includes('Море'))!
    await card
      .findAll('button')
      .find((b) => b.text() === 'Открыть пост')!
      .trigger('click')
    await flushPromises()
    expect(useModalStore().postModal.isOpen).toBe(false)
  })
})
