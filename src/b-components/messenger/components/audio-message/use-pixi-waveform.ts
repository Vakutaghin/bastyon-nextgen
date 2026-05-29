/**
 * PIXI v8 waveform-рендер: серая «фоновая» волна + синяя «прогресс»-волна
 * поверх. Ширина баров фиксирована, количество видимых баров адаптивно подбирается
 * под актуальную ширину контейнера (как в Telegram/WhatsApp).
 *
 * PIXI v8 `resizeTo` слушает только window resize, не ResizeObserver контейнера —
 * поэтому если родительский пузырь меняется (имя получателя подгрузилось), мы
 * руками синхронизируем размер `app.renderer.resize` перед каждой отрисовкой.
 *
 * См. CODE_AUDIT.md §1.
 */
import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import * as PIXI from 'pixi.js'

const BAR_BG_COLOR = 0xd0d7e2
const BAR_PROGRESS_COLOR = 0x00a4db
const TARGET_BAR_WIDTH = 2
const TARGET_BAR_SPACING = 2

export interface PixiWaveform {
  container: Ref<{ $el?: HTMLElement } | HTMLElement | null>
  setBars: (bars: number[]) => void
  redraw: () => void
}

export interface PixiWaveformOptions {
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

export function usePixiWaveform(opts: PixiWaveformOptions): PixiWaveform {
  const { barCount, currentTime, duration } = opts

  const container = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
  const app = ref<PIXI.Application | null>(null)
  const bgGraphics = ref<PIXI.Graphics | null>(null)
  const progressGraphics = ref<PIXI.Graphics | null>(null)
  const waveformBars = ref<number[]>(Array.from({ length: barCount }, () => 0.12))

  let resizeObserver: ResizeObserver | null = null

  function setBars(bars: number[]): void {
    waveformBars.value = bars
    redraw()
  }

  function redraw(): void {
    if (
      !app.value ||
      !bgGraphics.value ||
      !progressGraphics.value ||
      waveformBars.value.length === 0
    ) {
      return
    }

    // Синхронизируем с фактическим размером dom-элемента перед каждой отрисовкой —
    // PIXI v8 resizeTo не реагирует на layout-изменения родителя.
    const dom = resolveDom(container.value)
    let width = app.value.screen.width
    let height = app.value.screen.height
    if (dom) {
      const realW = Math.max(0, Math.floor(dom.clientWidth))
      const realH = Math.max(0, Math.floor(dom.clientHeight))
      if (realW > 0 && realH > 0 && (realW !== width || realH !== height)) {
        try {
          const renderer = app.value.renderer
          if (renderer && typeof renderer.resize === 'function') {
            renderer.resize(realW, realH)
            width = realW
            height = realH
          }
        } catch {
          // ignore
        }
      }
    }

    if (width <= 0 || height <= 0) return

    const sourceBars = waveformBars.value
    const slot = TARGET_BAR_WIDTH + TARGET_BAR_SPACING

    let visibleBars = Math.max(8, Math.floor((width + TARGET_BAR_SPACING) / slot))
    visibleBars = Math.min(visibleBars, sourceBars.length)

    let barWidth = TARGET_BAR_WIDTH
    let spacing = TARGET_BAR_SPACING
    const used = visibleBars * barWidth + (visibleBars - 1) * spacing
    if (used > width) {
      // Очень узкий контейнер — пропорционально ужимаем.
      const ratio = width / used
      barWidth = Math.max(1, TARGET_BAR_WIDTH * ratio)
      spacing = Math.max(0, TARGET_BAR_SPACING * ratio)
    }

    // Down-sample 64 семплов до visibleBars методом max-pooling (peak в каждом сегменте).
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

    bgGraphics.value.clear()
    progressGraphics.value.clear()

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

      bgGraphics.value.roundRect(x, yTop, barWidth, barHeight, radius)
      bgGraphics.value.fill({ color: BAR_BG_COLOR, alpha: 1 })

      if (i < progressCutIndex) {
        progressGraphics.value.roundRect(x, yTop, barWidth, barHeight, radius)
        progressGraphics.value.fill({ color: BAR_PROGRESS_COLOR, alpha: 1 })
      } else if (i === progressCutIndex && partialCut > 0) {
        const partialWidth = Math.max(1, Math.floor(barWidth * partialCut))
        progressGraphics.value.roundRect(
          x,
          yTop,
          partialWidth,
          barHeight,
          Math.min(radius, partialWidth / 2)
        )
        progressGraphics.value.fill({ color: BAR_PROGRESS_COLOR, alpha: 1 })
      }
    }
  }

  async function initPixi(): Promise<void> {
    const dom = resolveDom(container.value)
    if (!dom) return
    const application = new PIXI.Application()
    await application.init({
      resizeTo: dom,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })
    if (!resolveDom(container.value)) {
      application.destroy()
      return
    }
    dom.appendChild(application.canvas)
    const bg = new PIXI.Graphics()
    const prog = new PIXI.Graphics()
    application.stage.addChild(bg)
    application.stage.addChild(prog)
    app.value = application
    bgGraphics.value = bg
    progressGraphics.value = prog

    // Силой синхронизируем размер — при оптимистичном insert компонент монтируется
    // одновременно с layout-расчётами, и application.init() может попасть в 0×0.
    try {
      const w = Math.max(0, Math.floor(dom.clientWidth))
      const h = Math.max(0, Math.floor(dom.clientHeight))
      const renderer = application.renderer
      if (renderer && typeof renderer.resize === 'function' && w > 0 && h > 0) {
        renderer.resize(w, h)
      }
    } catch {
      // ignore
    }

    redraw()
  }

  onMounted(async () => {
    await initPixi()

    const dom = resolveDom(container.value)
    if (dom && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        const a = app.value
        if (a && dom) {
          const w = Math.max(0, Math.floor(dom.clientWidth))
          const h = Math.max(0, Math.floor(dom.clientHeight))
          try {
            const renderer = a.renderer
            if (renderer && typeof renderer.resize === 'function' && w > 0 && h > 0) {
              renderer.resize(w, h)
            }
          } catch {
            // ignore
          }
        }
        redraw()
      })
      resizeObserver.observe(dom)
    }
  })

  onBeforeUnmount(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (app.value) {
      app.value.destroy(true, { children: true, texture: true })
      app.value = null
    }
  })

  // Перерисовываем при смене времени или duration.
  watch(currentTime, redraw)
  watch(duration, redraw)

  return { container, setBars, redraw }
}
