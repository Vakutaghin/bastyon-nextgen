/**
 * Популярные сервисы для полки в ленте: каталог ноды по рейтингу, без
 * приложений с плохими оценками, без VPN (см. `isShelfAllowed`) и без
 * записей, выдающих себя за встроенные. Лента открывается часто, поэтому
 * список держится полчаса.
 */

import { BUILT_IN_APPS } from '@/mini-apps/registry/built-in'
import type { RemoteAppEntry, RemoteAppsLoader } from '@/mini-apps/registry/remote-registry'
import { isShelfAllowed } from './categories'
import { getCatalogLoader } from './catalog-loader'

export const SHELF_SIZE = 10
const TTL_MS = 30 * 60 * 1000

let cached: { at: number; apps: RemoteAppEntry[] } | null = null
let pending: Promise<RemoteAppEntry[]> | null = null

function impersonatesBuiltIn(entry: RemoteAppEntry): boolean {
  const name = entry.name.trim().toLowerCase()
  return BUILT_IN_APPS.some(
    (b) => b.id !== entry.id && (b.scope === entry.scope || b.name.toLowerCase() === name)
  )
}

export function pickShelfApps(apps: readonly RemoteAppEntry[]): RemoteAppEntry[] {
  return apps
    .filter((a) => (a.rating ?? 0) > 0 && isShelfAllowed(a.tags ?? []) && !impersonatesBuiltIn(a))
    .slice(0, SHELF_SIZE)
}

export async function loadPopularApps(
  getLoader: () => Promise<RemoteAppsLoader> = getCatalogLoader
): Promise<RemoteAppEntry[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.apps
  if (pending) return pending
  pending = (async () => {
    try {
      const loader = await getLoader()
      // С запасом: часть отсеется фильтрами.
      const page = await loader.load({ orderBy: 'rating', orderDesc: true, pageSize: 30 })
      const apps = pickShelfApps(page.apps)
      cached = { at: Date.now(), apps }
      return apps
    } finally {
      pending = null
    }
  })()
  return pending
}

export function resetPopularAppsCache(): void {
  cached = null
  pending = null
}
