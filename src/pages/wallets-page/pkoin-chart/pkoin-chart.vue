<template>
  <SC_PkoinChartWrap>
    <SC_PkoinChartTitle>{{ t('wallet.pkoinRateTitle') }}</SC_PkoinChartTitle>
    <SC_PkoinChartFilters>
      <SC_PkoinChartFilterGroup>
        <SC_PkoinChartFilterLabel>{{ t('wallet.periodLabel') }}</SC_PkoinChartFilterLabel>
        <SC_PkoinChartFilterBtn
          v-for="opt in PERIOD_OPTIONS"
          :key="opt.value"
          type="button"
          :class="{ active: periodDays === opt.value }"
          @click="setPeriod(opt.value)"
        >
          {{ opt.label }}
        </SC_PkoinChartFilterBtn>
      </SC_PkoinChartFilterGroup>
    </SC_PkoinChartFilters>
    <SC_PkoinChartRow>
      <SC_PkoinChartArea>
        <SC_PkoinChartContainer>
          <div ref="containerRef" class="chart-inner" />
          <SC_PkoinChartLoading v-if="loading" class="chart-loading">
            {{ t('wallet.chartLoading') }}
          </SC_PkoinChartLoading>
        </SC_PkoinChartContainer>
      </SC_PkoinChartArea>
      <SC_PkoinChartSidebar v-if="!error">
        <template v-if="loading">
          <SC_PkoinChartPriceLabel>{{ t('wallet.currentRate') }}</SC_PkoinChartPriceLabel>
          <SC_PkoinChartPriceValue>—</SC_PkoinChartPriceValue>
        </template>
        <template v-else-if="currentPrice != null">
          <SC_PkoinChartPriceLabel>{{ t('wallet.currentRate') }}</SC_PkoinChartPriceLabel>
          <SC_PkoinChartPriceValue>${{ currentPrice.toFixed(4) }}</SC_PkoinChartPriceValue>
          <template v-if="priceChange != null">
            <SC_PkoinChartStatRow>
              <SC_PkoinChartStatLabel>{{ t('wallet.statFor', { period: chartDaysLabel }) }}</SC_PkoinChartStatLabel>
              <SC_PkoinChartChange
                :class="priceChange > 0 ? 'positive' : priceChange < 0 ? 'negative' : 'neutral'"
              >
                {{ priceChange >= 0 ? '+' : '' }}{{ priceChange.toFixed(2) }}%
              </SC_PkoinChartChange>
            </SC_PkoinChartStatRow>
          </template>
          <template v-if="priceChange24h != null">
            <SC_PkoinChartStatRow>
              <SC_PkoinChartStatLabel>{{ t('wallet.statFor24h') }}</SC_PkoinChartStatLabel>
              <SC_PkoinChartChange
                :class="
                  priceChange24h > 0 ? 'positive' : priceChange24h < 0 ? 'negative' : 'neutral'
                "
              >
                {{ priceChange24h >= 0 ? '+' : '' }}{{ priceChange24h.toFixed(2) }}%
              </SC_PkoinChartChange>
            </SC_PkoinChartStatRow>
          </template>
          <template v-if="priceHigh30d != null">
            <SC_PkoinChartStatRow>
              <SC_PkoinChartStatLabel>{{ t('wallet.statMaxFor', { period: chartDaysLabel }) }}</SC_PkoinChartStatLabel>
              <SC_PkoinChartStatValue>${{ priceHigh30d.toFixed(4) }}</SC_PkoinChartStatValue>
            </SC_PkoinChartStatRow>
          </template>
          <template v-if="priceLow30d != null">
            <SC_PkoinChartStatRow>
              <SC_PkoinChartStatLabel>{{ t('wallet.statMinFor', { period: chartDaysLabel }) }}</SC_PkoinChartStatLabel>
              <SC_PkoinChartStatValue>${{ priceLow30d.toFixed(4) }}</SC_PkoinChartStatValue>
            </SC_PkoinChartStatRow>
          </template>
        </template>
      </SC_PkoinChartSidebar>
    </SC_PkoinChartRow>
    <SC_PkoinChartError v-if="error">
      {{ error }}
    </SC_PkoinChartError>
  </SC_PkoinChartWrap>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import * as d3 from 'd3'
