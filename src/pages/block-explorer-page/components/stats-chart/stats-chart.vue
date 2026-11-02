<template>
  <SC_ChartCard :aria-busy="loading">
    <SC_ChartHead>
      <SC_ChartTitleGroup>
        <SC_ChartTitle>
          {{ title }}
          <InfoTooltip v-if="info" :text="info" />
        </SC_ChartTitle>
        <SC_ChartSubtitle v-if="subtitle">{{ subtitle }}</SC_ChartSubtitle>
      </SC_ChartTitleGroup>
      <SC_ChartTools>
        <slot name="tools" />
        <SC_ToolButton
          v-if="points.length"
          type="button"
          :aria-pressed="showTable"
          @click="showTable = !showTable"
        >
          {{ showTable ? t('explorerStats.showChart') : t('explorerStats.showTable') }}
        </SC_ToolButton>
      </SC_ChartTools>
    </SC_ChartHead>

    <SC_ChartNote v-if="progress || failed" role="status" aria-live="polite">
      <span v-if="progress">
        {{ t('explorerStats.progress', { done: progress.done, total: progress.total }) }}
      </span>
      <template v-if="failed && !loading">
        <span>{{ t('explorerStats.partsFailed', { n: failed }) }}</span>
        <SC_NoteButton type="button" @click="emit('retry')">
          {{ t('explorerStats.retry') }}
        </SC_NoteButton>
      </template>
    </SC_ChartNote>

    <SC_ChartBody :class="{ refreshing: loading && points.length > 0 }">
      <SC_Placeholder v-if="!points.length && loading">{{
        t('explorerPage.loading')
      }}</SC_Placeholder>
      <SC_Placeholder v-else-if="!points.length && error">
        {{ t('explorerStats.error') }}
        <SC_NoteButton type="button" @click="emit('retry')">{{
          t('explorerStats.retry')
        }}</SC_NoteButton>
      </SC_Placeholder>
      <SC_Placeholder v-else-if="!points.length">{{
        emptyText || t('explorerPage.statsEmpty')
      }}</SC_Placeholder>

      <SC_TableWrap v-else-if="showTable">
        <SC_Table>
          <thead>
            <tr>
              <th scope="col">{{ t('explorerStats.period') }}</th>
              <th v-for="s in visibleSeries" :key="s.key" scope="col">{{ s.label }}</th>
              <th v-if="kind === 'stack' && visibleSeries.length > 1" scope="col">
                {{ t('explorerStats.total') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in tableRows" :key="p.t">
              <td>{{ formatPeriod(p.t, p.end, granularity, locale) }}</td>
              <td v-for="s in visibleSeries" :key="s.key">
                {{ formatValue(p.values[s.key] ?? null, locale, digits) }}
              </td>
              <td v-if="kind === 'stack' && visibleSeries.length > 1">
                {{ formatValue(totalAt(p), locale, digits) }}
              </td>
            </tr>
          </tbody>
        </SC_Table>
      </SC_TableWrap>

      <SC_Plot v-else ref="hostRef" @pointermove="onPointerMove" @pointerleave="setHover(null)">
        <svg
          ref="svgRef"
          role="img"
          tabindex="0"
          :aria-label="ariaLabel"
          @keydown="onKeydown"
          @focus="onFocus"
          @blur="setHover(null)"
        />
        <SC_Tooltip v-show="hoverPoint" ref="tooltipRef" aria-hidden="true">
          <template v-if="hoverPoint">
            <SC_TooltipDate>
              {{ formatPeriod(hoverPoint.t, hoverPoint.end, granularity, locale) }}
              <template v-if="unitHint"> · {{ unitHint }}</template>
            </SC_TooltipDate>
            <SC_TooltipRow v-for="s in tooltipSeries" :key="s.key">
              <SC_TooltipKey :color="s.color" />
              <span>{{ s.label }}</span>
              <strong>{{ formatValue(hoverPoint.values[s.key] ?? null, locale, digits) }}</strong>
            </SC_TooltipRow>
            <SC_TooltipRow v-if="kind === 'stack' && visibleSeries.length > 1" class="total">
              <span />
              <span>{{ t('explorerStats.total') }}</span>
              <strong>{{ formatValue(totalAt(hoverPoint), locale, digits) }}</strong>
            </SC_TooltipRow>
          </template>
        </SC_Tooltip>
      </SC_Plot>
    </SC_ChartBody>

    <SC_Legend
      v-if="series.length > 1 && points.length"
      :aria-label="t('explorerStats.legendLabel')"
    >
      <SC_LegendItem
        v-for="s in series"
        :key="s.key"
        type="button"
        :class="{ off: hidden.has(s.key) }"
        :aria-pressed="!hidden.has(s.key)"
        :title="t('explorerStats.legendHint')"
        @click="toggle(s.key)"
        @dblclick.prevent="solo(s.key)"
      >
        <SC_LegendKey :color="s.color" :class="{ line: kind === 'line', off: hidden.has(s.key) }" />
        {{ s.label }}
      </SC_LegendItem>
    </SC_Legend>
  </SC_ChartCard>
</template>

<script setup lang="ts">
// Один график статистики эксплорера. Легенда — переключатели: нажатие прячет
// или возвращает серию, двойное — оставляет только её. Наведение (и стрелки
// с клавиатуры) показывает значения всех серий в точке. Таблица — те же числа
// без графика: у части цветов палитры контраст с фоном ниже 3:1.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import InfoTooltip from '../shared/info-tooltip.vue'
import type { ChartPoint, Granularity } from '../../stats/stats-model'
import { formatPeriod, formatValue } from '../../stats/chart-format'
import type { StatsProgress } from '../../stats/use-network-stats'
import {
  drawHover,
  renderChart,
  type ChartKind,
  type ChartLayout,
  type ChartSeries,
} from './render-chart'
import {
  SC_ChartCard,
  SC_ChartHead,
  SC_ChartTitleGroup,
  SC_ChartTitle,
  SC_ChartSubtitle,
  SC_ChartTools,
  SC_ToolButton,
  SC_ChartNote,
  SC_NoteButton,
  SC_ChartBody,
  SC_Plot,
  SC_Tooltip,
  SC_TooltipDate,
  SC_TooltipRow,
  SC_TooltipKey,
  SC_Legend,
  SC_LegendItem,
  SC_LegendKey,
  SC_Placeholder,
  SC_TableWrap,
  SC_Table,
} from './stats-chart.styled'

defineOptions({ name: 'StatsChart' })

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    info?: string
    points: ChartPoint[]
    series: ChartSeries[]
    kind: ChartKind
    granularity: Granularity
    /** Знаков после запятой в подсказке и таблице. */
    digits?: number
    /** Что значат числа, если не «штук за период»: «в среднем за сутки». */
    unitHint?: string
    loading?: boolean
    progress?: StatsProgress | null
    failed?: number
    error?: unknown
    emptyText?: string
    height?: number
    /** Ось значений от нуля (у линий можно без). */
    zeroBased?: boolean
  }>(),
  {
    subtitle: '',
    info: '',
    digits: 0,
    unitHint: '',
    loading: false,
    failed: 0,
    emptyText: '',
    height: 260,
    zeroBased: true,
  }
)

