<template>
  <SC_ExplorerWork>
    <SC_ExplorerPage>
      <ExplorerHeader />

      <SC_StatsTop>
        <StatsPeriodBar />

        <SC_ExplorerStatsRow>
          <SC_StatCard v-for="card in cards" :key="card.key">
            <SC_StatCardLabel>{{ card.label }}</SC_StatCardLabel>
            <SC_StatCardValue>
              <Skeleton v-if="card.value === null" :width="90" :height="22" />
              <template v-else>{{ card.value }}</template>
            </SC_StatCardValue>
            <SC_StatCardHint>{{ card.hint }}</SC_StatCardHint>
          </SC_StatCard>
        </SC_ExplorerStatsRow>
      </SC_StatsTop>

      <SC_ChartsGrid>
        <StatsChart
          class="wide"
          :title="t('explorerPage.statsTitle')"
          :subtitle="activitySubtitle"
          :info="t('explorerStats.activityInfo')"
          :points="activity.points.value"
          :series="activity.series.value"
          kind="stack"
          v-bind="common"
          :digits="perDay ? 1 : 0"
          :height="300"
        />

        <StatsChart
          :title="t('explorerStats.publicationsTitle')"
          :subtitle="perDayHint"
          :info="t('explorerStats.publicationsInfo')"
          :points="publications.points.value"
          :series="publications.series.value"
          kind="line"
          v-bind="common"
          :digits="perDay ? 1 : 0"
        />

        <StatsChart
          :title="t('explorerStats.engagementTitle')"
          :subtitle="t('explorerStats.engagementSubtitle')"
          :info="t('explorerStats.engagementInfo')"
          :points="engagement.points.value"
          :series="engagement.series.value"
          kind="line"
          v-bind="common"
          unit-hint=""
          :digits="2"
        />

        <StatsChart
          :title="t('explorerStats.transfersTitle')"
          :subtitle="transfersSubtitle"
          :info="t('explorerStats.transfersInfo')"
          :points="transfers.points.value"
          :series="transfers.series.value"
          kind="bar"
          v-bind="common"
          :digits="perDay ? 1 : 0"
        />

        <StatsChart
          :title="t('explorerStats.accountsTitle')"
          :subtitle="accountsSubtitle"
          :info="t('explorerStats.accountsInfo')"
          :points="accountsPoints"
          :series="accountsSeries"
          kind="bar"
          granularity="day"
          :loading="accounts.isLoading.value"
          :error="accounts.error.value"
        />

        <ActivityHeatmap />

        <StatsChart
          :title="t('explorerStats.emissionTitle')"
          :subtitle="emissionSubtitle"
          :info="t('explorerStats.emissionInfo')"
          :points="emissionPoints"
          :series="emissionSeries"
          kind="line"
          granularity="day"
          :zero-based="false"
          :loading="chainSamples.loading.value"
        />

        <StatsChart
          :title="t('explorerStats.difficultyTitle')"
          :subtitle="t('explorerStats.difficultySubtitle')"
          :info="t('explorerStats.difficultyInfo')"
          :points="difficultyPoints"
          :series="difficultySeries"
          kind="line"
          granularity="day"
          :zero-based="false"
          :loading="chainSamples.loading.value"
        />
      </SC_ChartsGrid>
    </SC_ExplorerPage>
  </SC_ExplorerWork>
</template>

<script setup lang="ts">
// Вкладка «Статистика»: один период на всю страницу и графики, которые по
// нему строятся. «Новые аккаунты» и «Когда сеть активна» — всегда за
// последнюю неделю: по суткам нода аккаунты не считает, по часам отдаёт
// только 7 дней.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Skeleton } from '@/components'
import ExplorerHeader from '../components/explorer-header/explorer-header.vue'
import StatsChart from '../components/stats-chart/stats-chart.vue'
import StatsPeriodBar from '../components/stats-period-bar/stats-period-bar.vue'
import ActivityHeatmap from '../components/activity-heatmap/activity-heatmap.vue'
import type { ChartSeries } from '../components/stats-chart/render-chart'
import {
  ACTIVITY_SERIES,
  ENGAGEMENT_SERIES,
  PUBLICATION_SERIES,
  PUBLICATION_TYPES,
  TRANSFER_SERIES,
  periodStart,
  nextPeriod,
  type ChartPoint,
} from '../stats/stats-model'
import { formatValue } from '../stats/chart-format'
import { useStatsCharts } from '../stats/use-stats-charts'
import { useChainSamples, useWeekAccounts } from '../stats/use-network-stats'
import {
  SC_ExplorerWork,
  SC_ExplorerPage,
  SC_ExplorerStatsRow,
  SC_StatCard,
  SC_StatCardLabel,
  SC_StatCardValue,
  SC_StatCardHint,
} from '../block-explorer-page.styled'
import { SC_StatsTop, SC_ChartsGrid } from './stats-page.styled'

defineOptions({ name: 'ExplorerStatsPage' })

const { t, locale } = useI18n()
const { period, stats, perDay, days, total, chart, sumOf } = useStatsCharts()

