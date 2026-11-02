<template>
  <SC_ChartCard>
    <SC_ChartHead>
      <SC_ChartTitleGroup>
        <SC_ChartTitle>
          {{ t('explorerStats.heatmapTitle') }}
          <InfoTooltip :text="t('explorerStats.heatmapInfo')" />
        </SC_ChartTitle>
        <SC_ChartSubtitle>{{ t('explorerStats.heatmapSubtitle') }}</SC_ChartSubtitle>
      </SC_ChartTitleGroup>
    </SC_ChartHead>

    <SC_Placeholder v-if="isLoading && !points.length">{{
      t('explorerPage.loading')
    }}</SC_Placeholder>
    <SC_Placeholder v-else-if="!points.length">{{ t('explorerStats.error') }}</SC_Placeholder>
    <template v-else>
      <SC_Heatmap role="table" :aria-label="t('explorerStats.heatmapTitle')">
        <span />
        <SC_HourLabel v-for="h in 24" :key="`h${h}`" aria-hidden="true">
          {{ (h - 1) % 6 === 0 ? h - 1 : '' }}
        </SC_HourLabel>
        <template v-for="day in 7" :key="`d${day}`">
          <SC_DayLabel role="rowheader">{{ weekdayName(day - 1) }}</SC_DayLabel>
          <SC_Cell
            v-for="cell in cells.slice((day - 1) * 24, day * 24)"
            :key="cell.hour"
            role="cell"
            :class="`l${heatLevel(cell.value, range.min, range.max)}`"
            :title="cellLabel(cell)"
            :aria-label="cellLabel(cell)"
          />
        </template>
      </SC_Heatmap>
      <SC_HeatNote v-if="peak">
        {{
          t('explorerStats.heatmapPeak', {
            when: cellWhen(peak),
            n: formatValue(peak.value, locale),
          })
        }}
      </SC_HeatNote>
    </template>
  </SC_ChartCard>
</template>

<script setup lang="ts">
// Часы активности за последнюю неделю: строки — дни недели, столбцы — часы
// суток по местному времени, насыщенность — сколько транзакций было в этот час.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { bcp47 } from '@/i18n'
import InfoTooltip from '../shared/info-tooltip.vue'
import { heatLevel, heatmapCells, type HeatCell } from '../../stats/heatmap'
import { formatValue } from '../../stats/chart-format'
import { useWeekHours } from '../../stats/use-network-stats'
import {
  SC_ChartCard,
  SC_ChartHead,
  SC_ChartTitleGroup,
  SC_ChartTitle,
  SC_ChartSubtitle,
  SC_Placeholder,
} from '../stats-chart/stats-chart.styled'
import {
  SC_Heatmap,
  SC_DayLabel,
  SC_HourLabel,
  SC_Cell,
  SC_HeatNote,
} from './activity-heatmap.styled'

defineOptions({ name: 'ActivityHeatmap' })

const { t, locale } = useI18n()
const { points, isLoading } = useWeekHours()

const cells = computed(() => heatmapCells(points.value))
const range = computed(() => {
  const values = cells.value.map((c) => c.value).filter((v): v is number => v !== null)
  return { min: Math.min(...values), max: Math.max(...values) }
})
const peak = computed(() =>
  cells.value.reduce<HeatCell | null>(
    (best, c) => (c.value !== null && (!best || c.value > (best.value ?? 0)) ? c : best),
    null
  )
)

/** Понедельник — 5 января 2026 года; имена дней — по языку интерфейса. */
function weekdayName(weekday: number, style: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat(bcp47(locale.value), { weekday: style }).format(
    new Date(2026, 0, 5 + weekday)
  )
}

function cellWhen(cell: HeatCell): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${weekdayName(cell.weekday, 'long')}, ${pad(cell.hour)}:00–${pad((cell.hour + 1) % 24)}:00`
}

function cellLabel(cell: HeatCell): string {
  const value = cell.value === null ? '—' : formatValue(cell.value, locale.value)
  return `${cellWhen(cell)}: ${value}`
}
</script>
