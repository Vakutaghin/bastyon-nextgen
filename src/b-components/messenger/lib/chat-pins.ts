/**
 * Закреплённые чаты — сверху списка, чтобы те, с кем переписываешься часто,
 * всегда были под рукой.
 *
 * Хранится меткой комнаты Matrix `m.favourite` — как «Избранное» в Element.
 * Метки комнат — личные данные аккаунта на сервере: собеседники их не видят,
 * другие устройства получают с синком. Прежний клиент Bastyon меток не читает.
 *
 * Порядок — поле `order` метки, число от 0 до 1: меньше — выше. Только что
 * закреплённый встаёт наверх. Метка без порядка (так ставят некоторые
 * клиенты) — после упорядоченных.
 */

import type { Dialog } from '../types'

export const PIN_TAG = 'm.favourite'

/** Порядок закреплённой комнаты по её меткам или `undefined`, если не закреплена. */
export function pinOrderFromTags(tags: unknown): number | undefined {
  if (!tags || typeof tags !== 'object') return undefined
  const tag = (tags as Record<string, unknown>)[PIN_TAG]
  if (!tag || typeof tag !== 'object') return undefined
  const order = (tag as { order?: unknown }).order
  return typeof order === 'number' && Number.isFinite(order) ? order : 1
}

/** Порядок для нового закреплённого — выше всех закреплённых. */
export function nextPinOrder(dialogs: readonly Pick<Dialog, 'pinned'>[]): number {
  let min = Infinity
  for (const d of dialogs) if (d.pinned !== undefined && d.pinned < min) min = d.pinned
  if (min === Infinity) return 0.5
  // У нуля половины нет: тогда ниже нуля, сортировке это не мешает.
  return min > 0 ? min / 2 : min - 1
}

/**
 * Закреплённые — сверху по порядку, остальные — как были. Равный порядок не
 * переставляет: сортировка устойчивая.
 */
export function pinnedFirst<T>(items: readonly T[], pinOf: (item: T) => number | undefined): T[] {
  const pinned: { item: T; order: number; i: number }[] = []
  const rest: T[] = []
  items.forEach((item, i) => {
    const order = pinOf(item)
    if (order === undefined) rest.push(item)
    else pinned.push({ item, order, i })
  })
  if (pinned.length === 0) return rest
  pinned.sort((a, b) => a.order - b.order || a.i - b.i)
  return [...pinned.map((p) => p.item), ...rest]
}
