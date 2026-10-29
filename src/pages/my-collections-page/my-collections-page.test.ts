// «Коллекции и плейлисты»: всё своё по группам — публичное (коллекции, видео-
// и аудиоплейлисты) и личное (встроенные списки и личные плейлисты); фильтр;
// «Создать» — редактор, подсказка для коллекции публикаций, окно названия для
// личного; «⋯» у строки — изменить, поделиться, переименовать, удалить с
// подтверждением. Гостю — приглашение войти.

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'

import { i18n, setI18nLocale } from '@/i18n'

const mocks = vi.hoisted(() => ({
  address: 'PMe' as string | null,
  status: 'ready' as string,
  loadAuthor: vi.fn(async () => {}),
  remove: vi.fn(async () => 'sent'),
  dismissFailed: vi.fn(),
  createPlaylist: vi.fn((_kind: string, _name: string) => 'p:new1' as string | null),
  renamePlaylist: vi.fn(() => true),
  deletePlaylist: vi.fn(() => true),
  editorOpen: vi.fn(),
  copy: vi.fn(async () => true),
  toast: { success: vi.fn(), error: vi.fn() },
}))

const collectionsList = ref<Record<string, unknown>[]>([])

vi.mock('@/blockchain', () => ({
  useAuthStore: () => reactive({ getUserAddress: mocks.address }),
}))
vi.mock('@/composables/use-media-library', () => ({
  useMediaLibrary: () => ({
    collections: {
      loadAuthor: mocks.loadAuthor,
      statusOf: () => mocks.status,
      collectionsOf: () => collectionsList.value,
      remove: mocks.remove,
      dismissFailed: mocks.dismissFailed,
    },
    library: {
      ids: (id: string) => ({ 'saved-video': ['a', 'b'], music: [], 'p:trip': ['c'] })[id] ?? [],
      playlists: (kind: string) => (kind === 'video' ? ['p:trip'] : []),
      nameOf: (id: string) => (id === 'p:trip' ? 'Поездки' : ''),
      createPlaylist: mocks.createPlaylist,
      renamePlaylist: mocks.renamePlaylist,
      deletePlaylist: mocks.deletePlaylist,
    },
  }),
}))
vi.mock('@/stores/collection-editor-store', () => ({
  useCollectionEditorStore: () => ({ open: mocks.editorOpen }),
}))
vi.mock('@/b-components/media/add-to-list-modal/use-edits-left', () => ({
  useEditsLeft: () => ({ editsLeft: ref({ t1: 3 }), refresh: vi.fn(async () => {}) }),
}))
vi.mock('@/helpers/common/clipboard', () => ({ copyText: mocks.copy }))
vi.mock('@/b-components/app-toast', () => ({ appToast: mocks.toast }))

import MyCollectionsPage from './my-collections-page.vue'

const view = (over: Record<string, unknown>) => ({
  txid: 't1',
  hash: 'h1',
  address: 'PMe',
  contentTypes: null,
  caption: 'Сезон 1',
  description: '',
  image: '',
  lang: 'ru',
  contentIds: ['x', 'y'],
  settings: {},
  edited: false,
  kind: 'video',
  cover: null,
  ...over,
})

let wrapper: VueWrapper | null = null

async function mountPage(): Promise<void> {
  wrapper = mount(MyCollectionsPage, {
    attachTo: document.body,
    global: {
      plugins: [i18n],
      provide: { theme: {} },
      stubs: { 'router-link': { props: ['to'], template: '<a :href="to"><slot /></a>' } },
    },
  })
  await flushPromises()
}

const rows = () => wrapper!.findAll('[data-testid="shelf-row"]')
const row = (key: string) => wrapper!.find(`[data-testid="shelf-row"][data-key="${key}"]`)
const groupText = (id: string) => wrapper!.find(`[data-testid="shelf-group-${id}"]`).text()
const menuItems = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item'))
const menuItem = (label: string) => menuItems().find((el) => el.textContent?.trim() === label)

async function openRowMenu(key: string): Promise<void> {
  await row(key).find('[data-testid="shelf-row-menu"]').trigger('click')
  await flushPromises()
}

async function openCreate(): Promise<void> {
  await wrapper!.find('[data-testid="shelf-create"]').trigger('click')
  await flushPromises()
}

function confirmButton(label: string): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll<HTMLButtonElement>('.ant-modal button')).find(
    (b) => b.textContent?.trim() === label
  )
}

