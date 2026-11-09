// Выбор результата в выпадашке поиска шапки: что попадает в «Недавнее», куда
// уводит роутер (профиль, поиск по тегу/посту, миниаппа), закрытие выпадашки;
// подписи — инициал, аватар, заголовок поста из URL-encoded полей, обрезка.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import type { Router } from 'vue-router'
import type { SearchPost } from '@/types/rpc-responses/search-posts'
import type { SearchUserResult } from '@/types/rpc-responses/search-users'
import type { RemoteAppEntry } from '@/mini-apps/registry/remote-registry'

const mocks = vi.hoisted(() => ({ installFromRemoteEntry: vi.fn() }))

// История поиска персистится в IndexedDB — в тестах держим её в памяти.
vi.mock('@/db/apis/settings-api', () => ({
  settingsAPI: { get: async () => undefined, set: async (key: string) => key },
}))
vi.mock('@/blockchain/store/auth-store', () => ({
  useAuthStore: () => ({ getUserAddress: 'PMe' }),
}))
// Стор миниапп тянет реестр, манифесты и права — здесь важен только факт установки.
vi.mock('@/mini-apps/store/apps-store', () => ({
  useAppsStore: () => ({ installFromRemoteEntry: mocks.installFromRemoteEntry }),
}))

import { t } from '@/i18n'
import { useSearchStore } from '@/stores/search-store'
import { useSearchNavigation } from './use-search-navigation'

let push: ReturnType<typeof vi.fn>
let emitClose: ReturnType<typeof vi.fn>

function setup(query = '') {
  const q = ref(query)
  const nav = useSearchNavigation({ push } as unknown as Router, q, emitClose)
  return { nav, q, store: useSearchStore() }
}

const user = (over: Partial<SearchUserResult> = {}): SearchUserResult => ({
  address: 'PUserAddr',
  ...over,
})

const post = (over: Partial<SearchPost> = {}): SearchPost => ({
  hash: 'h1',
  txid: 'tx1',
  address: 'PAuthor',
  ...over,
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  push = vi.fn()
  emitClose = vi.fn()
})

describe('переходы по выбранному результату', () => {
  it('пользователь — профиль по адресу, в «Недавнем» — ник и аватар', () => {
    const { nav, store } = setup('ali')
    nav.onSelectUser(user({ name: 'alice', i: 'avatarhash' }))
    expect(push).toHaveBeenCalledWith({ name: 'profile', params: { userName: 'PUserAddr' } })
    expect(emitClose).toHaveBeenCalledTimes(1)
    expect(store.recentHistory[0]).toMatchObject({
      kind: 'user',
      value: 'PUserAddr',
      label: 'alice',
      meta: { name: 'alice', avatar: 'avatarhash' },
    })
  })

  it('тег — поиск постов по #тегу, в «Недавнем» — тег без решётки', () => {
    const { nav, store } = setup('кот')
    nav.onSelectTag({ tag: 'котики', count: 5 })
    expect(push).toHaveBeenCalledWith({ path: '/search', query: { q: '#котики', type: 'posts' } })
    expect(store.recentHistory[0]).toMatchObject({ kind: 'tag', value: 'котики' })
    expect(emitClose).toHaveBeenCalled()
  })

  it('пост — поиск постов по запросу с фокусом на выбранном', () => {
    const { nav, store } = setup('  новости!!  ')
    nav.onSelectPost(post())
    // Запрос нормализуется так же, как при Enter: без спецсимволов и пробелов по краям.
    expect(push).toHaveBeenCalledWith({
      path: '/search',
      query: { q: 'новости', type: 'posts', focus: 'tx1' },
    })
    expect(store.recentHistory[0]).toMatchObject({ kind: 'query', value: 'новости' })
    expect(emitClose).toHaveBeenCalled()
  })

  it('пост без txid — фокус по hash', () => {
    const { nav } = setup('x')
    nav.onSelectPost(post({ txid: '' }))
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ focus: 'h1' }) })
    )
  })

  it('миниаппа — регистрируется, запоминается со scope и открывается по id', () => {
    const { nav, store } = setup('игра')
    const entry: RemoteAppEntry = {
      id: 'game/2048 v2',
      name: '2048',
      scope: 'game.example',
      icon: 'https://game.example/icon.png',
    }
    nav.onSelectApp(entry)
    expect(mocks.installFromRemoteEntry).toHaveBeenCalledWith(entry)
    expect(store.recentHistory[0]).toMatchObject({
      kind: 'app',
      value: 'game/2048 v2',
      meta: { scope: 'game.example', name: '2048' },
    })
    expect(push).toHaveBeenCalledWith('/app/game%2F2048%20v2')
    expect(emitClose).toHaveBeenCalled()
  })

  it('«Показать все» — страница поиска нужной вкладки', () => {
    const { nav, store } = setup('bastyon')
    nav.onSeeAll('users')
    expect(push).toHaveBeenCalledWith({ path: '/search', query: { q: 'bastyon', type: 'users' } })
    expect(store.recentHistory[0]).toMatchObject({ kind: 'query', value: 'bastyon' })
  })

  it('«Показать все» с пустым запросом — только закрывает выпадашку', () => {
    const { nav, store } = setup('  !!! ')
    nav.onSeeAll('posts')
    expect(push).not.toHaveBeenCalled()
    expect(emitClose).toHaveBeenCalledTimes(1)
    expect(store.recentHistory).toEqual([])
  })

  it('берётся текущее значение запроса, а не то, что было при создании', () => {
    const { nav, q } = setup('старый')
    q.value = 'новый'
    nav.onSeeAll('tags')
    expect(push).toHaveBeenCalledWith({ path: '/search', query: { q: 'новый', type: 'tags' } })
  })
})

