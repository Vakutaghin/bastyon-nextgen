/**
 * Высота блока ↔ время.
 *
 * Статистика ноды раскладывает транзакции не по календарю, а по высоте:
 * день — `высота / 1440`, час — `высота / 60` (ExplorerRepository,
 * pocketnet.core 0.22). Блок в среднем раз в минуту, но не ровно: в 2019–2021
 * шаг был 60,4 с, к 2026 году — 57,2 с, и за годы набегают недели. Поэтому
 * время считаем по опорным блокам — время блока на каждой сотой тысяче
 * высоты, снятое с ноды 02.11.2026 (прошлые блоки не меняются), — а между
 * ними и после последнего до вершины цепочки — по прямой.
 */

export const DAY_BLOCKS = 1440
export const HOUR_BLOCKS = 60

/** [высота, unix-время в секундах]. */
export type ChainAnchor = readonly [number, number]

export const CHAIN_ANCHORS: readonly ChainAnchor[] = [
  [1, 1549812674],
  [100000, 1555777392],
  [200000, 1561818336],
  [300000, 1567869328],
  [400000, 1573912592],
  [500000, 1579951488],
  [600000, 1585982592],
  [700000, 1592026880],
  [800000, 1598061312],
  [900000, 1604104000],
  [1000000, 1610146832],
  [1100000, 1616404416],
  [1200000, 1622450544],
  [1300000, 1628485680],
  [1400000, 1634527488],
  [1500000, 1640560032],
  [1600000, 1646585216],
  [1700000, 1652612928],
  [1800000, 1658638752],
  [1900000, 1664644128],
  [2000000, 1670647072],
  [2100000, 1676612256],
  [2200000, 1682602176],
  [2300000, 1688594752],
  [2400000, 1694523696],
  [2500000, 1700341072],
  [2600000, 1706323952],
  [2700000, 1712306192],
  [2800000, 1718279488],
  [2900000, 1724117712],
  [3000000, 1730105616],
  [3100000, 1736121440],
  [3200000, 1742119760],
  [3300000, 1748027936],
  [3400000, 1753814496],
  [3500000, 1759622352],
  [3600000, 1765417712],
  [3700000, 1771144608],
  [3800000, 1776989168],
  [3900000, 1782716208],
  [4000000, 1788431552],
]

/** Средний шаг блока после последней опоры, пока не знаем вершину. */
const FALLBACK_BLOCK_SECONDS = 57.2

function anchorsWith(tip?: ChainAnchor | null): readonly ChainAnchor[] {
  const last = CHAIN_ANCHORS[CHAIN_ANCHORS.length - 1]!
  if (!tip || tip[0] <= last[0] || tip[1] <= last[1]) return CHAIN_ANCHORS
  return [...CHAIN_ANCHORS, tip]
}

/** Отрезок опор, внутри или у края которого лежит значение `pick(anchor)`. */
function segment(
  anchors: readonly ChainAnchor[],
  value: number,
  pick: 0 | 1
): [ChainAnchor, ChainAnchor] {
  for (let i = 1; i < anchors.length; i++) {
    if (value <= anchors[i]![pick]) return [anchors[i - 1]!, anchors[i]!]
  }
  return [anchors[anchors.length - 2]!, anchors[anchors.length - 1]!]
}

/** Время блока на высоте `height`, мс. `tip` — [высота, время] вершины цепочки. */
export function heightToTime(height: number, tip?: ChainAnchor | null): number {
  const anchors = anchorsWith(tip)
  const last = anchors[anchors.length - 1]!
  if (anchors === CHAIN_ANCHORS && height > last[0]) {
    return (last[1] + (height - last[0]) * FALLBACK_BLOCK_SECONDS) * 1000
  }
  const [a, b] = segment(anchors, height, 0)
  return (a[1] + ((height - a[0]) * (b[1] - a[1])) / (b[0] - a[0])) * 1000
}

/** Высота блока на момент `ms` — обратное к heightToTime, округлено вниз. */
export function timeToHeight(ms: number, tip?: ChainAnchor | null): number {
  const anchors = anchorsWith(tip)
  const last = anchors[anchors.length - 1]!
  const seconds = ms / 1000
  if (anchors === CHAIN_ANCHORS && seconds > last[1]) {
    return Math.floor(last[0] + (seconds - last[1]) / FALLBACK_BLOCK_SECONDS)
  }
  const [a, b] = segment(anchors, seconds, 1)
  const height = a[0] + ((seconds - a[1]) * (b[0] - a[0])) / (b[1] - a[1])
  return Math.max(1, Math.floor(height))
}

/** Начало суточной корзины ноды `day` (высота `day × 1440`), мс. */
export function dayToTime(day: number, tip?: ChainAnchor | null): number {
  return heightToTime(Math.max(1, day * DAY_BLOCKS), tip)
}

/** Начало часовой корзины ноды `hour` (высота `hour × 60`), мс. */
export function hourToTime(hour: number, tip?: ChainAnchor | null): number {
  return heightToTime(Math.max(1, hour * HOUR_BLOCKS), tip)
}
