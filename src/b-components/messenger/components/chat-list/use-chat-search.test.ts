// Поиск в списке чатов: свои чаты — сразу и не больше пяти, люди из сети —
// после паузы в наборе, не больше пятнадцати, без себя; ответ на старый
// запрос не перетирает новый.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({ searchUsers: vi.fn() }))

vi.mock('@/services/search-service', () => ({ searchUsers: mocks.searchUsers }))

import {
  GLOBAL_LIMIT,
  LOCAL_LIMIT,
  SEARCH_DEBOUNCE_MS,
  matchCandidates,
  normalizeForSearch,
  useChatSearch,
  type SearchCandidate,
} from './use-chat-search'

const ME = 'PMeMeMeMeMeMeMeMeMeMeMeMeMeMeMeMe1'

function setup(names: string[] = []) {
  const candidates = ref<SearchCandidate<string>[]>(names.map((n) => ({ item: n, name: n })))
  let api!: ReturnType<typeof useChatSearch<string>>
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useChatSearch(candidates, () => ME)
        return () => h('div')
      },
    })
  )
  return { api, wrapper, candidates }
}

const users = (n: number, prefix = 'u') =>
  Array.from({ length: n }, (_, i) => ({ address: `P${prefix}${i}`, name: `${prefix}${i}` }))

beforeEach(() => {
  vi.useFakeTimers()
  mocks.searchUsers.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('matchCandidates', () => {
  const c = (names: string[]) => names.map((n) => ({ item: n, name: n }))

  it('сначала с начала названия, потом с начала слова, потом внутри; порядок списка внутри', () => {
    expect(matchCandidates(c(['Мама Анна', 'банан', 'Анна', 'Аня', 'Ванна']), 'ан')).toEqual([
      'Анна',
      'Аня',
      'Мама Анна',
      'банан',
      'Ванна',
    ])
  })

  it('регистр и ё не важны, пустой запрос — пусто', () => {
    expect(matchCandidates(c(['Пётр', 'ПЕТЯ']), 'пет')).toEqual(['Пётр', 'ПЕТЯ'])
    expect(matchCandidates(c(['Пётр']), '  ')).toEqual([])
    expect(normalizeForSearch('  Ёлка ')).toBe('елка')
  })

  it('не больше пяти', () => {
    const many = Array.from({ length: 9 }, (_, i) => `Группа ${i}`)
    expect(matchCandidates(c(many), 'груп')).toHaveLength(LOCAL_LIMIT)
  })
})

describe('useChatSearch', () => {
  it('свои чаты находятся сразу, сеть — только после паузы, и пока ждём — загрузка', async () => {
    mocks.searchUsers.mockResolvedValue(users(2, 'anna'))
    const { api } = setup(['Анна', 'Борис'])
    api.open()
    api.query.value = 'ан'
    await nextTick()

    expect(api.isSearching.value).toBe(true)
    expect(api.chats.value).toEqual(['Анна'])
    expect(api.peopleLoading.value).toBe(true)
    expect(mocks.searchUsers).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
    expect(mocks.searchUsers).toHaveBeenCalledTimes(1)
    expect(mocks.searchUsers).toHaveBeenCalledWith('ан', { count: GLOBAL_LIMIT + 1 })
    expect(api.people.value.map((u) => u.name)).toEqual(['anna0', 'anna1'])
    expect(api.peopleLoading.value).toBe(false)
    expect(api.peopleDone.value).toBe(true)
  })

  it('пока набирают — в сеть один запрос, по последнему тексту', async () => {
    mocks.searchUsers.mockResolvedValue([])
    const { api } = setup()
    api.open()
    for (const q of ['ко', 'кои', 'коин']) {
      api.query.value = q
      await nextTick()
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 50)
    }
    await vi.advanceTimersByTimeAsync(50)
    expect(mocks.searchUsers).toHaveBeenCalledTimes(1)
    expect(mocks.searchUsers).toHaveBeenCalledWith('коин', expect.anything())
  })

  it('с одной буквы в сеть не ходим', async () => {
    const { api } = setup()
    api.open()
    api.query.value = 'к'
    await nextTick()
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS * 2)
    expect(mocks.searchUsers).not.toHaveBeenCalled()
    expect(api.tooShort.value).toBe(true)
    expect(api.peopleLoading.value).toBe(false)
  })

  it('себя не показываем, людей не больше пятнадцати', async () => {
    mocks.searchUsers.mockResolvedValue([{ address: ME, name: 'me' }, ...users(GLOBAL_LIMIT)])
    const { api } = setup()
    api.open()
    api.query.value = 'me'
    await nextTick()
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
    expect(api.people.value).toHaveLength(GLOBAL_LIMIT)
    expect(api.people.value.some((u) => u.address === ME)).toBe(false)
  })

  it('ответ на старый запрос не перетирает новый', async () => {
    let resolveOld!: (v: unknown) => void
    mocks.searchUsers
      .mockImplementationOnce(() => new Promise((r) => (resolveOld = r)))
      .mockResolvedValueOnce(users(1, 'new'))
    const { api } = setup()
    api.open()
    api.query.value = 'old'
    await nextTick()
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
    api.query.value = 'new'
    await nextTick()
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
    resolveOld(users(3, 'old'))
    await vi.advanceTimersByTimeAsync(0)
    expect(api.people.value.map((u) => u.name)).toEqual(['new0'])
    expect(api.peopleLoading.value).toBe(false)
  })

  it('сеть не ответила — пишем об этом, а не «никого»', async () => {
    mocks.searchUsers.mockRejectedValue(new Error('offline'))
    const { api } = setup()
    api.open()
    api.query.value = 'koin'
    await nextTick()
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
    expect(api.peopleFailed.value).toBe(true)
    expect(api.people.value).toEqual([])
    expect(api.peopleLoading.value).toBe(false)
  })

  it('закрыли поиск — запрос стёрт, ждущий поиск в сеть отменён', async () => {
    const { api } = setup(['Анна'])
    api.open()
    api.query.value = 'ан'
    await nextTick()
    api.close()
    await nextTick()
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
    expect(mocks.searchUsers).not.toHaveBeenCalled()
    expect(api.isOpen.value).toBe(false)
    expect(api.isSearching.value).toBe(false)
    expect(api.peopleLoading.value).toBe(false)
  })

  it('компонент ушёл со страницы — ждущий поиск в сеть отменён', async () => {
    const { api, wrapper } = setup()
    api.open()
    api.query.value = 'koin'
    await nextTick()
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
    expect(mocks.searchUsers).not.toHaveBeenCalled()
  })
})
