// «Медиастудия» как раздел «Контент» студии YouTube: «Загрузить» открывает
// окно загрузки, «Обновить» — иконка рядом; свои ролики — плиткой или
// списком, с поиском, фильтром и порядком; у ролика без поста — «Создать
// пост», в посте — «Открыть пост» (постов несколько — выбор из списка); пост
// ждёт блока — «Публикуется»; обложка и название открывают окно ролика, «⋯» —
// сведения, статистику и удаление; не вошли — приглашение войти. Сжатых копий
// нет и на компьютере: загруженный ролик — на сервере.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  desktop: false,
  signedIn: true,
  load: vi.fn(),
  remove: vi.fn(async () => {}),
  patch: vi.fn(),
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
        description: 'Летом на побережье',
        views: 120,
        isAudio: false,
        time: 3_000,
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
        description: '',
        views: null,
        isAudio: false,
        time: 2_000,
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
        description: 'Тихий лес',
        views: 5,
        isAudio: true,
        time: 1_000,
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
    remove: mocks.remove,
    patch: mocks.patch,
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
// Окно ролика проверяется отдельно: здесь — только что и с чем оно открылось.
vi.mock('./video-details/video-details-modal.vue', () => ({
  default: defineComponent({
    name: 'VideoDetailsModal',
    props: ['video', 'initialTab', 'publishing'],
    emits: ['close', 'changed', 'play', 'open-post', 'create-post', 'remove'],
    setup:
      (props, { emit }) =>
      () =>
        h('div', { class: 'details-stub' }, [
          `${props.video.name}:${props.initialTab}`,
          h('button', { class: 'details-play', onClick: () => emit('play') }, 'play'),
          h('button', { class: 'details-post', onClick: () => emit('open-post', 'p1') }, 'post'),
        ]),
  }),
}))
// Плеер — свой компонент; здесь — какой ролик открылся.
vi.mock('./studio-player-modal.vue', () => ({
  default: defineComponent({
    name: 'StudioPlayerModal',
    props: ['video'],
    emits: ['close'],
    setup: (props) => () => h('div', { class: 'player-stub' }, props.video.name),
  }),
}))

import { useModalStore } from '@/stores/modal-store'
import { useVideoUploadsStore } from '@/stores/video-uploads-store'
import MyVideosPage from './my-videos-page.vue'

let wrapper: VueWrapper | null = null
const button = (label: string) => wrapper!.findAll('button').find((b) => b.text().trim() === label)
const card = (name: string) => wrapper!.findAll('li').find((li) => li.text().includes(name))!
const menuItems = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item'))

