// Классификация ссылок из уведомлений (P1-5, open-redirect guard).
// Vue-free и чистая: решение (что делать со ссылкой) отделено от исполнения
// (window.location / window.open / router.push живут в компоненте) — чтобы
// security-логику можно было юнит-тестировать без монтирования компонента.

/** Доверенные хосты, на которые можно навигировать в том же окне. */
export const TRUSTED_LINK_HOSTS = ['bastyon.com', 'pocketnet.app'] as const

export function isTrustedLinkHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return TRUSTED_LINK_HOSTS.some((d) => h === d || h.endsWith(`.${d}`))
}

/** Намерение по ссылке уведомления — исполняется вызывающим компонентом. */
export type NotificationLinkAction =
  | { kind: 'ignore' }
  | { kind: 'same-tab'; href: string }
  | { kind: 'new-tab'; href: string }
  | { kind: 'router'; path: string }

/**
 * Классифицирует `link` из уведомления. `link` приходит с ноды —
 * `startsWith('http')` пропускал `http://evil.com`, который полной навигацией
 * подменял приложение (open-redirect/фишинг). Правила: относительный путь →
 * router; доверенный Bastyon-хост → та же вкладка; чужой http(s) → новая вкладка
 * (noopener у вызывающего); нестандартные схемы (`javascript:`) и
 * protocol-relative `//` → игнор.
 */
export function classifyNotificationLink(link: string): NotificationLinkAction {
  let url: URL | null = null
  try {
    url = new URL(link.trim())
  } catch {
    /* не абсолютный URL — url остаётся null */
  }

  if (url) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return { kind: 'ignore' }
    return isTrustedLinkHost(url.hostname)
      ? { kind: 'same-tab', href: url.href }
      : { kind: 'new-tab', href: url.href }
  }

  // Не абсолютный URL → внутренний маршрут роутера (защита от protocol-relative).
  const rel = link.trim()
  if (rel.startsWith('//')) return { kind: 'ignore' }
  return { kind: 'router', path: rel }
}
