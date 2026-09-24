import { describe, expect, it } from 'vitest'
import { findRestoreCandidate } from './app-restore'
import type { FavoriteMiniApp } from './favorites-store'
import type { SearchHistoryEntry } from '@/stores/search-store-consts'

const FAV: FavoriteMiniApp = {
  id: 'game.app',
  name: 'Game',
  scope: 'game.app',
  icon: 'https://game.app/b_icon.png',
  addedAt: 1,
}

const RECENT: SearchHistoryEntry = {
  kind: 'app',
  value: 'other.app',
  label: 'Other',
  addedAt: 2,
  meta: { name: 'Other', icon: 'https://other.app/b_icon.png', scope: 'other.app' },
}

// S46/G17: каталожные приложения не персистятся, а «Избранное»/«Недавнее» —
// да; после перезапуска клик вёл на «Приложение не найдено».
describe('findRestoreCandidate', () => {
  it('берёт метаданные из избранного', () => {
    expect(findRestoreCandidate('game.app', [FAV], [])).toEqual({
      id: 'game.app',
      name: 'Game',
      scope: 'game.app',
      icon: 'https://game.app/b_icon.png',
    })
  })

  it('берёт метаданные из истории поиска', () => {
    expect(findRestoreCandidate('other.app', [], [RECENT])).toEqual({
      id: 'other.app',
      name: 'Other',
      scope: 'other.app',
      icon: 'https://other.app/b_icon.png',
    })
  })

  it('избранное приоритетнее истории', () => {
    const stale: SearchHistoryEntry = { ...RECENT, value: 'game.app', meta: { scope: 'old.app' } }
    expect(findRestoreCandidate('game.app', [FAV], [stale])?.scope).toBe('game.app')
  })

  it('без scope восстанавливать нечего', () => {
    const noScope: SearchHistoryEntry = { ...RECENT, meta: { name: 'Other' } }
    expect(findRestoreCandidate('other.app', [], [noScope])).toBeNull()
  })

  it('чужие записи истории игнорируются', () => {
    const user: SearchHistoryEntry = { kind: 'user', value: 'other.app', addedAt: 3 }
    expect(findRestoreCandidate('other.app', [], [user])).toBeNull()
  })
})
