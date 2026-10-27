<template>
  <SC_Stats>
    <!-- Аналитика ролика, как в творческой студии YouTube: период сверху
         задаёт всё ниже; «Зрители» и «Время просмотра» переключают график. -->
    <SC_StatsBar>
      <Segmented
        v-model:value="stats.range.value"
        :options="rangeOptions"
        :aria-label="t('mediaStudio.stats.periodLabel')"
      />
    </SC_StatsBar>

    <SC_StatsNote v-if="stats.status.value === 'error'" class="error" role="alert">
      {{ t('mediaStudio.stats.failed') }}
      <Button size="small" @click="stats.load()">{{ t('mediaStudio.retry') }}</Button>
    </SC_StatsNote>
    <Spin v-else-if="!stats.overall.value" />

    <SC_StatsBody v-else :class="{ refreshing: stats.status.value === 'loading' }">
      <SC_Tiles>
        <SC_MetricTile
          type="button"
          :class="{ selected: stats.metric.value === 'viewers' }"
          :aria-pressed="stats.metric.value === 'viewers'"
          @click="stats.metric.value = 'viewers'"
        >
          <span>{{ t('mediaStudio.stats.viewers') }}</span>
          <strong>{{ formatCount(stats.overall.value.totalViewers) }}</strong>
        </SC_MetricTile>
        <SC_MetricTile
          type="button"
          :class="{ selected: stats.metric.value === 'aggregateWatchTime' }"
          :aria-pressed="stats.metric.value === 'aggregateWatchTime'"
          @click="stats.metric.value = 'aggregateWatchTime'"
        >
          <span>{{ t('mediaStudio.stats.watchTime') }}</span>
          <strong>{{ formatWatchTime(stats.overall.value.totalWatchTime) }}</strong>
        </SC_MetricTile>
        <SC_Tile>
          <span>{{ t('mediaStudio.stats.averageWatchTime') }}</span>
          <strong>{{ formatWatchTime(stats.overall.value.averageWatchTime) }}</strong>
        </SC_Tile>
        <SC_Tile>
          <span>{{ t('mediaStudio.stats.totalViews') }}</span>
          <strong>{{ views === null ? '—' : formatCount(views) }}</strong>
        </SC_Tile>
      </SC_Tiles>

      <SC_StatsNote v-if="stats.empty.value">{{ t('mediaStudio.stats.empty') }}</SC_StatsNote>
      <template v-else>
        <SC_StatsSection>
          <SC_StatsTitle>{{ chartTitle }}</SC_StatsTitle>
          <StatsChart
            kind="columns"
            :points="seriesPoints"
            :title="chartTitle"
            :column-label="t('mediaStudio.stats.columnTime')"
            :value-label="chartTitle"
            :format-value="seriesValue"
            :format-tick="seriesTick"
            :fractional="stats.metric.value === 'aggregateWatchTime'"
          />
        </SC_StatsSection>

        <SC_StatsSection v-if="retentionPoints.length > 1">
          <SC_StatsTitle>{{ t('mediaStudio.stats.retention') }}</SC_StatsTitle>
          <SC_StatsHint>{{ t('mediaStudio.stats.retentionHint') }}</SC_StatsHint>
          <StatsChart
            kind="line"
            :points="retentionPoints"
            :title="t('mediaStudio.stats.retention')"
            :column-label="t('mediaStudio.stats.columnMoment')"
            :value-label="t('mediaStudio.stats.columnRetention')"
            :format-value="percent"
            :format-tick="percent"
            :y-ticks="[0, 25, 50, 75, 100]"
          />
        </SC_StatsSection>

        <SC_StatsSection v-if="countries.length">
          <SC_StatsTitle>{{ t('mediaStudio.stats.countries') }}</SC_StatsTitle>
          <SC_Countries>
            <li v-for="country in countries" :key="country.key">
              <span>{{ country.name }}</span>
              <SC_CountryBar aria-hidden="true">
                <SC_CountryFill :share="country.share" />
              </SC_CountryBar>
              <strong>{{ formatCount(country.viewers) }}</strong>
            </li>
          </SC_Countries>
        </SC_StatsSection>
      </template>
    </SC_StatsBody>

    <SC_StatsHint>{{ t('mediaStudio.stats.note') }}</SC_StatsHint>
  </SC_Stats>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button, Segmented, Spin } from 'ant-design-vue'

