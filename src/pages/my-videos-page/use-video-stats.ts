/**
 * Окно ролика, вкладка «Статистика»: то, что видеосервер собрал из отметок
 * плееров, — зрители, время просмотра, удержание и страны за период, как в
 * аналитике творческой студии YouTube. Статистику сервер отдаёт только автору:
 * нужен его токен на сервере ролика.
 */

import { computed, ref, shallowRef, watch, type Ref } from 'vue'

import {
  getVideoStatsOverall,
  getVideoStatsRetention,
  getVideoStatsTimeserie,
  type StatsPeriod,
  type VideoStatsMetric,
  type VideoStatsOverall,
  type VideoStatsRetention,
  type VideoStatsTimeserie,
} from '@/services/peertube/peertube-video-studio'
import { logger } from '@/services/logger'
import type { ServerVideo } from './use-server-videos'

const log = logger.scope('[video-stats]')

export type StatsRange = '7' | '28' | '90' | 'all'
export const STATS_RANGES: StatsRange[] = ['7', '28', '90', 'all']

const DAY_MS = 86_400_000

/** Период для сервера: последние N дней до сейчас; «всё время» — без дат. */
export function statsPeriod(range: StatsRange, now = Date.now()): StatsPeriod {
  if (range === 'all') return {}
  return {
    startDate: new Date(now - Number(range) * DAY_MS).toISOString(),
    endDate: new Date(now).toISOString(),
  }
}

export interface VideoStatsDeps {
  overall: typeof getVideoStatsOverall
  timeserie: typeof getVideoStatsTimeserie
  retention: typeof getVideoStatsRetention
  token: (host: string) => Promise<string>
  now: () => number
}

export type StatsStatus = 'idle' | 'loading' | 'ready' | 'error'

export function useVideoStats(
  video: Ref<ServerVideo>,
  options: { deps?: Partial<VideoStatsDeps>; active: Ref<boolean> }
) {
  const deps: VideoStatsDeps = {
    overall: getVideoStatsOverall,
    timeserie: getVideoStatsTimeserie,
    retention: getVideoStatsRetention,
    token: () => Promise.reject(new Error('no_token')),
    now: () => Date.now(),
    ...options.deps,
  }

  const range = ref<StatsRange>('28')
  const metric = ref<VideoStatsMetric>('viewers')
  const status = ref<StatsStatus>('idle')
  const overall = shallowRef<VideoStatsOverall | null>(null)
  const series = shallowRef<VideoStatsTimeserie | null>(null)
  const retention = shallowRef<VideoStatsRetention>([])
  /** Поколение запроса: ответ на прежний период или ролик не в счёт. */
  let generation = 0
  let retentionFor = ''

  async function load(): Promise<void> {
    const gen = ++generation
    const { host, uuid, id, pointer } = video.value
    const target = uuid || id
    status.value = 'loading'
    try {
      const accessToken = await deps.token(host)
      const period = statsPeriod(range.value, deps.now())
      const params = { host, id: target, accessToken }
      const needRetention = retentionFor !== pointer
      const [nextOverall, nextSeries, nextRetention] = await Promise.all([
        deps.overall({ ...params, period }),
        deps.timeserie({ ...params, metric: metric.value, period }),
        // Удержание — за всё время: от периода не зависит.
        needRetention ? deps.retention(params).catch(() => []) : Promise.resolve(retention.value),
      ])
      if (gen !== generation) return
      overall.value = nextOverall
      series.value = nextSeries
      retention.value = nextRetention
      retentionFor = pointer
      status.value = 'ready'
    } catch (e) {
      if (gen !== generation) return
      log.warn('stats failed', host, e)
      status.value = 'error'
    }
  }

  /** За период никто не смотрел — графики пустые, показываем это словами. */
  const empty = computed(
    () =>
      status.value === 'ready' &&
      !overall.value?.totalViewers &&
      !series.value?.data.some((p) => p.value > 0)
  )

  watch(
    [options.active, range, metric, () => video.value.pointer],
    ([active]) => {
      if (active) void load()
    },
    { immediate: true }
  )

  return { range, metric, status, overall, series, retention, empty, load }
}
