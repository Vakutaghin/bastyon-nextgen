<template>
  <SC_PatternGrid
    ref="gridRef"
    role="img"
    :aria-label="t('appLock.patternLabel')"
    :class="{ disabled, compact }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <svg viewBox="0 0 300 300" aria-hidden="true">
      <polyline ref="trailRef" points="" />
      <line ref="tailRef" x1="0" y1="0" x2="0" y2="0" visibility="hidden" />
    </svg>
    <SC_PatternDot v-for="i in 9" :key="i" :ref="(el) => setDot(i - 1, el)" />
  </SC_PatternGrid>
</template>

<script setup lang="ts">
// Графический ключ 3×3, как в Android: ведём пальцем или мышью по точкам,
// отпустили — complete с номерами точек 0–8 по порядку.
//
// Отзывчивость: всё, что меняется на каждом движении (точки, линия), пишется
// прямо в DOM, а линия перерисовывается раз в кадр. Попадание считается по
// отрезку между двумя событиями, а не по точке: быстрый росчерк, пролетевший
// точку между событиями, её не теряет. Точка посередине прямой (0→2 через 1)
// добавляется сама, как в Android.

import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { haptic } from '@/helpers/common/haptics'
import { hitsAlong, withPassThrough, DOT_CENTER } from './pattern-geometry'
import { SC_PatternDot, SC_PatternGrid } from './styled'

const props = withDefaults(defineProps<{ disabled?: boolean; compact?: boolean }>(), {
  disabled: false,
  compact: false,
})

const emit = defineEmits<{ complete: [dots: number[]] }>()

const { t } = useI18n()

const gridRef = ref<{ $el: HTMLElement } | HTMLElement | null>(null)
const trailRef = ref<SVGElement | null>(null)
const tailRef = ref<SVGElement | null>(null)
// По номеру точки: порядок ref-массива из v-for Vue не обещает.
const dots: Array<HTMLElement | null> = []

let sequence: number[] = []
let drawing = false
let pointerId: number | null = null
let rect: ReturnType<HTMLElement['getBoundingClientRect']> | null = null
let last: { x: number; y: number } | null = null
let frame = 0
let failTimer: ReturnType<typeof setTimeout> | null = null

const elOf = (r: { $el: HTMLElement } | HTMLElement | null | undefined): HTMLElement | null =>
  r instanceof HTMLElement ? r : (r?.$el ?? null)

function setDot(index: number, el: unknown): void {
  dots[index] = elOf(el as { $el: HTMLElement } | HTMLElement | null)
}

/** Точка события в координатах поля 0…300. */
function toGrid(e: PointerEvent): { x: number; y: number } {
  const r = rect!
  return {
    x: ((e.clientX - r.left) * 300) / r.width,
    y: ((e.clientY - r.top) * 300) / r.height,
  }
}

function draw(): void {
  frame = 0
  const trail = trailRef.value
  const tail = tailRef.value
  if (!trail || !tail) return
  trail.setAttribute(
    'points',
    sequence.map((i) => `${DOT_CENTER[i]!.x},${DOT_CENTER[i]!.y}`).join(' ')
  )
  const end = sequence[sequence.length - 1]
  if (drawing && last && end !== undefined) {
    tail.setAttribute('x1', String(DOT_CENTER[end]!.x))
    tail.setAttribute('y1', String(DOT_CENTER[end]!.y))
    tail.setAttribute('x2', String(last.x))
    tail.setAttribute('y2', String(last.y))
    tail.setAttribute('visibility', 'visible')
  } else {
    tail.setAttribute('visibility', 'hidden')
  }
}

function scheduleDraw(): void {
  if (!frame) frame = requestAnimationFrame(draw)
}

function add(hits: number[]): void {
  for (const dot of withPassThrough(sequence, hits)) {
    sequence.push(dot)
    dots[dot]?.classList.add('on')
    haptic('small')
  }
}

function reset(): void {
  if (failTimer) clearTimeout(failTimer)
  failTimer = null
  sequence = []
  drawing = false
  last = null
  elOf(gridRef.value)?.classList.remove('error')
  for (const d of dots) d?.classList.remove('on')
  scheduleDraw()
}

function onPointerDown(e: PointerEvent): void {
  if (props.disabled || (e.pointerType === 'mouse' && e.button !== 0)) return
  const grid = elOf(gridRef.value)
  if (!grid) return
  e.preventDefault()
  reset()
  // Палец ушёл за край поля — движения всё равно идут сюда.
  try {
    grid.setPointerCapture(e.pointerId)
  } catch {
    /* указатель уже отпущен */
  }
  pointerId = e.pointerId
  rect = grid.getBoundingClientRect()
  drawing = true
  last = toGrid(e)
  add(hitsAlong(last, last, sequence))
  scheduleDraw()
}

function onPointerMove(e: PointerEvent): void {
  if (!drawing || e.pointerId !== pointerId || !last) return
  // Промежуточные положения, которые браузер склеил в одно событие, — чтобы
  // быстрый росчерк не срезал угол мимо точки.
  const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : []
  for (const ev of events.length ? events : [e]) {
    const next = toGrid(ev)
    add(hitsAlong(last, next, sequence))
    last = next
  }
  scheduleDraw()
}

function finish(e: PointerEvent, cancelled: boolean): void {
  if (!drawing || e.pointerId !== pointerId) return
  drawing = false
  pointerId = null
  scheduleDraw()
  if (cancelled || sequence.length === 0) {
    reset()
    return
  }
  emit('complete', [...sequence])
}

function onPointerUp(e: PointerEvent): void {
  finish(e, false)
}

function onPointerCancel(e: PointerEvent): void {
  finish(e, true)
}

/** Неверный ключ: линия и точки краснеют и гаснут. */
function fail(): void {
  elOf(gridRef.value)?.classList.add('error')
  haptic('strong')
  if (failTimer) clearTimeout(failTimer)
  failTimer = setTimeout(reset, 600)
}

function clear(): void {
  reset()
}

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame)
  if (failTimer) clearTimeout(failTimer)
})

defineExpose({ fail, clear })
</script>