describe('MyCollectionsPage', () => {
  beforeAll(async () => {
    await setI18nLocale('ru')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.address = 'PMe'
    mocks.status = 'ready'
    collectionsList.value = [
      view({ txid: 't1', kind: 'video', caption: 'Сезон 1' }),
      view({ txid: 't2', kind: 'audio', caption: 'Альбом', contentIds: ['z'] }),
      view({ txid: 't3', kind: 'posts', caption: 'Лучшее', pending: 'edit' }),
    ]
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('гостю — приглашение войти, без списков и «Создать»', async () => {
    mocks.address = null
    await mountPage()
    expect(wrapper!.text()).toContain('Войдите, чтобы видеть и собирать')
    expect(rows()).toHaveLength(0)
    expect(wrapper!.find('[data-testid="shelf-create"]').exists()).toBe(false)
  })

  it('всё своё по группам: публичное по видам, личное — встроенные списки и личные плейлисты', async () => {
    await mountPage()
    expect(mocks.loadAuthor).toHaveBeenCalledWith('PMe')
    expect(groupText('posts')).toContain('Лучшее')
    expect(groupText('posts')).toContain('Публикуется')
    expect(groupText('video')).toContain('Сезон 1')
    expect(groupText('video')).toContain('Видеоплейлист · 2 видео')
    expect(groupText('audio')).toContain('Аудиоплейлист · 1 трек')
    const personal = groupText('private')
    expect(personal).toContain('Сохранённые видео')
    expect(personal).toContain('Личный список · 2 видео')
    expect(personal).toContain('Моя музыка')
    expect(personal).toContain('Поездки')
    expect(row('t1').find('a').attributes('href')).toBe('/collection/t1')
    expect(row('p:trip').find('a').attributes('href')).toBe('/library/p:trip')
    // Встроенный список не переименовать и не удалить — меню у него нет.
    expect(row('saved-video').find('[data-testid="shelf-row-menu"]').exists()).toBe(false)
  })

  it('фильтр: только аудио; счётчики у кнопок', async () => {
    await mountPage()
    expect(wrapper!.find('[data-testid="shelf-filter-all"]').text()).toBe('Все 7')
    await wrapper!.find('[data-testid="shelf-filter-audio"]').trigger('click')
    expect(rows().map((r) => r.attributes('data-key'))).toEqual(['t2'])
    expect(wrapper!.find('[data-testid="shelf-group-private"]').exists()).toBe(false)
  })

  it('коллекций нет — подсказка в группе; не загрузились — «Повторить»', async () => {
    collectionsList.value = []
    mocks.status = 'error'
    await mountPage()
    expect(groupText('video')).toContain('Не удалось загрузить коллекции')
    const retry = wrapper!
      .find('[data-testid="shelf-group-video"]')
      .findAll('button')
      .find((b) => b.text() === 'Повторить')!
    await retry.trigger('click')
    expect(mocks.loadAuthor).toHaveBeenLastCalledWith('PMe', true)
  })

  it('«Создать»: плейлист — редактор, коллекция публикаций — как её собрать, личный — окно названия', async () => {
    await mountPage()
    await openCreate()
    menuItem('Видеоплейлист')!.click()
    expect(mocks.editorOpen).toHaveBeenCalledWith({ mode: 'create', kind: 'video' })

    await openCreate()
    menuItem('Коллекцию публикаций')!.click()
    await flushPromises()
    expect(document.body.textContent).toContain('Пустую коллекцию сеть не примет')
    confirmButton('Понятно')!.click()
    await flushPromises()

    await openCreate()
    menuItem('Личный плейлист аудио')!.click()
    await flushPromises()
    const input = document.body.querySelector<HTMLInputElement>('[data-testid="shelf-name"]')!
    input.value = 'В дорогу'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    confirmButton('Создать')!.click()
    await flushPromises()
    expect(mocks.createPlaylist).toHaveBeenCalledWith('audio', 'В дорогу')
    expect(mocks.toast.success).toHaveBeenCalledWith({ message: 'Плейлист «В дорогу» создан' })
  })

  it('«⋯» у публичной: правок осталось, «Изменить» — редактор, «Поделиться» — ссылка, «Удалить» — после подтверждения', async () => {
    await mountPage()
    await openRowMenu('t1')
    expect(menuItems().map((el) => el.textContent?.trim())).toEqual([
      'Изменить',
      'Осталось правок: 3 из 5',
      'Поделиться',
      'Удалить',
    ])
    menuItem('Изменить')!.click()
    expect(mocks.editorOpen).toHaveBeenCalledWith({ mode: 'edit', kind: 'video', rootTxid: 't1' })

    await openRowMenu('t1')
    menuItem('Поделиться')!.click()
    await flushPromises()
    expect(mocks.copy).toHaveBeenCalledWith(expect.stringContaining('t1'))

    await openRowMenu('t1')
    menuItem('Удалить')!.click()
    await flushPromises()
    expect(document.body.textContent).toContain('Удалить плейлист «Сезон 1»?')
    expect(mocks.remove).not.toHaveBeenCalled()
    confirmButton('Удалить')!.click()
    await flushPromises()
    expect(mocks.remove).toHaveBeenCalledWith('t1', expect.objectContaining({ kind: 'video' }))
  })

  it('своё изменение не в блоке — править и удалять нельзя, только «Поделиться»', async () => {
    await mountPage()
    await openRowMenu('t3')
    expect(menuItems().map((el) => el.textContent?.trim())).toEqual(['Поделиться'])
  })

  it('«⋯» у личного плейлиста: переименовать и удалить после подтверждения', async () => {
    await mountPage()
    await openRowMenu('p:trip')
    menuItem('Переименовать')!.click()
    await flushPromises()
    const input = document.body.querySelector<HTMLInputElement>('[data-testid="shelf-name"]')!
    expect(input.value).toBe('Поездки')
    input.value = 'Поездки 2026'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    confirmButton('Сохранить')!.click()
    await flushPromises()
    expect(mocks.renamePlaylist).toHaveBeenCalledWith('p:trip', 'Поездки 2026')

    await openRowMenu('p:trip')
    menuItem('Удалить')!.click()
    await flushPromises()
    expect(document.body.textContent).toContain('Удалить личный плейлист «Поездки»?')
    confirmButton('Удалить')!.click()
    await flushPromises()
    expect(mocks.deletePlaylist).toHaveBeenCalledWith('p:trip')
  })
})
