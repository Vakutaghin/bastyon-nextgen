<template>
  <SC_ActivityBlock>
    <StatsPeriodBar />
    <StatsChart
      :title="t('explorerPage.statsTitle')"
      :subtitle="subtitle"
      :info="t('explorerStats.activityInfo')"
      :points="activity.points.value"
      :series="activity.series.value"
      kind="stack"
      :granularity="period.granularity.value"
      :digits="perDay ? 1 : 0"
      :unit-hint="perDay ? t('explorerStats.perDay') : ''"
      :loading="stats.loading.value"
      :progress="stats.progress.value"
      :failed="stats.failed.value"
      :error="stats.error.value"
      :height="280"
      @retry="stats.retry"
    >
      <template #tools>
        <RouterLink v-slot="{ href, navigate }" custom :to="{ name: 'explorer-stats' }">
          <SC_SectionLink :href="href" @click="navigate">{{
            t('explorerStats.allStats')
          }}</SC_SectionLink>
        </RouterLink>
      </template>
    </StatsChart>
  </SC_ActivityBlock>
</template>

<script setup lang="ts">
// «Активность сети» на «Обзоре»: те же период и данные, что на вкладке
// «Статистика», только один график.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import StatsChart from '../stats-chart/stats-chart.vue'
import StatsPeriodBar from '../stats-period-bar/stats-period-bar.vue'
import { ACTIVITY_SERIES } from '../../stats/stats-model'
import { formatValue } from '../../stats/chart-format'
import { useStatsCharts } from '../../stats/use-stats-charts'
import { SC_SectionLink } from '../../block-explorer-page.styled'
import { SC_ActivityBlock } from '../../stats-page/stats-page.styled'

defineOptions({ name: 'NetworkStatsChart' })

const { t, locale } = useI18n()
const { period, stats, perDay, days, total, chart } = useStatsCharts()
const activity = chart(ACTIVITY_SERIES)

const subtitle = computed(() =>
  total.value
    ? t('explorerStats.activitySubtitle', {
        total: formatValue(total.value, locale.value),
        perDay: formatValue(days.value ? total.value / days.value : 0, locale.value),
      })
    : ''
)
</script>