const activity = chart(ACTIVITY_SERIES)
const publications = chart(PUBLICATION_SERIES)
const engagement = chart(ENGAGEMENT_SERIES, true)
const transfers = chart(TRANSFER_SERIES)

const fmt = (n: number | null, digits = 0) => formatValue(n, locale.value, digits)
const daily = (n: number) => (days.value ? n / days.value : 0)

/** Общие для графиков периода свойства. */
const common = computed(() => ({
  granularity: period.granularity.value,
  unitHint: perDay.value ? t('explorerStats.perDay') : '',
  loading: stats.loading.value,
  error: stats.error.value,
  onRetry: stats.retry,
}))

const perDayHint = computed(() => (perDay.value ? t('explorerStats.perDayAverage') : ''))

const activitySubtitle = computed(() =>
  total.value
    ? t('explorerStats.activitySubtitle', {
        total: fmt(total.value),
        perDay: fmt(daily(total.value)),
      })
    : ''
)
const transfersSubtitle = computed(() => {
  const n = sumOf([1])
  return n ? t('explorerStats.transfersSubtitle', { total: fmt(n), perDay: fmt(daily(n), 1) }) : ''
})

// --- Аккаунты: всего и новые по суткам за последнюю неделю ----------------
const accounts = useWeekAccounts()
const accountsSeries = computed<ChartSeries[]>(() => [
  { key: 'added', label: t('explorerStats.series.newAccounts'), color: 'var(--ui-series-5)' },
])
const accountsPoints = computed<ChartPoint[]>(() => {
  const byDay = new Map<number, number>()
  for (const p of accounts.points.value) {
    const day = periodStart(p.t + (p.end - p.t) / 2, 'day')
    byDay.set(day, (byDay.get(day) ?? 0) + p.added)
  }
  return [...byDay]
    .sort((a, b) => a[0] - b[0])
    .map(([day, added]) => ({ t: day, end: nextPeriod(day, 'day'), values: { added } }))
})
const weekAdded = computed(() => accounts.points.value.reduce((s, p) => s + p.added, 0))
const accountsSubtitle = computed(() =>
  accounts.total.value
    ? t('explorerStats.accountsSubtitle', {
        total: fmt(accounts.total.value),
        n: fmt(weekAdded.value),
      })
    : ''
)

// --- Выпуск монет и сложность стейкинга по выборке блоков -----------------
const chainSamples = useChainSamples(period.range)
const samplePoints = (pick: 'emission' | 'difficulty') =>
  chainSamples.samples.value
    .filter((s) => s[pick] !== null)
    .map((s) => ({ t: s.t, end: s.t, values: { [pick]: s[pick] } }))
const emissionPoints = computed<ChartPoint[]>(() => samplePoints('emission'))
const difficultyPoints = computed<ChartPoint[]>(() => samplePoints('difficulty'))
const emissionSeries = computed<ChartSeries[]>(() => [
  { key: 'emission', label: t('explorerStats.series.emission'), color: 'var(--ui-series-6)' },
])
const difficultySeries = computed<ChartSeries[]>(() => [
  { key: 'difficulty', label: t('explorerStats.series.difficulty'), color: 'var(--ui-series-7)' },
])
const emissionSubtitle = computed(() => {
  const pts = emissionPoints.value
  const first = pts[0]?.values.emission
  const last = pts[pts.length - 1]?.values.emission
  if (!first || !last || pts.length < 2) return ''
  return t('explorerStats.emissionSubtitle', {
    total: fmt(last),
    added: fmt(last - first),
    percent: fmt(((last - first) / first) * 100, 1),
  })
})

// --- Карточки итогов ------------------------------------------------------
const cards = computed(() => {
  const loaded = stats.points.value.length > 0
  const pubs = sumOf(PUBLICATION_TYPES)
  const ratings = sumOf([300, 301])
  return [
    {
      key: 'tx',
      label: t('explorerStats.cards.transactions'),
      value: loaded ? fmt(total.value) : null,
      hint: loaded ? t('explorerStats.cards.perDay', { n: fmt(daily(total.value)) }) : '',
    },
    {
      key: 'publications',
      label: t('explorerStats.cards.publications'),
      value: loaded ? fmt(pubs) : null,
      hint: loaded ? t('explorerStats.cards.perDay', { n: fmt(daily(pubs), 1) }) : '',
    },
    {
      key: 'ratings',
      label: t('explorerStats.cards.ratings'),
      value: loaded ? fmt(ratings) : null,
      hint:
        loaded && pubs
          ? t('explorerStats.cards.perPublication', { n: fmt(sumOf([300]) / pubs, 1) })
          : '',
    },
    {
      key: 'accounts',
      label: t('explorerStats.cards.accounts'),
      value: accounts.total.value === null ? null : fmt(accounts.total.value),
      hint:
        accounts.total.value === null
          ? ''
          : t('explorerStats.cards.weekAdded', { n: fmt(weekAdded.value) }),
    },
  ]
})
</script>