import {
  SC_PkoinChartWrap,
  SC_PkoinChartTitle,
  SC_PkoinChartFilters,
  SC_PkoinChartFilterGroup,
  SC_PkoinChartFilterLabel,
  SC_PkoinChartFilterBtn,
  SC_PkoinChartRow,
  SC_PkoinChartArea,
  SC_PkoinChartContainer,
  SC_PkoinChartLoading,
  SC_PkoinChartError,
  SC_PkoinChartSidebar,
  SC_PkoinChartPriceLabel,
  SC_PkoinChartPriceValue,
  SC_PkoinChartChange,
  SC_PkoinChartStatRow,
  SC_PkoinChartStatLabel,
  SC_PkoinChartStatValue,
} from './pkoin-chart.styled'

const COINGECKO_API = 'https://api.coingecko.com/api/v3/coins/pocketcoin/market_chart'

const { t } = useI18n()

const PERIOD_OPTIONS = computed(() => [
  { value: 1, label: t('wallet.period1d') },
  { value: 7, label: t('wallet.period7d') },
  { value: 30, label: t('wallet.period30d') },
  { value: 90, label: t('wallet.period3m') },
  { value: 180, label: t('wallet.period6m') },
  { value: 365, label: t('wallet.period12m') },
])

interface MarketChartResponse {
  prices: [number, number][]
  market_caps: [number, number][]
  total_volumes: [number, number][]
}

const containerRef = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const currentPrice = ref<number | null>(null)
const priceChange = ref<number | null>(null)
const priceChange24h = ref<number | null>(null)
const priceHigh30d = ref<number | null>(null)
const priceLow30d = ref<number | null>(null)
const chartDataRef = ref<[number, number][]>([])
const periodDays = ref<number>(30)
let resizeObserver: ResizeObserver | null = null

const chartDaysLabel = computed<string>(() => {
  const p = periodDays.value
  if (p === 1) return t('wallet.days1')
  if (p <= 31) return t('wallet.daysN', { count: p })
  if (p <= 100) return t('wallet.months3')
  if (p <= 200) return t('wallet.months6')
  return t('wallet.months12')
})

function setPeriod(days: number): void {
  periodDays.value = days
}

