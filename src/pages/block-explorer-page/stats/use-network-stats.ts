/**
 * Статистика сети за выбранный период — для графиков эксплорера.
 *
 * Часы — один запрос (последние 168 ч), сутки — кусками по 10 (stats-source).
 * Куски приходят от свежих к старым, график дорисовывается по мере прихода.
 * Готовые куски живут в памяти до перезагрузки, законченные — ещё и в
 * IndexedDB. Не пришедший кусок спрашиваем ещё раз в конце; не пришёл и
 * тогда — график показывает дыру и предлагает повторить.
 */

import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useNodeInfo } from '@/composables/use-block-explorer-queries'
import {
  DAY_BLOCKS,
  HOUR_BLOCKS,
  heightToTime,
  hourToTime,
  timeToHeight,
  type ChainAnchor,
} from './chain-time'
import {
  bucketsToPoints,
  groupPoints,
  periodStart,
  type BucketKind,
  type Buckets,
  type Granularity,
  type StatsPoint,
} from './stats-model'
import type { PeriodRange } from './stats-period'
import {
  chunksFor,
  fetchAccountsByHour,
  fetchDayChunk,
  fetchDifficulty,
  fetchEmission,
  fetchHours,
  isChunkFinal,
  readHistory,
  runLimited,
  writeHistory,
} from './stats-source'

const CONCURRENCY = 4
const HOURS_TTL_MS = 5 * 60_000

/** Куски суток, уже пришедшие за эту сессию. */
const dayChunks = new Map<number, Buckets>()
let hoursCache: { at: number; data: Promise<Buckets> } | null = null

function loadHours(): Promise<Buckets> {
  if (!hoursCache || Date.now() - hoursCache.at > HOURS_TTL_MS) {
    const data = fetchHours(168)
    hoursCache = { at: Date.now(), data }
    data.catch(() => (hoursCache = null))
  }
  return hoursCache.data
}

const chunkKey = (k: number) => `day-chunk:${k}`

/** Вершина цепочки [высота, время] — для перевода корзин во время. */
export function useChainTip(): Ref<ChainAnchor | null> {
  const { data } = useNodeInfo()
  return computed<ChainAnchor | null>(() => {
    const last = data.value?.data?.lastblock
    return last?.height && last?.time ? [last.height, last.time] : null
  })
}

export interface StatsProgress {
  done: number
  total: number
}

export function useNetworkStats(range: Ref<PeriodRange>, granularity: Ref<Granularity>) {
  const tip = useChainTip()
  const source = computed<BucketKind>(() => (granularity.value === 'hour' ? 'hour' : 'day'))

  const hours = shallowRef<Buckets | null>(null)
  const days = shallowRef<Buckets>({})
  const loading = ref(false)
  const progress = ref<StatsProgress | null>(null)
  const failed = ref(0)
  const error = ref<unknown>(null)
  let generation = 0

  /** Сутки ноды, которые покрывает период; недели и месяцы — с начала первого. */
  const dayWindow = computed(() => {
    const from =
      granularity.value === 'week' || granularity.value === 'month'
        ? periodStart(range.value.from, granularity.value)
        : range.value.from
    return {
      from: Math.floor(timeToHeight(from, tip.value) / DAY_BLOCKS),
      to: Math.floor(timeToHeight(range.value.to, tip.value) / DAY_BLOCKS),
    }
  })

  async function loadDays(gen: number): Promise<void> {
    const { from, to } = dayWindow.value
    const currentDay = tip.value
      ? Math.floor(tip.value[0] / DAY_BLOCKS)
      : Math.floor(timeToHeight(Date.now()) / DAY_BLOCKS)
    const chunks = chunksFor(from, to)
    const publish = () => {
      if (gen !== generation) return
      const merged: Buckets = {}
      for (const k of chunks) Object.assign(merged, dayChunks.get(k) ?? {})
      days.value = merged
    }

    let missing = chunks.filter((k) => !dayChunks.has(k) || !isChunkFinal(k, currentDay))
    const stored = await readHistory<Buckets>(
      missing.filter((k) => isChunkFinal(k, currentDay)).map(chunkKey)
    )
    for (const k of missing) {
      const hit = stored.get(chunkKey(k))
      if (hit) dayChunks.set(k, hit)
    }
    missing = missing.filter((k) => !stored.has(chunkKey(k)))
    if (gen !== generation) return
    publish()

    progress.value = { done: chunks.length - missing.length, total: chunks.length }
    const toStore = new Map<string, Buckets>()
    const attempt = async (queue: number[]): Promise<number[]> => {
      const left: number[] = []
      await runLimited(queue, CONCURRENCY, async (k) => {
        if (gen !== generation) return
        try {
          const data = await fetchDayChunk(k)
          dayChunks.set(k, data)
          if (isChunkFinal(k, currentDay)) toStore.set(chunkKey(k), data)
          if (gen === generation && progress.value) progress.value.done += 1
          publish()
        } catch {
          left.push(k)
        }
      })
      return left
    }
    const stillMissing = await attempt(await attempt(missing))
    void writeHistory(toStore)
    if (gen !== generation) return
    failed.value = stillMissing.length
  }

  async function load(): Promise<void> {
    const gen = ++generation
    loading.value = true
    failed.value = 0
    error.value = null
    progress.value = null
    try {
      if (source.value === 'hour') hours.value = await loadHours()
      else await loadDays(gen)
    } catch (e) {
      if (gen === generation) error.value = e
    } finally {
      if (gen === generation) {
        loading.value = false
        progress.value = null
      }
    }
  }

  watch(
    () => [range.value.from, range.value.to, source.value, granularity.value],
    () => void load(),
    { immediate: true }
  )

  /** Точки периода, сгруппированные по шагу графика. */
  const points = computed<StatsPoint[]>(() => {
    if (source.value === 'hour') {
      const all = bucketsToPoints(hours.value, 'hour', tip.value)
      return all.filter((p) => p.end > range.value.from && p.t < range.value.to)
    }
    const { from, to } = dayWindow.value
    const inWindow: Buckets = {}
    for (const [day, counts] of Object.entries(days.value)) {
      const n = Number(day)
      if (n >= from && n <= to) inWindow[day] = counts
    }
    return groupPoints(bucketsToPoints(inWindow, 'day', tip.value), granularity.value, 'day')
  })

  return { points, source, loading, progress, failed, error, retry: load }
}