const emit = defineEmits<{ retry: [] }>()

const { t, locale } = useI18n()

const hidden = ref(new Set<string>())
const showTable = ref(false)
const hostRef = ref<{ $el: HTMLElement } | HTMLElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)
const tooltipRef = ref<{ $el: HTMLElement } | HTMLElement | null>(null)
const width = ref(0)
const hoverIndex = ref<number | null>(null)
const layout = shallowRef<ChartLayout | null>(null)

const visibleSeries = computed(() => props.series.filter((s) => !hidden.value.has(s.key)))
const hoverPoint = computed(() =>
  hoverIndex.value === null ? null : (props.points[hoverIndex.value] ?? null)
)
/** В подсказке стопки — сверху вниз, как слои на графике. */
const tooltipSeries = computed(() =>
  props.kind === 'stack' ? [...visibleSeries.value].reverse() : visibleSeries.value
)
const tableRows = computed(() => [...props.points].reverse())
const ariaLabel = computed(() => [props.title, props.subtitle].filter(Boolean).join('. '))

function totalAt(p: ChartPoint): number {
  return visibleSeries.value.reduce((s, x) => s + (p.values[x.key] ?? 0), 0)
}

function elementOf(r: { $el: HTMLElement } | HTMLElement | null): HTMLElement | null {
  if (!r) return null
  return r instanceof HTMLElement ? r : r.$el
}

