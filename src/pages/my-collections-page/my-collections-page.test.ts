// «Коллекции и плейлисты»: встроенные списки сверху, ниже один список своих
// плейлистов и коллекций со значками «что внутри» и «кто видит»; фильтры по
// обоим свойствам; «Создать» — одно окно; «⋯» у строки — изменить, поделиться,
// переименовать, сделать личным или публичным, удалить с подтверждением.
// Гостю — приглашение войти.

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
  createPlaylist: vi.fn(
    (_kind: string, _name: string, _items?: string[]) => 'p:new1' as string | null
  ),
  renamePlaylist: vi.fn(() => true),
  deletePlaylist: vi.fn(() => true),
  editorOpen: vi.fn(),
  copy: vi.fn(async () => true),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
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
      replacing: () => false,
    },
    library: {
      favorites: ['f1', 'f2', 'f3'],
      ids: (id: string) => ({ 'watch-later': ['a', 'b'], 'p:trip': ['c'] })[id] ?? [],
      playlists: (kind: string) => (kind === 'video' ? ['p:trip'] : []),
      nameOf: (id: string) => (id === 'p:trip' ? 'Поездки' : ''),
      kindOf: (id: string) => (id === 'p:trip' ? 'video' : null),
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
vi.mock('@/stores/offline-videos-store', () => ({
  useOfflineVideosStore: () => ({ available: true, mine: [{ meta: { kind: 'audio' } }] }),
}))

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
const builtin = (id: string) => wrapper!.find(`[data-testid="shelf-builtin-${id}"]`)
const keys = () => rows().map((r) => r.attributes('data-key'))
const menuItems = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item'))
const menuItem = (label: string) => menuItems().find((el) => el.textContent?.trim() === label)

async function openRowMenu(key: string): Promise<void> {
  await row(key).find('[data-testid="shelf-row-menu"]').trigger('click')
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
      view({ txid: 't2', kind: 'audio', caption: 'Концерт', contentIds: ['z'] }),
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

  it('сверху встроенные: «Избранное», «Смотреть позже», «Скачанное» — со счётом и ссылкой', async () => {
    await mountPage()
    expect(builtin('favorites').text()).toContain('Избранное')
    expect(builtin('favorites').text()).toContain('3')
    expect(builtin('favorites').find('a').attributes('href')).toBe('/?feedMode=favorites')
    expect(builtin('later').find('a').attributes('href')).toBe('/video/later')
    expect(builtin('later').text()).toContain('Только я')
    // Скачано только аудио — туда и ведёт.
    expect(builtin('downloads').find('a').attributes('href')).toBe('/audio/downloads')
    expect(builtin('downloads').text()).toContain('На этом устройстве')
  })

  it('свои — одним списком по названию, у строки что внутри и кто видит', async () => {
    await mountPage()
    expect(mocks.loadAuthor).toHaveBeenCalledWith('PMe')
    expect(keys()).toEqual(['t2', 't3', 'p:trip', 't1'])
    expect(row('t1').text()).toContain('2 видео')
    expect(row('t1').find('[data-testid="shelf-row-visibility"]').text()).toBe('Видят все')
    expect(row('t2').text()).toContain('1 трек')
    expect(row('t3').text()).toContain('Публикуется')
    expect(row('p:trip').find('[data-testid="shelf-row-visibility"]').text()).toBe('Только я')
    expect(row('p:trip').text()).toContain('1 видео')
    expect(row('t1').find('a').attributes('href')).toBe('/collection/t1')
    expect(row('p:trip').find('a').attributes('href')).toBe('/library/p:trip')
    expect(wrapper!.text()).not.toMatch(/альбом/i)
  })

  it('фильтры: что внутри и кто видит, счётчики у кнопок', async () => {
    await mountPage()
    expect(wrapper!.find('[data-testid="shelf-filter-all"]').text()).toBe('Все 4')
    await wrapper!.find('[data-testid="shelf-filter-video"]').trigger('click')
    expect(keys()).toEqual(['p:trip', 't1'])
    expect(wrapper!.find('[data-testid="shelf-visibility-private"]').text()).toBe('Только я 1')
    await wrapper!.find('[data-testid="shelf-visibility-private"]').trigger('click')
    expect(keys()).toEqual(['p:trip'])
    await wrapper!.find('[data-testid="shelf-filter-audio"]').trigger('click')
    expect(rows()).toHaveLength(0)
    expect(wrapper!.text()).toContain('Ничего не нашлось')
  })

  it('своих нет — подсказка; публичные не загрузились — «Повторить»', async () => {
    collectionsList.value = []
    mocks.status = 'error'
    await mountPage()
    expect(wrapper!.text()).toContain('Не удалось загрузить коллекции')
    const retry = wrapper!.findAll('button').find((b) => b.text() === 'Повторить')!
    await retry.trigger('click')
    expect(mocks.loadAuthor).toHaveBeenLastCalledWith('PMe', true)
  })

  it('«Создать» — одно окно; что внутри и кто видит — по выбранным фильтрам', async () => {
    await mountPage()
    await wrapper!.find('[data-testid="shelf-create"]').trigger('click')
    expect(mocks.editorOpen).toHaveBeenLastCalledWith({
      mode: 'create',
      kind: 'video',
      visibility: 'private',
    })
    await wrapper!.find('[data-testid="shelf-filter-posts"]').trigger('click')
    await wrapper!.find('[data-testid="shelf-visibility-public"]').trigger('click')
    await wrapper!.find('[data-testid="shelf-create"]').trigger('click')
    expect(mocks.editorOpen).toHaveBeenLastCalledWith({
      mode: 'create',
      kind: 'posts',
      visibility: 'public',
    })
  })

  it('«⋯» у публичной: правок осталось, изменить, поделиться, сделать личным, удалить после подтверждения', async () => {
    await mountPage()
    await openRowMenu('t1')
    expect(menuItems().map((el) => el.textContent?.trim())).toEqual([
      'Изменить',
      'Осталось правок: 3 из 5',
      'Поделиться',
      'Отправить в чат',
      'Сделать личным',
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
    expect(document.body.textContent).toContain('Удалить «Сезон 1»?')
    expect(mocks.remove).not.toHaveBeenCalled()
    confirmButton('Удалить')!.click()
    await flushPromises()
    expect(mocks.remove).toHaveBeenCalledWith('t1', expect.objectContaining({ kind: 'video' }))
  })

  it('«Сделать личным»: сначала личный список с теми же записями, потом удаление публичной', async () => {
    await mountPage()
    await openRowMenu('t1')
    menuItem('Сделать личным')!.click()
    await flushPromises()
    expect(document.body.textContent).toContain('Сделать «Сезон 1» личным?')
    expect(mocks.createPlaylist).not.toHaveBeenCalled()
    confirmButton('Сделать личным')!.click()
    await flushPromises()
    expect(mocks.createPlaylist).toHaveBeenCalledWith('video', 'Сезон 1', ['x', 'y'])
    expect(mocks.remove).toHaveBeenCalledWith('t1', expect.objectContaining({ kind: 'video' }))
    expect(mocks.toast.success).toHaveBeenCalledWith({ message: '«Сезон 1» теперь личный' })
  })

  it('своё изменение не в блоке — править и удалять нельзя, только «Поделиться»', async () => {
    await mountPage()
    await openRowMenu('t3')
    expect(menuItems().map((el) => el.textContent?.trim())).toEqual(['Поделиться'])
  })

  it('«⋯» у личного: переименовать, сделать публичным — окно «Создать», удалить после подтверждения', async () => {
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
    menuItem('Сделать публичным')!.click()
    expect(mocks.editorOpen).toHaveBeenLastCalledWith({
      mode: 'create',
      kind: 'video',
      kinds: ['video'],
      visibility: 'public',
      lockVisibility: true,
      caption: 'Поездки',
      initialIds: ['c'],
      replaces: 'p:trip',
    })

    await openRowMenu('p:trip')
    menuItem('Удалить')!.click()
    await flushPromises()
    expect(document.body.textContent).toContain('Удалить «Поездки»?')
    confirmButton('Удалить')!.click()
    await flushPromises()
    expect(mocks.deletePlaylist).toHaveBeenCalledWith('p:trip')
  })
})
