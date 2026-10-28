/**
 * Раскладка шапки, меню аккаунта и левой панели: какие значки справа от
 * поиска, какие пункты в меню аватара, какие разделы и блоки слева от ленты, в
 * каком порядке. Здесь — чистая часть: пункты по умолчанию и сведение
 * сохранённого с ними. Подписи, значки и доступность на этой платформе — в
 * `b-components/header/header-layout`.
 *
 * Порядок по умолчанию:
 * - шапка: «Сервисы» — сразу за поиском, это раздел, как ссылка; дальше то,
 *   чем пользуются чаще всего, — уведомления и чаты; за ними индикаторы Tor и
 *   IPFS, тема и ширина страницы — «системная» часть у самого аккаунта
 *   (ширина — только на широком экране). «Сообщить об ошибке»
 *   по умолчанию в меню: нужна редко, а место в шапке — самое дорогое;
 * - меню: вы — деньги — ваше содержимое — лимиты на него — связь — помощь и
 *   настройки. «Настройки» не скрываются: через них скрытое и возвращают;
 * - левая панель: разделы ленты, затем приложения и справка — как было до
 *   настройки; под разделами — порядок и язык ленты, категории, теги.
 */

export type HeaderItemId =
  | 'services'
  | 'notifications'
  | 'messenger'
  | 'tor'
  | 'ipfs'
  | 'theme'
  | 'pageWidth'
  | 'reportBug'

export type MenuItemId =
  | 'profile'
  | 'wallets'
  | 'paidSubscriptions'
  | 'mediaStudio'
  | 'myFiles'
  | 'limits'
  | 'mesh'
  | 'help'
  | 'reportBug'
  | 'settings'

/** Разделы левой панели — те же, что `sidebarData.tabs.*` в переводах. */
export type SidebarItemId =
  | 'feed'
  | 'subscriptions'
  | 'video'
  | 'audio'
  | 'articles'
  | 'favorites'
  | 'discussed'
  | 'miniApps'
  | 'topAccounts'
  | 'explorer'
  | 'help'

/** Блоки под разделами: «Сначала лучшее» с языком ленты, категории, теги. */
export type SidebarBlockId = 'feedSettings' | 'categories' | 'tags'

export interface LayoutEntry<Id extends string = string> {
  id: Id
  visible: boolean
}

export const DEFAULT_HEADER_LAYOUT: readonly LayoutEntry<HeaderItemId>[] = [
  { id: 'services', visible: true },
  { id: 'notifications', visible: true },
  { id: 'messenger', visible: true },
  { id: 'tor', visible: true },
  { id: 'ipfs', visible: true },
  { id: 'theme', visible: true },
  { id: 'pageWidth', visible: true },
  { id: 'reportBug', visible: false },
]

export const DEFAULT_MENU_LAYOUT: readonly LayoutEntry<MenuItemId>[] = [
  { id: 'profile', visible: true },
  { id: 'wallets', visible: true },
  { id: 'paidSubscriptions', visible: true },
  { id: 'mediaStudio', visible: true },
  { id: 'myFiles', visible: true },
  { id: 'limits', visible: true },
  { id: 'mesh', visible: true },
  { id: 'help', visible: true },
  { id: 'reportBug', visible: true },
  { id: 'settings', visible: true },
]

export const DEFAULT_SIDEBAR_LAYOUT: readonly LayoutEntry<SidebarItemId>[] = [
  { id: 'feed', visible: true },
  { id: 'subscriptions', visible: true },
  { id: 'video', visible: true },
  { id: 'audio', visible: true },
  { id: 'articles', visible: true },
  { id: 'favorites', visible: true },
  { id: 'discussed', visible: true },
  { id: 'miniApps', visible: true },
  { id: 'topAccounts', visible: true },
  { id: 'explorer', visible: true },
  { id: 'help', visible: true },
]

export const DEFAULT_SIDEBAR_BLOCKS: readonly LayoutEntry<SidebarBlockId>[] = [
  { id: 'feedSettings', visible: true },
  { id: 'categories', visible: true },
  { id: 'tags', visible: true },
]

/** Пункты меню, которые нельзя скрыть: без «Настроек» скрытое не вернуть. */
export const LOCKED_MENU_ITEMS: readonly MenuItemId[] = ['settings']

/**
 * Сохранённая раскладка поверх пунктов по умолчанию. Незнакомое и повторы
 * отбрасываются (пункт убрали из приложения, запись испорчена). Пункт,
 * которого в сохранённом нет (появился в новой версии), встаёт за своим
 * соседом по умолчанию — тем, что перед ним, — со своей видимостью по
 * умолчанию. Закреплённые всегда видны.
 */
export function mergeLayout<Id extends string>(
  saved: unknown,
  defaults: readonly LayoutEntry<Id>[],
  locked: readonly Id[] = []
): LayoutEntry<Id>[] {
  const known = new Set<string>(defaults.map((d) => d.id))
  const result: LayoutEntry<Id>[] = []
  const seen = new Set<string>()
  if (Array.isArray(saved)) {
    for (const raw of saved) {
      if (!raw || typeof raw !== 'object') continue
      const { id, visible } = raw as { id?: unknown; visible?: unknown }
      if (typeof id !== 'string' || !known.has(id) || seen.has(id)) continue
      seen.add(id)
      result.push({ id: id as Id, visible: visible !== false })
    }
  }
  defaults.forEach((entry, index) => {
    if (seen.has(entry.id)) return
    let at = 0
    for (let i = index - 1; i >= 0; i--) {
      const prev = result.findIndex((e) => e.id === defaults[i]!.id)
      if (prev >= 0) {
        at = prev + 1
        break
      }
    }
    result.splice(at, 0, { ...entry })
    seen.add(entry.id)
  })
  for (const entry of result) if (locked.includes(entry.id)) entry.visible = true
  return result
}

/** Пункт с места `from` на место `to`; за пределами списка — без изменений. */
export function moveEntry<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

/** Раскладка совпадает с той, что по умолчанию, — хранить её незачем. */
export function isDefaultLayout<Id extends string>(
  list: readonly LayoutEntry<Id>[],
  defaults: readonly LayoutEntry<Id>[]
): boolean {
  return (
    list.length === defaults.length &&
    list.every((e, i) => e.id === defaults[i]!.id && e.visible === defaults[i]!.visible)
  )
}
