/**
 * Фильтрация подсказок тегов из облака трендов (gettags не умеет префикс-поиск,
 * поэтому подгружаем облако и фильтруем на клиенте).
 *
 * Приоритет: сначала совпадения по началу строки, затем по вхождению.
 * Уже выбранные теги исключаются.
 */
/**
 * По умолчанию не режем: облако приходит от ноды уже ограниченным (getTags с
 * count=100). Список из восьми подсказок не давал дотянуться до остальных
 * тегов — выпадашка скроллится сама, ограничивать её нечем.
 */
const DEFAULT_LIMIT = 100

export function filterTagSuggestions(
  cloud: string[],
  query: string,
  selected: string[],
  limit: number = DEFAULT_LIMIT
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