async function fetchFromCoinGecko(days: number): Promise<[number, number][]> {
  const url = `${COINGECKO_API}?vs_currency=usd&days=${days}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(t('wallet.errorCoinGeckoLoad'))
  const data = (await res.json()) as MarketChartResponse
  if (!Array.isArray(data.prices) || data.prices.length === 0) {
    throw new Error(t('wallet.errorNoRateData'))
  }
  return data.prices
}

function renderChart(data: [number, number][]): void {
  const el = containerRef.value
  if (!el || data.length === 0) return

  const width = el.clientWidth
  const height = el.clientHeight
  const margin = { top: 12, right: 12, bottom: 24, left: 48 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  d3.select(el).selectAll('*').remove()

  const svg = d3
    .select(el)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .attr('style', 'max-width: 100%; height: auto;')

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const points = data.map(([t, y]) => ({ date: new Date(t), value: y }))
  const xExtent = d3.extent(points, (d) => d.date) as [Date, Date]
  const yExtent = d3.extent(points, (d) => d.value) as [number, number]
  const yPadding = (yExtent[1] - yExtent[0]) * 0.05 || 0.01
  const yMin = Math.max(0, yExtent[0] - yPadding)
  const yMax = yExtent[1] + yPadding

  const xScale = d3.scaleTime().domain(xExtent).range([0, innerWidth])
  const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0])

  const line = d3
    .line<{ date: Date; value: number }>()
    .x((d) => xScale(d.date))
    .y((d) => yScale(d.value))
    .curve(d3.curveMonotoneX)

  g.append('path')
    .datum(points)
    .attr('fill', 'none')
    .attr('stroke', '#00A3F7')
    .attr('stroke-width', 2)
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round')
    .attr('d', line)

  const xAxis = d3
    .axisBottom(xScale)
    .ticks(5)
    .tickSizeOuter(0)
    .tickFormat((d) => d3.timeFormat('%d.%m')(d as Date))

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(xAxis)
    .attr('color', 'rgb(120, 120, 120)')
    .style('font-size', '11px')

  const yAxis = d3
    .axisLeft(yScale)
    .ticks(5)
    .tickSizeOuter(0)
    .tickFormat((d) => `$${Number(d).toFixed(2)}`)

  g.append('g').call(yAxis).attr('color', 'rgb(120, 120, 120)').style('font-size', '11px')

  const crosshair = g
    .append('g')
    .attr('class', 'crosshair')
    .style('pointer-events', 'none')
    .style('display', 'none')
  crosshair
    .append('line')
    .attr('class', 'crosshair-v')
    .attr('stroke', 'rgba(120, 120, 120, 0.6)')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,4')
    .attr('x1', 0)
    .attr('x2', 0)
    .attr('y1', 0)
    .attr('y2', innerHeight)
  crosshair
    .append('line')
    .attr('class', 'crosshair-h')
    .attr('stroke', 'rgba(120, 120, 120, 0.6)')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,4')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', 0)
    .attr('y2', 0)

  const tooltipWidth = 120
  const tooltipHeight = 36
  const tooltipPadding = 8
  const crosshairTooltip = crosshair.append('g').attr('class', 'crosshair-tooltip')
  crosshairTooltip
    .append('rect')
    .attr('class', 'crosshair-tooltip-bg')
    .attr('width', tooltipWidth)
    .attr('height', tooltipHeight)
    .attr('rx', 4)
    .attr('ry', 4)
    .attr('fill', 'rgba(255, 255, 255, 0.95)')
    .attr('stroke', 'rgba(0, 0, 0, 0.1)')
    .attr('stroke-width', 1)
  crosshairTooltip
    .append('text')
    .attr('class', 'crosshair-tooltip-date')
    .attr('x', tooltipPadding)
    .attr('y', 14)
    .attr('fill', 'rgb(120, 120, 120)')
    .style('font-size', '10px')
    .style('font-family', 'inherit')
  crosshairTooltip
    .append('text')
    .attr('class', 'crosshair-tooltip-price')
    .attr('x', tooltipPadding)
    .attr('y', 26)
    .attr('fill', 'rgb(33, 33, 33)')
    .style('font-size', '12px')
    .style('font-weight', '600')
    .style('font-family', 'inherit')

  const formatTooltipDate = d3.timeFormat('%d.%m.%Y %H:%M')
  const container = d3.select(el)
  container.on('mousemove.crosshair', function (event: MouseEvent) {
    const rect = el.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const xInner = Math.max(0, Math.min(innerWidth, x - margin.left))
    const yInner = Math.max(0, Math.min(innerHeight, y - margin.top))
    crosshair.style('display', null)
    crosshair
      .select('.crosshair-v')
      .attr('x1', xInner)
      .attr('x2', xInner)
      .attr('y1', 0)
      .attr('y2', innerHeight)
    crosshair
      .select('.crosshair-h')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yInner)
      .attr('y2', yInner)

    const date = xScale.invert(xInner)
    const price = yScale.invert(yInner)
    crosshairTooltip.select('.crosshair-tooltip-date').text(formatTooltipDate(date))
    crosshairTooltip.select('.crosshair-tooltip-price').text(`$${Number(price).toFixed(4)}`)

    let tx = xInner + 8
    let ty = yInner - tooltipHeight - 6
    if (tx + tooltipWidth > innerWidth) tx = xInner - tooltipWidth - 8
    if (ty < 0) ty = yInner + 8
    crosshairTooltip.attr('transform', `translate(${tx},${ty})`)
  })
  container.on('mouseleave.crosshair', () => {
    crosshair.style('display', 'none')
  })
}

async function loadAndRender(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const data = await fetchFromCoinGecko(periodDays.value)
    chartDataRef.value = data
    if (data.length >= 2) {
      const prices = data.map(([, p]) => p)
      const lastPrice = data[data.length - 1]![1]
      const lastTs = data[data.length - 1]![0]
      currentPrice.value = lastPrice

      const firstPrice = data[0]![1]
      if (firstPrice && firstPrice > 0) {
        priceChange.value = ((lastPrice - firstPrice) / firstPrice) * 100
      }

      const ts24hAgo = lastTs - 24 * 60 * 60 * 1000
      const idx24h = data.findIndex(([t]) => t >= ts24hAgo)
      if (idx24h >= 0 && idx24h < data.length) {
        const price24h = data[idx24h]![1]
        if (price24h && price24h > 0) {
          priceChange24h.value = ((lastPrice - price24h) / price24h) * 100
        }
      }

      priceHigh30d.value = Math.max(...prices)
      priceLow30d.value = Math.min(...prices)
    }
    renderChart(data)
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('wallet.errorChartLoad')
  } finally {
    loading.value = false
  }
}

function onResize(): void {
  const data = chartDataRef.value
  if (!loading.value && !error.value && containerRef.value && data.length > 0) {
    renderChart(data)
  }
}

onMounted(() => {
  loadAndRender()
  resizeObserver = new ResizeObserver(onResize)
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

watch(containerRef, (el) => {
  if (resizeObserver && el) resizeObserver.observe(el)
})

watch(periodDays, () => {
  loadAndRender()
})
</script>
