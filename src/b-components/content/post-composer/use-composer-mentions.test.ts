// @-упоминания в композере: где начинается токен, как ранжируются подсказки
// (подписки и знакомые — сразу, сеть — после паузы и только по имени) и что
// уходит в текст при выборе.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type Ref } from 'vue'

const m = vi.hoisted(() => ({
  known: [] as Array<{ address: string; name: string; avatar: string | null }>,
  searchQuery: null as unknown as Ref<string>,
  searchData: null as unknown as Ref<unknown[] | undefined>,
  searchFetching: null as unknown as Ref<boolean>,
  subscribed: new Set<string>(),
  init: vi.fn(async () => {}),
  preloadUserNames: vi.fn(async () => {}),
  rememberUsers: vi.fn(),
}))

vi.mock('@/composables/use-search-query', () => ({
  useSearchUsers: (query: Ref<string>) => {
    m.searchQuery = query
    return { data: m.searchData, isFetching: m.searchFetching }
  },
}))
vi.mock('@/services/user-names', () => ({
  knownUsers: () => m.known,
  preloadUserNames: m.preloadUserNames,
  rememberUsers: m.rememberUsers,
}))
vi.mock('@/helpers/common/url-transformer', () => ({
  resolveImageUrl: (i: string | null | undefined) => i || null,
}))
vi.mock('@/stores', () => ({
  useAuthStore: () => ({ isUserAuthenticated: true }),
  useUserRelationsStore: () => ({ subscribed: m.subscribed, init: m.init }),
}))

import {
  MENTION_SEARCH_DELAY_MS,
  detectMentionToken,
  rankMentions,
  useComposerMentions,
  type MentionCandidate,
} from './use-composer-mentions'

const user = (address: string, name: string): MentionCandidate => ({ address, name, avatar: null })

describe('detectMentionToken', () => {
  it('детектит токен в начале строки', () => {
    expect(detectMentionToken('@bob', 4)).toEqual({ query: 'bob', start: 0, end: 4 })
  })

  it('детектит токен после пробела', () => {
    expect(detectMentionToken('hi @al', 6)).toEqual({ query: 'al', start: 3, end: 6 })
  })

  it('пустой query сразу после @', () => {
    expect(detectMentionToken('hi @', 4)).toEqual({ query: '', start: 3, end: 4 })
  })

  it('не ловит e-mail (@ не после пробела)', () => {
    expect(detectMentionToken('mail@host', 9)).toBeNull()
  })

  it('null, если перед курсором нет @-токена', () => {
    expect(detectMentionToken('just text', 9)).toBeNull()
  })

  it('обрывается на пробеле после токена', () => {
    expect(detectMentionToken('@bob ', 5)).toBeNull()
  })

  it('берёт query до позиции курсора (середина токена)', () => {
    expect(detectMentionToken('@bobby', 4)).toEqual({ query: 'bob', start: 0, end: 4 })
  })

  it('null при выходе курсора за границы', () => {
    expect(detectMentionToken('@bob', 99)).toBeNull()
  })
})

describe('rankMentions', () => {
  it('сначала имена с начала (подписки впереди, короче — выше), потом совпадения внутри', () => {
    const local = [
      user('P1', 'kreyser001'),
      user('P2', 'akr'),
      user('P3', 'kr'),
      user('P4', 'Krot'),
    ]
    const ranked = rankMentions('kr', local, [], new Set(['P4', 'P2']))
    expect(ranked.map((u) => u.name)).toEqual(['Krot', 'kr', 'kreyser001', 'akr'])
  })

  it('свои раньше сетевых, повтор по адресу и пустое имя отбрасываются, не больше лимита', () => {
    const local = [user('P1', 'anna')]
    const remote = [user('P1', 'anna'), user('P2', ''), user('P3', 'anton'), user('P4', 'andrey')]
    expect(rankMentions('an', local, remote, new Set(), 2).map((u) => u.address)).toEqual([
      'P1',
      'P3',
    ])
  })

  it('кто не содержит набранного в имени, не подсказывается (нашёлся по «О себе»)', () => {
    const remote = [user('P1', 'Daniel_Satchkov'), user('P2', 'bastyon_news')]
    expect(rankMentions('bastyon', [], remote, new Set()).map((u) => u.name)).toEqual([
      'bastyon_news',
    ])
  })

  it('одна @ без букв — подписки первыми и в своём порядке', () => {
    const local = [user('P1', 'zoe'), user('P2', 'alexander'), user('P3', 'bo')]
    expect(rankMentions('', local, [], new Set(['P2', 'P1'])).map((u) => u.name)).toEqual([
      'zoe',
      'alexander',
      'bo',
    ])
  })
})

