<template>
  <SC_Chart>
    <!-- Один ряд: столбики по дням (зрители, время) или линия (удержание).
         Наведение и стрелки показывают значение; таблица под графиком —
         то же самое без наведения. -->
    <SC_Plot
      ref="plotRef"
      tabindex="0"
      role="img"
      :aria-label="title"
      :class="{ hovering: active !== null }"
      @pointermove="onPointer"
      @pointerleave="active = null"
      @focus="onFocus"
      @blur="active = null"
      @keydown="onKey"
    >
      <svg :width="width" :height="HEIGHT" aria-hidden="true">
        <g class="grid">
          <line
            v-for="tick in ticks"
            :key="tick"
            :x1="LEFT"
            :x2="width - RIGHT"
            :y1="yOf(tick)"
            :y2="yOf(tick)"
          />
        </g>
        <g class="axis">
          <text
            v-for="tick in ticks"
            :key="tick"
            :x="LEFT - 8"
            :y="yOf(tick)"
            text-anchor="end"
            dominant-baseline="middle"
          >
            {{ formatTick(tick) }}
          </text>
          <text
            v-for="index in xLabels"
            :key="index"
            :x="xOf(index)"
            :y="HEIGHT - 6"
            :text-anchor="xAnchor(index)"
          >
            {{ points[index]!.label }}
          </text>
        </g>

        <g v-if="kind === 'columns'">
          <path
            v-for="(point, index) in points"
            :key="index"
            class="bar"
            :class="{ active: index === active }"
            :d="columnPath(xOf(index) - barWidth / 2, barWidth, yOf(point.value), baseline)"
          />
        </g>
        <g v-else-if="points.length">
          <path class="area" :d="areaPath" />
          <path class="line" :d="linePath" />
        </g>

        <g v-if="active !== null && kind === 'line'" class="crosshair">
          <line :x1="xOf(active)" :x2="xOf(active)" :y1="TOP" :y2="baseline" />
          <circle :cx="xOf(active)" :cy="yOf(points[active]!.value)" r="4" />
        </g>
      </svg>

      <SC_Tooltip v-if="active !== null" :at-x="tooltipAt.x" :at-y="tooltipAt.y">
        <strong>{{ formatValue(points[active]!.value) }}</strong>
        <span>{{ points[active]!.label }}</span>
      </SC_Tooltip>
    </SC_Plot>

    <SC_TableToggle>
      <summary>{{ t('mediaStudio.stats.showTable') }}</summary>
      <table>
        <caption class="visually-hidden">
          {{
            title
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ columnLabel }}</th>
            <th scope="col">{{ valueLabel }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(point, index) in tableRows" :key="index">
            <td>{{ point.label }}</td>
            <td>{{ formatValue(point.value) }}</td>
          </tr>
        </tbody>
      </table>
    </SC_TableToggle>
  </SC_Chart>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { columnPath, labelIndexes, niceTicks, sampleEvenly } from './stats-chart-scale'
import { SC_Chart, SC_Plot, SC_TableToggle, SC_Tooltip } from './stats-chart.styled'

export interface ChartPoint {
  /** Положение по X для линии (секунда ролика); у столбиков не нужно. */
  x: number
  /** Подпись точки: дата или время в ролике. */
  label: string
  value: number
}

const props = withDefaults(
  defineProps<{
    kind: 'columns' | 'line'
    points: ChartPoint[]
    title: string
    columnLabel: string
    valueLabel: string
    formatValue: (value: number) => string
    formatTick: (value: number) => string
    /** Деления оси Y; без них — круглые от нуля до максимума. */
    yTicks?: number[]
    /** Значения дробные (часы просмотра): деления не округляются до целых. */
    fractional?: boolean
  }>(),
  { yTicks: undefined, fractional: false }
)

const { t } = useI18n()

const HEIGHT = 220
const TOP = 12
const BOTTOM = 28
const LEFT = 52
const RIGHT = 8
/** Столбик не толще 24 px, между соседними — 2 px фона. */
const BAR_MAX = 24
const BAR_GAP = 2
/** Строк в таблице под линией удержания. */
const TABLE_ROWS = 12

const plotRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const width = ref(600)
const active = ref<number | null>(null)
let observer: ResizeObserver | null = null

const plotElement = (): HTMLElement | null => {
  const value = plotRef.value
  if (!value) return null
  return value instanceof HTMLElement ? value : ((value.$el as HTMLElement | undefined) ?? null)
}

onMounted(() => {
  const element = plotElement()
  if (!element) return
  width.value = element.clientWidth || width.value
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = Math.max(240, Math.round(entry.contentRect.width))
  })
  observer.observe(element)
})

