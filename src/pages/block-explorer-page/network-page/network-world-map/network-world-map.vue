<template>
  <SC_Map ref="wrapRef">
    <SC_MapCanvas ref="canvasRef" aria-hidden="true" />
    <SC_MapSvg
      :viewBox="`0 0 ${width} ${height}`"
      role="group"
      :aria-label="t('explorerNetwork.mapAria')"
    >
      <SC_MapBubble
        v-for="b in bubbles"
        :key="b.code"
        :cx="b.x"
        :cy="b.y"
        :r="b.r"
        tabindex="0"
        role="button"
        :aria-label="b.label"
        :aria-pressed="selected === b.code"
        :class="{ active: selected === b.code, dimmed: !!selected && selected !== b.code }"
        @mouseenter="hover = b.code"
        @mouseleave="hover = null"
        @focus="hover = b.code"
        @blur="hover = null"
        @click="emit('select', selected === b.code ? null : b.code)"
        @keydown.enter.prevent="emit('select', selected === b.code ? null : b.code)"
        @keydown.space.prevent="emit('select', selected === b.code ? null : b.code)"
      />
      <SC_MapCount
        v-for="b in bubbles.filter((x) => x.r >= 9)"
        :key="`n-${b.code}`"
        :x="b.x"
        :y="b.y"
        aria-hidden="true"
      >
        {{ b.count }}
      </SC_MapCount>
      <g v-if="tip" :transform="`translate(${tip.x}, ${tip.y})`" aria-hidden="true">
        <SC_MapTipBox :x="tip.left" y="0" :width="tip.w" height="24" rx="6" />
        <SC_MapTipText :x="tip.left + tip.w / 2" y="16">{{ tip.text }}</SC_MapTipText>
      </g>
    </SC_MapSvg>
  </SC_Map>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { geoNaturalEarth1, type GeoProjection } from 'd3'
import { useTheme } from '@/composables/use-theme'
import type { CountShare } from '@/services/network-map/network-stats'
import { COUNTRY_POINTS } from '@/services/network-map/data/country-points'
import { DOT_COLS, DOT_ROWS, DOT_STEP, LAND_BITS } from '@/services/network-map/data/world-dots'
import { formatExplorerNumber } from '../../components/shared/format-explorer'
import { useCountryNames } from '../use-country-names'
import {
  SC_Map,
  SC_MapCanvas,
  SC_MapSvg,
  SC_MapBubble,
  SC_MapCount,
  SC_MapTipBox,
  SC_MapTipText,
} from './network-world-map.styled'

const p = defineProps<{
  countries: CountShare<string>[]
  selected: string | null
}>()

const emit = defineEmits<{ select: [code: string | null] }>()

const { t } = useI18n()
const { isDark } = useTheme()
const { countryName } = useCountryNames()

const wrapRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const canvasRef = ref<{ $el?: HTMLCanvasElement } | HTMLCanvasElement | null>(null)
const el = <T extends HTMLElement>(r: { $el?: T } | T | null): T | null =>
  r instanceof HTMLElement ? (r as T) : (r?.$el ?? null)

const width = ref(0)
const height = ref(0)
const hover = ref<string | null>(null)
const projection = ref<GeoProjection | null>(null)

/** Антарктиду не рисуем: нод там нет, а место она занимает. */
const SOUTH = -58
const NORTH = 84

function makeProjection(w: number, h: number): GeoProjection {
  const outline: [number, number][] = []
  for (let lon = -180; lon <= 180; lon += 10) outline.push([lon, SOUTH], [lon, NORTH])
  for (let lat = SOUTH; lat <= NORTH; lat += 10) outline.push([-180, lat], [180, lat])
  return geoNaturalEarth1().fitExtent(
    [
      [4, 4],
      [w - 4, h - 4],
    ],
    { type: 'MultiPoint', coordinates: outline }
  )
}

let landBits: Uint8Array | null = null
function land(): Uint8Array {
  landBits ??= Uint8Array.from(window.atob(LAND_BITS), (c) => c.charCodeAt(0))
  return landBits
}

function drawDots(): void {
  const canvas = el(canvasRef.value)
  const proj = projection.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx || !proj) return
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(width.value * dpr)
  canvas.height = Math.round(height.value * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width.value, height.value)
  ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('--ui-border-accented').trim() || '#ccc'
  const bits = land()
  const step = (width.value / (360 / DOT_STEP)) * 0.36
  for (let r = 0; r < DOT_ROWS; r++) {
    const lat = 90 - DOT_STEP / 2 - r * DOT_STEP
    if (lat < SOUTH) break
    for (let c = 0; c < DOT_COLS; c++) {
      const i = r * DOT_COLS + c
      if (!(bits[i >> 3]! & (1 << (i & 7)))) continue
      const point = proj([-180 + DOT_STEP / 2 + c * DOT_STEP, lat])
      if (!point) continue
      ctx.beginPath()
      ctx.arc(point[0], point[1], step, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

const bubbles = computed(() => {
  const proj = projection.value
  if (!proj) return []
  const max = Math.max(1, ...p.countries.map((c) => c.count))
  const scale = Math.max(14, width.value / 28)
  return p.countries
    .map((c) => {
      const at = COUNTRY_POINTS[c.key]
      const point = at ? proj([at[0], at[1]]) : null
      if (!point) return null
      const label = t('explorerNetwork.mapBubble', {
        country: countryName(c.key),
        n: formatExplorerNumber(c.count),
        percent: Math.round(c.share * 100),
      })
      return {
        code: c.key,
        count: c.count,
        x: point[0],
        y: point[1],
        r: Math.max(3.5, Math.sqrt(c.count / max) * scale),
        label,
      }
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .sort((a, b) => b.r - a.r)
})

const tip = computed(() => {
  const code = hover.value
  const b = bubbles.value.find((x) => x.code === code)
  if (!b) return null
  const text = b.label
  const w = Math.min(width.value - 8, text.length * 6.6 + 16)
  const y = b.y - b.r - 30 < 0 ? b.y + b.r + 6 : b.y - b.r - 30
  const left = Math.min(Math.max(-b.x + 4, -w / 2), width.value - b.x - w - 4)
  return { x: b.x, y, w, left, text }
})

let observer: ResizeObserver | null = null

function resize(): void {
  const wrap = el(wrapRef.value)
  if (!wrap) return
  width.value = wrap.clientWidth
  height.value = Math.round(wrap.clientWidth * 0.47)
  projection.value = makeProjection(width.value, height.value)
  drawDots()
}

onMounted(() => {
  observer = new ResizeObserver(resize)
  const wrap = el(wrapRef.value)
  if (wrap) observer.observe(wrap)
  resize()
})
onBeforeUnmount(() => observer?.disconnect())
watch(isDark, drawDots)
</script>