describe('подписи результатов', () => {
  it('инициал — по нику, без ника — по адресу, иначе «?»', () => {
    const { nav } = setup()
    expect(nav.initialOf(user({ name: 'bob' }))).toBe('B')
    expect(nav.initialOf(user({ name: '' }))).toBe('P')
    expect(nav.initialOf({ address: '' } as SearchUserResult)).toBe('?')
    expect(nav.initialOfApp('мессенджер')).toBe('М')
    expect(nav.initialOfApp('')).toBe('?')
  })

  it('аватар: голый хеш достраивается до адреса, без аватара — null', () => {
    const { nav } = setup()
    expect(nav.avatarOf(user({ i: 'hash1' }))).toBe('https://pocketnet.app:8092/i/hash1')
    expect(nav.avatarOf(user({ i: 'https://bastyon.com:8092/i/old' }))).toBe(
      'https://pocketnet.app:8092/i/old'
    )
    expect(nav.avatarOf(user())).toBeNull()
  })

  it('заголовок поста — раскодированный caption, иначе начало текста, иначе txid', () => {
    const { nav } = setup()
    expect(nav.postTitle(post({ c: encodeURIComponent('Привет, мир') }))).toBe('Привет, мир')
    const long = 'я'.repeat(100)
    expect(nav.postTitle(post({ m: encodeURIComponent(long) }))).toBe('я'.repeat(80))
    expect(nav.postTitle(post({ c: '', m: '' }))).toBe('tx1')
    expect(nav.postTitle(post({ txid: '' }))).toBe(t('search.postFallback'))
  })

  it('битая URL-кодировка не роняет заголовок — показывается как есть', () => {
    const { nav } = setup()
    expect(nav.postTitle(post({ c: '100%' }))).toBe('100%')
  })

  it('обрезка: длинное — до max символов вместе с «…», короткое и пустое — как есть', () => {
    const { nav } = setup()
    expect(nav.truncate('abcdef', 4)).toBe('abc…')
    expect(nav.truncate('abcdef', 4)).toHaveLength(4)
    expect(nav.truncate('abcd', 4)).toBe('abcd')
    expect(nav.truncate('', 4)).toBe('')
  })
})