onBeforeUnmount(() => observer?.disconnect())

const baseline = HEIGHT - BOTTOM
const maxValue = computed(() => Math.max(0, ...props.points.map((point) => point.value)))
const ticks = computed(() => props.yTicks ?? niceTicks(maxValue.value, 4, !props.fractional))
const yMax = computed(() => ticks.value[ticks.value.length - 1] || 1)
const plotWidth = computed(() => Math.max(1, width.value - LEFT - RIGHT))

const xMax = computed(() => Math.max(1, ...props.points.map((point) => point.x)))
const slot = computed(() => plotWidth.value / Math.max(1, props.points.length))
const barWidth = computed(() => Math.max(1, Math.min(BAR_MAX, slot.value - BAR_GAP)))

function xOf(index: number): number {
  if (props.kind === 'columns') return LEFT + slot.value * (index + 0.5)
  return LEFT + (plotWidth.value * (props.points[index]?.x ?? 0)) / xMax.value
}

function yOf(value: number): number {
  return baseline - ((baseline - TOP) * Math.min(value, yMax.value)) / yMax.value
}

const xLabels = computed(() => labelIndexes(props.points.length, plotWidth.value))

/** Под столбиком подпись по центру; у линии крайние — к краям, чтобы не вылезали. */
function xAnchor(index: number): 'start' | 'middle' | 'end' {
  if (props.kind === 'columns' || props.points.length < 2) return 'middle'
  if (index === 0) return 'start'
  return index === props.points.length - 1 ? 'end' : 'middle'
}

const linePath = computed(() =>
  props.points
    .map((point, index) => `${index ? 'L' : 'M'}${xOf(index)},${yOf(point.value)}`)
    .join(' ')
)
const areaPath = computed(() =>
  props.points.length
    ? `${linePath.value} L${xOf(props.points.length - 1)},${baseline} L${xOf(0)},${baseline} Z`
    : ''
)

const tableRows = computed(() =>
  props.kind === 'line' ? sampleEvenly(props.points, TABLE_ROWS) : props.points
)

/** Подсказка над точкой, не вылезая за края графика. */
const tooltipAt = computed(() => {
  if (active.value === null) return { x: 0, y: 0 }
  const x = Math.min(Math.max(xOf(active.value), LEFT + 40), width.value - 40)
  const point = props.points[active.value]
  const y = point ? yOf(point.value) : baseline
  return { x: Math.round(x), y: Math.round(Math.max(0, y - 8)) }
})

function nearest(clientX: number): number | null {
  const element = plotElement()
  if (!element || !props.points.length) return null
  const x = clientX - element.getBoundingClientRect().left
  let best = 0
  let distance = Infinity
  props.points.forEach((_, index) => {
    const gap = Math.abs(xOf(index) - x)
    if (gap < distance) {
      distance = gap
      best = index
    }
  })
  return best
}

function onPointer(event: PointerEvent): void {
  active.value = nearest(event.clientX)
}

function onFocus(): void {
  if (props.points.length) active.value = props.points.length - 1
}

function onKey(event: KeyboardEvent): void {
  if (!props.points.length) return
  const last = props.points.length - 1
  const current = active.value ?? last
  const step = props.kind === 'line' ? Math.max(1, Math.round(props.points.length / 20)) : 1
  const moves: Record<string, number> = {
    ArrowLeft: Math.max(0, current - step),
    ArrowRight: Math.min(last, current + step),
    Home: 0,
    End: last,
  }
  const next = moves[event.key]
  if (next === undefined) return
  event.preventDefault()
  active.value = next
}
</script>
