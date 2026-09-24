/**
 * Восстановление каталожной миниаппы, которая не установлена (S46/G17).
 *
 * Каталожные приложения регистрируются только на сессию (`remote-session`), а
 * «Избранное» и «Недавнее» переживают перезапуск. После рестарта клик по такой
 * записи открывал `/app/<id>` с текстом «Приложение не найдено». Здесь по id
 * ищем сохранённые метаданные (name/scope/icon) и регистрируем приложение
 * заново — ровно то же, что делает клик по карточке в каталоге.
 */

import { logger } from '@/services/logger'
import { useSearchStore } from '@/stores/search-store'
import type { SearchHistoryEntry } from '@/stores/search-store-consts'
import type { InstalledApp, AppId } from '../types/app'
import { useAppsStore } from './apps-store'
import { useFavoriteMiniAppsStore, type FavoriteMiniApp } from './favorites-store'

const log = logger.scope('[mini-apps:restore]')

/** Минимум, которого хватает, чтобы зарегистрировать приложение без каталога. */
export interface RestoreCandidate {
  id: AppId
  name: string
  scope: string
  icon?: string
}

/**
 * Ищет метаданные приложения в избранном и истории поиска. Чистая функция —
 * сторы читает вызывающий.
 */
export function findRestoreCandidate(
  appId: AppId,
  favorites: readonly FavoriteMiniApp[],
  history: readonly SearchHistoryEntry[]
): RestoreCandidate | null {
  const fav = favorites.find((f) => f.id === appId)
  if (fav?.scope) {
    return { id: fav.id, name: fav.name, scope: fav.scope, icon: fav.icon }
  }

  const recent = history.find((e) => e.kind === 'app' && e.value === appId && !!e.meta?.scope)
  if (recent?.meta?.scope) {
    return {
      id: appId,
      name: recent.meta.name ?? recent.label ?? appId,
      scope: recent.meta.scope,
      icon: recent.meta.icon,
    }
  }

  return null
}

/**
 * Возвращает установленное приложение, при необходимости восстановив
 * каталожную регистрацию. `null` — метаданных нет нигде (UI покажет
 * «Приложение не найдено»).
 */
export async function ensureAppAvailable(appId: AppId): Promise<InstalledApp | null> {
  const appsStore = useAppsStore()
  const existing = appsStore.byId(appId)
  if (existing) return existing

  const favStore = useFavoriteMiniAppsStore()
  await favStore.init()
  const searchStore = useSearchStore()

  const candidate = findRestoreCandidate(appId, favStore.items, searchStore.history)
  if (!candidate) return null

  const restored = appsStore.installFromRemoteEntry({
    id: candidate.id,
    name: candidate.name,
    scope: candidate.scope,
    icon: candidate.icon,
  })
  log.debug('restored session app', appId, restored ? 'ok' : 'rejected')
  return restored
}
