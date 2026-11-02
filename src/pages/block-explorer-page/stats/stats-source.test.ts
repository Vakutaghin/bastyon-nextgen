import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getByPRC: vi.fn() }))
vi.mock('@/helpers/api/request', () => ({ getByPRC: mocks.getByPRC }))
vi.mock('@/composables/use-explorer-preferred-node', () => ({ getExplorerRpcConfig: () => ({}) }))

import { chunksFor, fetchDayChunk, isChunkFinal, readHistory, runLimited } from './stats-source'

describe('stats source', () => {
  it('ten-day chunks aligned to node days, newest first', () => {
    expect(chunksFor(2795, 2839)).toEqual([283, 282, 281, 280, 279])
    expect(chunksFor(-5, 3)).toEqual([0])
    expect(isChunkFinal(283, 2839)).toBe(false)
    expect(isChunkFinal(282, 2830)).toBe(true)
  })

  it('a chunk is asked by its top height and ten days', async () => {
    mocks.getByPRC.mockResolvedValueOnce({ data: { '2830': { '200': 1 } } })
    await expect(fetchDayChunk(283)).resolves.toEqual({ '2830': { '200': 1 } })
    expect(mocks.getByPRC.mock.calls[0]![0]).toMatchObject({
      method: 'getstatisticbydays',
      parameters: [2840 * 1440, 10],
    })
  })

  it('limited concurrency, one failure does not stop the rest', async () => {
    let running = 0
    let peak = 0
    const done: number[] = []
    await runLimited([1, 2, 3, 4, 5, 6], 2, async (n) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 1))
      running--
      if (n === 3) throw new Error('timeout')
      done.push(n)
    })
    expect(peak).toBe(2)
    expect(done.sort()).toEqual([1, 2, 4, 5, 6])
  })

  it('no IndexedDB — empty cache, no error', async () => {
    await expect(readHistory(['day-chunk:1'])).resolves.toEqual(new Map())
  })
})
