// Пачка роликов — коллекция, плейлист, личный список: качество одно на всех
// (у каждого ролика — ближайшее не выше выбранного), в листе выбора — сколько
// займут все вместе.

import { pickQuality, type OfflineQuality } from './offline-job'

export interface OfflineBatchRow {
  height: number
  /** Сумма размеров роликов в этом качестве, байт; 0 — серверы не сказали. */
  size: number
}

/** Ряды листа: все высоты, что есть хоть у одного ролика, по возрастанию. */
export function batchRows(lists: readonly (readonly OfflineQuality[])[]): OfflineBatchRow[] {
  const heights = [...new Set(lists.flatMap((qs) => qs.map((q) => q.height)))].sort((a, b) => a - b)
  return heights.map((height) => ({
    height,
    size: lists.reduce((sum, qs) => sum + (pickQuality(qs, height)?.size ?? 0), 0),
  }))
}

/** `fn` для каждого элемента, не больше `limit` разом; порядок результатов — как у входа. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++
      out[index] = await fn(items[index]!, index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}
