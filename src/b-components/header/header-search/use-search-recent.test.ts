// «Недавнее» в выпадашке поиска: когда блок виден, куда ведёт клик по записи
// каждого вида (запрос, тег, пользователь, миниаппа), поднятие записи наверх,
// удаление и очистка истории, вторичная подпись пользователя.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import type { Router } from 'vue-router'

// История поиска персистится в IndexedDB — в тестах держим её в памяти.
vi.mock('@/db/apis/settings-api', () => ({
  settingsAPI: { get: async () => undefined, set: async (key: string) => key },
}))
vi.mock('@/blockchain/store/auth-store', () => ({
  useAuthStore: () => ({ getUserAddress: 'PMe' }),
}))

import { useSearchStore } from '@/stores/search-store'
import type { SearchHistoryEntry } from '@/stores/search-store-consts'
import { useSearchRecent } from './use-search-recent'

let push: ReturnType<typeof vi.fn>
let emitClose: ReturnType<typeof vi.fn>

function setup(showResultsInitially = false) {
  const showResults = ref(showResultsInitially)
  const recent = useSearchRecent({ push } as unknown as Router, showResults, emitClose)
  return { recent, showResults, store: useSearchStore() }
}

const entry = (over: Partial<SearchHistoryEntry>): SearchHistoryEntry => ({
  kind: 'query',
  value: 'v',
  addedAt: 1,
  ...over,
})

beforeEach(() => {
  setActivePinia(createPinia())
  push = vi.fn()
  emitClose = vi.fn()
})

describe('видимость блока «Недавнее»', () => {
  it('виден, только когда есть история и не показываются результаты', () => {
    const { recent, showResults, store } = setup()
    expect(recent.showRecent.value).toBe(false)
    store.commit('кошки')
    expect(recent.showRecent.value).toBe(true)
    expect(recent.recentEntries.value.map((e) => e.value)).toEqual(['кошки'])
    showResults.value = true
    expect(recent.showRecent.value).toBe(false)
  })

  it('после очистки истории блок пропадает', () => {
    const { recent, store } = setup()
    store.commit('a')
    store.commitTag('b')
    recent.onClearHistory()
    expect(recent.recentEntries.value).toEqual([])
    expect(recent.showRecent.value).toBe(false)
  })

  it('удаление убирает только выбранную запись', () => {
    const { recent, store } = setup()
    store.commit('same')
    store.commitTag('same')
    recent.onRemoveRecent(entry({ kind: 'query', value: 'same' }))
    expect(recent.recentEntries.value).toEqual([
      expect.objectContaining({ kind: 'tag', value: 'same' }),
    ])
  })
})

describe('клик по записи', () => {
  it('запрос — повторный поиск, поле заполняется, запись поднимается наверх', () => {
    const { recent, store } = setup()
    store.commit('старый')
    store.commit('свежий')
    recent.onSelectRecent(store.recentHistory[1]!)
    expect(emitClose).toHaveBeenCalledTimes(1)
    expect(store.query).toBe('старый')
    expect(push).toHaveBeenCalledWith({ path: '/search', query: { q: 'старый' } })
    expect(store.recentHistory.map((e) => e.value)).toEqual(['старый', 'свежий'])
  })

  it('тег — поиск постов по #тегу', () => {
    const { recent, store } = setup()
    recent.onSelectRecent(entry({ kind: 'tag', value: 'музыка', label: '#музыка' }))
    expect(push).toHaveBeenCalledWith({ path: '/search', query: { q: '#музыка', type: 'posts' } })
    expect(store.recentHistory[0]).toMatchObject({ kind: 'tag', value: 'музыка' })
  })

  it('пользователь — профиль по адресу, ник и аватар сохраняются в истории', () => {
    const { recent, store } = setup()
    recent.onSelectRecent(
      entry({ kind: 'user', value: 'PAddr', label: 'alice', meta: { name: 'alice', avatar: 'a' } })
    )
    expect(push).toHaveBeenCalledWith({ name: 'profile', params: { userName: 'PAddr' } })
    expect(store.recentHistory[0]).toMatchObject({
      kind: 'user',
      value: 'PAddr',
      meta: { name: 'alice', avatar: 'a' },
    })
  })

  it('миниаппа — страница приложения по закодированному id', () => {
    const { recent } = setup()
    recent.onSelectRecent(entry({ kind: 'app', value: 'my app/1', meta: { scope: 's.example' } }))
    expect(push).toHaveBeenCalledWith('/app/my%20app%2F1')
    expect(emitClose).toHaveBeenCalled()
  })
})

describe('подписи', () => {
  it('у каждого вида записи своя, непустая иконка', () => {
    const { recent } = setup()
    const icons = (['query', 'tag', 'user', 'app'] as const).map(recent.iconForKind)
    expect(icons.every(Boolean)).toBe(true)
    expect(new Set(icons).size).toBe(4)
  })

  it('у пользователя с ником, отличным от подписи, вторая строка — адрес', () => {
    const { recent } = setup()
    expect(
      recent.secondaryFor(
        entry({ kind: 'user', value: 'PAddr', label: 'PAddr', meta: { name: 'alice' } })
      )
    ).toBe('PAddr')
    expect(
      recent.secondaryFor(
        entry({ kind: 'user', value: 'PAddr', label: 'alice', meta: { name: 'alice' } })
      )
    ).toBeUndefined()
    expect(recent.secondaryFor(entry({ kind: 'user', value: 'PAddr' }))).toBeUndefined()
    expect(recent.secondaryFor(entry({ kind: 'query', value: 'q' }))).toBeUndefined()
  })
})