describe('useComposerMentions', () => {
  let text: Ref<string>
  let scope: ReturnType<typeof effectScope>

  function setup() {
    text = ref('')
    scope = effectScope()
    return scope.run(() =>
      useComposerMentions({
        getText: () => text.value,
        getEl: () => null,
        setText: (value) => {
          text.value = value
        },
      })
    )!
  }

  async function type(mentions: ReturnType<typeof setup>, value: string) {
    text.value = value
    mentions.update()
    await nextTick()
  }

  beforeEach(() => {
    vi.useFakeTimers()
    m.known = []
    m.subscribed = new Set()
    m.searchData = ref(undefined)
    m.searchFetching = ref(false)
    m.init.mockClear()
    m.preloadUserNames.mockClear()
    m.rememberUsers.mockClear()
  })
  afterEach(() => {
    scope.stop()
    vi.useRealTimers()
  })

  it('одна @ — сразу подписки и знакомые, сеть не спрашивается', async () => {
    m.known = [user('P2', 'bob'), user('P1', 'alice')]
    m.subscribed = new Set(['P1'])
    const mentions = setup()
    await type(mentions, 'Привет @')
    expect(mentions.show.value).toBe(true)
    expect(mentions.results.value.map((u) => u.name)).toEqual(['alice', 'bob'])
    await vi.advanceTimersByTimeAsync(MENTION_SEARCH_DELAY_MS * 2)
    expect(m.searchQuery.value).toBe('')
  })

  it('сеть — от двух букв и после паузы в наборе, не на каждую букву', async () => {
    const mentions = setup()
    await type(mentions, '@k')
    await type(mentions, '@kr')
    await type(mentions, '@kre')
    expect(m.searchQuery.value).toBe('')
    await vi.advanceTimersByTimeAsync(MENTION_SEARCH_DELAY_MS)
    expect(m.searchQuery.value).toBe('kre')
  })

  it('пока сеть ищет, а своих совпадений нет, — «Ищу…»; ничего не нашлось — списка нет', async () => {
    const mentions = setup()
    await type(mentions, '@zz')
    expect(mentions.results.value).toEqual([])
    expect(mentions.searching.value).toBe(true)
    expect(mentions.show.value).toBe(true)

    await vi.advanceTimersByTimeAsync(MENTION_SEARCH_DELAY_MS)
    m.searchData.value = []
    await nextTick()
    expect(mentions.searching.value).toBe(false)
    expect(mentions.show.value).toBe(false)
  })

  it('из сети — только совпавшие по имени; найденные запоминаются для следующего раза', async () => {
    const mentions = setup()
    await type(mentions, '@bastyon')
    await vi.advanceTimersByTimeAsync(MENTION_SEARCH_DELAY_MS)
    const found = [
      { address: 'P1', name: 'Daniel_Satchkov', i: 'https://a/1.jpg' },
      { address: 'P2', name: 'bastyon_news', i: '' },
    ]
    m.searchData.value = found
    await nextTick()
    expect(mentions.results.value).toEqual([{ address: 'P2', name: 'bastyon_news', avatar: null }])
    expect(m.rememberUsers).toHaveBeenCalledWith(found)
  })

  it('выбор вставляет «@имя » на место токена, остальной текст цел', async () => {
    m.known = [user('P1', 'kreyser001')]
    const mentions = setup()
    await type(mentions, 'Привет @kre')
    text.value = 'Привет @kre, как дела'
    mentions.select(mentions.results.value[0]!)
    expect(text.value).toBe('Привет @kreyser001 , как дела')
    expect(mentions.show.value).toBe(false)
  })

  it('имена подписок догружаются один раз, когда впервые набрали @', async () => {
    m.subscribed = new Set(['P1', 'P2'])
    const mentions = setup()
    await type(mentions, '@')
    await type(mentions, '@a')
    await vi.advanceTimersByTimeAsync(0)
    expect(m.init).toHaveBeenCalledTimes(1)
    expect(m.preloadUserNames).toHaveBeenCalledTimes(1)
    expect(m.preloadUserNames).toHaveBeenCalledWith(['P1', 'P2'])
  })
})
