// Окно ролика, «Статистика»: грузится, только когда вкладку открыли; период и
// метрика перезапрашивают сводку и ряд; удержание — один раз на ролик; ответ
// на прежний период не перетирает новый.

import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'

import type { ServerVideo } from './use-server-videos'
import { statsPeriod, useVideoStats, type VideoStatsDeps } from './use-video-stats'

const NOW = Date.parse('2026-10-28T12:00:00.000Z')
const VIDEO = {
  host: 'pt.host',
  id: 42,
  uuid: 'u1',
  pointer: 'peertube://pt.host/u1',
} as ServerVideo

const overall = (viewers: number) => ({
  averageWatchTime: 30,
  totalWatchTime: viewers * 30,
  totalViewers: viewers,
  viewersPeak: 1,
  viewersPeakDate: null,
  countries: [],
})

function setup(over: Partial<VideoStatsDeps> = {}) {
  const deps = {
    overall: vi.fn(async () => overall(4)),
    timeserie: vi.fn(async () => ({
      groupInterval: '1 day',
      data: [{ date: '2026-10-27', value: 4 }],
    })),
    retention: vi.fn(async () => [{ second: 0, retentionPercent: 100 }]),
    token: vi.fn(async () => 'AT'),
    now: () => NOW,
    ...over,
  }
  const active = ref(false)
  const scope = effectScope()
  const stats = scope.run(() => useVideoStats(ref(VIDEO), { deps, active }))!
  return { stats, deps, active }
}

describe('statsPeriod', () => {
  it('последние N дней до сейчас; «всё время» — без дат', () => {
    expect(statsPeriod('7', NOW)).toEqual({
      startDate: '2026-10-21T12:00:00.000Z',
      endDate: '2026-10-28T12:00:00.000Z',
    })
    expect(statsPeriod('all', NOW)).toEqual({})
  })
})

describe('useVideoStats', () => {
  it('пока вкладка закрыта — ничего не грузит; открыли — 28 дней, зрители, токен автора', async () => {
    const { stats, deps, active } = setup()
    await flushPromises()
    expect(deps.overall).not.toHaveBeenCalled()
    active.value = true
    await flushPromises()
    expect(deps.token).toHaveBeenCalledWith('pt.host')
    expect(deps.overall).toHaveBeenCalledWith({
      host: 'pt.host',
      id: 'u1',
      accessToken: 'AT',
      period: statsPeriod('28', NOW),
    })
    expect(deps.timeserie).toHaveBeenCalledWith(expect.objectContaining({ metric: 'viewers' }))
    expect(stats.status.value).toBe('ready')
    expect(stats.empty.value).toBe(false)
  })

  it('период и метрика перезапрашивают; удержание — один раз', async () => {
    const { stats, deps, active } = setup()
    active.value = true
    await flushPromises()
    stats.range.value = 'all'
    await flushPromises()
    expect(deps.overall).toHaveBeenLastCalledWith(expect.objectContaining({ period: {} }))
    stats.metric.value = 'aggregateWatchTime'
    await flushPromises()
    expect(deps.timeserie).toHaveBeenLastCalledWith(
      expect.objectContaining({ metric: 'aggregateWatchTime' })
    )
    expect(deps.retention).toHaveBeenCalledTimes(1)
  })

  it('никто не смотрел — «пусто»; сервер не отдал — ошибка', async () => {
    const quiet = setup({
      overall: vi.fn(async () => overall(0)),
      timeserie: vi.fn(async () => ({ groupInterval: '1 day', data: [] })),
    })
    quiet.active.value = true
    await flushPromises()
    expect(quiet.stats.empty.value).toBe(true)

    const failing = setup({ overall: vi.fn(async () => Promise.reject(new Error('403'))) })
    failing.active.value = true
    await flushPromises()
    expect(failing.stats.status.value).toBe('error')
  })

  it('ответ на прежний период не перетирает новый', async () => {
    let releaseSlow: () => void = () => {}
    const slow = new Promise<void>((resolve) => (releaseSlow = resolve))
    const overallFn = vi
      .fn()
      .mockImplementationOnce(async () => {
        await slow
        return overall(1)
      })
      .mockImplementation(async () => overall(9))
    const { stats, active } = setup({ overall: overallFn })
    active.value = true
    await nextTick()
    stats.range.value = '7'
    await flushPromises()
    releaseSlow()
    await flushPromises()
    expect(stats.overall.value?.totalViewers).toBe(9)
  })
})
