/**
 * Размер окна чата на компьютере. Окно прижато к правому нижнему углу, поэтому
 * тянется за левый и верхний край и за левый верхний угол. Не меньше исходных
 * 360×500 и не больше 60 % ширины и 80 % высоты окна приложения; на тесном
 * экране побеждает минимум — как было, пока размер не менялся.
 *
 * Размер запоминается на этом устройстве. Окно приложения сузили — чат
 * ужимается, но запомненный размер остаётся и вернётся, когда места снова
 * хватит.
 */

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

export interface WidgetSize {
  width: number
  height: number
}

/** Исходный размер окна — он же наименьший. */
export const WIDGET_MIN_SIZE: Readonly<WidgetSize> = { width: 360, height: 500 }
/** Доля окна приложения, больше которой чат не растягивается. */
export const WIDGET_MAX_SHARE: Readonly<WidgetSize> = { width: 0.6, height: 0.8 }
/** Шаг стрелками на клавиатуре. */
export const WIDGET_KEY_STEP = 20

const STORAGE_KEY = 'bastyon_messenger_widget_size'

/** Размер в пределах: не меньше исходного и не больше доли окна приложения. */
export function clampWidgetSize(size: WidgetSize, viewport: WidgetSize): WidgetSize {
  const maxWidth = Math.max(WIDGET_MIN_SIZE.width, viewport.width * WIDGET_MAX_SHARE.width)
  const maxHeight = Math.max(WIDGET_MIN_SIZE.height, viewport.height * WIDGET_MAX_SHARE.height)
  return {
    width: Math.round(Math.min(Math.max(size.width, WIDGET_MIN_SIZE.width), maxWidth)),
    height: Math.round(Math.min(Math.max(size.height, WIDGET_MIN_SIZE.height), maxHeight)),
  }
}

export function readSavedWidgetSize(): WidgetSize | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<WidgetSize>
    if (Number.isFinite(raw?.width) && Number.isFinite(raw?.height)) {
      return { width: Number(raw.width), height: Number(raw.height) }
    }
  } catch {
    // Хранилище недоступно или запись битая — исходный размер.
  }
  return null
}

function saveWidgetSize(size: WidgetSize | null): void {
  try {
    if (size) localStorage.setItem(STORAGE_KEY, JSON.stringify(size))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Приватный режим: размер проживёт до перезагрузки.
  }
}

/** Какие стороны двигает ручка: левый край — ширину, верхний — высоту. */
export interface ResizeAxes {
  width: boolean
  height: boolean
}

export function useWidgetSize() {
  /** Желаемый размер: что человек выбрал, без учёта нынешнего окна приложения. */
  const wanted = ref<WidgetSize>(readSavedWidgetSize() ?? { ...WIDGET_MIN_SIZE })
  const viewport = reactive<WidgetSize>({ width: window.innerWidth, height: window.innerHeight })
  const size = computed(() => clampWidgetSize(wanted.value, viewport))
  const resizing = ref(false)

  function onViewportResize(): void {
    viewport.width = window.innerWidth
    viewport.height = window.innerHeight
  }
  onMounted(() => window.addEventListener('resize', onViewportResize))
  onBeforeUnmount(() => window.removeEventListener('resize', onViewportResize))

  function set(next: WidgetSize): void {
    wanted.value = clampWidgetSize(next, viewport)
  }

  /** Тянут мышью или пальцем: ручка ловит указатель, пока его не отпустят. */
  function startResize(event: PointerEvent, axes: ResizeAxes): void {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget as HTMLElement
    handle.setPointerCapture?.(event.pointerId)
    const start = { x: event.clientX, y: event.clientY, ...size.value }
    resizing.value = true

    const move = (e: PointerEvent): void => {
      set({
        width: axes.width ? start.width + start.x - e.clientX : start.width,
        height: axes.height ? start.height + start.y - e.clientY : start.height,
      })
    }
    const end = (): void => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
      resizing.value = false
      saveWidgetSize(wanted.value)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }

  /** Стрелки на ручке угла: влево и вверх — больше, вправо и вниз — меньше. */
  function resizeByKey(event: KeyboardEvent): void {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [WIDGET_KEY_STEP, 0],
      ArrowRight: [-WIDGET_KEY_STEP, 0],
      ArrowUp: [0, WIDGET_KEY_STEP],
      ArrowDown: [0, -WIDGET_KEY_STEP],
    }
    const step = delta[event.key]
    if (!step) return
    event.preventDefault()
    set({ width: size.value.width + step[0], height: size.value.height + step[1] })
    saveWidgetSize(wanted.value)
  }

  /** Двойной щелчок по углу — исходный размер. */
  function resetSize(): void {
    wanted.value = { ...WIDGET_MIN_SIZE }
    saveWidgetSize(null)
  }

  return { size, resizing, startResize, resizeByKey, resetSize }
}
