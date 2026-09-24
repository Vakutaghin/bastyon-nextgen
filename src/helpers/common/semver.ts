/**
 * Сравнение версий вида `1.2.3` — одна реализация на приложение.
 *
 * Нужна в двух местах: changelog («какая запись соответствует сборке») и
 * проверка обновлений («релиз на GitHub новее установленной версии»).
 *
 * Сравнивается только числовое ядро версии: суффикс предрелиза (`-beta.1`)
 * отбрасывается. Для проверки обновлений это безопасно — GitHub-эндпоинт
 * `releases/latest` предрелизы и черновики не отдаёт.
 */

/** `v1.2.3-beta.1` → `1.2.3`. Возвращает `null`, если чисел в строке нет. */
export function normalizeVersion(raw: string): string | null {
  const match = /^\s*v?(\d+(?:\.\d+)*)/.exec(raw)
  return match?.[1] ?? null
}

/** Сравнивает `1.2.3` и `1.2.4` как компаратор `Array.sort`: `> 0`, если `a > b`. */
export function compareSemver(a: string, b: string): number {
  const ap = a.split('.').map((n) => parseInt(n, 10) || 0)
  const bp = b.split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(ap.length, bp.length)
  for (let i = 0; i < len; i++) {
    const av = ap[i] ?? 0
    const bv = bp[i] ?? 0
    if (av !== bv) return av - bv
  }
  return 0
}

/**
 * `true`, если `candidate` строго новее `current`. Обе строки могут прийти
 * с префиксом `v` (тег релиза) — нормализуются перед сравнением.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = normalizeVersion(candidate)
  const b = normalizeVersion(current)
  if (!a || !b) return false
  return compareSemver(a, b) > 0
}
