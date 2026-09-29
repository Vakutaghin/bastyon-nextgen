// Composable: плеер под пальцем — как в приложении YouTube. Панель показывает
// и прячет касание, двойное касание сбоку перематывает (touch-gestures),
// удержание включает 2×, свайп вниз выходит из полноэкранного режима.
// Мышь сюда не попадает: её клики и наведение — в use-video-controls.

import { onBeforeUnmount, reactive, ref, watch, type Ref } from 'vue'
import {
  SEEK_CONTINUE_MS,
  TAP_SEEK_STEP,
  TapTracker,
  DOUBLE_TAP_MS,
  tapZone,
} from '../touch-gestures'

/** Панель прячется через столько после последнего касания, пока ролик идёт, мс. */
export const TOUCH_CONTROLS_HIDE_MS = 3000
/** Удержание дольше этого — ускорение 2×, мс. */
export const LONG_PRESS_MS = 500
/** Смещение пальца, после которого это уже не касание, px. */
const TAP_SLOP_PX = 10
/** Свайп вниз длиннее этого выходит из полноэкранного режима, px. */
const SWIPE_EXIT_PX = 60

/** Элементы управления: касание по ним — их нажатие, а не жест по ролику. */
const CONTROL_SELECTOR = '[data-player-control]'

interface TouchControlsOptions {
  isPlaying: Ref<boolean>
  isFullscreen: Ref<boolean>
  /** Жесты работают только у запущенного ролика. */
  isActive: () => boolean
  /** Перемотать на `seconds`; `false` — перематывать нечего. */
  seekBy: (seconds: number) => boolean
  exitFullscreen: () => void
  /** Удержание: `true` — включить 2×, `false` — вернуть скорость. */
  setHoldSpeed: (held: boolean) => void
}

export function useTouchControls(options: TouchControlsOptions) {
  const { isPlaying, isFullscreen, isActive, seekBy, exitFullscreen, setHoldSpeed } = options

  const controlsVisible = ref(false)
  /** Волна перемотки сбоку: сторона, сколько секунд набрано, ключ для перезапуска анимации. */
  const ripple = reactive({ side: null as 'left' | 'right' | null, seconds: 0, key: 0 })
  const holding = ref(false)

  const tracker = new TapTracker()
  let hideTimer: ReturnType<typeof setTimeout> | null = null
  let settleTimer: ReturnType<typeof setTimeout> | null = null
  let rippleTimer: ReturnType<typeof setTimeout> | null = null
  let pressTimer: ReturnType<typeof setTimeout> | null = null
  let press: { id: number; x: number; y: number; moved: boolean } | null = null

  const clearHide = (): void => {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = null
  }

  /** Панель прячется сама только пока ролик идёт; на паузе остаётся, как у YouTube. */
  const scheduleHide = (): void => {
    clearHide()
    if (!isPlaying.value) return
    hideTimer = setTimeout(() => {
      hideTimer = null
      if (isPlaying.value) controlsVisible.value = false
    }, TOUCH_CONTROLS_HIDE_MS)
  }

  const showControls = (): void => {
    controlsVisible.value = true
    scheduleHide()
  }

  const hideControls = (): void => {
    clearHide()
    controlsVisible.value = false
  }

  const toggleControls = (): void => {
    if (controlsVisible.value) hideControls()
    else showControls()
  }

  /** Нажатие на кнопку панели продлевает её показ. */
  const poke = (): void => {
    if (controlsVisible.value) scheduleHide()
  }

  watch(isPlaying, (playing) => {
    // Пауза — панель на экране; запуск — прячется через 3 секунды.
    if (!playing) {
      clearHide()
      if (isActive()) controlsVisible.value = true
    } else if (controlsVisible.value) {
      scheduleHide()
    }
  })

  const seekStep = (dir: -1 | 1): void => {
    if (!seekBy(dir * TAP_SEEK_STEP)) return
    const side = dir > 0 ? 'right' : 'left'
    ripple.seconds = ripple.side === side ? ripple.seconds + TAP_SEEK_STEP : TAP_SEEK_STEP
    ripple.side = side
    ripple.key++
    // Во время перемотки панель не мешает, как у YouTube.
    hideControls()
    if (rippleTimer) clearTimeout(rippleTimer)
    rippleTimer = setTimeout(() => {
      rippleTimer = null
      ripple.side = null
      ripple.seconds = 0
    }, SEEK_CONTINUE_MS)
  }

  const handleTap = (clientX: number, rect: DOMRect): void => {
    const decision = tracker.tap(tapZone(clientX - rect.left, rect.width), Date.now())
    if (decision.kind === 'toggle') {
      toggleControls()
    } else if (decision.kind === 'seek') {
      seekStep(decision.direction)
    } else {
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = setTimeout(() => {
        settleTimer = null
        if (tracker.settle(Date.now())) toggleControls()
      }, DOUBLE_TAP_MS)
    }
  }

  const endPress = (): void => {
    if (pressTimer) clearTimeout(pressTimer)
    pressTimer = null
    if (holding.value) {
      holding.value = false
      setHoldSpeed(false)
    }
    press = null
  }

  const onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch' || !isActive()) return
    if ((event.target as Element | null)?.closest(CONTROL_SELECTOR)) return
    // Второй палец — щипок или прокрутка, не жест по ролику.
    if (press) {
      endPress()
      return
    }
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
    if (isPlaying.value) {
      pressTimer = setTimeout(() => {
        pressTimer = null
        if (!press || press.moved) return
        holding.value = true
        setHoldSpeed(true)
        hideControls()
      }, LONG_PRESS_MS)
    }
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (!press || event.pointerId !== press.id) return
    const dx = event.clientX - press.x
    const dy = event.clientY - press.y
    if (Math.hypot(dx, dy) > TAP_SLOP_PX) {
      press.moved = true
      if (pressTimer) clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  const onPointerUp = (event: PointerEvent): void => {
    if (!press || event.pointerId !== press.id) return
    const wasHolding = holding.value
    const { x, y, moved } = press
    endPress()
    if (wasHolding) return
    const dy = event.clientY - y
    const dx = event.clientX - x
    // Свайп вниз во весь экран — выход, как у YouTube. В ленте вертикальный
    // жест — прокрутка страницы, до нас он доходит отменой касания.
    if (isFullscreen.value && dy > SWIPE_EXIT_PX && Math.abs(dy) > Math.abs(dx) * 1.5) {
      exitFullscreen()
      return
    }
    if (moved) return
    const container = event.currentTarget as HTMLElement | null
    if (container) handleTap(event.clientX, container.getBoundingClientRect())
  }

  const onPointerCancel = (): void => {
    endPress()
  }

  onBeforeUnmount(() => {
    clearHide()
    if (settleTimer) clearTimeout(settleTimer)
    if (rippleTimer) clearTimeout(rippleTimer)
    endPress()
  })

  return {
    controlsVisible,
    ripple,
    holding,
    showControls,
    hideControls,
    poke,
    reset: () => tracker.reset(),
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  }
}
