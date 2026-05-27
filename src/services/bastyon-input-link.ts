/**
 * Парсер Bastyon-ссылок, вставленных в строку поиска.
 *
 * Назначение узкое: понять, что пользователь вставил URL (а не искал
 * слово), и определить целевой маршрут в новом приложении.
 * В оригинале это `self.app.thislink(value)` (menu/index.js:827-836) —
 * если URL распознан, выполняется прямая навигация, иначе fall back
 * на обычный поиск.
 *
 * Этот модуль НЕ для распознавания ссылок внутри текста сообщений —
 * для этого есть `b-components/messenger/lib/bastyon-link.ts`, который
 * специализирован на постах/комментах.
 *
 * Что распознаём (ровно то, для чего в новом приложении есть маршрут):
 *
 *   bastyon.com/@name       → профиль /<name>
 *   bastyon.com/<Pxxx…>     → профиль /<address>
 *   bastyon.com/?ss=query   → поиск /search?q=query
 *   bastyon.com/?sst=tags   → поиск /search?q=#tag1+#tag2&type=posts
 *
 * Что НЕ распознаём (нет таргета):
 *
 *   bastyon.com/post?s=…    — пока нет страницы поста; пользователь
 *                              получит обычную поисковую выдачу.
 *   bastyon.com/index?v=…   — то же для видео.
 *
 * Допустимые префиксы: `bastyon://`, `https?://(bastyon.com|pocketnet.app|forta.chat)/`,
 * а также короткие формы без схемы — `bastyon.com/...`, `pocketnet.app/...`.
 */

const BASTYON_HOSTS = ['bastyon.com', 'pocketnet.app', 'forta.chat']
/** Pocketnet-адрес: base58, начинается с P, 33-34 символа. Грубая регэкспа. */
const POCKETNET_ADDRESS_RE = /^P[a-km-zA-HJ-NP-Z1-9]{25,40}$/

export type ParsedBastyonInput =
  | { kind: 'profile'; userName: string }
  | { kind: 'search'; query: string; tagMode: boolean }

/**
 * Пытается превратить введённое значение в один из известных таргетов.
 * Возвращает `null`, если значение — не Bastyon-URL.
 */
export function parseBastyonInput(value: string): ParsedBastyonInput | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const normalized = normalizeToUrl(trimmed)
  if (!normalized) return null

  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    return null
  }

  if (!BASTYON_HOSTS.includes(url.hostname)) return null

  // 1) Query-параметры ss / sst — старые формы поиска.
  const ss = url.searchParams.get('ss')
  const sst = url.searchParams.get('sst')
  if (ss && ss.trim()) {
    return { kind: 'search', query: ss.trim(), tagMode: false }
  }
  if (sst && sst.trim()) {
    const tags = sst
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`))
      .join(' ')
    return { kind: 'search', query: tags, tagMode: true }
  }

  // 2) Путь /@name или /<address>.
  const path = url.pathname.replace(/^\/+|\/+$/g, '')
  if (!path) return null

  // Игнорируем известные неподходящие префиксы (`post`, `index`, etc.).
  // У них нет целевого маршрута в новом приложении.
  const firstSegment = path.split('/')[0] ?? ''
  if (firstSegment === 'post' || firstSegment === 'index') return null

  if (firstSegment.startsWith('@')) {
    const name = firstSegment.slice(1).trim()
    if (name) return { kind: 'profile', userName: name }
    return null
  }

  if (POCKETNET_ADDRESS_RE.test(firstSegment)) {
    return { kind: 'profile', userName: firstSegment }
  }

  return null
}

/**
 * Превращает то, что мог ввести пользователь, в полный URL. Поддерживает:
 *   - bastyon://...           → https://bastyon.com/...
 *   - https://host/...        → как есть
 *   - host/path               → https://host/path
 *
 * Возвращает `null`, если строку нельзя осмысленно нормализовать.
 */
function normalizeToUrl(value: string): string | null {
  const lower = value.toLowerCase()

  if (lower.startsWith('bastyon://')) {
    return 'https://bastyon.com/' + value.slice('bastyon://'.length)
  }

  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return value
  }

  // Короткая форма: host/path без схемы.
  for (const host of BASTYON_HOSTS) {
    if (lower.startsWith(host + '/') || lower === host) {
      return 'https://' + value
    }
  }

  return null
}
