/** Текст счётчика: пусто — значка нет; больше max — «max+». */
export function badgeText(count: number | undefined, max = 99): string {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return ''
  const n = Math.floor(count)
  return n > max ? `${max}+` : String(n)
}
