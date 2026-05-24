<template>
  <SC_StatsCard>
    <SC_StatsHeader>
      <SC_StatsTitleGroup>
        <SC_StatsTitle>Активность сети</SC_StatsTitle>
        <SC_StatsSubtitle>
          {{ subtitle }}
        </SC_StatsSubtitle>
      </SC_StatsTitleGroup>
      <SC_StatsToggle role='tablist'>
        <SC_StatsToggleBtn
          type='button'
          :class='{ active: granularity === "hours" }'
          @click='granularity = "hours"'
        >
          48 часов
        </SC_StatsToggleBtn>
        <SC_StatsToggleBtn
          type='button'
          :class='{ active: granularity === "days" }'
          @click='granularity = "days"'
        >
          30 дней
        </SC_StatsToggleBtn>
      </SC_StatsToggle>
    </SC_StatsHeader>

    <SC_StatsPlaceholder v-if='isLoading'>Загрузка…</SC_StatsPlaceholder>
    <SC_StatsPlaceholder v-else-if='error'>Не удалось загрузить статистику</SC_StatsPlaceholder>
    <SC_StatsPlaceholder v-else-if='!points.length'>Нет данных</SC_StatsPlaceholder>
    <SC_ChartHost v-else ref='hostRef'>
      <svg ref='svgRef' :viewBox='`0 0 ${WIDTH} ${HEIGHT}`' preserveAspectRatio='none' />
    </SC_ChartHost>

    <SC_Legend v-if='points.length'>
      <SC_LegendItem v-for='cat in CATEGORIES' :key='cat.key'>
        <SC_LegendDot :style='{ background: cat.color }' />
        <span>{{ cat.label }}</span>
      </SC_LegendItem>
    </SC_Legend>
  </SC_StatsCard>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref, watch, nextTick } from 'vue'
import * as d3 from 'd3'
import { useStatsByHours, useStatsByDays } from '@/composables/use-block-explorer-queries'
import {
  aggregateStats,
  sumTotals,
  type StatsPoint,
} from './aggregate-stats'
import {
  SC_StatsCard,
  SC_StatsHeader,
  SC_StatsTitleGroup,
  SC_StatsTitle,
  SC_StatsSubtitle,
  SC_StatsToggle,
  SC_StatsToggleBtn,
  SC_ChartHost,
  SC_Legend,
  SC_LegendItem,
  SC_LegendDot,
  SC_StatsPlaceholder,
} from './network-stats-chart.styled'

defineOptions({ name: 'NetworkStatsChart' })

const WIDTH = 1200
const HEIGHT = 280
const MARGIN = { top: 12, right: 12, bottom: 28, left: 44 }

interface CategorySpec {
  key: keyof Pick<StatsPoint, 'content' | 'ratings' | 'subscriptions' | 'accounts' | 'moderation' | 'other'>
  label: string
  color: string
}

const CATEGORIES: CategorySpec[] = [
  { key: 'content',       label: 'Контент (пост/коммент)', color: '#1890ff' },
  { key: 'ratings',       label: 'Оценки',                 color: '#52c41a' },
  { key: 'subscriptions', label: 'Подписки',               color: '#faad14' },
  { key: 'accounts',      label: 'Аккаунты',               color: '#722ed1' },
  { key: 'moderation',    label: 'Модерация',              color: '#eb2f96' },
  { key: 'other',         label: 'Прочее (PoS/переводы)',  color: '#8c8c8c' },
]

const granularity = ref<'hours' | 'days'>('hours')

const hoursQuery = useStatsByHours(48)
const daysQuery = useStatsByDays(30)

const isLoading = computed(() =>
  granularity.value === 'hours' ? hoursQuery.isLoading.value : daysQuery.isLoading.value,
)
const error = computed(() =>
  granularity.value === 'hours' ? hoursQuery.error.value : daysQuery.error.value,
)

const points = computed<StatsPoint[]>(() => {
  const q = granularity.value === 'hours' ? hoursQuery : daysQuery
  return aggregateStats(q.data.value?.data)
})

const subtitle = computed(() => {
  const n = points.value.length
  const total = sumTotals(points.value)
  if (!n) return ''
  const unit = granularity.value === 'hours' ? `${n} ч` : `${n} д`
  return `Всего ${total.toLocaleString('en-US')} транзакций за ${unit}`
})

const svgRef = ref<SVGSVGElement | null>(null)
const hostRef = ref<HTMLElement | null>(null)

function renderChart() {
  const svgEl = svgRef.value
  const pts = points.value
  if (!svgEl || !pts.length) return

  const svg = d3.select(svgEl)
  svg.selectAll('*').remove()

  const innerW = WIDTH - MARGIN.left - MARGIN.right
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom

  const g = svg
    .append('g')
    .attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)

  // X — индекс точки 0..N-1, шкала линейная для красивого area-плотного рисунка.
  const x = d3.scaleLinear()
    .domain([0, pts.length - 1])
    .range([0, innerW])

  const stackKeys = CATEGORIES.map((c) => c.key)
  const stackGen = d3.stack<StatsPoint, string>()
    .keys(stackKeys)
    .value((d, key) => (d as unknown as Record<string, number>)[key] ?? 0)
  const series = stackGen(pts)

  const yMax = d3.max(series, (s) => d3.max(s, (p) => p[1])) ?? 0
  const y = d3.scaleLinear()
    .domain([0, yMax])
    .nice()
    .range([innerH, 0])

  const area = d3.area<d3.SeriesPoint<StatsPoint>>()
    .x((_, i) => x(i))
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]))
    .curve(d3.curveMonotoneX)

  const colorOf = (key: string) =>
    CATEGORIES.find((c) => c.key === key)?.color ?? '#999'

  g.selectAll('path.layer')
    .data(series)
    .join('path')
    .attr('class', 'layer')
    .attr('d', area)
    .attr('fill', (d) => colorOf(d.key as string))
    .attr('fill-opacity', 0.85)
    .attr('stroke', 'none')

  // Y-axis с минимальной разметкой.
  const yAxis = d3.axisLeft(y)
    .ticks(4)
    .tickFormat((v) => d3.format('~s')(v as number))
    .tickSize(-innerW)

  g.append('g')
    .attr('class', 'y-axis')
    .call(yAxis)
    .call((sel) => sel.select('.domain').remove())
    .call((sel) => sel.selectAll('text').attr('fill', '#6c757d').style('font-size', '11px'))
    .call((sel) => sel.selectAll('line').attr('stroke', '#e9ecef').attr('stroke-dasharray', '2,2'))

  // X-axis: «N{ч|д} назад» каждый ~6-й тик.
  const unitChar = granularity.value === 'hours' ? 'ч' : 'д'
  const step = Math.max(1, Math.ceil(pts.length / 6))
  const xTickIdxs = pts.map((_, i) => i).filter((i) => i % step === 0 || i === pts.length - 1)

  const xAxisG = g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${innerH})`)

  xAxisG.selectAll('text.tick')
    .data(xTickIdxs)
    .join('text')
    .attr('class', 'tick')
    .attr('x', (i) => x(i))
    .attr('y', 18)
    .attr('text-anchor', 'middle')
    .attr('fill', '#6c757d')
    .style('font-size', '11px')
    .text((i) => {
      const fromEnd = pts.length - 1 - i
      if (fromEnd === 0) return 'сейчас'
      return `-${fromEnd}${unitChar}`
    })
}

onMounted(() => {
  nextTick(renderChart)
})

watch([points, granularity], () => {
  nextTick(renderChart)
})
</script>
