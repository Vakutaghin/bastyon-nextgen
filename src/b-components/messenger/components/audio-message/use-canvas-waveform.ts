/**
 * Waveform голосового сообщения на обычном 2D-canvas: приглушённая «фоновая»
 * волна и акцентная «прогресс»-волна поверх. Ширина баров фиксирована, их количество
 * подбирается под актуальную ширину контейнера (как в Telegram/WhatsApp).
 *
 * Раньше это рисовал PIXI, то есть КАЖДОЕ аудио-сообщение поднимало свой
 * WebGL-контекст. Браузер держит их около 16 штук: в переписке с десятком
 * голосовых старые контексты терялись, волны гасли, а память утекала (N20).
 * Рисунок здесь — скруглённые прямоугольники, для них WebGL не нужен.
 */
import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

// Canvas не понимает var(--…): цвета темы берём из вычисленных стилей
// контейнера при каждой отрисовке, фолбэки — светлая тема.
const BAR_BG_FALLBACK = '#cad5e2'
const BAR_PROGRESS_FALLBACK = '#00c16a'

function themeColor(el: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback
}
const TARGET_BAR_WIDTH = 2
const TARGET_BAR_SPACING = 2

export interface CanvasWaveform {
  container: Ref<{ $el?: HTMLElement } | HTMLElement | null>
  setBars: (bars: number[]) => void
  redraw: () => void
}

export interface CanvasWaveformOptions {
  barCount: number
  currentTime: Ref<number>
  duration: Ref<number>
}

function resolveDom(el: unknown): HTMLElement | null {
  if (!el) return null
  if (el instanceof HTMLElement) return el
  const wrapped = el as { $el?: unknown }
  if (wrapped.$el instanceof HTMLElement) return wrapped.$el
  return null
}

/** roundRect есть не везде (старые WebView) — тогда рисуем обычный прямоугольник. */
function barPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath()
  const rounded = ctx as CanvasRenderingContext2D & {
    roundRect?: (x: number, y: number, w: number, h: number, r: number) => void
  }
  if (typeof rounded.roundRect === 'function') rounded.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
  ctx.fill()
}

export function useCanvasWaveform(opts: CanvasWaveformOptions): CanvasWaveform {
  const { barCount, currentTime, duration } = opts

  const container = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
  const waveformBars = ref<number[]>(Array.from({ length: barCount }, () => 0.12))

  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let resizeObserver: ResizeObserver | null = null

  function setBars(bars: number[]): void {
    waveformBars.value = bars
    redraw()
  }

  /** Подгоняет размер буфера под CSS-размер контейнера с учётом DPR. */
  function syncSize(dom: HTMLElement): { width: number; height: number } | null {
    if (!canvas) return null
    const width = Math.max(0, Math.floor(dom.clientWidth))
    const height = Math.max(0, Math.floor(dom.clientHeight))
    if (width === 0 || height === 0) return null
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const bufferW = Math.floor(width * dpr)
    const bufferH = Math.floor(height * dpr)
    if (canvas.width !== bufferW || canvas.height !== bufferH) {
      canvas.width = bufferW
      canvas.height = bufferH
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    return { width, height }
  }

  function redraw(): void {
    const dom = resolveDom(container.value)
    if (!dom || !ctx) return
    const size = syncSize(dom)
    if (!size) return
    const { width, height } = size

    ctx.clearRect(0, 0, width, height)

    const sourceBars = waveformBars.value
    if (sourceBars.length === 0) return

    const barBgColor = themeColor(dom, '--ui-border-accented', BAR_BG_FALLBACK)
    const barProgressColor = themeColor(dom, '--ui-primary', BAR_PROGRESS_FALLBACK)

    let barWidth = TARGET_BAR_WIDTH
    let spacing = TARGET_BAR_SPACING
    const step = TARGET_BAR_WIDTH + TARGET_BAR_SPACING
    let visibleBars = Math.max(1, Math.min(sourceBars.length, Math.floor((width + spacing) / step)))
    const used = visibleBars * TARGET_BAR_WIDTH + (visibleBars - 1) * TARGET_BAR_SPACING
    if (used > width && visibleBars > 1) {
      const ratio = width / used
      barWidth = Math.max(1, TARGET_BAR_WIDTH * ratio)
      spacing = Math.max(0, TARGET_BAR_SPACING * ratio)
    }
    visibleBars = Math.max(1, visibleBars)

    // Down-sample исходных семплов до visibleBars методом max-pooling.
    const sampledBars: number[] = new Array(visibleBars)
    for (let i = 0; i < visibleBars; i += 1) {
      const start = Math.floor((i * sourceBars.length) / visibleBars)
      const end = Math.min(
        sourceBars.length,
        Math.ceil(((i + 1) * sourceBars.length) / visibleBars)
      )
      let peak = 0
      for (let j = start; j < end; j += 1) {
        const v = sourceBars[j] ?? 0
        if (v > peak) peak = v
      }
      sampledBars[i] = peak
    }

    const centerY = Math.floor(height / 2)
    const maxBarHeight = Math.max(24, Math.floor(height * 0.7))
    const totalUsed = visibleBars * barWidth + (visibleBars - 1) * spacing
    const startX = Math.max(0, Math.floor((width - totalUsed) / 2))

    const progressRatio = duration.value > 0 ? currentTime.value / duration.value : 0
    const progressCutIndex = Math.floor(progressRatio * visibleBars)
    const partialCut = progressRatio * visibleBars - progressCutIndex
    const radius = Math.min(2, barWidth / 2)

    for (let i = 0; i < visibleBars; i += 1) {
      const value = Math.min(1, Math.max(0, sampledBars[i] ?? 0))
      const barHeight = Math.max(2, Math.floor(maxBarHeight * value))
      const x = startX + i * (barWidth + spacing)
      const yTop = centerY - Math.floor(barHeight / 2)

      ctx.fillStyle = barBgColor
      barPath(ctx, x, yTop, barWidth, barHeight, radius)

      ctx.fillStyle = barProgressColor
      if (i < progressCutIndex) {
        barPath(ctx, x, yTop, barWidth, barHeight, radius)
      } else if (i === progressCutIndex && partialCut > 0) {
        const partialWidth = Math.max(1, Math.floor(barWidth * partialCut))
        barPath(ctx, x, yTop, partialWidth, barHeight, Math.min(radius, partialWidth / 2))
      }
    }
  }

  onMounted(() => {
    const dom = resolveDom(container.value)
    if (!dom) return
    canvas = document.createElement('canvas')
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    ctx = canvas.getContext('2d')
    dom.appendChild(canvas)
    redraw()

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => redraw())
      resizeObserver.observe(dom)
    }
  })

  onBeforeUnmount(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    canvas?.remove()
    canvas = null
    ctx = null
  })

  watch(currentTime, redraw)
  watch(duration, redraw)

  return { container, setBars, redraw }
}