/** Активность за последние 7 суток по часам — для «Когда сеть активна». */
export function useWeekHours() {
  const tip = useChainTip()
  const query = useQuery({
    queryKey: ['explorer', 'stats-week-hours'] as const,
    queryFn: loadHours,
    staleTime: HOURS_TTL_MS,
    refetchOnWindowFocus: false,
  })
  const points = computed(() => bucketsToPoints(query.data.value, 'hour', tip.value))
  return { points, isLoading: query.isLoading, error: query.error }
}

export interface AccountsPoint {
  t: number
  end: number
  /** Аккаунтов в сети на конец часа. */
  total: number
  /** Новых за час. */
  added: number
}

/** Аккаунты за последние 7 суток: всего и новые по часам. */
export function useWeekAccounts() {
  const tip = useChainTip()
  const query = useQuery({
    queryKey: ['explorer', 'stats-week-accounts'] as const,
    queryFn: () => fetchAccountsByHour(168),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
  const points = computed<AccountsPoint[]>(() => {
    const data = query.data.value ?? {}
    const hoursSorted = Object.keys(data)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
    const out: AccountsPoint[] = []
    for (let i = 1; i < hoursSorted.length; i++) {
      const hour = hoursSorted[i]!
      const total = data[String(hour)]!
      const prev = data[String(hoursSorted[i - 1]!)]!
      out.push({
        t: hourToTime(hour, tip.value),
        end: hourToTime(hour + 1, tip.value),
        total,
        added: Math.max(0, total - prev),
      })
    }
    return out
  })
  const total = computed(() => points.value[points.value.length - 1]?.total ?? null)
  return { points, total, isLoading: query.isLoading, error: query.error }
}

export interface ChainSample {
  t: number
  height: number
  emission: number | null
  difficulty: number | null
}

/** Шаг выборки в сутках: не больше ~40 точек на период. */
const SAMPLE_STEPS = [1, 7, 14, 30, 61, 91, 182]

/**
 * Выпуск монет и сложность стейкинга по выборке блоков периода. Выборка —
 * по высотам, кратным шагу в сутках ноды: при смене периода те же блоки
 * переиспользуются, а прошлые значения не меняются и лежат в IndexedDB.
 */
export function useChainSamples(range: Ref<PeriodRange>) {
  const tip = useChainTip()
  const samples = shallowRef<ChainSample[]>([])
  const loading = ref(false)
  let generation = 0

  async function load(): Promise<void> {
    const gen = ++generation
    const fromDay = Math.ceil(timeToHeight(range.value.from, tip.value) / DAY_BLOCKS)
    const tipHeight = tip.value?.[0] ?? timeToHeight(Date.now())
    const toDay = Math.floor(tipHeight / DAY_BLOCKS)
    const span = Math.max(1, toDay - fromDay)
    const step = SAMPLE_STEPS.find((s) => span / s <= 40) ?? 365
    const heights: number[] = []
    for (let day = Math.ceil(fromDay / step) * step; day <= toDay; day += step) {
      heights.push(Math.max(1, day * DAY_BLOCKS))
    }
    // Последняя точка — свежий блок, кратный 10 (нода сама округляет вершину).
    const last = Math.floor((tipHeight - HOUR_BLOCKS) / 10) * 10
    if (!heights.length || last - heights[heights.length - 1]! > step * DAY_BLOCKS * 0.25) {
      heights.push(last)
    }

    const keys = heights.flatMap((h) => [`emission:${h}`, `difficulty:${h}`])
    const stored = await readHistory<number>(keys)
    const values = new Map<string, number | null>(stored)
    const publish = () => {
      if (gen !== generation) return
      samples.value = heights.map((h) => ({
        t: heightToTime(h, tip.value),
        height: h,
        emission: values.get(`emission:${h}`) ?? null,
        difficulty: values.get(`difficulty:${h}`) ?? null,
      }))
    }
    publish()
    loading.value = true
    const toStore = new Map<string, number>()
    const missing = keys.filter((k) => !values.has(k))
    await runLimited(missing, CONCURRENCY, async (key) => {
      if (gen !== generation) return
      const [kind, raw] = key.split(':')
      const h = Number(raw)
      const value = kind === 'emission' ? await fetchEmission(h) : await fetchDifficulty(h)
      values.set(key, value)
      if (value !== null && h !== last) toStore.set(key, value)
      publish()
    })
    void writeHistory(toStore)
    if (gen === generation) loading.value = false
  }

  watch(
    () => [range.value.from, range.value.to, tip.value?.[0] ?? 0],
    (next, prev) => {
      // Вершина растёт каждую минуту — перезапрашиваем только при смене периода
      // или когда вершина впервые стала известна.
      if (prev && next[0] === prev[0] && next[1] === prev[1] && prev[2]) return
      void load()
    },
    { immediate: true }
  )

  return { samples, loading }
}
