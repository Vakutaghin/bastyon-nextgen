/**
 * Статистика сети за выбранный период — для графиков эксплорера.
 *
 * Данные — из истории на устройстве (stats-sync): период и свой диапазон
 * только выбирают из неё, сеть при переключении не спрашивается. Часы —
 * последние 168 (столько отдаёт нода), сутки — за всё время.
 */

import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { DAY_BLOCKS, HOUR_BLOCKS, heightToTime, hourToTime, timeToHeight } from './chain-time'
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
  fetchDifficulty,
  fetchEmission,
  readHistory,
  runLimited,
  writeHistory,
} from './stats-source'
import { useChainTip, useStatsSync } from './stats-sync'

const CONCURRENCY = 4

export function useNetworkStats(range: Ref<PeriodRange>, granularity: Ref<Granularity>) {
  const sync = useStatsSync()
  const tip = sync.tip
  const source = computed<BucketKind>(() => (granularity.value === 'hour' ? 'hour' : 'day'))

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

  /** Точки периода, сгруппированные по шагу графика. */
  const points = computed<StatsPoint[]>(() => {
    if (source.value === 'hour') {
      const all = bucketsToPoints(sync.hours.value, 'hour', tip.value)
      return all.filter((p) => p.end > range.value.from && p.t < range.value.to)
    }
    const { from, to } = dayWindow.value
    const inWindow: Buckets = {}
    for (const [day, counts] of Object.entries(sync.days.value)) {
      const n = Number(day)
      if (n >= from && n <= to) inWindow[day] = counts
    }
    return groupPoints(bucketsToPoints(inWindow, 'day', tip.value), granularity.value, 'day')
  })

  // Пустой период во время синхронизации — «Загрузка», а не «нет данных»; с
  // данными график не гасим: история докачивается минутами.
  const loading = computed(() => sync.syncing.value && points.value.length === 0)
  const error = computed(() => (points.value.length ? null : sync.error.value))

  return { points, source, loading, error, retry: sync.refresh }
}

/** Активность за последние 7 суток по часам — для «Когда сеть активна». */
export function useWeekHours() {
  const sync = useStatsSync()
  const points = computed(() => bucketsToPoints(sync.hours.value, 'hour', sync.tip.value))
  const isLoading = computed(() => sync.syncing.value && !sync.hours.value)
  return { points, isLoading, error: sync.error }
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
  const sync = useStatsSync()
  const tip = sync.tip
  const points = computed<AccountsPoint[]>(() => {
    const data = sync.accounts.value ?? {}
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
  const isLoading = computed(() => sync.syncing.value && !sync.accounts.value)
  return { points, total, isLoading, error: sync.error }
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