async function openMenu(name: string): Promise<HTMLElement[]> {
  await card(name).find('button[aria-label="Ещё"]').trigger('click')
  await flushPromises()
  return menuItems()
}

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
    localStorage.clear()
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

  it('свои ролики: обработка и «в посте» видно, «Создать пост» — у ролика без поста', async () => {
    await mountPage()
    expect(mocks.load).toHaveBeenCalled()
    const text = wrapper!.text()
    expect(text).toContain('Море')
    expect(text).toContain('В посте')
    expect(text).toContain('Обрабатывается')
    expect(text).toContain('1:15')
    expect(text).toContain('3 ролика · 125 просмотров')
    expect(card('Море').text()).not.toContain('Создать пост')
    await card('Горы')
      .findAll('button')
      .find((b) => b.text() === 'Создать пост')!
      .trigger('click')
    expect(mocks.openComposer).toHaveBeenCalledWith({
      pointer: 'peertube://pt.host/u2',
      title: 'Горы',
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

  it('список: описание рядом с названием; выбранный вид запоминается', async () => {
    await mountPage()
    expect(wrapper!.find('ul.grid').exists()).toBe(true)
    await wrapper!.find('button[aria-label="Списком"]').trigger('click')
    expect(wrapper!.find('ul.list').exists()).toBe(true)
    expect(card('Море').text()).toContain('Летом на побережье')
    expect(card('Горы').text()).toContain('Без описания')
    expect(localStorage.getItem('bastyon_media_studio_view')).toBe('list')

    wrapper!.unmount()
    await mountPage()
    expect(wrapper!.find('ul.list').exists()).toBe(true)
    expect(wrapper!.find('button[aria-label="Списком"]').attributes('aria-pressed')).toBe('true')
  })

  it('поиск — по названию, описанию и заголовку поста; ничего нет — «Сбросить»', async () => {
    await mountPage()
    const search = wrapper!.find('input[aria-label="Поиск по названию и описанию"]')
    await search.setValue('побережье')
    expect(wrapper!.findAll('li').map((li) => li.text())).toEqual([expect.stringContaining('Море')])
    await search.setValue('весной')
    expect(wrapper!.findAll('li')).toHaveLength(1)
    expect(card('Лес').exists()).toBe(true)
    await search.setValue('пустыня')
    expect(wrapper!.text()).toContain('Ничего не нашлось.')
    await button('Сбросить поиск и фильтр')!.trigger('click')
    expect(wrapper!.findAll('li')).toHaveLength(3)
  })

  it('аудио помечено на обложке', async () => {
    await mountPage()
    expect(card('Лес').text()).toContain('Аудио')
    expect(card('Море').text()).not.toContain('Аудио')
  })

  it('название и «⋯ → Статистика» открывают окно ролика на нужной вкладке', async () => {
    await mountPage()
    await card('Море').find('button[title="Море"]').trigger('click')
    expect(wrapper!.find('.details-stub').text()).toContain('Море:details')

    const items = await openMenu('Горы')
    items.find((item) => item.textContent?.includes('Статистика'))!.click()
    await flushPromises()
    expect(wrapper!.find('.details-stub').text()).toContain('Горы:stats')
  })

  it('обложка, «⋯ → Смотреть» и кнопка в окне ролика запускают плеер', async () => {
    await mountPage()
    await card('Море').find('button[aria-label="Смотреть «Море»"]').trigger('click')
    expect(wrapper!.find('.player-stub').text()).toBe('Море')
    expect(wrapper!.find('.details-stub').exists()).toBe(false)

    // Ролик в обработке: файлов нет — смотреть нечего, обложка открывает окно ролика.
    const busy = await openMenu('Горы')
    expect(busy.some((item) => item.textContent?.includes('Смотреть'))).toBe(false)
    document.body.click()

    // Аудио — «Слушать».
    const items = await openMenu('Лес')
    items.find((item) => item.textContent?.includes('Слушать'))!.click()
    await flushPromises()
    expect(wrapper!.find('.player-stub').text()).toBe('Лес')

    await card('Море').find('button[title="Море"]').trigger('click')
    await wrapper!.find('.details-play').trigger('click')
    expect(wrapper!.find('.player-stub').text()).toBe('Море')
    // Окно ролика остаётся под плеером.
    expect(wrapper!.find('.details-stub').exists()).toBe(true)
  })

  it('пост из окна ролика открывается не под ним: окно ролика закрывается', async () => {
    await mountPage()
    await card('Море').find('button[title="Море"]').trigger('click')
    await wrapper!.find('.details-post').trigger('click')
    await flushPromises()
    expect(useModalStore().postModal.isOpen).toBe(true)
    expect(wrapper!.find('.details-stub').exists()).toBe(false)
  })

  it('«⋯ → Удалить»: подтверждение называет, что станет с постом, и удаляет', async () => {
    await mountPage()
    const items = await openMenu('Море')
    items.find((item) => item.textContent?.includes('Удалить'))!.click()
    await flushPromises()
    const confirm = document.body.querySelector('.ant-modal-confirm')!
    expect(confirm.textContent).toContain('В постах с ним останется только текст')
    const ok = Array.from(confirm.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Удалить'
    )!
    ok.click()
    await flushPromises()
    expect(mocks.remove).toHaveBeenCalledWith(expect.objectContaining({ uuid: 'u1' }))
  })

  it('ролик в посте: ещё один пост — из «⋯»', async () => {
    await mountPage()
    const items = await openMenu('Море')
    items.find((item) => item.textContent?.includes('Создать пост'))!.click()
    await flushPromises()
    expect(mocks.openComposer).toHaveBeenCalledWith({
      pointer: 'peertube://pt.host/u1',
      title: 'Море',
    })
  })
})