import { formatDuration } from '@/b-components/video-uploader/utils/video-formatter'
import { dateLocale } from '@/helpers/common/date-formatter'
import { formatCount, formatWatchTime } from '../studio-format'
import type { ServerVideo } from '../use-server-videos'
import { STATS_RANGES, useVideoStats, type VideoStatsDeps } from '../use-video-stats'
import StatsChart, { type ChartPoint } from './stats-chart.vue'
import {
  SC_Countries,
  SC_CountryBar,
  SC_CountryFill,
  SC_MetricTile,
  SC_Stats,
  SC_StatsBar,
  SC_StatsBody,
  SC_StatsHint,
  SC_StatsNote,
  SC_StatsSection,
  SC_StatsTitle,
  SC_Tile,
  SC_Tiles,
} from './video-stats-panel.styled'

const props = defineProps<{
  video: ServerVideo
  /** Просмотры за всё время — из сведений ролика. */
  views: number | null
  active: boolean
  deps?: Partial<VideoStatsDeps>
}>()

const { t } = useI18n()

const stats = useVideoStats(toRef(props, 'video'), {
  active: toRef(props, 'active'),
  deps: props.deps,
})

const rangeOptions = computed(() =>
  STATS_RANGES.map((range) => ({
    value: range,
    label:
      range === 'all'
        ? t('mediaStudio.stats.periodAll')
        : t('mediaStudio.stats.periodDays', { n: Number(range) }, Number(range)),
  }))
)

/** Подпись точки по шагу, который выбрал сервер: месяцы, дни, часы, минуты. */
function pointLabel(iso: string, interval: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const locale = dateLocale()
  if (/month/.test(interval))
    return date.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
  if (/day/.test(interval))
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  return date.toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Время просмотра на графике — в минутах или часах, чтобы деления были круглыми. */
const watchUnit = computed<{ seconds: number; unit: 'second' | 'minute' | 'hour' }>(() => {
  const max = Math.max(0, ...(stats.series.value?.data.map((point) => point.value) ?? []))
  if (max >= 2 * 3600) return { seconds: 3600, unit: 'hour' }
  if (max >= 120) return { seconds: 60, unit: 'minute' }
  return { seconds: 1, unit: 'second' }
})

const watchTime = computed(() => stats.metric.value === 'aggregateWatchTime')

const seriesPoints = computed<ChartPoint[]>(() => {
  const series = stats.series.value
  if (!series) return []
  const scale = watchTime.value ? watchUnit.value.seconds : 1
  return series.data.map((point, index) => ({
    x: index,
    label: pointLabel(point.date, series.groupInterval),
    value: point.value / scale,
  }))
})

const chartTitle = computed(() =>
  watchTime.value ? t('mediaStudio.stats.watchTime') : t('mediaStudio.stats.viewers')
)

const unitFormat = (unit: 'second' | 'minute' | 'hour', value: number): string =>
  new Intl.NumberFormat(dateLocale(), {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value)

const seriesValue = (value: number): string =>
  watchTime.value ? formatWatchTime(value * watchUnit.value.seconds) : formatCount(value)
const seriesTick = (value: number): string =>
  watchTime.value ? unitFormat(watchUnit.value.unit, value) : formatCount(value)

const percent = (value: number): string =>
  new Intl.NumberFormat(dateLocale(), { style: 'percent', maximumFractionDigits: 0 }).format(
    value / 100
  )

const retentionPoints = computed<ChartPoint[]>(() =>
  stats.retention.value.map((point) => ({
    x: point.second,
    label: formatDuration(point.second),
    value: point.retentionPercent,
  }))
)

/** Страны по числу зрителей; дальше восьмой — «Другие». */
const COUNTRIES_SHOWN = 8
const countries = computed(() => {
  const list = stats.overall.value?.countries ?? []
  const total = list.reduce((sum, country) => sum + country.viewers, 0) || 1
  let names: Intl.DisplayNames | null = null
  try {
    names = new Intl.DisplayNames([dateLocale()], { type: 'region' })
  } catch {
    names = null
  }
  const nameOf = (code: string): string => {
    try {
      return names?.of(code.toUpperCase()) ?? code
    } catch {
      return code
    }
  }
  const shown = list.slice(0, COUNTRIES_SHOWN)
  const rest = list.slice(COUNTRIES_SHOWN).reduce((sum, country) => sum + country.viewers, 0)
  const rows = shown.map((country) => ({
    key: country.isoCode,
    name: nameOf(country.isoCode),
    viewers: country.viewers,
  }))
  if (rest) rows.push({ key: '*', name: t('mediaStudio.stats.otherCountries'), viewers: rest })
  return rows.map((row) => ({ ...row, share: `${Math.round((row.viewers / total) * 100)}%` }))
})
</script>
