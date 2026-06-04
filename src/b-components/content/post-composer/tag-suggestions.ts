/**
 * Фильтрация подсказок тегов из облака трендов (gettags не умеет префикс-поиск,
 * поэтому подгружаем облако и фильтруем на клиенте).
 *
 * Приоритет: сначала совпадения по началу строки, затем по вхождению.
 * Уже выбранные теги исключаются.
 */
export function filterTagSuggestions(
  cloud: string[],
  query: string,
  selected: string[],
  limit: number = 8
): string[] {
  const q = query.trim().toLowerCase()
  const selectedSet = new Set(selected.map((t) => t.toLowerCase()))
  const pool = cloud.filter((tag) => tag && !selectedSet.has(tag.toLowerCase()))

  if (!q) return pool.slice(0, limit)

  const starts: string[] = []
  const contains: string[] = []
  for (const tag of pool) {
    const lower = tag.toLowerCase()
    if (lower.startsWith(q)) starts.push(tag)
    else if (lower.includes(q)) contains.push(tag)
  }
  return [...starts, ...contains].slice(0, limit)
}
