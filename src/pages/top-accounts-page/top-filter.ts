/**
 * Поиск по топу аккаунтов: по имени и по адресу, без учёта регистра и `@`
 * в начале. Место у найденного — из полного списка: фильтр топ не
 * перенумеровывает.
 */

import type { TopEntry } from '@/services/top-accounts'

export interface RankedEntry {
  entry: TopEntry
  /** Место в топе, с единицы. */
  rank: number
}

/** Запрос из поля: без пробелов по краям и `@` перед именем, в нижнем регистре. */
export function normalizeTopQuery(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase()
}

export function filterTop(
  entries: readonly TopEntry[],
  nameOf: (address: string) => string | undefined,
  rawQuery: string
): RankedEntry[] {
  const query = normalizeTopQuery(rawQuery)
  const ranked = entries.map((entry, index) => ({ entry, rank: index + 1 }))
  if (!query) return ranked
  return ranked.filter(({ entry }) => {
    const name = nameOf(entry.address)?.toLowerCase() ?? ''
    return name.includes(query) || entry.address.toLowerCase().includes(query)
  })
}
