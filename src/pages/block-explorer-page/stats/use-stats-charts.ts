/**
 * Данные графиков за выбранный период: одна загрузка на страницу, из неё —
 * серии каждого графика и итоги для карточек.
 */

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChartSeries } from '../components/stats-chart/render-chart'
import {
  coveredDays,
  sumTypes,
  toChartPoints,
  totalOf,
  type Counts,
  type SeriesSpec,
} from './stats-model'
import { useNetworkStats } from './use-network-stats'
import { useStatsPeriod } from './use-stats-period'

export function useStatsCharts() {
  const { t } = useI18n()
  const period = useStatsPeriod()
  const stats = useNetworkStats(period.range, period.granularity)

  /** Недели и месяцы показываем в среднем за сутки. */
  const perDay = computed(
    () => period.granularity.value === 'week' || period.granularity.value === 'month'
  )
  const days = computed(() => coveredDays(stats.points.value, stats.source.value))

  /** Все транзакции периода по типам. */
  const totals = computed<Counts>(() => {
    const out: Counts = {}
    for (const p of stats.points.value) {
      for (const [type, n] of Object.entries(p.counts)) out[type] = (out[type] ?? 0) + n
    }
    return out
  })
  const total = computed(() => totalOf(totals.value))

  function chart(specs: readonly SeriesSpec[], ratio = false) {
    return {
      series: computed<ChartSeries[]>(() =>
        specs.map((s) => ({ key: s.key, label: t(s.labelKey), color: s.color }))
      ),
      points: computed(() =>
        toChartPoints(
          stats.points.value,
          specs,
          period.granularity.value,
          stats.source.value,
          ratio
        )
      ),
    }
  }

  return {
    period,
    stats,
    perDay,
    days,
    totals,
    total,
    chart,
    sumOf: (types: readonly number[]) => sumTypes(totals.value, types),
  }
}