function toggle(key: string): void {
  const next = new Set(hidden.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  hidden.value = next
}

function solo(key: string): void {
  const others = props.series.filter((s) => s.key !== key).map((s) => s.key)
  const alreadySolo = !hidden.value.has(key) && others.every((k) => hidden.value.has(k))
  hidden.value = alreadySolo ? new Set() : new Set(others)
}

function render(animate: boolean): void {
  const svg = svgRef.value
  if (!svg || !props.points.length || width.value <= 0) return
  layout.value = renderChart({
    svg,
    width: width.value,
    height: props.height,
    points: props.points,
    series: visibleSeries.value,
    kind: props.kind,
    locale: locale.value,
    animate,
    zeroBased: props.zeroBased,
  })
  if (hoverIndex.value !== null && hoverIndex.value >= props.points.length) hoverIndex.value = null
  drawHover(svg, layout.value, hoverIndex.value, visibleSeries.value, props.kind)
}

function placeTooltip(): void {
  const tip = elementOf(tooltipRef.value)
  const host = elementOf(hostRef.value)
  const l = layout.value
  if (!tip || !host || !l || hoverIndex.value === null) return
  const x = l.xOf(hoverIndex.value)
  const w = tip.offsetWidth
  const room = host.clientWidth
  // Справа от перекрестья, у правого края — слева от него.
  const left = x + 12 + w > room ? Math.max(0, x - 12 - w) : x + 12
  tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(l.top)}px)`
}

function setHover(index: number | null): void {
  hoverIndex.value = index
  if (svgRef.value) drawHover(svgRef.value, layout.value, index, visibleSeries.value, props.kind)
  if (index !== null) void nextTick(placeTooltip)
}

/** Ближайшая к указателю точка по горизонтали. */
function onPointerMove(event: PointerEvent): void {
  const svg = svgRef.value
  const l = layout.value
  if (!svg || !l || !props.points.length) return
  const x = event.clientX - svg.getBoundingClientRect().left
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < props.points.length; i++) {
    const d = Math.abs(l.xOf(i) - x)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  if (best !== hoverIndex.value) setHover(best)
}

function onFocus(): void {
  if (hoverIndex.value === null && props.points.length) setHover(props.points.length - 1)
}

function onKeydown(event: KeyboardEvent): void {
  const n = props.points.length
  if (!n) return
  const current = hoverIndex.value ?? n - 1
  if (event.key === 'ArrowLeft') setHover(Math.max(0, current - 1))
  else if (event.key === 'ArrowRight') setHover(Math.min(n - 1, current + 1))
  else if (event.key === 'Home') setHover(0)
  else if (event.key === 'End') setHover(n - 1)
  else if (event.key === 'Escape') setHover(null)
  else return
  event.preventDefault()
}

let observer: ResizeObserver | null = null

function observe(): void {
  observer?.disconnect()
  const host = elementOf(hostRef.value)
  if (!host) return
  width.value = host.clientWidth
  observer = new ResizeObserver((entries) => {
    const w = Math.round(entries[0]?.contentRect.width ?? 0)
    if (w && w !== width.value) width.value = w
  })
  observer.observe(host)
}

onMounted(() => {
  observe()
  render(false)
})

onBeforeUnmount(() => observer?.disconnect())

// Хост появляется и пропадает вместе с данными и таблицей.
watch(
  hostRef,
  () =>
    void nextTick(() => {
      observe()
      render(false)
    })
)

watch(
  () => [props.points, props.kind, props.height, props.zeroBased, width.value, locale.value],
  () => void nextTick(() => render(false))
)

// Переключение серий — с плавным переходом.
watch(hidden, () => void nextTick(() => render(true)))

// Набор серий сменился (другой график в том же месте) — показываем все.
watch(
  () => props.series.map((s) => s.key).join(','),
  () => (hidden.value = new Set())
)
</script>
