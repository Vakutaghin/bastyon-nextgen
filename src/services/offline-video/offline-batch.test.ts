// Пачка роликов: в листе — все высоты и сколько займут все ролики (у каждого —
// ближайшее не выше); описания спрашиваются не больше чем по N разом.

import { describe, expect, it } from 'vitest'
import { batchRows, mapLimit } from './offline-batch'
import type { OfflineQuality } from './offline-job'

const q = (height: number, size: number): OfflineQuality => ({
  height,
  size,
  fileUrl: `https://h/${height}.mp4`,
})

describe('offline-batch', () => {
  it('ряды: все высоты по возрастанию; у ролика без такой — ближайшая ниже, а нет ниже — самая маленькая', () => {
    const rows = batchRows([
      [q(144, 10), q(360, 30), q(720, 70)],
      [q(240, 20), q(480, 40)],
    ])
    expect(rows).toEqual([
      // Второму нечего дать не выше 144 — берётся его самое маленькое, 240.
      { height: 144, size: 10 + 20 },
      { height: 240, size: 10 + 20 },
      { height: 360, size: 30 + 20 },
      { height: 480, size: 30 + 40 },
      { height: 720, size: 70 + 40 },
    ])
    expect(batchRows([])).toEqual([])
  })

  it('mapLimit: не больше limit разом, результаты в порядке входа', async () => {
    let running = 0
    let peak = 0
    const out = await mapLimit([5, 1, 3, 2, 4], 2, async (n, i) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, n))
      running--
      return `${i}:${n}`
    })
    expect(peak).toBe(2)
    expect(out).toEqual(['0:5', '1:1', '2:3', '3:2', '4:4'])
    expect(await mapLimit([], 4, async () => 1)).toEqual([])
  })
})
